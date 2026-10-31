import { useEffect } from 'react';
import { useI18n } from '@rozbazaar/web';
import { useUI } from '../state/ui';
import { useDetectArea } from '../state/useDetectArea';

/** Asked once per visit, with a reason, after the first screen settles (cold prompts get blocked). */
export function LocAsk() {
  const { t } = useI18n();
  const ui = useUI();
  const detect = useDetectArea();

  useEffect(() => {
    const id = window.setTimeout(async () => {
      if (!navigator.geolocation) return;
      try {
        if (sessionStorage.getItem('rbx.locAsked')) return;
        sessionStorage.setItem('rbx.locAsked', '1');
      } catch {
        /* storage blocked: ask anyway */
      }
      try {
        const st = await navigator.permissions?.query({ name: 'geolocation' });
        if (st?.state === 'granted') return void detect();
        if (st?.state === 'denied') return;
      } catch {
        /* no permissions API */
      }
      ui.setLocAsk(true);
    }, 2600);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per app start
  }, []);

  const dismiss = () => ui.setLocAsk(false);
  return (
    <>
      <div className={`loc-bg ${ui.locAsk ? 'on' : ''}`} onClick={dismiss} />
      <div
        className={`loc-ask ${ui.locAsk ? 'on' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-hidden={!ui.locAsk}
      >
        <div className="la-ico">📍</div>
        <b className="disp">{t('Which village are you in?', 'आप किस गाँव में हैं?')}</b>
        <p>
          {t(
            "Let us use your location and we'll show the right vendor, the right rates and the right slots for your area.",
            'लोकेशन दें, हम आपके इलाके का सही वेंडर, सही रेट और सही स्लॉट दिखा देंगे।',
          )}
        </p>
        <button
          className="bigbtn"
          style={{ width: '100%', marginTop: 18 }}
          onClick={() => {
            dismiss();
            void detect();
          }}
        >
          {t('Use my location', 'मेरी लोकेशन लें')}
        </button>
        <button
          className="ghostbtn"
          style={{ marginTop: 10 }}
          onClick={() => {
            dismiss();
            ui.setAreaOpen(true);
          }}
        >
          {t("I'll pick my village myself", 'मैं खुद गाँव चुनूँगा')}
        </button>
      </div>
    </>
  );
}
