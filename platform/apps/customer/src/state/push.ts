import { enablePush, pushState, useI18n } from '@rozbazaar/web';
import { api } from '../api/client';
import { VAPID_PUBLIC_KEY } from '../config';
import { useToast } from '../ui/Toast';

export const savePush = () => enablePush(api, '/v1/customer/push-subscriptions', VAPID_PUBLIC_KEY);

/** "Allow" notifications: ask, subscribe, save — and say honestly whether it worked. */
export function useAskNotif() {
  const { t } = useI18n();
  const toast = useToast();
  return async function askNotif(loggedIn: boolean) {
    if (pushState() === 'unsupported')
      return toast(t('This browser has no notifications', 'इस ब्राउज़र में सूचनाएँ नहीं'));
    try {
      const r = await Notification.requestPermission();
      if (r !== 'granted')
        return toast(t('No problem — check My bookings instead', 'कोई बात नहीं — मेरी बुकिंग में देख लेना'));
      if (!loggedIn)
        return toast(
          t(
            'Notifications on — log in once and order updates will reach this phone',
            'सूचनाएँ चालू — एक बार लॉगिन करें, फिर ऑर्डर की हर जानकारी इस फ़ोन पर आएगी',
          ),
        );
      await savePush();
      toast(t('Done — we will alert you', 'हो गया — हम बता देंगे'));
    } catch {
      toast(t('Could not enable alerts', 'सूचनाएँ चालू नहीं हुईं'));
    }
  };
}
