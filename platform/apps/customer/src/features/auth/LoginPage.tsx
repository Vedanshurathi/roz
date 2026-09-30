import { useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { customerPhoneLoginBody, type CustomerProfile } from '@rozbazaar/shared';
import { Button, Field, safeNext, useI18n, useToast } from '@rozbazaar/web';
import { api } from '../../api/client';
import { keys, useSession } from '../../api/queries';
import { PageHeader } from '../../components/PageHeader';

/** Only an in-app path may be used as "next" (no open redirects). */
export default function LoginPage() {
  const { t } = useI18n();
  const toast = useToast();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const session = useSession();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({});

  const login = useMutation({
    mutationFn: (body: { name: string; phone: string }) =>
      api.post<CustomerProfile>('/v1/customer/auth/phone', body),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: keys.session });
      toast.show(t('Welcome to RozBazaar!', 'RozBazaar में स्वागत है!'), 'good');
      nav(next, { replace: true });
    },
    onError: (e) => toast.show(e.message, 'bad'),
  });

  if (session.data?.authenticated) return <Navigate to={next} replace />;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const r = customerPhoneLoginBody.safeParse({ name, phone });
    if (!r.success) {
      const f = r.error.flatten().fieldErrors;
      setErrors({
        name: f.name ? t('Please write your name', 'अपना नाम लिखें') : undefined,
        phone: f.phone
          ? t('Enter a valid 10-digit mobile number', 'सही 10 अंकों का मोबाइल नंबर लिखें')
          : undefined,
      });
      return;
    }
    setErrors({});
    login.mutate(r.data);
  }

  const googleUrl = api.url('/v1/customer/auth/google', { returnTo: next });
  const googleFailed = params.get('error') === 'google';

  return (
    <div className="page">
      <PageHeader title="" back="/" />
      <div className="page__body auth">
        <img src="/brand/mark.png" alt="" width={72} height={60} className="auth__logo rv d1" />
        <h1 className="rv d1">{t('Log in to book', 'बुक करने के लिए लॉगिन करें')}</h1>
        <p className="rb-muted rv d2">
          {t(
            'Your name and number go to the vendor who comes to your door.',
            'आपका नाम और नंबर उसी वेंडर को जाता है जो आपके दरवाज़े पर आएगा।',
          )}
        </p>
        {googleFailed ? (
          <p className="warn">
            {t(
              'Google sign-in did not finish. Please try again.',
              'Google से लॉगिन पूरा नहीं हुआ। फिर कोशिश करें।',
            )}
          </p>
        ) : null}
        <form onSubmit={submit} noValidate className="rv d3">
          <Field
            label={t('Your name', 'आपका नाम')}
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            error={errors.name}
          />
          <Field
            label={t('Mobile number', 'मोबाइल नंबर')}
            prefix="🇮🇳 +91"
            inputMode="numeric"
            autoComplete="tel-national"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            maxLength={14}
            error={errors.phone}
          />
          <Button type="submit" block loading={login.isPending}>
            {t('Continue', 'आगे बढ़ें')}
          </Button>
        </form>
        <div className="or" aria-hidden>
          <span>{t('or', 'या')}</span>
        </div>
        <a className="rb-btn rb-btn--secondary rb-btn--block google" href={googleUrl}>
          <span>G</span>
          <span>{t('Continue with Google', 'Google से जारी रखें')}</span>
        </a>
        <p className="rb-muted terms">
          {t(
            'By continuing you agree to our terms and privacy policy.',
            'आगे बढ़कर आप हमारी शर्तों और प्राइवेसी पॉलिसी से सहमत हैं।',
          )}
        </p>
      </div>
    </div>
  );
}
