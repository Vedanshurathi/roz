import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { vendorLoginBody, type VendorLoginResult } from '@rozbazaar/shared';
import { ApiError, Button, Field, safeNext, useI18n, useToast } from '@rozbazaar/web';
import { api } from '../../api/client';
import { keys, useSession } from '../../api/queries';
import { googleLoginUrl } from '../../config';
import { loginErrorText } from './authText';

type Problem = 'NOT_REGISTERED' | 'NO_PASSWORD' | null;

export default function LoginPage() {
  const { t, lang, setLang } = useI18n();
  const toast = useToast();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const session = useSession();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [problem, setProblem] = useState<Problem>(null);
  const [error, setError] = useState<string | null>(null);

  // Already logged in (e.g. opened /login from a bookmark): carry on.
  useEffect(() => {
    if (session.data?.user) nav(next, { replace: true });
    else if (session.data?.needsRegistration) nav('/register', { replace: true });
  }, [session.data, nav, next]);

  useEffect(() => {
    if (params.get('error') === 'google')
      toast.show(
        t('Google login did not finish. Please try again.', 'Google लॉगिन पूरा नहीं हुआ। फिर से करें।'),
        'bad',
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, for the redirect back from Google
  }, []);

  const parsed = vendorLoginBody.safeParse({ phone, password });
  const login = useMutation({
    mutationFn: () =>
      api.post<VendorLoginResult>('/v1/vendor/auth/login', vendorLoginBody.parse({ phone, password })),
    onSuccess: async (r) => {
      await qc.invalidateQueries({ queryKey: keys.session });
      void api.put('/v1/vendor/language', { lang }).catch(() => undefined);
      nav(r.needsRegistration ? '/register' : next, { replace: true });
    },
    onError: (e) => {
      const code = e instanceof ApiError ? e.businessCode : undefined;
      if (code === 'NOT_REGISTERED' || code === 'NO_PASSWORD') {
        setProblem(code);
        setError(null);
      } else {
        setProblem(null);
        setError(loginErrorText(e, t));
      }
    },
  });

  return (
    <div className="auth">
      <div className="auth__hero">
        <div className="auth__brand">
          <img src="/brand/mark.png" alt="" width={44} height={44} />
          <b>
            RozBazaar <span>{t('Vendor', 'वेंडर')}</span>
          </b>
          <div className="langsw" role="group" aria-label={t('Language', 'भाषा')}>
            <button type="button" aria-pressed={lang === 'en'} onClick={() => setLang('en')}>
              EN
            </button>
            <button type="button" aria-pressed={lang === 'hi'} onClick={() => setLang('hi')}>
              हिं
            </button>
          </div>
        </div>
        <h1>{t('Your orders, bills and earnings — in one place', 'आपके ऑर्डर, बिल और कमाई — एक जगह')}</h1>
      </div>

      <form
        className="auth__card rv d1"
        onSubmit={(e) => {
          e.preventDefault();
          if (parsed.success) login.mutate();
        }}
        noValidate
      >
        <h2>{t('Log in', 'लॉगिन करें')}</h2>
        <Field
          label={t('Mobile number', 'मोबाइल नंबर')}
          prefix="+91"
          inputMode="numeric"
          autoComplete="tel-national"
          maxLength={14}
          value={phone}
          onChange={(e) => {
            setPhone(e.target.value);
            setProblem(null);
          }}
        />
        <label className="rb-field" htmlFor="f-pw">
          <span className="rb-field__label">{t('Password', 'पासवर्ड')}</span>
          <span className={`rb-field__box ${error ? 'rb-field__box--bad' : ''}`}>
            <input
              id="f-pw"
              type={show ? 'text' : 'password'}
              autoComplete="current-password"
              maxLength={128}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button type="button" className="pwshow" onClick={() => setShow((s) => !s)} aria-pressed={show}>
              {show ? t('Hide', 'छिपाएँ') : t('Show', 'दिखाएँ')}
            </button>
          </span>
          {error ? (
            <span className="rb-field__error" role="alert">
              {error}
            </span>
          ) : null}
        </label>
        <Button type="submit" block loading={login.isPending} disabled={!parsed.success}>
          {t('Log in', 'लॉगिन')}
        </Button>

        {problem ? (
          <div className="note note--or" role="alert">
            <span aria-hidden>{problem === 'NOT_REGISTERED' ? '🛺' : '🔑'}</span>
            <span>
              {problem === 'NOT_REGISTERED'
                ? t(
                    'This number is not a RozBazaar vendor yet. Register with your Google account — it takes 2 minutes.',
                    'यह नंबर अभी RozBazaar वेंडर नहीं है। अपने Google खाते से रजिस्टर करें — 2 मिनट लगेंगे।',
                  )
                : t(
                    'You have not made a password yet. Log in with Google once and the app will ask you to make one.',
                    'आपने अभी पासवर्ड नहीं बनाया। एक बार Google से लॉगिन करें, ऐप पासवर्ड बनवाएगा।',
                  )}
            </span>
          </div>
        ) : null}

        <div className="or">
          <span>{t('or', 'या')}</span>
        </div>
        <a className="rb-btn rb-btn--secondary rb-btn--block" href={googleLoginUrl()}>
          <span>
            <b className="g-logo" aria-hidden>
              G
            </b>{' '}
            {problem === 'NOT_REGISTERED'
              ? t('Register with Google', 'Google से रजिस्टर करें')
              : t('Continue with Google', 'Google से आगे बढ़ें')}
          </span>
        </a>
        <p className="auth__fine">
          {t(
            'Forgot your password? Ask RozBazaar to reset it — it is never sent by SMS.',
            'पासवर्ड भूल गए? RozBazaar से रीसेट करवाएँ — यह कभी SMS पर नहीं आता।',
          )}
        </p>
      </form>
    </div>
  );
}
