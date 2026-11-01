import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button, enablePush, pushState, storage, useI18n, useToast } from '@rozbazaar/web';
import { api } from '../../api/client';
import { STORAGE, VAPID_PUBLIC_KEY } from '../../config';

/** Turns on new-order alerts on this phone. Also used from the profile screen. */
export function useEnablePush() {
  const { t } = useI18n();
  const toast = useToast();
  return useMutation({
    mutationFn: () => enablePush(api, '/v1/vendor/push-subscriptions', VAPID_PUBLIC_KEY),
    onSuccess: () => toast.show(t('Alerts are on for this phone ✓', 'इस फ़ोन पर अलर्ट चालू ✓'), 'good'),
    onError: (e) =>
      toast.show(
        e.message === 'denied'
          ? t(
              'Alerts are blocked. Allow notifications for this site in your browser settings.',
              'अलर्ट बंद हैं। ब्राउज़र सेटिंग में इस साइट के नोटिफ़िकेशन चालू करें।',
            )
          : e.message === 'unsupported'
            ? t(
                'This browser cannot show alerts. On iPhone, add the app to the Home Screen first.',
                'यह ब्राउज़र अलर्ट नहीं दिखा सकता। iPhone पर पहले ऐप को होम स्क्रीन पर जोड़ें।',
              )
            : e.message,
        'bad',
      ),
  });
}

export function PushCard() {
  const { t } = useI18n();
  const [hidden, setHidden] = useState(() => Boolean(storage.get(STORAGE.pushDismissed)));
  const enable = useEnablePush();
  if (hidden || pushState() !== 'default' || enable.isSuccess) return null;
  return (
    <div className="card pushcard rv d1">
      <div className="pushcard__t">
        <span aria-hidden>🔔</span>
        <div>
          <b>{t('Get told the moment a new order comes in?', 'नया ऑर्डर आते ही बताएँ?')}</b>
          <small>{t('Works even when the app is closed.', 'ऐप बंद हो तब भी काम करेगा।')}</small>
        </div>
      </div>
      <div className="pushcard__a">
        <Button
          variant="ghost"
          onClick={() => {
            storage.set(STORAGE.pushDismissed, true);
            setHidden(true);
          }}
        >
          {t('Not now', 'अभी नहीं')}
        </Button>
        <Button loading={enable.isPending} onClick={() => enable.mutate()}>
          {t('Yes, alert me', 'हाँ, बताइए')}
        </Button>
      </div>
    </div>
  );
}
