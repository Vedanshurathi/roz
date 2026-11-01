import { useNavigate } from 'react-router';
import { useMutation } from '@tanstack/react-query';
import type { Booking } from '@rozbazaar/shared';
import {
  Button,
  EmptyState,
  ItemImage,
  qty,
  rupees,
  slotLabel,
  Spinner,
  useI18n,
  useToast,
} from '@rozbazaar/web';
import { api } from '../../api/client';
import { useProducts } from '../../api/queries';
import { TopBar } from '../../components/TopBar';
import { nameIndex, unitLabel } from '../../lib/names';
import { navigateUrl, orderTotal, phaseOf, type Phase } from '../../lib/status';
import { useOrder } from './useOrder';

const STEPS: Array<{ en: string; hi: string; phases: Phase[] }> = [
  { en: 'Booked', hi: 'बुक हुआ', phases: ['new'] },
  { en: 'On the way', hi: 'रास्ते में', phases: ['way', 'reached'] },
  { en: 'Bill sent', hi: 'बिल भेजा', phases: ['bill', 'disputed'] },
  { en: 'Paid', hi: 'पैसे मिले', phases: ['paid'] },
  { en: 'Delivered', hi: 'डिलीवर', phases: ['done'] },
];

export default function OrderPage() {
  const { t, lang } = useI18n();
  const { q, order, refresh, base } = useOrder();
  const products = useProducts();
  if (q.isPending) return <Spinner />;
  if (!order)
    return (
      <div className="page page--cream">
        <TopBar title={t('Order', 'ऑर्डर')} back="/" />
        <EmptyState icon="🔍" title={t('This order is not in your list', 'यह ऑर्डर आपकी सूची में नहीं है')} />
      </div>
    );
  const names = nameIndex(products.data ?? [], lang);
  const billed = order.finalTotal != null;
  const lines = order.items.filter((i) => !i.removed);

  return (
    <div className="page page--cream page--bar">
      <TopBar
        title={order.customerName ?? t('Customer', 'ग्राहक')}
        sub={`${order.code} · ${slotLabel(order.slot, lang)}`}
        back="/"
      />
      <div className="wrap">
        <div className="card rv d1">
          <div className="addr">
            <span aria-hidden>📍</span>
            <div>
              <b>{order.addressLine}</b>
              {order.addressLine.includes(order.area) ? null : <span>{order.area}</span>}
              {order.landmark ? <em className="lm">{order.landmark}</em> : null}
            </div>
          </div>
          <a
            className="rb-btn btn-blue rb-btn--block"
            href={navigateUrl(order)}
            target="_blank"
            rel="noopener noreferrer"
            style={{ marginTop: 14 }}
          >
            <span>🧭 {t('Navigate on Google Maps', 'Google Maps पर रास्ता')}</span>
          </a>
          <div className="split">
            {order.counterpartPhone ? (
              <a className="rb-btn rb-btn--secondary" href={`tel:+91${order.counterpartPhone}`}>
                <span>📞 {t('Call', 'कॉल')}</span>
              </a>
            ) : null}
            <span className="rb-btn rb-btn--ghost is-static">
              <span>
                🧺 {lines.length} {t('items', 'सामान')}
              </span>
            </span>
          </div>
        </div>

        <Timeline order={order} />

        {order.note ? (
          <div className="note note--blue">
            <span aria-hidden>📝</span>
            <span>
              {t('Customer note: ', 'ग्राहक का नोट: ')}
              {order.note}
            </span>
          </div>
        ) : null}
        {order.status === 'disputed' && order.disputeReason ? (
          <div className="note note--or" role="alert">
            <span aria-hidden>⚠️</span>
            <span>
              {t('Customer says: ', 'ग्राहक कहते हैं: ')}
              {order.disputeReason}
            </span>
          </div>
        ) : null}

        <div className="sechd">
          <h2>{billed ? t('Final items', 'आख़िरी सामान') : t('What they ordered', 'क्या मँगाया है')}</h2>
          <span>
            {lines.length} {t('items', 'सामान')}
          </span>
        </div>
        <div className="card">
          {lines.map((i) => {
            const q2 = i.finalQty ?? i.qty;
            const p = i.finalPrice ?? i.price;
            const name = (i.productId && names.get(i.productId)) || i.name;
            return (
              <div key={i.id} className="irow">
                <ItemImage src={i.imageUrl} name={i.name} size={46} />
                <div className="irow__t">
                  <b>
                    {name}
                    {i.addedAtDoor ? <span className="rb-pill rb-pill--b">{t('added', 'जोड़ा')}</span> : null}
                  </b>
                  <span>
                    {qty(q2)} × {unitLabel(i.unit, lang)} · {rupees(p)}/{unitLabel(i.unit, lang)}
                  </span>
                </div>
                <b className="irow__amt">{rupees(Math.round(q2 * p * 100) / 100)}</b>
              </div>
            );
          })}
          <div className="trow trow--big">
            <div>
              <b>{rupees(orderTotal(order))}</b>
              <small>
                {billed
                  ? t('FINAL — YOU WEIGHED', 'आख़िरी — आपने तोला')
                  : t('ESTIMATE — WEIGH AT THE DOOR', 'अनुमान — घर पर तोलना है')}
              </small>
            </div>
          </div>
        </div>
      </div>
      <ActionBar order={order} base={base} refresh={refresh} />
    </div>
  );
}

