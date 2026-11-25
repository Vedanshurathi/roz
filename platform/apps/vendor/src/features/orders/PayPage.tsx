import { Navigate, useNavigate } from 'react-router';
import { useMutation } from '@tanstack/react-query';
import type { PayMethod } from '@rozbazaar/shared';
import { Button, rupees, Spinner, useI18n, useToast } from '@rozbazaar/web';
import { api } from '../../api/client';
import { TopBar } from '../../components/TopBar';
import { orderTotal, phaseOf } from '../../lib/status';
import { useOrder } from './useOrder';

/** The customer pays the vendor directly; the app only records how. */
export default function PayPage() {
  const { t } = useI18n();
  const toast = useToast();
  const nav = useNavigate();
  const { q, order, base, refresh } = useOrder();
  const pay = useMutation({
    mutationFn: (method: PayMethod) =>
      api.post(`/v1/vendor/orders/${order!.id}/payment`, { method, amount: orderTotal(order!) }),
    onSuccess: async () => {
      toast.show(t('Payment recorded — now confirm the code', 'पेमेंट दर्ज — अब कोड कन्फ़र्म करें'), 'good');
      await refresh();
      nav(`${base}/code`, { replace: true });
    },
    onError: (e) => toast.show(e.message, 'bad'),
  });
  if (q.isPending) return <Spinner />;
  if (!order) return <Navigate to="/" replace />;
  if (phaseOf(order.status) === 'paid') return <Navigate to={`${base}/code`} replace />;
  if (phaseOf(order.status) !== 'bill') return <Navigate to={base} replace />;

  return (
    <div className="page page--cream">
      <TopBar
        title={t('Take payment', 'पेमेंट लो')}
        sub={t('cash or UPI, straight to you', 'नकद या UPI, सीधे आपको')}
        back={base}
      />
      <div className="wrap">
        <div className="paycard rv d1">
          <small>{t('FINAL BILL', 'आख़िरी बिल')}</small>
          <b>{rupees(orderTotal(order))}</b>
          <span>
            {order.customerName} · {order.code}
          </span>
          {order.status === 'bill_approved' ? (
            <em className="rb-pill rb-pill--g">
              ✓ {t('Customer approved the bill', 'ग्राहक ने बिल मंज़ूर किया')}
            </em>
          ) : (
            <em className="rb-pill rb-pill--o">
              {t('Customer has not approved yet', 'ग्राहक ने अभी मंज़ूर नहीं किया')}
            </em>
          )}
        </div>
        <h2 className="sech">{t('How did they pay?', 'उन्होंने कैसे दिया?')}</h2>
        <div className="stack">
          <Button
            block
            variant="dark"
            className="btn-xl"
            loading={pay.isPending && pay.variables === 'cash'}
            disabled={pay.isPending}
            onClick={() => pay.mutate('cash')}
          >
            💵 {t('Cash received', 'नकद मिला')}
          </Button>
          <Button
            block
            variant="dark"
            className="btn-xl"
            loading={pay.isPending && pay.variables === 'upi_direct'}
            disabled={pay.isPending}
            onClick={() => pay.mutate('upi_direct')}
          >
            📱 {t('UPI received', 'UPI मिला')}
          </Button>
        </div>
        <div className="note note--or" style={{ marginTop: 16 }}>
          <span aria-hidden>💡</span>
          <span>
            {t(
              'RozBazaar never touches this money. It is yours the moment they hand it over.',
              'RozBazaar इस पैसे को कभी नहीं छूता। हाथ में आते ही ये आपका है।',
            )}
          </span>
        </div>
      </div>
    </div>
  );
}
