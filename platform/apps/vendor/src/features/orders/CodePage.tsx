import { useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { useMutation } from '@tanstack/react-query';
import { ApiError, Button, rupees, Sheet, Spinner, useI18n, useToast } from '@rozbazaar/web';
import { api } from '../../api/client';
import { TopBar } from '../../components/TopBar';
import { orderTotal, phaseOf } from '../../lib/status';
import { useOrder } from './useOrder';

/** The customer reads out their 4-digit code — the final proof the order reached them. */
export default function CodePage() {
  const { t } = useI18n();
  const toast = useToast();
  const nav = useNavigate();
  const { q, order, base, refresh } = useOrder();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [help, setHelp] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const verify = useMutation({
    mutationFn: () => api.post(`/v1/vendor/orders/${order!.id}/verify`, { otp: code }),
    onSuccess: () => {
      toast.show(t('Delivered ✓ Well done!', 'डिलीवर ✓ शाबाश!'), 'good');
      nav('/', { replace: true });
      void refresh();
    },
    onError: (e) => {
      setCode('');
      input.current?.focus();
      setError(
        e instanceof ApiError && e.status === 429
          ? t(
              'Too many wrong codes. Ask the customer to read it again, then wait a few minutes.',
              'बहुत बार ग़लत कोड। ग्राहक से फिर से पढ़वाएँ और कुछ मिनट रुकें।',
            )
          : e instanceof ApiError && e.status === 422
            ? t('That code is wrong. Ask them to read it again.', 'कोड ग़लत है। उनसे फिर से पढ़वाएँ।')
            : e.message,
      );
    },
  });

  // Verified: we are on our way home. Don't let the refreshed "delivered" status trigger the
  // guard below, which would override that navigation with a redirect to the order.
  if (verify.isSuccess) return <Spinner />;
  if (q.isPending) return <Spinner />;
  if (!order) return <Navigate to="/" replace />;
  if (phaseOf(order.status) !== 'paid') return <Navigate to={base} replace />;

  return (
    <div className="page page--cream page--bar">
      <TopBar
        title={t('Confirm the delivery', 'डिलीवरी कन्फ़र्म करो')}
        sub={t('ask them to read out the code', 'उनसे कोड पढ़ने को कहो')}
        back={base}
      />
      <div className="wrap">
        <div className="paycard paycard--dark rv d1">
          <small>{t('PAYMENT RECEIVED', 'पेमेंट मिला')}</small>
          <b>{rupees(order.payAmount ?? orderTotal(order))}</b>
          <span>
            {order.customerName} · {order.code}
          </span>
        </div>
        <div className="note note--blue">
          <span aria-hidden>📱</span>
          <span>
            {t(
              'The customer has a 4-digit code on their phone. Ask them for it and type it here — that confirms the order reached them.',
              'ग्राहक के फ़ोन पर 4 अंकों का कोड है। उनसे पूछकर यहाँ लिखें — इससे पक्का होता है कि ऑर्डर उन तक पहुँचा।',
            )}
          </span>
        </div>
        <label className={`otp ${error ? 'is-bad' : ''}`} onClick={() => input.current?.focus()}>
          <span className="rb-sr">{t('Delivery code', 'डिलीवरी कोड')}</span>
          <input
            ref={input}
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{4}"
            maxLength={4}
            value={code}
            autoFocus
            onChange={(e) => {
              setCode(e.target.value.replace(/\D/g, '').slice(0, 4));
              setError(null);
            }}
          />
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={`otp__box ${i === code.length ? 'is-cur' : ''}`} aria-hidden>
              {code[i] ?? ''}
            </span>
          ))}
        </label>
        {error ? (
          <p className="otp__err" role="alert">
            {error}
          </p>
        ) : null}
        <Button block variant="secondary" onClick={() => setHelp(true)} style={{ marginTop: 18 }}>
          {t('Customer cannot find the code?', 'ग्राहक को कोड नहीं मिल रहा?')}
        </Button>
      </div>
      <div className="stickybar">
        <div className="stickybar__in">
          <Button
            block
            loading={verify.isPending}
            disabled={code.length !== 4}
            onClick={() => verify.mutate()}
          >
            {t('Confirm delivery', 'डिलीवरी कन्फ़र्म करो')}
          </Button>
        </div>
      </div>
      {help ? (
        <Sheet open onClose={() => setHelp(false)} title={t('Where is the code?', 'कोड कहाँ है?')}>
          <ol className="helplist">
            <li>{t('Open the RozBazaar app or rozbazaar.shop', 'RozBazaar ऐप या rozbazaar.shop खोलें')}</li>
            <li>{t('Tap “Orders” at the bottom', 'नीचे “ऑर्डर” दबाएँ')}</li>
            <li>
              {t('The 4-digit delivery code is on this order', 'इस ऑर्डर पर 4 अंकों का डिलीवरी कोड है')}
            </li>
          </ol>
          <p className="rb-muted">
            {t(
              'Still stuck? Call RozBazaar — the order stays safe until then.',
              'फिर भी दिक्कत? RozBazaar को फ़ोन करें — तब तक ऑर्डर सुरक्षित है।',
            )}
          </p>
        </Sheet>
      ) : null}
    </div>
  );
}
