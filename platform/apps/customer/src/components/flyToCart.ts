/**
 * Signature interaction: the item's picture arcs into the basket bar. Uses the Web Animations
 * API (no library), skips itself for people who asked for reduced motion.
 */
export function flyToCart(from: HTMLElement | null): void {
  if (!from || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const target = document.getElementById('cartbar-icon');
  if (!target) return;
  const a = from.getBoundingClientRect();
  const b = target.getBoundingClientRect();
  const ghost = from.cloneNode(true) as HTMLElement;
  Object.assign(ghost.style, {
    position: 'fixed',
    left: `${a.left}px`,
    top: `${a.top}px`,
    width: `${a.width}px`,
    height: `${a.height}px`,
    zIndex: '90',
    pointerEvents: 'none',
    borderRadius: '14px',
  });
  document.body.appendChild(ghost);
  const dx = b.left + b.width / 2 - (a.left + a.width / 2);
  const dy = b.top + b.height / 2 - (a.top + a.height / 2);
  const anim = ghost.animate(
    [
      { transform: 'translate(0,0) scale(1)', opacity: 1 },
      { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 90}px) scale(0.7)`, opacity: 0.95, offset: 0.5 },
      { transform: `translate(${dx}px, ${dy}px) scale(0.2)`, opacity: 0.2 },
    ],
    { duration: 650, easing: 'cubic-bezier(.22,1,.36,1)' },
  );
  anim.onfinish = () => ghost.remove();
}
