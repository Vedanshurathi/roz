import { useEffect, useRef } from 'react';
import { enablePush, istDate, pushState, useI18n, useToast } from '@rozbazaar/web';
import { api } from '../api/client';
import { VAPID_PUBLIC_KEY } from '../config';
import { useOrders } from '../api/queries';

/**
 * While the app is open, today's and tomorrow's orders are polled; a booking we have not seen
 * before gets a toast and a buzz. (Push notifications cover the app-closed case.)
 */
export function OrderAlerts() {
  const { t } = useI18n();
  const toast = useToast();
  const today = useOrders(istDate(0));
  const tomorrow = useOrders(istDate(1));
  const seen = useRef<Set<string> | null>(null);

  // A phone that already allowed alerts re-saves its subscription for whoever is logged in now.
  useEffect(() => {
    if (pushState() === 'granted')
      void enablePush(api, '/v1/vendor/push-subscriptions', VAPID_PUBLIC_KEY).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!today.data || !tomorrow.data) return;
    const all = [...today.data, ...tomorrow.data].filter((b) => b.status === 'placed');
    if (!seen.current) {
      seen.current = new Set(all.map((b) => b.id)); // first load: nothing is "new"
      return;
    }
    const fresh = all.filter((b) => !seen.current!.has(b.id));
    for (const b of fresh) seen.current.add(b.id);
    if (!fresh.length) return;
    const who = fresh[0]!.customerName ?? t('a customer', 'एक ग्राहक');
    toast.show(
      fresh.length === 1
        ? t(`🛒 New order from ${who}`, `🛒 ${who} का नया ऑर्डर`)
        : t(`🛒 ${fresh.length} new orders`, `🛒 ${fresh.length} नए ऑर्डर`),
      'good',
    );
    try {
      navigator.vibrate?.([200, 100, 200]);
    } catch {
      /* not supported */
    }
  }, [today.data, tomorrow.data, t, toast]);

  return null;
}
