import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/** Bottom sheet dialog: focus moves in, Esc / backdrop close, focus returns when it closes. */
export function Sheet(props: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const { open, onClose } = props;

  useEffect(() => {
    if (!open) return;
    const before = document.activeElement as HTMLElement | null;
    const t = window.setTimeout(() => panel.current?.focus(), 20);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab' && panel.current) {
        const f = panel.current.querySelectorAll<HTMLElement>(
          'button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])',
        );
        if (!f.length) return;
        const first = f[0]!,
          last = f[f.length - 1]!;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      before?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div
      className="rb-sheet-wrap"
      role="presentation"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="rb-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        ref={panel}
      >
        <div className="rb-sheet__grab" aria-hidden />
        <div className="rb-sheet__head">
          <h2 id={titleId}>{props.title}</h2>
          <button type="button" className="rb-sheet__x" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="rb-sheet__body">{props.children}</div>
        {props.footer ? <div className="rb-sheet__foot">{props.footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}
