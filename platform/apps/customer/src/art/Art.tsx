import { useMemo, useState } from 'react';
import { ART } from './drawings';

let n = 0;

/**
 * An item's picture: the vendor's / catalogue photo, else the hand-drawn illustration, else an
 * emoji. A photo that fails to load falls back to the drawing (as in the original app).
 * The drawings are our own constant SVG strings (art/drawings.ts), never user content, so
 * rendering them inline is safe — and the original CSS sizes `svg` inside these boxes.
 */
export function Art({
  photo,
  artKey,
  em,
  alt,
}: {
  photo?: string | null;
  artKey?: string | null;
  em?: string;
  alt?: string;
}) {
  const [failed, setFailed] = useState(false);
  const svg = useMemo(() => {
    const sv = artKey ? ART[artKey] : undefined;
    if (!sv) return null;
    // Gradient ids are page-global: scope them per picture so two tomatoes don't share one.
    const u = `_${n++}`;
    return sv
      .replace(/id="([a-z]\d+[a-z]?)"/g, (_m, g: string) => `id="${g}${u}"`)
      .replace(/url\(#([a-z]\d+[a-z]?)\)/g, (_m, g: string) => `url(#${g}${u})`);
  }, [artKey]);

  if (photo && !failed)
    return (
      <img
        src={photo}
        alt={alt ?? ''}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
      />
    );
  if (svg)
    return (
      // eslint-disable-next-line no-restricted-syntax -- constant, app-owned SVG drawings (see comment above)
      <span className="artsvg" dangerouslySetInnerHTML={{ __html: svg }} />
    );
  return <span className="emfall">{em || '🥬'}</span>;
}
