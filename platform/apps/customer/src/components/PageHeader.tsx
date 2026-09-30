import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { useI18n } from '@rozbazaar/web';

/** Sticky page header with a big back arrow (46 px box — easy to hit outdoors). */
export function PageHeader(props: {
  title: string;
  back?: string;
  right?: ReactNode;
  step?: { n: number; of: number };
}) {
  const nav = useNavigate();
  const { t } = useI18n();
  return (
    <header className="phead">
      <button
        type="button"
        className="phead__back"
        onClick={() => (props.back ? nav(props.back) : nav(-1))}
        aria-label={t('Back', 'पीछे')}
      >
        ←
      </button>
      <div className="phead__title">
        <h1>{props.title}</h1>
        {props.step ? (
          <div
            className="steps"
            aria-label={t(
              `Step ${props.step.n} of ${props.step.of}`,
              `चरण ${props.step.n} / ${props.step.of}`,
            )}
          >
            {Array.from({ length: props.step.of }, (_, i) => (
              <span key={i} className={i < props.step!.n ? 'is-on' : ''} />
            ))}
          </div>
        ) : null}
      </div>
      {props.right}
    </header>
  );
}
