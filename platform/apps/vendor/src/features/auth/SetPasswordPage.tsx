import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { passwordSchema } from '@rozbazaar/shared';
import { Button, Field, storage, useI18n, useToast } from '@rozbazaar/web';
import { api } from '../../api/client';
import { useVendor } from '../../app/vendor-context';
import { keys } from '../../api/queries';
import { STORAGE } from '../../config';

/** First app password (only while none exists). Later changes go through admin approval. */
export default function SetPasswordPage() {
  const { t } = useI18n();
  const toast = useToast();
  const nav = useNavigate();
  const qc = useQueryClient();
  const vendor = useVendor();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const check = passwordSchema.safeParse(pw);
  const mismatch = pw2.length > 0 && pw !== pw2;
  const save = useMutation({
    mutationFn: () => api.post('/v1/vendor/password/first', { password: pw }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.password });
      toast.show(
        t(
          'Password saved — use it with your phone number next time',
          'पासवर्ड बन गया — अगली बार फ़ोन नंबर के साथ डालें',
        ),
        'good',
      );
      nav('/', { replace: true });
    },
    onError: (e) => toast.show(e.message, 'bad'),
  });
  return (
    <div className="page page--cream">
      <header className="topbar topbar--plain">
        <div className="topbar__t">
          <h1>{t('Make your password', 'अपना पासवर्ड बनाएँ')}</h1>
          <p>
            {t('Next time: phone', 'अगली बार: फ़ोन')} {vendor?.phone ? `+91 ${vendor.phone}` : ''} +{' '}
            {t('this password', 'यह पासवर्ड')}
          </p>
        </div>
      </header>
      <div className="wrap">
        <div className="card rv d1">
          <Field
            label={t('New password', 'नया पासवर्ड')}
            type="password"
            autoComplete="new-password"
            value={pw}
            maxLength={128}
            onChange={(e) => setPw(e.target.value)}
            hint={t(
              'At least 8 characters, with letters and numbers',
              'कम से कम 8 अक्षर, अक्षर और अंक दोनों',
            )}
            error={
              pw && !check.success
                ? t('Use 8+ characters with letters and numbers', '8+ अक्षर, अक्षर और अंक दोनों रखें')
                : null
            }
          />
          <Field
            label={t('Type it again', 'फिर से लिखें')}
            type="password"
            autoComplete="new-password"
            value={pw2}
            maxLength={128}
            onChange={(e) => setPw2(e.target.value)}
            error={mismatch ? t('The two passwords are different', 'दोनों पासवर्ड अलग हैं') : null}
          />
        </div>
      </div>
      <div className="stickybar stack">
        <Button
          block
          loading={save.isPending}
          disabled={!check.success || pw !== pw2}
          onClick={() => save.mutate()}
        >
          {t('Save password', 'पासवर्ड सेव करें')}
        </Button>
        <Button
          block
          variant="ghost"
          onClick={() => {
            storage.set(STORAGE.passwordLater, true);
            nav('/', { replace: true });
          }}
        >
          {t('Later', 'बाद में')}
        </Button>
      </div>
    </div>
  );
}
