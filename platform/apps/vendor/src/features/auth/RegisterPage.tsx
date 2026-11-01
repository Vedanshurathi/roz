import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { VENDOR_TYPES, vendorApplyBody, type VendorType } from '@rozbazaar/shared';
import { Button, Field, Spinner, useI18n, useToast } from '@rozbazaar/web';
import { api } from '../../api/client';
import { keys, useAreas, useSession } from '../../api/queries';
import { TYPE_ICON, typeLabel } from '../../lib/names';

/** First-time vendor (signed in with Google, no vendor row yet): what I sell and where. */
export default function RegisterPage() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const nav = useNavigate();
  const qc = useQueryClient();
  const session = useSession();
  const areas = useAreas();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [type, setType] = useState<VendorType>('vegetable');
  const [picked, setPicked] = useState<string[]>([]);
  const [shop, setShop] = useState('');
  const [vehicle, setVehicle] = useState('');

  const body = {
    name,
    phone,
    type,
    areas: picked,
    shop: shop.trim() || undefined,
    vehicle: vehicle.trim() || undefined,
    lang,
  };
  const valid = vendorApplyBody.safeParse(body);
  const apply = useMutation({
    mutationFn: () => api.post('/v1/vendor/apply', vendorApplyBody.parse(body)),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: keys.session });
      toast.show(
        t(
          'Registered! RozBazaar will call you to approve.',
          'रजिस्टर हो गया! RozBazaar मंज़ूरी के लिए फ़ोन करेगा।',
        ),
        'good',
      );
      nav('/set-password', { replace: true });
    },
    onError: (e) => toast.show(e.message, 'bad'),
  });

  if (session.data?.user) return <Navigate to="/" replace />;
  const toggle = (a: string) => setPicked((p) => (p.includes(a) ? p.filter((x) => x !== a) : [...p, a]));

  return (
    <div className="page page--cream">
      <header className="topbar topbar--plain">
        <div className="topbar__t">
          <h1>{t('Become a RozBazaar vendor', 'RozBazaar वेंडर बनें')}</h1>
          <p>{t('Tell us what you sell and where', 'बताइए आप क्या बेचते हैं और कहाँ')}</p>
        </div>
      </header>
      <div className="wrap">
        <div className="card rv d1">
          <Field
            label={t('Your name', 'आपका नाम')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            autoComplete="name"
          />
          <Field
            label={t('Mobile number', 'मोबाइल नंबर')}
            prefix="+91"
            inputMode="numeric"
            maxLength={14}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            hint={t('You will log in with this number', 'इसी नंबर से लॉगिन करेंगे')}
          />
        </div>

        <h2 className="sech">{t('What do you sell?', 'आप क्या बेचते हैं?')}</h2>
        <div
          className="typegrid rv d2"
          role="radiogroup"
          aria-label={t('What do you sell?', 'आप क्या बेचते हैं?')}
        >
          {VENDOR_TYPES.map((v) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={type === v}
              className={`typecard ${type === v ? 'is-on' : ''}`}
              onClick={() => setType(v)}
            >
              <span aria-hidden>{TYPE_ICON[v]}</span>
              <b>{typeLabel(v, lang)}</b>
            </button>
          ))}
        </div>

        <h2 className="sech">{t('Villages you go to', 'आप किन गाँवों में जाते हैं')}</h2>
        {areas.isPending ? (
          <Spinner />
        ) : (
          <div className="chips rv d3">
            {(areas.data ?? []).map((a) => (
              <button
                key={a.name}
                type="button"
                aria-pressed={picked.includes(a.name)}
                className={`rb-chip ${picked.includes(a.name) ? 'is-on' : ''}`}
                onClick={() => toggle(a.name)}
              >
                {a.name}
              </button>
            ))}
          </div>
        )}

        <div className="card rv d4" style={{ marginTop: 16 }}>
          <Field
            label={t('Shop name (optional)', 'दुकान का नाम (ज़रूरी नहीं)')}
            value={shop}
            onChange={(e) => setShop(e.target.value)}
            maxLength={80}
          />
          <Field
            label={t('Vehicle (optional)', 'गाड़ी (ज़रूरी नहीं)')}
            value={vehicle}
            onChange={(e) => setVehicle(e.target.value)}
            maxLength={60}
            placeholder={t('Thela, e-rickshaw…', 'ठेला, ई-रिक्शा…')}
          />
        </div>
      </div>
      <div className="stickybar">
        <Button block loading={apply.isPending} disabled={!valid.success} onClick={() => apply.mutate()}>
          {t('Register', 'रजिस्टर करें')}
        </Button>
      </div>
    </div>
  );
}
