import { useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { itemEmoji } from '../emoji.js';

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="rb-center" role="status" aria-live="polite">
      <span className="rb-spinner" aria-hidden />
      {label ? <span className="rb-muted">{label}</span> : <span className="rb-sr">Loading</span>}
    </div>
  );
}

export function EmptyState(props: { icon: string; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="rb-empty">
      <div className="rb-empty__icon" aria-hidden>
        {props.icon}
      </div>
      <h3>{props.title}</h3>
      {props.text ? <p>{props.text}</p> : null}
      {props.action}
    </div>
  );
}

export function ErrorState(props: { message: string; onRetry?: () => void; retryLabel?: string }) {
  return (
    <div className="rb-empty" role="alert">
      <div className="rb-empty__icon" aria-hidden>
        ⚠️
      </div>
      <p>{props.message}</p>
      {props.onRetry ? (
        <button type="button" className="rb-btn rb-btn--secondary" onClick={props.onRetry}>
          <span>{props.retryLabel ?? 'Try again'}</span>
        </button>
      ) : null}
    </div>
  );
}

export function Stars({ value, size = 14 }: { value: number | null; size?: number }) {
  if (value == null || value <= 0) return null;
  return (
    <span className="rb-stars" style={{ fontSize: size }} aria-label={`${value.toFixed(1)} out of 5`}>
      ★ {value.toFixed(1)}
    </span>
  );
}

/** Photo with graceful fallback to an emoji drawing (missing URL or failed load). */
export function ItemImage(props: {
  src: string | null;
  name: string;
  category?: string | null;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const size = props.size ?? 64;
  if (!props.src || failed) {
    return (
      <span
        className="rb-itemimg rb-itemimg--emoji"
        style={{ width: size, height: size, fontSize: size * 0.55 }}
        aria-hidden
      >
        {itemEmoji(props.name, props.category)}
      </span>
    );
  }
  return (
    <img
      className="rb-itemimg"
      src={props.src}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}

export function Stepper(props: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label: string;
}) {
  const { value, onChange, min = 0, max = 99, step = 1 } = props;
  return (
    <div className="rb-stepper" role="group" aria-label={props.label}>
      <button
        type="button"
        onClick={() => onChange(Math.max(min, +(value - step).toFixed(2)))}
        aria-label="Less"
      >
        −
      </button>
      <output aria-live="polite">{value}</output>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, +(value + step).toFixed(2)))}
        aria-label="More"
        disabled={value >= max}
      >
        +
      </button>
    </div>
  );
}

export function Field(
  props: InputHTMLAttributes<HTMLInputElement> & {
    label: string;
    error?: string | null;
    hint?: string;
    prefix?: string;
  },
) {
  const { label, error, hint, prefix, id, ...rest } = props;
  const inputId = id ?? `f-${label.replace(/\W+/g, '-').toLowerCase()}`;
  return (
    <label className="rb-field" htmlFor={inputId}>
      <span className="rb-field__label">{label}</span>
      <span className={`rb-field__box ${error ? 'rb-field__box--bad' : ''}`}>
        {prefix ? <span className="rb-field__prefix">{prefix}</span> : null}
        <input id={inputId} aria-invalid={Boolean(error) || undefined} {...rest} />
      </span>
      {error ? (
        <span className="rb-field__error">{error}</span>
      ) : hint ? (
        <span className="rb-field__hint">{hint}</span>
      ) : null}
    </label>
  );
}

export function Skeleton({ h = 16, w = '100%', r = 10 }: { h?: number; w?: number | string; r?: number }) {
  return <span className="rb-skel" style={{ height: h, width: w, borderRadius: r }} aria-hidden />;
}
