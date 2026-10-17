import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { useI18n } from '@rozbazaar/web';

/** Screen header with the big back arrow (46 px box, 30 px arrow — as in the old app). */
export function TopBar(props: { title: string; sub?: string | null; back?: string; right?: ReactNode }) {
  const { t } = useI18n();
  const nav = useNavigate();
  return (
    <header className="topbar">
      <button
        type="button"
        className="topbar__bk"
        aria-label={t('Back', 'वापस')}
        onClick={() => (props.back ? nav(props.back) : nav(-1))}
      >
        ←
      </button>
      <div className="topbar__t">
        <h1>{props.title}</h1>
        {props.sub ? <p>{props.sub}</p> : null}
      </div>
      {props.right}
    </header>
  );
}
