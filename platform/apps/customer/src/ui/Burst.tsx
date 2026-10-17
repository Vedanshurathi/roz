import { useEffect, useRef } from 'react';

/** The success tick with fragments flying outward (the original "burst"). */
export function SuccessRing({ delay = 450 }: { delay?: number }) {
  const ring = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ring.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const cols = ['#7ECB53', '#F2760D', '#FFD814', '#fff', '#4FD873'];
    const parts: HTMLSpanElement[] = [];
    for (let i = 0; i < 10; i++) {
      const s = document.createElement('span');
      s.className = 'burst';
      const a = ((Math.PI * 2) / 10) * i + Math.random() * 0.4;
      const d = 68 + Math.random() * 46;
      s.style.setProperty('--bx', `${Math.cos(a) * d}px`);
      s.style.setProperty('--by', `${Math.sin(a) * d}px`);
      s.style.background = cols[i % cols.length]!;
      s.style.animation = `bst ${0.62 + Math.random() * 0.3}s ${delay / 1000 + i * 0.018}s var(--ez) forwards`;
      el.appendChild(s);
      parts.push(s);
    }
    return () => parts.forEach((p) => p.remove());
  }, [delay]);
  return (
    <div className="suc-ring" ref={ring}>
      <svg viewBox="0 0 52 52" aria-hidden>
        <path d="M13 27 L22 36 L39 17" />
      </svg>
    </div>
  );
}
