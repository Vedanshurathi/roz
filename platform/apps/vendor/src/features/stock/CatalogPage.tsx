import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { VENDOR_TYPES, type CatalogItem, type VendorType } from '@rozbazaar/shared';
import { Button, ErrorState, Field, ItemImage, Sheet, Spinner, useI18n, useToast } from '@rozbazaar/web';
import { api } from '../../api/client';
import { useVendor } from '../../app/vendor-context';
import { keys, useCatalog, useProducts } from '../../api/queries';
import { TopBar } from '../../components/TopBar';
import { normUnit, TYPE_ICON, typeLabel, UNITS, unitLabel } from '../../lib/names';
import { matchScore } from '../../lib/search';

const catName = (c: CatalogItem, lang: 'en' | 'hi') => (lang === 'hi' ? c.nameHi : c.nameEn) || c.name;

/** RozBazaar's master list (104 items with photos) — one tap + a rate and it's on sale. */
export default function CatalogPage() {
  const { t, lang } = useI18n();
  const vendor = useVendor();
  const catalog = useCatalog();
  const products = useProducts();
  const [type, setType] = useState<VendorType>(vendor.type);
  const [q, setQ] = useState('');
  const [picking, setPicking] = useState<CatalogItem | null>(null);
  const have = useMemo(
    () => new Set((products.data ?? []).map((p) => p.catalogKey).filter(Boolean)),
    [products.data],
  );

  const list = (catalog.data ?? []).filter((c) =>
    q.trim() ? matchScore([c.name, c.nameEn, c.nameHi], q) > 0 : c.category === type,
  );

  return (
    <div className="page page--cream">
      <TopBar
        title={t('Catalogue', 'कैटलॉग')}
        sub={t('tap an item, set your rate', 'सामान चुनें, अपना रेट डालें')}
        back="/stock"
      />
      <div className="wrap">
        <div className="searchbox">
          <span aria-hidden>🔍</span>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('Search… (bhindi, आलू)', 'ढूँढें… (bhindi, आलू)')}
            aria-label={t('Search the catalogue', 'कैटलॉग में ढूँढें')}
          />
        </div>
        {!q ? (
          <div className="chips" role="tablist">
            {VENDOR_TYPES.map((v) => (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={type === v}
                className={`rb-chip ${type === v ? 'is-on' : ''}`}
                onClick={() => setType(v)}
              >
                {TYPE_ICON[v]} {typeLabel(v, lang)}
              </button>
            ))}
          </div>
        ) : null}
        {catalog.isPending ? (
          <Spinner />
        ) : catalog.isError ? (
          <ErrorState
            message={catalog.error.message}
            onRetry={() => catalog.refetch()}
            retryLabel={t('Retry', 'फिर से')}
          />
        ) : (
          <div className="catgrid">
            {list.map((c) => {
              const added = have.has(c.key);
              return (
                <button
                  key={c.key}
                  type="button"
                  className={`catitem ${added ? 'is-added' : ''}`}
                  disabled={added}
                  onClick={() => setPicking(c)}
                >
                  <ItemImage src={c.imageUrl} name={c.nameEn ?? c.name} category={c.category} size={72} />
                  <b>{catName(c, lang)}</b>
                  <small>{added ? `✓ ${t('Added', 'जुड़ा हुआ')}` : `+ ${t('Add', 'जोड़ें')}`}</small>
                </button>
              );
            })}
          </div>
        )}
      </div>
      {picking ? <ActivateSheet item={picking} onClose={() => setPicking(null)} /> : null}
    </div>
  );
}

function ActivateSheet({ item, onClose }: { item: CatalogItem; onClose: () => void }) {
  const { t, lang } = useI18n();
  const toast = useToast();
  const qc = useQueryClient();
  const [price, setPrice] = useState('');
  const [unit, setUnit] = useState(normUnit(item.unit || 'kg'));
  const n = Number(price);
  const add = useMutation({
    mutationFn: () =>
      api.post('/v1/vendor/catalog/activate', { key: item.key, price: Math.round(n * 100) / 100, unit }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.products });
      toast.show(
        t(`${catName(item, lang)} added to your items`, `${catName(item, lang)} आपके सामान में जुड़ गया`),
        'good',
      );
      onClose();
    },
    onError: (e) => toast.show(e.message, 'bad'),
  });
  const units = UNITS.includes(unit as (typeof UNITS)[number]) ? UNITS : [unit, ...UNITS];
  return (
    <Sheet
      open
      onClose={onClose}
      title={catName(item, lang)}
      footer={
        <Button block loading={add.isPending} disabled={!(n > 0)} onClick={() => add.mutate()}>
          {t('Add to my items', 'मेरे सामान में जोड़ें')}
        </Button>
      }
    >
      <div className="actv">
        <ItemImage src={item.imageUrl} name={item.nameEn ?? item.name} category={item.category} size={84} />
        <Field
          label={t("Today's rate", 'आज का रेट')}
          prefix="₹"
          inputMode="decimal"
          autoFocus
          value={price}
          onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, '').slice(0, 7))}
        />
      </div>
      <div className="chips" role="radiogroup" aria-label={t('Unit', 'इकाई')}>
        {units.map((u) => (
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
    </Sheet>
  );
}
