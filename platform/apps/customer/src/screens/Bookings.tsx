import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import type { Booking } from '@rozbazaar/shared';
import { useI18n } from '@rozbazaar/web';
import { api } from '../api/client';
import { keys, useBookings } from '../api/queries';
import { addrName, prettySlot, stepLbl, stepOf, STEPS, vtype } from '../lib/model';
import { useShop } from '../state/shop';
import { useMe } from '../state/useMe';
import { useToast } from '../ui/Toast';

export default function Bookings() {
  const { t, lang } = useI18n();
  const nav = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const shop = useShop();
  const { loggedIn, pending } = useMe();
  const q = useBookings(loggedIn);
  const list = q.data ?? [];

  function reorder(b: Booking) {
    let n = 0;
    for (const i of b.items) {
      if (i.productId && !i.removed) {
        shop.addOne(i.productId, Math.max(1, Math.round(i.qty)));
        n++;
      }
    }
    if (!n) return toast(t('Those items are not in stock today', 'वह सामान आज स्टॉक में नहीं'));
    nav('/basket');
  }

  async function cancel(b: Booking) {
    const reason = window.prompt(
      t('Why are you cancelling? (vendor will see this)', 'क्यों रद्द कर रहे हैं? (वेंडर को दिखेगा)'),
      '',
    );
    if (reason == null) return;
    if (reason.trim().length < 3) return toast(t('Please write a reason', 'कृपया कारण लिखें'));
    try {
      await api.post(`/v1/customer/bookings/${b.id}/cancel`, { reason: reason.trim() });
      toast(t('Booking cancelled', 'बुकिंग रद्द हो गई'));
      void qc.invalidateQueries({ queryKey: keys.bookings });
    } catch (e) {
      toast((e as Error).message || t('Could not cancel', 'रद्द नहीं हुआ'));
    }
  }

  const statusWord = (b: Booking) =>
    b.status === 'cancelled'
      ? t('Cancelled', 'रद्द')
      : b.status === 'missed'
        ? t('Missed', 'छूट गया')
        : b.status === 'disputed'
          ? t('Under check', 'जाँच में')
          : stepLbl(stepOf(b), t);

  return (
    <div className="scr on" id="s-bookings">
      <div className="topbar">
        <button className="bk" onClick={() => nav('/')} aria-label={t('Back', 'वापस')}>
          ←
        </button>
        <div>
          <h1>{t('My bookings', 'मेरी बुकिंग')}</h1>
          <div className="sub" id="bkSub">
            {q.data ? `${list.length} ${t('bookings', 'बुकिंग')}` : ''}
          </div>
        </div>
      </div>
      <div className="pg" id="bookBody">
        {!pending && !loggedIn ? (
          <div className="empty">
            <div className="ee">📋</div>
            <b>{t('Log in to see your bookings', 'अपनी बुकिंग देखने के लिए लॉगिन करें')}</b>
            <button
              className="bigbtn"
              style={{ marginTop: 20, padding: '14px 28px' }}
              onClick={() => nav('/login')}
            >
              {t('Log in', 'लॉगिन')}
            </button>
          </div>
        ) : q.isPending ? (
          <div className="card">
            <div className="sk" style={{ height: 82 }} />
          </div>
        ) : q.isError ? (
          <div className="empty">
            <div className="ee">😕</div>
            <b>{t('Could not load bookings', 'बुकिंग लोड नहीं हुई')}</b>
            <p>
              {q.error.message ||
                t('Check your connection and try again', 'कनेक्शन देखें और दोबारा कोशिश करें')}
            </p>
            <button
              className="bigbtn"
              style={{ marginTop: 20, padding: '14px 28px' }}
              onClick={() => void q.refetch()}
            >
              {t('Retry', 'दोबारा')}
            </button>
          </div>
        ) : !list.length ? (
          <div className="empty">
            <div className="ee">📋</div>
            <b>{t('No bookings yet', 'कोई बुकिंग नहीं')}</b>
            <p>{t('Book a vendor to get started', 'वेंडर बुक करके शुरू करें')}</p>
            <button
              className="bigbtn"
              style={{ marginTop: 20, padding: '14px 28px' }}
              onClick={() => nav('/slot')}
            >
              {t('Pick a slot', 'स्लॉट चुनें')}
            </button>
          </div>
        ) : (
          list.map((b) => {
            const step = stepOf(b);
            const idx = STEPS.indexOf(step);
            const v = vtype(b.type);
            const closed = b.status === 'cancelled' || b.status === 'missed';
            return (
              <div className="card ocard" key={b.id} data-code={b.code}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                  <span style={{ fontSize: 26 }}>{v.em}</span>
                  <div>
                    <b style={{ fontSize: 15, display: 'block' }}>{lang === 'en' ? v.en : v.hi}</b>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--mut)' }}>
                      {b.code} · 🕖 {prettySlot(b.date, b.slot, t, lang)}
                    </span>
                  </div>
                  <span className={`stp st-${step}`} style={{ marginLeft: 'auto' }}>
                    {statusWord(b)}
                  </span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    gap: 8,
                    alignItems: 'flex-start',
                    background: 'var(--grey)',
                    borderRadius: 12,
                    padding: '11px 13px',
                    marginTop: 12,
                    fontSize: 12.5,
                    fontWeight: 700,
                    color: 'var(--tx2)',
                    lineHeight: 1.45,
                  }}
                >
                  <span>📍</span>
                  <span style={{ minWidth: 0, wordBreak: 'break-word' }}>
                    {addrName(b.addressLabel, t)} · {b.addressLine}
                  </span>
                </div>
                {closed ? (
                  b.cancelReason ? (
                    <p className="muted" style={{ marginTop: 10, fontSize: 12.5 }}>
                      {t('Reason', 'कारण')}: {b.cancelReason}
                    </p>
                  ) : null
                ) : (
                  <div className="track">
                    {STEPS.map((s, i) => (
                      <div className="tnode" key={s}>
                        <div className={`tline ${i < idx ? 'on' : ''}`} />
                        <div className={`tdot ${i <= idx ? 'on' : ''}`}>{i <= idx ? '✓' : ''}</div>
                        <div className="tlbl">{stepLbl(s, t)}</div>
                      </div>
                    ))}
                  </div>
                )}
                {!closed && b.deliveryOtp && step !== 'completed' ? (
                  <div
                    className="otpbox"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 11,
                      background: 'var(--navy)',
                      color: '#fff',
                      borderRadius: 13,
                      padding: '12px 15px',
                      marginTop: 14,
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 1.6, opacity: 0.55 }}>
                        {t('DELIVERY CODE', 'डिलीवरी कोड')}
                      </div>
                      <div
                        style={{ fontFamily: 'var(--disp)', fontSize: 26, fontWeight: 800, letterSpacing: 6 }}
                      >
                        {b.deliveryOtp}
                      </div>
                    </div>
                    <div
                      style={{ fontSize: 11, fontWeight: 700, opacity: 0.6, maxWidth: 118, lineHeight: 1.35 }}
                    >
                      {t('show at the door', 'दरवाज़े पर दिखाएँ')}
                    </div>
                  </div>
                ) : null}
                <div style={{ display: 'flex', gap: 9, marginTop: 13, flexWrap: 'wrap' }}>
                  {b.status === 'bill_final' ? (
                    <button className="btn-g" onClick={() => nav(`/bill/${b.id}`)}>
                      {t('See final bill', 'फ़ाइनल बिल देखें')}
                    </button>
                  ) : null}
                  {(b.status === 'delivered' || b.status === 'completed') && b.ratingStars == null ? (
                    <button className="btn-g" onClick={() => nav(`/rate/${b.id}`)}>
                      {t('Rate the vendor', 'वेंडर को रेटिंग दें')}
                    </button>
                  ) : null}
                  {step === 'completed' || closed ? (
                    <button className="pill" onClick={() => reorder(b)}>
                      {t('Order again', 'फिर से ऑर्डर')}
                    </button>
                  ) : null}
                  {!closed ? (
                    <button
                      className="pill"
                      onClick={() =>
                        b.counterpartPhone
                          ? (window.location.href = `tel:+91${b.counterpartPhone}`)
                          : toast(t('Vendor number not assigned yet', 'वेंडर अभी तय नहीं हुआ'))
                      }
                    >
                      📞 {t('Call vendor', 'वेंडर को कॉल करें')}
                    </button>
                  ) : null}
                  {b.status === 'placed' ? (
                    <button className="pill" onClick={() => void cancel(b)}>
                      {t('Cancel', 'रद्द करें')}
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