function Timeline({ order }: { order: Booking }) {
  const { t } = useI18n();
  const phase = phaseOf(order.status);
  const idx = STEPS.findIndex((s) => s.phases.includes(phase));
  if (idx < 0) return null;
  const at = phase === 'done' ? STEPS.length : idx; // finished: every step ticked
  return (
    <div className="card">
      <ol className="tl" aria-label={t('Order progress', 'ऑर्डर की स्थिति')}>
        {STEPS.map((s, i) => (
          <li
            key={s.en}
            className={i < at ? 'is-done' : i === at ? 'is-now' : ''}
            aria-current={i === at ? 'step' : undefined}
          >
            <span className="tl__d">{i < at ? '✓' : i + 1}</span>
            <small>{t(s.en, s.hi)}</small>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** One big button — whatever the next step is. */
function ActionBar({
  order,
  base,
  refresh,
}: {
  order: Booking;
  base: string;
  refresh: () => Promise<unknown>;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const nav = useNavigate();
  const setStatus = useMutation({
    mutationFn: (status: 'on_the_way' | 'reached') =>
      api.post(`/v1/vendor/orders/${order.id}/status`, { status }),
    onError: (e) => toast.show(e.message, 'bad'),
  });
  const phase = phaseOf(order.status);

  const bar = (el: React.ReactNode) => (
    <div className="stickybar">
      <div className="stickybar__in">{el}</div>
    </div>
  );

  switch (phase) {
    case 'new':
      return bar(
        <Button
          block
          variant="dark"
          loading={setStatus.isPending}
          onClick={() =>
            setStatus.mutate('on_the_way', {
              onSuccess: async () => {
                toast.show(t('Customer told you are coming', 'ग्राहक को बता दिया कि आप आ रहे हैं'), 'good');
                await refresh();
              },
            })
          }
        >
          🛵 {t("I'm on the way", 'रास्ते में हूँ')}
        </Button>,
      );
    case 'way':
      return bar(
        <Button
          block
          className="btn-or"
          loading={setStatus.isPending}
          onClick={() =>
            setStatus.mutate('reached', {
              onSuccess: async () => {
                await refresh();
                nav(`${base}/bill`);
              },
            })
          }
        >
          ⚖️ {t('Reached — make the bill', 'पहुँच गया — बिल बनाओ')}
        </Button>,
      );
    case 'reached':
      return bar(
        <Button block className="btn-or" onClick={() => nav(`${base}/bill`)}>
          ⚖️ {t('Make the bill', 'बिल बनाओ')}
        </Button>,
      );
    case 'disputed':
      return bar(
        <Button block className="btn-or" onClick={() => nav(`${base}/bill`)}>
          ⚖️ {t('Weigh again & re-send the bill', 'दोबारा तोलो और बिल भेजो')}
        </Button>,
      );
    case 'bill':
      return bar(
        <div className="stack stack--tight">
          <Button block onClick={() => nav(`${base}/pay`)}>
            💵 {t('Take payment', 'पेमेंट लो')}
          </Button>
          {order.status === 'bill_final' ? (
            <Button block variant="ghost" onClick={() => nav(`${base}/bill`)}>
              {t('Change the bill', 'बिल बदलें')}
            </Button>
          ) : null}
        </div>,
      );
    case 'paid':
      return bar(
        <Button block variant="dark" onClick={() => nav(`${base}/code`)}>
          🔢 {t('Confirm the delivery code', 'डिलीवरी कोड कन्फ़र्म करो')}
        </Button>,
      );
    case 'done':
      return bar(
        <div className="barinfo barinfo--good">
          <b>✅ {t('Delivered & paid', 'डिलीवर और पेमेंट हो गया')}</b>
          <small>
            {order.payMethod === 'cash' ? t('Cash', 'नकद') : 'UPI'} ·{' '}
            {rupees(order.payAmount ?? orderTotal(order))}
          </small>
        </div>,
      );
    default:
      return bar(
        <div className="barinfo">
          <b>
            {phase === 'missed'
              ? `⏰ ${t('This order was missed', 'यह ऑर्डर छूट गया')}`
              : phase === 'review'
                ? `🔍 ${t('RozBazaar is checking this order', 'RozBazaar इस ऑर्डर की जाँच कर रहा है')}`
                : `❌ ${t('This order was cancelled', 'यह ऑर्डर रद्द हो गया')}`}
          </b>
          <small>{order.cancelReason ?? t('Nothing to do here', 'यहाँ कुछ नहीं करना')}</small>
        </div>,
      );
  }
}
