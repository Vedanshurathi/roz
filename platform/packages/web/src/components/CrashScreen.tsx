import { useI18n } from '../i18n.js';

/** Shown instead of a raw stack trace if a screen crashes. Reloading fetches the latest build. */
export function CrashScreen() {
  const { t } = useI18n();
  return (
    <div className="rb-center" role="alert" style={{ minHeight: '80vh', textAlign: 'center' }}>
      <div style={{ fontSize: 46 }} aria-hidden>
        😕
      </div>
      <h2>{t('Something went wrong', 'कुछ गड़बड़ हो गई')}</h2>
      <p className="rb-muted">
        {t(
          'Please reload. If it keeps happening, tell RozBazaar.',
          'कृपया दोबारा खोलें। बार-बार हो तो RozBazaar को बताएँ।',
        )}
      </p>
      <button type="button" className="rb-btn rb-btn--primary" onClick={() => window.location.assign('/')}>
        <span>{t('Reload', 'दोबारा खोलें')}</span>
      </button>
    </div>
  );
}
