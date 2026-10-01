import { useEffect, useState } from 'react';
import { pushState, useI18n } from '@rozbazaar/web';
import { api } from '../api/client';
import { useSession } from '../api/queries';
import { IN_APP, geoState, getPreciseLocation, unblockHow } from '../lib/geo';
import { savePush, useAskNotif } from '../state/push';
import { useUI } from '../state/ui';

type Ok = true | false | 'warn' | null;
interface Fix {
  ok?: boolean;
  busy?: boolean;
  acc?: number;
  msg: string;
}

/**
 * "Check notifications & location": on the person's own phone, what is on/off and why — app vs
 * browser, notification permission, background service, saved for alerts, location + a real GPS
 * test, and a test notification whose delivery is read back from the server.
 */
export function CheckSheet() {
  const { t } = useI18n();
  const ui = useUI();
  const loggedIn = Boolean(useSession().data?.authenticated);
  const askNotif = useAskNotif();
  const [notif, setNotif] = useState<string>('default');
  const [sw, setSw] = useState<boolean | null>(null);
  const [sub, setSub] = useState<true | string | null>(null);
  const [geo, setGeo] = useState<string>('prompt');
  const [fix, setFix] = useState<Fix | null>(null);
  const [test, setTest] = useState<{ ok: Ok; msg: string } | null>(null);

  async function run() {
    const n = pushState();
    setNotif(n);
    setGeo(await geoState());
    try {
      const r = await navigator.serviceWorker?.getRegistration('/');
      setSw(Boolean(r && (r.active || r.waiting || r.installing)));
    } catch {
      setSw(false);
    }
    if (!loggedIn) return;
    if (n !== 'granted')
      return setSub(t('Needs notification permission first', 'पहले सूचना की अनुमति चाहिए'));
    try {
      await savePush();
      setSub(true);
    } catch (e) {
      setSub(t('Could not subscribe: ', 'सब्सक्राइब नहीं हुआ: ') + ((e as Error).message || ''));
    }
  }
  useEffect(() => {
    if (ui.checkOpen) void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run each time it opens
  }, [ui.checkOpen]);

  async function ckGeo() {
    setFix({
      busy: true,
      msg: t(
        'Finding you… (up to 20 s, stand near a window)',
        'लोकेशन ढूँढ रहे हैं… (20 सेकंड तक, खिड़की के पास रहें)',
      ),
    });
    try {
      const p = await getPreciseLocation(undefined, 20000, 30);
      const a = Math.round(p.coords.accuracy);
      setFix({ ok: true, acc: a, msg: t(`Found — accuracy ±${a} m`, `मिल गई — ±${a} मी`) });
      try {
        localStorage.setItem('rb_geo_ok', '1');
      } catch {
        /* storage blocked */
      }
    } catch (err) {
      const code = (err as { code?: number })?.code;
      setFix({
        ok: false,
        msg:
          code === 1
            ? t('Permission denied. ', 'अनुमति नहीं मिली। ') + unblockHow('geo', t)
            : code === 2
              ? t(
                  'Phone could not get a position — turn on Location (GPS) in the top bar',
                  'फ़ोन को लोकेशन नहीं मिली — ऊपर की पट्टी से लोकेशन (GPS) चालू करें',
                )
              : code === 3
                ? t(
                    'Timed out — turn on Location (GPS), go near a window and try again',
                    'समय खत्म — लोकेशन (GPS) चालू करें, खिड़की के पास जाकर फिर कोशिश करें',
                  )
                : t('Location not available here', 'यहाँ लोकेशन उपलब्ध नहीं'),
      });
    }
    setGeo(await geoState());
  }

  async function ckPush() {
    setTest({ ok: null, msg: t('Sending…', 'भेज रहे हैं…') });
    try {
      const r = await api.post<{ id: string; devices: number }>('/v1/customer/push/test');
      if (!r.devices)
        return setTest({
          ok: false,
          msg: t(
            'No phone saved for alerts yet — allow notifications first',
            'अभी कोई फ़ोन सेव नहीं — पहले सूचनाएँ चालू करें',
          ),
        });
      for (let i = 0; i < 6; i++) {
        await new Promise((res) => setTimeout(res, 2000));
        const d = await api
          .get<{ sent: number; failed: number; devices: number; delivered: boolean }>(
            `/v1/customer/push/test/${r.id}`,
          )
          .catch(() => null);
        if (!d) continue;
        if (d.delivered)
          return setTest({
            ok: true,
            msg: t(
              'Reached this phone ✔ — did it pop up at the top? If not, see the tip below.',
              'इस फ़ोन पर पहुँची ✔ — क्या ऊपर दिखी? नहीं तो नीचे की सलाह देखें।',
            ),
          });
        if (d.sent || d.failed)
          setTest({
            ok: d.sent > 0 ? 'warn' : false,
            msg:
              d.sent > 0
                ? t(
                    `Sent to ${d.sent} of ${d.devices} device(s), waiting for the phone…`,
                    `भेज दी (${d.sent}/${d.devices}), फ़ोन का इंतज़ार…`,
                  )
                : t(
                    `Sending failed on all ${d.devices} device(s) — tap Allow notifications again`,
                    `सब ${d.devices} डिवाइस पर फ़ेल — फिर से सूचनाएँ चालू करें`,
                  ),
          });
      }
      setTest((cur) =>
        cur?.ok === true
          ? cur
          : {
              ok: false,
              msg: t(
                'Sent, but this phone did not confirm it. Check the phone settings tip below.',
                'भेज दी, पर फ़ोन से पुष्टि नहीं आई। नीचे फ़ोन सेटिंग की सलाह देखें।',
              ),
            },
      );
    } catch (e) {
      setTest({ ok: false, msg: (e as Error).message || t('Could not send', 'नहीं भेज पाए') });
    }
  }

  const row = (ok: Ok, title: string, detail?: string) => (
    <div className="ckrow">
      <div className="ck">{ok === true ? '✅' : ok === false ? '❌' : ok === 'warn' ? '⚠️' : '⏳'}</div>
      <div style={{ minWidth: 0 }}>
        <b>{title}</b>
        {detail ? <span>{detail}</span> : null}
      </div>
    </div>
  );
  const close = () => ui.setCheckOpen(false);
  return (
    <div className={`sheet-wrap ${ui.checkOpen ? 'on' : ''}`} id="checkSheet" style={{ zIndex: 170 }}>
      <div className="sheet-bg" onClick={close} />
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={t('Notifications & location', 'सूचनाएँ और लोकेशन')}
      >
        <div className="sheet-grab" />
        <div className="sheet-hd">
          <div>
            <b>{t('Notifications & location', 'सूचनाएँ और लोकेशन')}</b>
            <span>{t('a quick check of this phone', 'इस फ़ोन की जल्दी जाँच')}</span>
          </div>
          <button className="bk" onClick={close} aria-label={t('Close', 'बंद करें')}>
            ✕
          </button>
        </div>
        <div style={{ padding: '0 16px 26px', maxHeight: '66vh', overflowY: 'auto' }}>
          {row(
            true,
            IN_APP
              ? t('Opened as the RozBazaar app', 'RozBazaar ऐप में खुला')
              : t('Opened in the browser', 'ब्राउज़र में खुला'),
            (navigator.userAgent.match(/Android [\d.]+|iPhone OS [\d_]+|Chrome\/[\d]+/g) ?? []).join(' · '),
          )}
          {row(
            notif === 'granted' ? true : notif === 'default' ? 'warn' : false,
            t('Notification permission', 'सूचना की अनुमति'),
            notif === 'granted'
              ? t('Allowed', 'अनुमति है')
              : notif === 'default'
                ? t(
                    'Not asked yet — tap "Allow notifications" below',
                    'अभी पूछा नहीं — नीचे "सूचनाएँ चालू करें" दबाएँ',
                  )
                : notif === 'denied'
                  ? t('Blocked. ', 'बंद है। ') + unblockHow('notif', t)
                  : t('This browser has no notifications', 'इस ब्राउज़र में सूचनाएँ नहीं'),
          )}
          {row(
            sw,
            t('Background service', 'बैकग्राउंड सर्विस'),
            sw == null
              ? ''
              : sw
                ? t('Running', 'चल रही है')
                : t('Not running — close and reopen the app', 'नहीं चल रही — ऐप बंद करके फिर खोलें'),
          )}
          {loggedIn
            ? row(
                sub == null ? null : sub === true,
                t('This phone saved for alerts', 'यह फ़ोन सूचनाओं के लिए सेव'),
                sub == null ? '' : sub === true ? t('Yes', 'हाँ') : sub,
              )
            : row(
                'warn',
                t('Not logged in', 'लॉगिन नहीं है'),
                t('Log in once so notifications reach this phone', 'लॉगिन करें ताकि सूचनाएँ इस फ़ोन पर आएँ'),
              )}
          {row(
            geo === 'granted' ? true : geo === 'denied' ? false : 'warn',
            t('Location permission', 'लोकेशन की अनुमति'),
            geo === 'granted'
              ? t('Allowed', 'अनुमति है')
              : geo === 'denied'
                ? t('Blocked. ', 'बंद है। ') + unblockHow('geo', t)
                : t(
                    'Not asked yet — tap "Test location" below',
                    'अभी पूछा नहीं — नीचे "लोकेशन जाँचें" दबाएँ',
                  ),
          )}
          {fix
            ? row(
                fix.ok ? ((fix.acc ?? 999) <= 100 ? true : 'warn') : fix.busy ? null : false,
                t('GPS test', 'GPS जाँच'),
                fix.msg,
              )
            : null}
          {test ? row(test.ok, t('Test notification', 'टेस्ट सूचना'), test.msg) : null}
          <div className="ckbtns">
            {notif === 'default' ? (
              <button onClick={() => void askNotif(loggedIn).then(() => setTimeout(() => void run(), 1500))}>
                🔔 {t('Allow notifications', 'सूचनाएँ चालू करें')}
              </button>
            ) : null}
            <button className="sec" onClick={() => void ckGeo()}>
              📍 {t('Test location', 'लोकेशन जाँचें')}
            </button>
            {loggedIn ? (
              <button onClick={() => void ckPush()}>📨 {t('Send me a test', 'मुझे टेस्ट भेजें')}</button>
            ) : null}
          </div>
          <p className="muted" style={{ fontSize: 12, marginTop: 14 }}>
            {IN_APP
              ? t(
                  'If a test shows ✅ here but nothing pops up: Phone Settings → Apps → RozBazaar → Notifications → turn everything on, and Battery → Unrestricted.',
                  'अगर यहाँ ✅ दिखे पर फ़ोन पर कुछ न आए: फ़ोन सेटिंग्स → ऐप्स → RozBazaar → सूचनाएँ → सब चालू करें, और बैटरी → बिना रोक।',
                )
              : t(
                  'If a test shows ✅ here but nothing pops up: Phone Settings → Apps → Chrome → Notifications → turn on.',
                  'अगर यहाँ ✅ दिखे पर फ़ोन पर कुछ न आए: फ़ोन सेटिंग्स → ऐप्स → Chrome → सूचनाएँ → चालू करें।',
                )}
          </p>
        </div>
      </div>
    </div>
  );
}
