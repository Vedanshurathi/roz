import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { EmptyState, Sheet, timeAgo, useI18n } from '@rozbazaar/web';
import { api } from '../../api/client';
import { keys, useNotifications } from '../../api/queries';

/** 🔔 in the header with an unread badge; opens the list. */
export function NotificationsButton({ enabled }: { enabled: boolean }) {
  const { t, lang } = useI18n();
  const [open, setOpen] = useState(false);
  const q = useNotifications(enabled);
  const qc = useQueryClient();
  const read = useMutation({
    mutationFn: (id: string) => api.post(`/v1/customer/notifications/${id}/read`),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.notifications }),
  });
  const unread = (q.data ?? []).filter((n) => !n.isRead).length;
  if (!enabled) return null;
  return (
    <>
      <button
        type="button"
        className="iconbtn"
        onClick={() => setOpen(true)}
        aria-label={t(`Notifications, ${unread} unread`, `सूचनाएँ, ${unread} नई`)}
      >
        🔔{unread ? <span className="iconbtn__badge">{unread > 9 ? '9+' : unread}</span> : null}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={t('Notifications', 'सूचनाएँ')}>
        {(q.data ?? []).length === 0 ? (
          <EmptyState icon="🔕" title={t('No notifications yet', 'अभी कोई सूचना नहीं')} />
        ) : (
          <ul className="notes">
            {q.data!.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  className={`notes__i ${n.isRead ? '' : 'is-new'}`}
                  onClick={() => !n.isRead && read.mutate(n.id)}
                >
                  <b>{lang === 'hi' ? n.title.hi : n.title.en}</b>
                  <span>{lang === 'hi' ? n.message.hi : n.message.en}</span>
                  <small>{timeAgo(n.createdAt, lang)}</small>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Sheet>
    </>
  );
}
