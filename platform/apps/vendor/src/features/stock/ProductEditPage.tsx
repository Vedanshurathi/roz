import { useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { upsertProductBody, VENDOR_TYPES, type VendorProduct, type VendorType } from '@rozbazaar/shared';
import { Button, Field, ItemImage, Spinner, useI18n, useToast } from '@rozbazaar/web';
import { api } from '../../api/client';
import { useVendor } from '../../app/vendor-context';
import { keys, useProducts } from '../../api/queries';
import { TopBar } from '../../components/TopBar';
import { photoToDataUrl } from '../../lib/photo';
import { normUnit, TYPE_ICON, typeLabel, UNITS, unitLabel } from '../../lib/names';

export default function ProductEditPage() {
  const { id } = useParams();
  const products = useProducts();
  if (id && products.isPending) return <Spinner />;
  const existing = id ? (products.data ?? []).find((p) => p.id === id) : undefined;
  if (id && !existing) return <Navigate to="/stock" replace />;
  return <ProductForm key={id ?? 'new'} existing={existing} />;
}

function ProductForm({ existing }: { existing?: VendorProduct }) {
  const { t, lang } = useI18n();
  const toast = useToast();
  const nav = useNavigate();
  const qc = useQueryClient();
  const vendor = useVendor();
  // Editing never renames: the typed name stays what the vendor first entered (customers search it).
  const [name, setName] = useState(existing?.name ?? '');
  const [nameHi, setNameHi] = useState(existing?.nameHi ?? '');
  const [unit, setUnit] = useState(normUnit(existing?.unit ?? 'kg'));
  const [price, setPrice] = useState(existing ? String(existing.price) : '');
  const [category, setCategory] = useState<VendorType>(existing?.category ?? vendor.type);
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  const body = {
    id: existing?.id,
    name,
    nameHi: nameHi.trim() || undefined,
    unit,
    price: Number(price),
    category,
    image: photo ?? undefined,
    sort: existing?.sortOrder,
  };
  const valid = upsertProductBody.safeParse(body).success && Number(price) > 0;

  const save = useMutation({
    mutationFn: () => api.post<{ id: string }>('/v1/vendor/products', upsertProductBody.parse(body)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.products });
      toast.show(
        existing
          ? t('Saved ✓', 'सेव हो गया ✓')
          : t(
              'Added — RozBazaar checks new items before customers see them',
              'जुड़ गया — ग्राहकों को दिखाने से पहले RozBazaar जाँचेगा',
            ),
        'good',
      );
      nav('/stock', { replace: true });
    },
    onError: (e) => toast.show(e.message, 'bad'),
  });
  const remove = useMutation({
    mutationFn: () => api.del(`/v1/vendor/products/${existing!.id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.products });
      toast.show(t('Item removed', 'सामान हटा दिया'));
      nav('/stock', { replace: true });
    },
    onError: (e) => toast.show(e.message, 'bad'),
  });

  async function onFile(f: File | undefined) {
    if (!f) return;
    setPhotoBusy(true);
    try {
      setPhoto(await photoToDataUrl(f));
    } catch {
      toast.show(t('Could not use that photo — try another', 'यह फ़ोटो नहीं लगी — दूसरी आज़माएँ'), 'bad');
    } finally {
      setPhotoBusy(false);
    }
  }

  return (
    <div className="page page--cream page--bar">
      <TopBar
        title={existing ? t('Edit item', 'सामान बदलें') : t('Add a new item', 'नया सामान जोड़ें')}
        back="/stock"
      />
      <div className="wrap">
        <div className="card photo">
          {photo ? (
            <img src={photo} alt="" className="photo__img" />
          ) : (
            <ItemImage src={existing?.imageUrl ?? null} name={name || '?'} category={category} size={96} />
          )}
          <div>
            <Button variant="secondary" loading={photoBusy} onClick={() => file.current?.click()}>
              📷{' '}
              {photo || existing?.imageUrl
                ? t('Change photo', 'फ़ोटो बदलें')
                : t('Add a photo', 'फ़ोटो लगाएँ')}
            </Button>
            <p className="rb-muted">{t('A real photo sells better', 'असली फ़ोटो से ज़्यादा बिकता है')}</p>
          </div>
          <input
            ref={file}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
        </div>

        <div className="card">
          <Field
            label={t('Item name (as customers say it)', 'सामान का नाम (जैसे ग्राहक बोलते हैं)')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            placeholder="Tamatar"
            disabled={Boolean(existing)}
            hint={
              existing
                ? t(
                    'The name cannot be changed — add a new item instead',
                    'नाम नहीं बदल सकते — नया सामान जोड़ें',
                  )
                : undefined
            }
          />
          <Field
            label={t('Name in Hindi (optional)', 'हिंदी में नाम (ज़रूरी नहीं)')}
            value={nameHi}
            onChange={(e) => setNameHi(e.target.value)}
            maxLength={60}
            placeholder="टमाटर"
          />
          <Field
            label={t('Rate', 'रेट')}
            prefix="₹"
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, '').slice(0, 7))}
          />
        </div>

        <h2 className="sech">{t('Sold by', 'किस हिसाब से बिकता है')}</h2>
        <div className="chips" role="radiogroup" aria-label={t('Unit', 'इकाई')}>
          {(UNITS.includes(unit as (typeof UNITS)[number]) ? [...UNITS] : [unit, ...UNITS]).map((u) => (
            <button
              key={u}
              type="button"
              role="radio"
              aria-checked={unit === u}
              className={`rb-chip ${unit === u ? 'is-on' : ''}`}
              onClick={() => setUnit(u)}
            >
              {unitLabel(u, lang)}
            </button>
          ))}
        </div>

        <h2 className="sech">{t('Type', 'किस्म')}</h2>
        <div className="chips" role="radiogroup" aria-label={t('Type', 'किस्म')}>
          {VENDOR_TYPES.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={category === c}
              className={`rb-chip ${category === c ? 'is-on' : ''}`}
              onClick={() => setCategory(c)}
            >
              {TYPE_ICON[c]} {typeLabel(c, lang)}
            </button>
          ))}
        </div>

        {existing ? (
          <Button
            block
            variant="danger"
            style={{ marginTop: 24 }}
            loading={remove.isPending}
            onClick={() =>
              window.confirm(t('Remove this item from your list?', 'यह सामान अपनी सूची से हटाएँ?')) &&
              remove.mutate()
            }
          >
            🗑 {t('Remove this item', 'यह सामान हटाएँ')}
          </Button>
        ) : null}
      </div>
      <div className="stickybar">
        <div className="stickybar__in">
          <Button block loading={save.isPending} disabled={!valid || photoBusy} onClick={() => save.mutate()}>
            {t('Save', 'सेव करें')}
          </Button>
        </div>
      </div>
    </div>
  );
}
