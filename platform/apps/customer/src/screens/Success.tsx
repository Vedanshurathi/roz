import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import type { CreatedBooking } from '@rozbazaar/shared';
import { useI18n } from '@rozbazaar/web';
import { useAskNotif } from '../state/push';
import { useMe } from '../state/useMe';
import { SuccessRing } from '../ui/Burst';

export default function Success() {
  const { t } = useI18n();
  const nav = useNavigate();
  const st = useLocation().state as (CreatedBooking & { slotLine: string }) | null;
  const { loggedIn } = useMe();
  const askNotif = useAskNotif();
  const [ask, setAsk] = useState(false);

  // Let the success moment land, then offer alerts (only if the browser hasn't been asked yet).
  useEffect(() => {
    if (!('Notification' in window) || Notification.permission !== 'default') return;
    const id = window.setTimeout(() => setAsk(true), 1400);
    return () => {
      window.clearTimeout(id);
    };
  }, []);

  if (!st?.code) return <Navigate to="/bookings" replace />;
  return (
    <div className="scr on" id="s-success">
      <div className="suc">
        <div className="burst-wrap" style={{ position: 'relative' }}>
          <SuccessRing />
        </div>
        <h1>{t('Booking confirmed! 🎉', 'बुकिंग पक्की हो गई! 🎉')}</h1>
        <p id="sucLine">
          {t(
            `The vendor has been told. See you ${st.slotLine.toLowerCase()}.`,
            `वेंडर को बता दिया गया है — ${st.slotLine}`,
          )}
        </p>
        <div className="idpill" id="sucId">
          {st.code}
        </div>
        <div className="otp-card">
          <span>{t('DELIVERY CODE', 'डिलीवरी कोड')}</span>
          <b id="sucOtp">{st.deliveryOtp ?? '----'}</b>
          <i>{t('Show this to the vendor at your door', 'यह कोड दरवाज़े पर वेंडर को दिखाएँ')}</i>
        </div>
        {ask ? (
          <div
            className="perm"
            id="permNotif"
            style={{ marginTop: 26, maxWidth: 420, textAlign: 'left', display: 'flex' }}
          >
            <span className="pe">🔔</span>
            <div style={{ minWidth: 0 }}>
              <b>{t('Get told when the vendor sets out?', 'वेंडर निकले तो बता दें?')}</b>
              <span>
                {t(
                  'One alert when they leave, one when they reach your street. Nothing else, ever.',
                  'एक सूचना जब वे निकलें, एक जब आपकी गली में पहुँचें। और कुछ नहीं।',
                )}
              </span>
            </div>
            <div className="perm-btns">
              <button className="pill" onClick={() => setAsk(false)}>
                {t('No thanks', 'रहने दें')}
              </button>
              <button
                className="btn-g"
                onClick={() => {
                  setAsk(false);
                  void askNotif(loggedIn);
                }}
              >
                {t('Yes, alert me', 'हाँ, बताएँ')}
              </button>
            </div>
          </div>
        ) : null}
        <div style={{ display: 'flex', gap: 11, marginTop: 24, width: '100%', maxWidth: 400 }}>
          <button className="ghostbtn" onClick={() => nav('/')}>
            {t('Home', 'होम')}
          </button>
          <button className="bigbtn" onClick={() => nav('/bookings')}>
            {t('View booking', 'बुकिंग देखें')}
          </button>
        </div>
      </div>
    </div>
  );
}
