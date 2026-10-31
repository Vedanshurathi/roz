import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { useI18n } from '@rozbazaar/web';
import { api } from '../api/client';
import { keys, useNotifications, useSession } from '../api/queries';
import { when } from '../lib/model';
import { useUI } from '../state/ui';

export const CN_ICON: Record<string, string> = {
  booking_confirmed: '✅',
  booking_on_the_way: '🚚',
  booking_reached: '📍',
  bill_final: '🧾',
  booking_paid: '💵',
  booking_delivered: '🎉',
  booking_missed: '😔',
  booking_pending_review: '🔍',
  cancelled: '❌',
  slot_reminder: '⏰',
  tomorrow_reminder: '🗓️',
  broadcast: '📣',
  booking_status: '🛒',
};

/** 🔔 — order updates, reminders and offers. Opening it marks everything read. */
export function NotifSheet() {
  const { t, lang } = useI18n();
  const ui = useUI();
  const nav = useNavigate();
  const qc = useQueryClient();
  const loggedIn = Boolean(useSession().data?.authenticated);
  const q = useNotifications(loggedIn);
  const list = q.data ?? [];
  const close = () => ui.setNotifsOpen(false);

  useEffect(() => {
    if (!ui.notifsOpen || !loggedIn || !(q.data ?? []).some((n) => !n.isRead)) return;
    void api
      .post('/v1/customer/notifications/read-all')
      .then(() => qc.invalidateQueries({ queryKey: keys.notifications }))
      .catch(() => undefined);
  }, [ui.notifsOpen, loggedIn, q.data, qc]);

  return (
    <div className={`sheet-wrap ${ui.notifsOpen ? 'on' : ''}`} id="notifSheet" style={{ zIndex: 160 }}>
      <div className="sheet-bg" onClick={close} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={t('Notifications', 'सूचनाएँ')}>
        <div className="sheet-grab" />
        <div className="sheet-hd">
          <div>
            <b>{t('Notifications', 'सूचनाएँ')}</b>
            <span>{t('order updates, reminders and offers', 'ऑर्डर की जानकारी, रिमाइंडर और ऑफ़र')}</span>
          </div>
          <button className="bk" onClick={close} aria-label={t('Close', 'बंद करें')}>
            ✕
          </button>
        </div>
        <div style={{ padding: '0 16px 26px', maxHeight: '62vh', overflowY: 'auto' }}>
          {!loggedIn ? (
            <div className="empty" style={{ padding: '26px 10px', textAlign: 'center' }}>
              <div style={{ fontSize: 40 }}>🔔</div>
              <b>{t('Log in to see your notifications', 'अपनी सूचनाएँ देखने के लिए लॉगिन करें')}</b>
            </div>
          ) : list.length ? (
            list.map((n) => (
              <div
                key={n.id}
                className={`nitem ${n.isRead ? '' : 'un'}`}
                role="button"
                tabIndex={0}
                onClick={() => {
                  close();
                  if (n.bookingId) nav('/bookings');
                }}
              >
                <div className="ni">{CN_ICON[n.type] ?? '🔔'}</div>
                <div style={{ minWidth: 0 }}>
                  <b>{lang === 'en' ? n.title.en : n.title.hi}</b>
                  <span>{lang === 'en' ? n.message.en : n.message.hi}</span>
                  <small>{when(n.createdAt, t)}</small>
                </div>
              </div>
            ))
          ) : (
            <div style={{ padding: '26px 10px', textAlign: 'center' }}>
              <div style={{ fontSize: 40 }}>🔕</div>
              <b>{t('No notifications yet', 'अभी कोई सूचना नहीं')}</b>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
