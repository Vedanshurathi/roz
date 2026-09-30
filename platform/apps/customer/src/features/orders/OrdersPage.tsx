import { useState } from 'react';
import { Link } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Booking, BookingStatus } from '@rozbazaar/shared';
import {
  Button,
  dayLabel,
  EmptyState,
  ErrorState,
  rupees,
  slotLabel,
  Spinner,
  useI18n,
  useToast,
} from '@rozbazaar/web';
import { api } from '../../api/client';
import { keys, useBookings, useHome } from '../../api/queries';
import { useShop } from '../../state/shop';
import { nameIndex } from '../catalog/names';
import { BillSheet, CancelSheet, RateSheet } from './sheets';

const STEPS: Array<{ statuses: BookingStatus[]; en: string; hi: string }> = [
  { statuses: ['placed'], en: 'Booked', hi: 'बुक' },
  { statuses: ['on_the_way'], en: 'On the way', hi: 'रास्ते में' },
  { statuses: ['reached', 'bill_final', 'disputed'], en: 'At your door', hi: 'दरवाज़े पर' },
  { statuses: ['bill_approved', 'paid'], en: 'Bill & payment', hi: 'बिल व पैसे' },
  { statuses: ['delivered', 'completed'], en: 'Done', hi: 'पूरा' },
];

function statusText(s: BookingStatus, t: (en: string, hi: string) => string): { text: string; tone: string } {
  switch (s) {
    case 'placed':
      return { text: t('Booked', 'बुक हो गया'), tone: 'b' };
    case 'on_the_way':
      return { text: t('Vendor on the way', 'वेंडर रास्ते में'), tone: 'o' };
    case 'reached':
      return { text: t('Vendor at your door', 'वेंडर दरवाज़े पर'), tone: 'o' };
    case 'bill_final':
      return { text: t('Bill ready — please check', 'बिल तैयार — जाँचें'), tone: 'o' };
    case 'bill_approved':
      return { text: t('Bill approved', 'बिल मंज़ूर'), tone: 'g' };
    case 'paid':
      return { text: t('Paid', 'पैसे दिए'), tone: 'g' };
    case 'delivered':
    case 'completed':
      return { text: t('Delivered', 'पहुँच गया'), tone: 'g' };
    case 'disputed':
      return { text: t('Bill being re-checked', 'बिल फिर से जाँच में'), tone: 'r' };
    case 'cancelled':
      return { text: t('Cancelled', 'रद्द'), tone: 'r' };
    case 'missed':
      return { text: t('Missed', 'छूट गया'), tone: 'r' };
    default:
      return { text: t('Under review', 'जाँच में'), tone: '' };
  }
}

function Tracker({ status }: { status: BookingStatus }) {
  const { t } = useI18n();
  const idx = STEPS.findIndex((s) => s.statuses.includes(status));
  if (idx < 0) return null;
  return (
    <ol className="tracker" aria-label={t('Order progress', 'ऑर्डर की स्थिति')}>
      {STEPS.map((s, i) => (
        <li
          key={s.en}
          className={i < idx ? 'is-done' : i === idx ? 'is-now' : ''}
          aria-current={i === idx ? 'step' : undefined}
        >
          <span aria-hidden />
          <small>{t(s.en, s.hi)}</small>
        </li>
      ))}
    </ol>
  );
}

