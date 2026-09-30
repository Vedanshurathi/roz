import { useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button, enablePush, pushState, useI18n, useToast } from '@rozbazaar/web';
import { api } from '../../api/client';
import { VAPID_PUBLIC_KEY } from '../../config';

const PATH = '/v1/customer/push-subscriptions';

export function useEnableAlerts() {
  const { t } = useI18n();
  const toast = useToast();
  return useMutation({
    mutationFn: () => enablePush(api, PATH, VAPID_PUBLIC_KEY),
    onSuccess: () =>
      toast.show(t('Order updates are on for this phone ✓', 'इस फ़ोन पर ऑर्डर की सूचना चालू ✓'), 'good'),
    onError: (e) =>
      toast.show(
        e.message === 'denied'
          ? t(
              'Notifications are blocked. Phone Settings → Apps → RozBazaar (or tap 🔒 in the browser) → allow notifications.',
              'सूचनाएँ बंद हैं। फ़ोन सेटिंग → ऐप्स → RozBazaar (या ब्राउज़र में 🔒 दबाएँ) → सूचनाएँ चालू करें।',
            )
          : e.message === 'unsupported'
            ? t(
                'This browser cannot show notifications. On iPhone, add RozBazaar to the Home Screen first.',
                'यह ब्राउज़र सूचना नहीं दिखा सकता। iPhone पर पहले RozBazaar को होम स्क्रीन पर जोड़ें।',
              )
            : e.message,
        'bad',
      ),
  });
}

/**
 * Once per app start, a logged-in phone that already allowed notifications re-saves its
 * subscription — so pushes follow whoever is logged in on this phone now.
 */
export function useSyncPush(loggedIn: boolean) {
  const done = useRef(false);
  useEffect(() => {
    if (!loggedIn || done.current || pushState() !== 'granted') return;
    done.current = true;
    void enablePush(api, PATH, VAPID_PUBLIC_KEY).catch(() => undefined);
  }, [loggedIn]);
}

/** "Get told when the vendor is on the way?" — shown only while the choice is still open. */
export function AlertsCard() {
  const { t } = useI18n();
  const enable = useEnableAlerts();
  const [state] = useState(pushState);
  if (state !== 'default' || enable.isSuccess) return null;
  return (
    <div className="alertcard">
      <span aria-hidden>🔔</span>
      <div>
        <b>{t('Get told when the vendor is on the way?', 'वेंडर के निकलते ही बताएँ?')}</b>
        <small>
          {t(
            'Also when your bill is ready. Works even when the app is closed.',
            'बिल तैयार होने पर भी। ऐप बंद हो तब भी।',
          )}
        </small>
      </div>
      <Button loading={enable.isPending} onClick={() => enable.mutate()}>
        {t('Yes', 'हाँ')}
      </Button>
    </div>
  );
}
