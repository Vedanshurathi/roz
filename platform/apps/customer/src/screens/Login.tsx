import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { useI18n } from '@rozbazaar/web';
import { api } from '../api/client';
import { keys } from '../api/queries';
import { useMe } from '../state/useMe';
import { useToast } from '../ui/Toast';
import { CheckoutBanner } from '../ui/CheckoutBanner';

const PENDING_KEY = 'rb_pending_profile';
function readPending(): { name: string; phone: string } | null {
  try {
    const v = JSON.parse(sessionStorage.getItem(PENDING_KEY) ?? 'null') as {
      name: string;
      phone: string;
    } | null;
    sessionStorage.removeItem(PENDING_KEY);
    return v;
  } catch {
    return null;
  }
}

/**
 * Name + phone first (required), then either Google (verifies the account) or phone only.
 * Phone login has no OTP — founder's decision for face-to-face village delivery.
 */
export default function Login() {
  const { t } = useI18n();
  const nav = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const [params] = useSearchParams();
  const { me, loggedIn, needsProfile } = useMe();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState<'' | 'google' | 'phone'>('');
  const ok = name.trim().length >= 2 && phone.length === 10;

  // Back from Google: the name + number typed before leaving are saved on the account.
  const applied = useRef(false);
  useEffect(() => {
    if (!loggedIn || applied.current) return;
    applied.current = true;
    const pending = readPending();
    if (pending?.name && pending.phone) void saveProfile(pending.name, pending.phone);
    else if (me?.name) setName(me.name);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, when the session lands
  }, [loggedIn]);

  useEffect(() => {
    if (params.get('error') === 'google')
      toast(t('Google sign-in did not finish — try again', 'Google लॉगिन पूरा नहीं हुआ — दोबारा कोशिश करें'));
  }, [params, toast, t]);

  async function saveProfile(n: string, p: string) {
    try {
      await api.put('/v1/customer/profile', { name: n, phone: p });
      await qc.invalidateQueries({ queryKey: keys.session });
      toast(t(`Hello, ${n.split(' ')[0]} 🙏`, `नमस्ते, ${n.split(' ')[0]} 🙏`));
    } catch (e) {
      toast((e as Error).message || t('Could not log in — try again', 'लॉगिन नहीं हुआ — दोबारा कोशिश करें'));
    }
  }

  function check(): boolean {
    if (name.trim().length < 2) {
      toast(t('Your name is required', 'नाम भरना ज़रूरी है'));
      return false;
    }
    if (phone.length !== 10) {
      toast(t('A 10-digit phone number is required', '10 अंकों का नंबर भरना ज़रूरी है'));
      return false;
    }
    return true;
  }

  function google() {
    if (!check()) return;
    setBusy('google');
    try {
      sessionStorage.setItem(PENDING_KEY, JSON.stringify({ name: name.trim(), phone }));
    } catch {
      /* storage blocked — the name/number will be asked again */
    }
    window.location.href = api.url('/v1/customer/auth/google', { returnTo: '/login' });
  }

  async function phoneLogin() {
    if (!check()) return;
    setBusy('phone');
    try {
      if (needsProfile) await api.put('/v1/customer/profile', { name: name.trim(), phone });
      else await api.post('/v1/customer/auth/phone', { name: name.trim(), phone });
      await qc.invalidateQueries({ queryKey: keys.session });
      toast(t(`Hello, ${name.trim().split(' ')[0]} 🙏`, `नमस्ते, ${name.trim().split(' ')[0]} 🙏`));
    } catch (e) {
      toast((e as Error).message || t('Could not log in — try again', 'लॉगिन नहीं हुआ — दोबारा कोशिश करें'));
    } finally {
      setBusy('');
    }
  }

  const gate = ok ? undefined : ({ opacity: 0.45, pointerEvents: 'none' } as const);
  return (
    <div className="scr on" id="s-login">
      <div className="topbar">
        {needsProfile ? null : (
          <button
            className="bk"
            onClick={() => (window.history.length > 1 ? nav(-1) : nav('/'))}
            aria-label={t('Back', 'वापस')}
          >
            ←
          </button>
        )}
        <div>
          <h1>{t('One quick step', 'बस एक कदम')}</h1>
        </div>
      </div>
      <div className="pg" style={{ maxWidth: 440 }}>
        <CheckoutBanner />
        <img
          src="/brand/mark.png"
          alt=""
          style={{
            width: 62,
            height: 62,
            borderRadius: 18,
            background: 'var(--lime-s)',
            padding: 9,
            margin: '8px 0 18px',
          }}
        />
        <p className="muted" style={{ marginBottom: 22 }}>
          {needsProfile
            ? t(
                'Add your name and number so the vendor can reach you.',
                'नाम और नंबर डालें ताकि वेंडर आप तक पहुँच सके।',
              )
            : t(
                'Add your name and number, then verify with Google. Takes ten seconds.',
                'नाम और नंबर डालें, फिर Google से वेरिफ़ाई करें। दस सेकंड लगेंगे।',
              )}
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void phoneLogin();
          }}
        >
          <label className="lbl" htmlFor="inName">
            {t('Your name *', 'आपका नाम *')}
          </label>
          <input
            className="field"
            id="inName"
            autoComplete="name"
            maxLength={60}
            placeholder={t('e.g. Vedanshu', 'जैसे: वेदांशु')}
            style={{ marginBottom: 16 }}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <label className="lbl" htmlFor="inPhone">
            {t('Phone number *', 'फ़ोन नंबर *')}
          </label>
          <div className="phone-box">
            <div className="cc">🇮🇳 +91</div>
            <input
              id="inPhone"
              inputMode="numeric"
              autoComplete="tel-national"
              maxLength={10}
              placeholder="98XXXXXXXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
            />
          </div>

          {needsProfile ? (
            <button
              type="submit"
              className={`bigbtn ${busy ? 'busy' : ''}`}
              style={{ width: '100%', marginTop: 22, ...gate }}
            >
              {t('Continue', 'आगे बढ़ें')}
            </button>
          ) : (
            <>
              <button
                type="button"
                className={`gbtn ${busy === 'google' ? 'busy' : ''}`}
                id="gBtn"
                style={{ marginTop: 22, ...gate }}
                onClick={google}
              >
                <svg viewBox="0 0 48 48" aria-hidden="true">
                  <path
                    fill="#EA4335"
                    d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6.1C12.3 13.2 17.6 9.5 24 9.5z"
                  />
                  <path
                    fill="#4285F4"
                    d="M46.1 24.6c0-1.6-.1-3.1-.4-4.6H24v9.1h12.4c-.5 2.9-2.2 5.3-4.6 7l7.6 5.9c4.4-4.1 6.7-10.1 6.7-17.4z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M10.4 28.7c-.5-1.4-.8-2.9-.8-4.7s.3-3.3.8-4.7l-7.8-6.1C.9 16.5 0 20.1 0 24s.9 7.5 2.6 10.8l7.8-6.1z"
                  />
                  <path
                    fill="#34A853"
                    d="M24 48c6.2 0 11.5-2 15.4-5.6l-7.6-5.9c-2.1 1.4-4.8 2.3-7.8 2.3-6.4 0-11.7-3.7-13.6-9.1l-7.8 6.1C6.5 42.6 14.6 48 24 48z"
                  />
                </svg>
                <span id="gLbl">
                  {busy === 'google'
                    ? t('Connecting to Google…', 'Google से जुड़ रहे हैं…')
                    : t('Verify with Google', 'Google से वेरिफ़ाई करें')}
                </span>
              </button>
              {ok ? null : (
                <p
                  id="gHint"
                  style={{
                    textAlign: 'center',
                    fontSize: 12,
                    fontWeight: 700,
                    color: 'var(--mut)',
                    marginTop: 10,
                  }}
                >
                  {t('Fill in your name and number to enable this', 'इसे चालू करने के लिए नाम और नंबर भरें')}
                </p>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0' }}>
                <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
                <span style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--mut)' }}>{t('OR', 'या')}</span>
                <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
              </div>
              <button
                type="submit"
                className="ghostbtn"
                id="phoneLoginBtn"
                style={{
                  width: '100%',
                  ...(gate ?? (busy === 'phone' ? { opacity: 0.6, pointerEvents: 'none' } : {})),
                }}
              >
                📱 <span>{t('Continue with phone number', 'सिर्फ़ फ़ोन नंबर से आगे बढ़ें')}</span>
              </button>
              <p
                style={{
                  textAlign: 'center',
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'var(--mut)',
                  marginTop: 8,
                }}
              >
                {t('No OTP — just your name and number', 'कोई OTP नहीं — बस नाम और नंबर')}
              </p>
            </>
          )}
        </form>
        <p className="muted" style={{ textAlign: 'center', marginTop: 20, fontSize: 11.5 }}>
          {t(
            "By continuing you agree to RozBazaar's terms. Payment is always direct to the vendor — cash or UPI.",
            'आगे बढ़ने का मतलब है आप RozBazaar की शर्तें मानते हैं। पेमेंट हमेशा सीधे वेंडर को — कैश या UPI।',
          )}
        </p>
      </div>
    </div>
  );
}