function OrderCard({
  b,
  names,
  onBill,
  onCancel,
  onRate,
}: {
  b: Booking;
  names: Map<string, string>;
  onBill: () => void;
  onCancel: () => void;
  onRate: () => void;
}) {
  const { t, lang } = useI18n();
  const st = statusText(b.status, t);
  const active = !['delivered', 'completed', 'cancelled', 'missed'].includes(b.status);
  const total = b.finalTotal ?? b.estTotal;
  return (
    <article className={`ocard rb-card ${active ? 'ocard--live' : ''}`}>
      <div className="ocard__top">
        <div>
          <b>
            {dayLabel(b.date, lang)}, {slotLabel(b.slot, lang)}
          </b>
          <small>
            {b.code} · {b.vendorName ?? '—'}
          </small>
        </div>
        <span className={`rb-pill rb-pill--${st.tone}`}>{st.text}</span>
      </div>
      {active ? <Tracker status={b.status} /> : null}
      {active && b.deliveryOtp ? (
        <div className="ocard__otp">
          <span>
            {t('Delivery code — tell the vendor at the door', 'डिलीवरी कोड — दरवाज़े पर वेंडर को बताएँ')}
          </span>
          <b>{b.deliveryOtp}</b>
        </div>
      ) : null}
      <p className="ocard__items">
        {b.items
          .filter((i) => !i.removed)
          .map((i) => (i.productId && names.get(i.productId)) || i.name)
          .join(', ')}
      </p>
      <div className="ocard__total">
        <span>{b.finalTotal != null ? t('Bill', 'बिल') : t('Estimated', 'अनुमानित')}</span>
        <b>{rupees(total)}</b>
      </div>
      <div className="ocard__actions">
        {b.status === 'bill_final' ? (
          <Button onClick={onBill}>{t('Check the bill', 'बिल देखें')}</Button>
        ) : null}
        {b.counterpartPhone && active ? (
          <a className="rb-btn rb-btn--secondary" href={`tel:+91${b.counterpartPhone}`}>
            <span>📞 {t('Call vendor', 'वेंडर को फ़ोन')}</span>
          </a>
        ) : null}
        {b.status === 'placed' ? (
          <Button variant="ghost" onClick={onCancel}>
            {t('Cancel', 'रद्द करें')}
          </Button>
        ) : null}
        {['delivered', 'completed'].includes(b.status) && !b.ratingStars ? (
          <Button variant="secondary" onClick={onRate}>
            ⭐ {t('Rate', 'रेटिंग दें')}
          </Button>
        ) : null}
        {b.ratingStars ? <span className="rb-stars">{'★'.repeat(b.ratingStars)}</span> : null}
      </div>
    </article>
  );
}

export default function OrdersPage() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const qc = useQueryClient();
  const q = useBookings(true);
  const home = useHome(useShop().area, true);
  // Booked items carry the vendor's typed name; show the proper English / Hindi name when we know it.
  const names = nameIndex(home.data?.products ?? [], lang);
  const [bill, setBill] = useState<Booking | null>(null);
  const [cancel, setCancel] = useState<Booking | null>(null);
  const [rate, setRate] = useState<Booking | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: keys.bookings });

  const cancelM = useMutation({
    mutationFn: (v: { id: string; reason: string }) =>
      api.post(`/v1/customer/bookings/${v.id}/cancel`, { reason: v.reason }),
    onSuccess: () => {
      setCancel(null);
      toast.show(t('Order cancelled', 'ऑर्डर रद्द हो गया'), 'good');
      void refresh();
    },
    onError: (e) => toast.show(e.message, 'bad'),
  });
  const rateM = useMutation({
    mutationFn: (v: { id: string; stars: number; comment: string }) =>
      api.post(`/v1/customer/bookings/${v.id}/rating`, { stars: v.stars, comment: v.comment || undefined }),
    onSuccess: () => {
      setRate(null);
      toast.show(t('Thank you!', 'धन्यवाद!'), 'good');
      void refresh();
    },
    onError: (e) => toast.show(e.message, 'bad'),
  });

  return (
    <div className="page">
      <header className="phead phead--plain">
        <h1>{t('My orders', 'मेरे ऑर्डर')}</h1>
      </header>
      <div className="page__body">
        {q.isPending ? (
          <Spinner />
        ) : q.isError ? (
          <ErrorState message={q.error.message} onRetry={() => q.refetch()} />
        ) : !q.data.length ? (
          <EmptyState
            icon="📦"
            title={t('No orders yet', 'अभी कोई ऑर्डर नहीं')}
            action={
              <Link className="rb-btn rb-btn--primary" to="/">
                <span>{t('Book fresh sabzi', 'ताज़ी सब्ज़ी बुक करें')}</span>
              </Link>
            }
          />
        ) : (
          <div className="olist">
            {q.data.map((b, i) => (
              <div key={b.id} className={`rv d${Math.min(6, i + 1)}`}>
                <OrderCard
                  b={b}
                  names={names}
                  onBill={() => setBill(b)}
                  onCancel={() => setCancel(b)}
                  onRate={() => setRate(b)}
                />
              </div>
            ))}
          </div>
        )}
      </div>
      {bill ? (
        <BillSheet
          booking={bill}
          names={names}
          onClose={() => setBill(null)}
          onDone={() => {
            setBill(null);
            void refresh();
          }}
        />
      ) : null}
      {cancel ? (
        <CancelSheet
          onClose={() => setCancel(null)}
          busy={cancelM.isPending}
          onSubmit={(reason) => cancelM.mutate({ id: cancel.id, reason })}
        />
      ) : null}
      {rate ? (
        <RateSheet
          vendor={rate.vendorName}
          busy={rateM.isPending}
          onClose={() => setRate(null)}
          onSubmit={(stars, comment) => rateM.mutate({ id: rate.id, stars, comment })}
        />
      ) : null}
    </div>
  );
}
