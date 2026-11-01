/**
 * Camera photos are several MB; the API accepts ≤ ~300 KB JPEG/PNG/WebP data URLs. Shrink on the
 * phone before upload (also strips EXIF, including GPS, because canvas re-encodes the pixels).
 */
const MAX_CHARS = 400_000;

export async function photoToDataUrl(file: File, maxSide = 720): Promise<string> {
  if (!/^image\/(jpeg|png|webp|heic|heif)$/i.test(file.type) && !file.type.startsWith('image/'))
    throw new Error('not-an-image');
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no-canvas');
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    for (const q of [0.82, 0.7, 0.58, 0.45]) {
      const url = canvas.toDataURL('image/jpeg', q);
      if (url.length <= MAX_CHARS) return url;
    }
    throw new Error('too-big');
  } finally {
    bitmap.close();
  }
}
