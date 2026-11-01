/**
 * Vendor photos are stored in the DB as base64 data URLs. Sending them inline made every
 * catalogue response ~870 KB. Instead the API decodes each photo once, keeps it in a bounded
 * in-memory cache keyed by the hash of its content, and returns a URL. Browsers cache that URL
 * forever (the content hash changes whenever the photo changes).
 */
import { Buffer } from 'node:buffer';
import { sha256Hex } from '../../lib/crypto.js';

export interface StoredImage {
  mime: 'image/jpeg' | 'image/png' | 'image/webp';
  bytes: Buffer;
  hash: string;
}

const DATA_URL = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+=*)$/;

/** Decodes and checks the bytes really are the declared image type (no HTML/SVG smuggling). */
export function decodeImageDataUrl(dataUrl: string): StoredImage | null {
  if (dataUrl.length > 3_000_000) return null;
  const m = DATA_URL.exec(dataUrl);
  if (!m) return null;
  const mime = m[1] as StoredImage['mime'];
  const bytes = Buffer.from(m[2]!, 'base64');
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isPng = bytes.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  const isWebp =
    bytes.subarray(0, 4).toString('latin1') === 'RIFF' && bytes.subarray(8, 12).toString('latin1') === 'WEBP';
  const ok =
    (mime === 'image/jpeg' && isJpeg) || (mime === 'image/png' && isPng) || (mime === 'image/webp' && isWebp);
  if (!ok) return null;
  return { mime, bytes, hash: sha256Hex(bytes, 32) };
}

export class ImageStore {
  private readonly items = new Map<string, StoredImage>();
  private bytes = 0;

  constructor(private readonly maxBytes = 64 * 1024 * 1024) {}

  /** Stores a data URL; returns its content hash, or null when it is not a valid image. */
  put(dataUrl: string): string | null {
    const img = decodeImageDataUrl(dataUrl);
    if (!img) return null;
    if (!this.items.has(img.hash)) {
      this.items.set(img.hash, img);
      this.bytes += img.bytes.length;
      this.evict();
    }
    return img.hash;
  }

  get(hash: string): StoredImage | undefined {
    const img = this.items.get(hash);
    if (img) {
      // LRU: most recently used goes to the end.
      this.items.delete(hash);
      this.items.set(hash, img);
    }
    return img;
  }

  private evict(): void {
    for (const [k, v] of this.items) {
      if (this.bytes <= this.maxBytes) break;
      this.items.delete(k);
      this.bytes -= v.bytes.length;
    }
  }

  get size(): number {
    return this.items.size;
  }
}
