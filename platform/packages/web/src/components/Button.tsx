import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'dark';

export function Button({
  variant = 'primary',
  block,
  loading,
  children,
  className,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  block?: boolean;
  loading?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={['rb-btn', `rb-btn--${variant}`, block ? 'rb-btn--block' : '', className ?? '']
        .join(' ')
        .trim()}
    >
      {loading ? <span className="rb-spinner rb-spinner--sm" aria-hidden /> : null}
      <span>{children}</span>
    </button>
  );
}
