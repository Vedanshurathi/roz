import { useCallback, useEffect, useRef, useState } from 'react';
import { pushState, useI18n } from '@rozbazaar/web';
import { useSession } from '../api/queries';
import { geoState, unblockHow } from '../lib/geo';
import { useAskNotif } from '../state/push';
import { useDetectArea } from '../state/useDetectArea';
import { useUI } from '../state/ui';

const NAG_MS = 2 * 60 * 1000;
type Kind = '' | 'notif' | 'geo' | 'notif-denied' | 'geo-denied';
const seen = (k: string) => {
  try {
    return sessionStorage.getItem('rb_nag_' + k);
  } catch {
    return null;
  }
};

/**
 * Keeps asking (gently) until notifications + location are allowed: shown 9 s after opening and
 * again 2 minutes after it is closed. When the browser has blocked one, it explains how to unblock
 * it (a page cannot re-open that prompt itself).
 */
export function PermBar() {
  const { t } = useI18n();
  const ui = useUI();
  const loggedIn = Boolean(useSession().data?.authenticated);
  const askNotif = useAskNotif();
  const detectArea = useDetectArea();
  const [kind, setKind] = useState<Kind>('');
  const [on, setOn] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const locAskOpen = useRef(ui.locAsk);
  useEffect(() => {
    locAskOpen.current = ui.locAsk;
  }, [ui.locAsk]);

  const nag = useCallback(async () => {
    window.clearTimeout(timer.current);
    if (locAskOpen.current) {
      timer.current = window.setTimeout(() => void nag(), NAG_MS);
      return;
    }
    const n = pushState();
    const g = await geoState();
    let k: Kind = '';
    if (n === 'default') k = 'notif';
    else if (g === 'prompt') k = 'geo';
    else if (n === 'denied' && !seen('notif-denied')) k = 'notif-denied';
    else if (g === 'denied' && !seen('geo-denied')) k = 'geo-denied';
    setKind(k);
    setOn(Boolean(k));
  }, []);

  useEffect(() => {
    timer.current = window.setTimeout(() => void nag(), 9000);
    return () => {
      window.clearTimeout(timer.current);
    };
  }, [nag]);

  function close() {
    setOn(false);
    if (kind.endsWith('denied'))
      try {
        sessionStorage.setItem('rb_nag_' + kind, '1');
      } catch {
        /* storage blocked */
      }
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void nag(), NAG_MS);
  }

  const body =
    kind === 'notif'
      ? {
          pe: '🔔',
          b: t('Know when your vendor is coming', 'वेंडर कब आ रहा है, तुरंत जानें'),
          s: t(
            'Order confirmed, on the way, at your door, complete — right on your phone',
            'ऑर्डर पक्का, रास्ते में, दरवाज़े पर, पूरा — सीधे आपके फ़ोन पर',
          ),
          ok: () => {
            setOn(false);
            void askNotif(loggedIn).then(() => setTimeout(() => void nag(), 4000));
          },
        }
      : kind === 'geo'
        ? {
            pe: '📍',
            b: t('Share your location', 'अपनी लोकेशन दें'),
            s: t(
              'We show your village’s vendor and the vendor finds your door',
              'हम आपके गाँव का वेंडर दिखाएँगे और वेंडर सही दरवाज़े तक पहुँचेगा',
            ),
            ok: () => {
              setOn(false);
              void detectArea().then(() => setTimeout(() => void nag(), 3000));
            },
          }
        : kind === 'notif-denied'
          ? { pe: '🔕', b: t('Notifications are blocked', 'सूचनाएँ बंद हैं'), s: unblockHow('notif', t) }
          : kind === 'geo-denied'
            ? { pe: '📍', b: t('Location is blocked', 'लोकेशन बंद है'), s: unblockHow('geo', t) }
            : null;

  if (!body) return <div className="permbar" id="permBar" />;
  return (
    <div className={`permbar ${on ? 'on' : ''}`} id="permBar" role="region" aria-label={body.b}>
      <span className="pe">{body.pe}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <b>{body.b}</b>
        <span>{body.s}</span>
      </div>
      {'ok' in body && body.ok ? (
        <button className="pok" onClick={body.ok}>
          {t('Allow', 'अनुमति दें')}
        </button>
      ) : null}
      <button className="px" onClick={close} aria-label={t('Close', 'बंद करें')}>
        ✕
      </button>
    </div>
  );
}
