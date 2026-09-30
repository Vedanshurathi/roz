import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { saveAddressBody, type Address, type AreaMatch } from '@rozbazaar/shared';
import { Button, Field, Spinner, useI18n, useToast } from '@rozbazaar/web';
import { api } from '../../api/client';
import { keys, useAddresses, useAreas } from '../../api/queries';
import { PageHeader } from '../../components/PageHeader';
import { useShop } from '../../state/shop';

const LABELS: Array<[string, string, string]> = [
  ['Home', 'घर', '🏠'],
  ['Shop', 'दुकान', '🏪'],
  ["Parents' home", 'मम्मी का घर', '👵'],
];

export default function AddressPage() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { id } = useParams();
  const [params] = useSearchParams();
  const next = params.get('next')?.startsWith('/') ? params.get('next')! : '/account';
  const shop = useShop();
  const areas = useAreas();
  const addresses = useAddresses(true);
  const existing = id ? addresses.data?.find((a) => a.id === id) : undefined;

  const [form, setForm] = useState({
    label: 'Home',
    house: '',
    street: '',
    landmark: '',
    area: shop.area ?? '',
  });
  const [coords, setCoords] = useState<{ lat: number; lng: number; acc: number } | null>(null);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    if (existing) {
      setForm({
        label: existing.label ?? 'Home',
        house: existing.house ?? '',
        street: existing.street ?? '',
        landmark: existing.landmark ?? '',
        area: existing.area,
      });
      if (existing.lat != null && existing.lng != null)
        setCoords({ lat: existing.lat, lng: existing.lng, acc: 0 });
    }
  }, [existing]);

  const save = useMutation({
    mutationFn: (body: unknown) => api.post<Address>('/v1/customer/addresses', body),
    onSuccess: async (a) => {
      await qc.invalidateQueries({ queryKey: keys.addresses });
      shop.setAddressId(a.id);
      toast.show(t('Address saved', 'पता सेव हो गया'), 'good');
      nav(next, { replace: true });
    },
    onError: (e) => toast.show(e.message, 'bad'),
  });

  function locate() {
    if (!('geolocation' in navigator))
      return toast.show(t('Location is not available', 'लोकेशन उपलब्ध नहीं'), 'bad');
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (p) => {
        const c = { lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy };
        setCoords(c);
        try {
          const m = await api.get<AreaMatch>('/v1/public/areas/locate', { lat: c.lat, lng: c.lng });
          // Only switch village on a reasonably precise fix (a coarse fix once put an address 57 km away).
          if (m.area && m.inRange && c.acc <= 3000) setForm((f) => ({ ...f, area: m.area! }));
        } catch {
          /* keep what the person chose */
        }
        setLocating(false);
      },
      () => {
        setLocating(false);
        toast.show(t('Allow location to pin your door', 'दरवाज़े की लोकेशन के लिए इजाज़त दें'), 'bad');
      },
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 0 },
    );
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const body = {
      id: existing?.id,
      label: form.label,
      house: form.house || undefined,
      street: form.street || undefined,
      landmark: form.landmark || undefined,
      area: form.area,
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
      makeDefault: !addresses.data?.length,
    };
    const r = saveAddressBody.safeParse(body);
    if (!r.success) return toast.show(t('Choose your village', 'अपना गाँव चुनें'), 'bad');
    if (!coords && !form.house && !form.street && !form.landmark) {
      return toast.show(
        t(
          'Add your location or write the house / street / landmark',
          'लोकेशन जोड़ें या घर / गली / पहचान लिखें',
        ),
        'bad',
      );
    }
    save.mutate(r.data);
  }

  if (id && addresses.isPending) return <Spinner />;

  return (
    <div className="page">
      <PageHeader title={existing ? t('Edit address', 'पता बदलें') : t('New address', 'नया पता')} />
      <form className="page__body" onSubmit={submit} noValidate>
        <Button variant="secondary" block onClick={locate} loading={locating}>
          📍{' '}
          {coords
            ? t('Update my location', 'लोकेशन फिर से लें')
            : t('Use my current location', 'मेरी अभी की लोकेशन लें')}
        </Button>
        {coords && coords.acc > 60 ? (
          <p className="warn">
            {t(
              `Location is rough (±${Math.round(coords.acc)} m). Add a landmark so the vendor finds you.`,
              `लोकेशन साफ़ नहीं (±${Math.round(coords.acc)} मी.) — पहचान ज़रूर लिखें।`,
            )}
          </p>
        ) : coords ? (
          <p className="good">✓ {t('Your door is pinned', 'आपका दरवाज़ा पिन हो गया')}</p>
        ) : null}

        <label className="rb-field">
          <span className="rb-field__label">{t('Village', 'गाँव')} *</span>
          <select
            className="select"
            value={form.area}
            onChange={(e) => setForm({ ...form, area: e.target.value })}
            required
          >
            <option value="">{t('Choose…', 'चुनें…')}</option>
            {(areas.data ?? []).map((a) => (
              <option key={a.name} value={a.name}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <Field
          label={t('House / building number', 'मकान नंबर')}
          value={form.house}
          onChange={(e) => setForm({ ...form, house: e.target.value })}
          maxLength={80}
        />
        <Field
          label={t('Street / mohalla', 'गली / मोहल्ला')}
          value={form.street}
          onChange={(e) => setForm({ ...form, street: e.target.value })}
          maxLength={120}
        />
        <Field
          label={t('Landmark', 'पहचान (लैंडमार्क)')}
          hint={t(
            'e.g. Near the Hanuman temple — this is how vendors find you',
            'जैसे: हनुमान मंदिर के पास — वेंडर ऐसे ही पता ढूँढते हैं',
          )}
          value={form.landmark}
          onChange={(e) => setForm({ ...form, landmark: e.target.value })}
          maxLength={120}
        />
        <div className="labelchips" role="radiogroup" aria-label={t('Save as', 'इस नाम से सेव करें')}>
          {LABELS.map(([en, hi, icon]) => (
            <button
              key={en}
              type="button"
              role="radio"
              aria-checked={form.label === en}
              className={`rb-chip ${form.label === en ? 'is-on' : ''}`}
              onClick={() => setForm({ ...form, label: en })}
            >
              {icon} {lang === 'hi' ? hi : en}
            </button>
          ))}
        </div>
        <div className="stickybar">
          <Button type="submit" block loading={save.isPending}>
            {t('Save address', 'पता सेव करें')}
          </Button>
        </div>
      </form>
    </div>
  );
}
