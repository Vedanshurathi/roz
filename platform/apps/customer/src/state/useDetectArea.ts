/** "Use my location" → the right village (only switches when the backend is sure). */
import type { AreaMatch } from '@rozbazaar/shared';
import { useI18n } from '@rozbazaar/web';
import { api } from '../api/client';
import { getPreciseLocation } from '../lib/geo';
import { useToast } from '../ui/Toast';
import { useShop } from './shop';
import { useUI } from './ui';

export function useDetectArea() {
  const { t } = useI18n();
  const toast = useToast();
  const shop = useShop();
  const ui = useUI();

  return async function detectArea() {
    if (!navigator.geolocation)
      return toast(t('This phone cannot share location', 'यह फ़ोन लोकेशन नहीं दे सकता'));
    try {
      const st = await navigator.permissions?.query({ name: 'geolocation' });
      if (st?.state === 'denied')
        return toast(
          t('Location is blocked — pick your area from the list', 'लोकेशन बंद है — सूची में से इलाका चुनें'),
        );
    } catch {
      /* no permissions API */
    }
    toast(t('Finding your area…', 'आपका इलाका ढूँढ रहे हैं…'));
    try {
      const pos = await getPreciseLocation(undefined, 12000, 50);
      if (pos.coords.accuracy > 3000) {
        ui.setAreaOpen(true);
        return toast(
          t(
            'Your location is too rough to tell the village — please pick it',
            'लोकेशन से गाँव पक्का नहीं हुआ — कृपया चुनें',
          ),
        );
      }
      try {
        localStorage.setItem('rb_geo_ok', '1');
      } catch {
        /* storage blocked */
      }
      const d = await api.get<AreaMatch>('/v1/public/areas/locate', {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
      });
      if (!d.area)
        return toast(
          t('Could not match an area — pick from the list', 'इलाका मेल नहीं खाया — सूची में से चुनें'),
        );
      if (!d.inRange) {
        ui.setAreaOpen(false);
        return toast(
          t(
            `You are about ${d.distanceKm ?? '?'} km from ${d.area} — we do not reach there yet`,
            `आप ${d.area} से ~${d.distanceKm ?? '?'} किमी दूर हैं — अभी हम वहाँ नहीं पहुँचते`,
          ),
        );
      }
      // Village points start approximate; guessing wrong would show another vendor's prices.
      if (d.confident) {
        if (d.area !== shop.area) {
          shop.setArea(d.area);
          toast(t(`Showing ${d.area}`, `${d.area} दिखा रहे हैं`));
        }
        ui.setAreaOpen(false);
        if (!d.served)
          toast(
            t(
              `No vendor in ${d.area} yet — tap Notify me`,
              `अभी ${d.area} में वेंडर नहीं — "मुझे बताएँ" दबाएँ`,
            ),
          );
        return;
      }
      ui.setGuess(d);
      ui.setAreaOpen(true);
      toast(t(`Looks like ${d.area} — please confirm`, `शायद ${d.area} है — पक्का कर दें`));
    } catch (err) {
      toast(
        (err as { code?: number })?.code === 1
          ? t(
              'Permission denied — pick your area from the list',
              'अनुमति नहीं मिली — सूची में से इलाका चुनें',
            )
          : t(
              'Could not find you — pick your area from the list',
              'लोकेशन नहीं मिली — सूची में से इलाका चुनें',
            ),
      );
    }
  };
}
