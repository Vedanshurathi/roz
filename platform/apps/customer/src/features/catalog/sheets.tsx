import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import type { Area, AreaMatch, Product } from '@rozbazaar/shared';
import { ApiError, Button, ItemImage, rupees, Sheet, Stars, useI18n, useToast } from '@rozbazaar/web';
import { api } from '../../api/client';
import { productName } from './names';

/** Pick the village. GPS uses our own village boundaries, never reverse-geocoded text. */
export function AreaSheet(props: {
  open: boolean;
  onClose: () => void;
  areas: Area[];
  current: string | null;
  onPick: (a: string) => void;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const [locating, setLocating] = useState(false);

  function useMyLocation() {
    if (!('geolocation' in navigator))
      return toast.show(
        t('Location is not available on this phone', 'इस फ़ोन पर लोकेशन उपलब्ध नहीं है'),
        'bad',
      );
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          // Coarse fixes (> 3 km) must never switch the village.
          if (pos.coords.accuracy > 3000) {
            toast.show(
              t('Location is too rough — please pick your village', 'लोकेशन साफ़ नहीं है — गाँव चुनें'),
              'bad',
            );
            return;
          }
          const m = await api.get<AreaMatch>('/v1/public/areas/locate', {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
          if (m.area && m.inRange) {
            props.onPick(m.area);
            toast.show(t(`You are in ${m.area}`, `आप ${m.area} में हैं`), 'good');
          } else {
            toast.show(t("We don't deliver at this location yet", 'इस जगह अभी डिलीवरी नहीं है'), 'bad');
          }
        } catch (e) {
          toast.show((e as Error).message, 'bad');
        } finally {
          setLocating(false);
        }
      },
      () => {
        setLocating(false);
        toast.show(
          t('Allow location, or pick your village below', 'लोकेशन की इजाज़त दें, या नीचे गाँव चुनें'),
          'bad',
        );
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 },
    );
  }

  return (
    <Sheet
      open={props.open}
      onClose={props.onClose}
      title={t('Where should we deliver?', 'कहाँ डिलीवर करें?')}
    >
      <Button variant="secondary" block onClick={useMyLocation} loading={locating}>
        📍 {t('Use my location', 'मेरी लोकेशन लें')}
      </Button>
      <ul className="arealist">
        {props.areas.map((a) => (
          <li key={a.name}>
            <button
              type="button"
              className={`arealist__i ${a.name === props.current ? 'is-on' : ''}`}
              onClick={() => props.onPick(a.name)}
            >
              <span>{a.name}</span>
              {a.served ? (
                <span className="rb-pill rb-pill--g">{t('Delivering', 'डिलीवरी चालू')}</span>
              ) : (
                <span className="rb-pill">{t('Coming soon', 'जल्द')}</span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

/** Same item, several vendors: the customer chooses whose (price, rating, stock). */
export function VendorPickerSheet(props: {
  options: Product[];
  onClose: () => void;
  onPick: (p: Product) => void;
  cartVendorId: string | null;
}) {
  const { t, lang } = useI18n();
  const first = props.options[0];
  if (!first) return null;
  const sorted = [...props.options].sort(
    (a, b) => Number(b.inStock) - Number(a.inStock) || a.price - b.price,
  );
  return (
    <Sheet
      open
      onClose={props.onClose}
      title={t(`Who should bring ${productName(first, lang)}?`, `${productName(first, lang)} कौन लाए?`)}
    >
      <ul className="vpick">
        {sorted.map((p) => (
          <li key={p.id}>
            <button type="button" className="vpick__i" disabled={!p.inStock} onClick={() => props.onPick(p)}>
              <ItemImage src={p.imageUrl} name={p.nameEn ?? p.name} category={p.category} size={52} />
              <span className="vpick__txt">
                <b>{p.vendorName}</b> <Stars value={p.vendorRating} size={12} />
                <small>
                  {p.unit}
                  {p.vendorId === props.cartVendorId ? ` · ${t('in your basket', 'आपकी टोकरी में')}` : ''}
                </small>
              </span>
              <span className="vpick__price">{p.inStock ? rupees(p.price) : t('Out of stock', 'ख़त्म')}</span>
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

/** Village not served yet: join the waitlist. */
export function WaitlistCard(props: { area: string }) {
  const { t } = useI18n();
  const toast = useToast();
  const [phone, setPhone] = useState('');
  const join = useMutation({
    mutationFn: () => api.post('/v1/public/waitlist', { area: props.area, type: 'vegetable', phone }),
    onSuccess: () =>
      toast.show(t("Done! We'll tell you when we start here.", 'हो गया! यहाँ शुरू होते ही बताएँगे।'), 'good'),
    onError: (e) => toast.show(e instanceof ApiError ? e.message : 'Error', 'bad'),
  });
  return (
    <div className="rb-card waitlist rv d2">
      <h3>{t(`We're not in ${props.area} yet`, `${props.area} में अभी हम नहीं आते`)}</h3>
      <p className="rb-muted">
        {t(
          'Leave your number and we will call you when vendors start here.',
          'अपना नंबर दें — वेंडर शुरू होते ही फ़ोन करेंगे।',
        )}
      </p>
      <form
        className="waitlist__row"
        onSubmit={(e) => {
          e.preventDefault();
          join.mutate();
        }}
      >
        <input
          inputMode="numeric"
          autoComplete="tel"
          maxLength={14}
          placeholder="98XXXXXXXX"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          aria-label={t('Mobile number', 'मोबाइल नंबर')}
        />
        <Button type="submit" loading={join.isPending}>
          {t('Notify me', 'मुझे बताएँ')}
        </Button>
      </form>
    </div>
  );
}
