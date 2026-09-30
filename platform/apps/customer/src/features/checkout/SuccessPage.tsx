import { useEffect } from 'react';
import { Link, Navigate, useLocation } from 'react-router';
import type { CreatedBooking } from '@rozbazaar/shared';
import { pushState, useI18n } from '@rozbazaar/web';
import { useShop } from '../../state/shop';
import { AlertsCard } from '../notifications/PushAlerts';

export default function SuccessPage() {
  const { t } = useI18n();
  const created = useLocation().state as CreatedBooking | null;
  const { clearCart, setNote } = useShop();
  useEffect(() => {
    if (!created?.code) return;
    clearCart();
    setNote('');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once for this booking
  }, [created?.code]);
  if (!created?.code) return <Navigate to="/orders" replace />;
  return (
    <div className="success">
      <div className="success__check" aria-hidden>
        ✓
      </div>
      <h1 className="rv d1">{t('Booking confirmed! 🎉', 'बुकिंग पक्की हो गई! 🎉')}</h1>
      <span className="rb-pill rb-pill--g rv d2">{created.code}</span>
      {created.deliveryOtp ? (
        <div className="otpbox rv d3">
          <small>{t('Give this code to the vendor at your door', 'दरवाज़े पर वेंडर को यह कोड बताएँ')}</small>
          <b aria-label={created.deliveryOtp.split('').join(' ')}>{created.deliveryOtp}</b>
        </div>
      ) : null}
      {pushState() === 'granted' ? (
        <p className="rb-muted rv d4">
          {t('We will notify you when the vendor is on the way.', 'वेंडर के निकलते ही आपको सूचना मिलेगी।')}
        </p>
      ) : (
        <div className="rv d4">
          <AlertsCard />
        </div>
      )}
      <div className="success__actions rv d5">
        <Link to="/orders" className="rb-btn rb-btn--primary rb-btn--block">
          <span>{t('View my order', 'मेरा ऑर्डर देखें')}</span>
        </Link>
        <Link to="/" className="rb-btn rb-btn--ghost rb-btn--block">
          <span>{t('Back to home', 'होम पर जाएँ')}</span>
        </Link>
      </div>
    </div>
  );
}
