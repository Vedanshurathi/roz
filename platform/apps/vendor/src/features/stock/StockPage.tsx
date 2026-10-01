import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { VendorProduct } from '@rozbazaar/shared';
import { EmptyState, ErrorState, ItemImage, Skeleton, useI18n, useToast } from '@rozbazaar/web';
import { api } from '../../api/client';
import { keys, useProducts } from '../../api/queries';
import { Toggle } from '../../components/Toggle';
import { productName, unitLabel } from '../../lib/names';
import { matchScore } from '../../lib/search';

export default function StockPage() {
  const { t, lang } = useI18n();
  const products = useProducts();
  const [q, setQ] = useState('');
  const all = products.data ?? [];
  const list = q.trim() ? all.filter((p) => matchScore([p.name, p.nameEn, p.nameHi], q) > 0) : all;
  const available = all.filter((p) => p.inStock).length;

  return (
    <div className="page page--cream">
      <header className="topbar topbar--plain">
        <div className="topbar__t">
          <h1>{t('Stock & rates', 'स्टॉक और रेट')}</h1>
          <p>{t("today's rate, updated by you", 'आज का रेट, आपके हाथ में')}</p>
        </div>
      </header>
      <div className="wrap">
        <div className="note note--blue">
          <span aria-hidden>📣</span>
          <span>
            {t(
              'Customers see these rates before booking. Change them when the mandi rate changes — each rate saves as you type.',
              'ग्राहक बुकिंग से पहले ये रेट देखते हैं। मंडी का रेट बदले तो यहाँ बदलें — रेट लिखते ही सेव हो जाता है।',
            )}
          </span>
        </div>
        <div className="sechd">
          <h2>{t('Your items', 'आपका सामान')}</h2>
          <span>
            {available} {t('available', 'उपलब्ध')}
          </span>
        </div>
        <div className="addrow">
          <Link to="/stock/new" className="dashbtn">
            + {t('Add a new item', 'नया सामान जोड़ें')}
          </Link>
          <Link to="/stock/catalog" className="dashbtn dashbtn--g">
            🗂️ {t('Browse the catalogue', 'कैटलॉग देखें')}
          </Link>
        </div>
        {all.length > 6 ? (
          <div className="searchbox">
            <span aria-hidden>🔍</span>
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t('Find an item…', 'सामान ढूँढें…')}
              aria-label={t('Find an item', 'सामान ढूँढें')}
            />
          </div>
        ) : null}
        {products.isPending ? (
          <div className="stack">
            <Skeleton h={130} r={18} />
            <Skeleton h={130} r={18} />
          </div>
        ) : products.isError ? (
          <ErrorState
            message={products.error.message}
            onRetry={() => products.refetch()}
            retryLabel={t('Retry', 'फिर से')}
          />
        ) : !all.length ? (
          <EmptyState
            icon="🥬"
            title={t('No items yet', 'अभी कोई सामान नहीं')}
            text={t('Add from the catalogue — it takes a minute.', 'कैटलॉग से जोड़ें — एक मिनट लगेगा।')}
          />
        ) : (
          <div className="stack">
            {list.map((p) => (
              <StockCard key={p.id} p={p} lang={lang} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StockCard({ p, lang }: { p: VendorProduct; lang: 'en' | 'hi' }) {
  const { t } = useI18n();
  const toast = useToast();
  const qc = useQueryClient();
  const [price, setPrice] = useState(String(p.price));
  const [saved, setSaved] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    setPrice(String(p.price));
  }, [p.price]);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const stock = useMutation({
    mutationFn: (inStock: boolean) => api.post(`/v1/vendor/products/${p.id}/stock`, { inStock }),
    onSuccess: (_r, inStock) => {
      qc.setQueryData<VendorProduct[]>(keys.products, (list) =>
        list?.map((x) => (x.id === p.id ? { ...x, inStock } : x)),
      );
      toast.show(
        inStock
          ? t(`${productName(p, lang)} is available`, `${productName(p, lang)} उपलब्ध है`)
          : t(`${productName(p, lang)} marked out of stock`, `${productName(p, lang)} का स्टॉक ख़त्म`),
      );
    },
    onError: (e) => toast.show(e.message, 'bad'),
  });
  const rate = useMutation({
    mutationFn: (value: number) =>
      api.post('/v1/vendor/products/prices', { prices: [{ id: p.id, price: value }] }),
    onSuccess: (_r, value) => {
      qc.setQueryData<VendorProduct[]>(keys.products, (list) =>
        list?.map((x) => (x.id === p.id ? { ...x, price: value, priceIsStale: false } : x)),
      );
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1800);
    },
    onError: (e) => toast.show(e.message, 'bad'),
  });

  function onPrice(v: string) {
    const clean = v.replace(/[^\d.]/g, '').slice(0, 7);
    setPrice(clean);
    setSaved(false);
    window.clearTimeout(timer.current);
    const n = Number(clean);
    if (!clean || !Number.isFinite(n) || n <= 0 || n === p.price) return;
    // Save shortly after the vendor stops typing (decimals allowed).
    timer.current = window.setTimeout(() => rate.mutate(Math.round(n * 100) / 100), 900);
  }

  const review =
    p.reviewStatus === 'pending'
      ? { text: t('⏳ Waiting for RozBazaar approval', '⏳ RozBazaar की मंज़ूरी बाकी'), tone: 'o' }
      : p.reviewStatus === 'rejected'
        ? {
            text: `✕ ${t('Not approved', 'मंज़ूर नहीं')}${p.reviewNote ? ` — ${p.reviewNote}` : ''}`,
            tone: 'r',
          }
        : null;

  return (
    <article className={`scard ${p.inStock ? '' : 'is-out'}`}>
      <div className="scard__top">
        <ItemImage src={p.imageUrl} name={p.name} category={p.category} size={56} />
        <Link to={`/stock/${p.id}`} className="scard__t">
          <b>{productName(p, lang)} ›</b>
          {productName(p, lang) !== p.name ? <small>{p.name}</small> : null}
          {review ? (
            <span className={`rb-pill rb-pill--${review.tone}`}>{review.text}</span>
          ) : (
            <span className={p.inStock ? 'ok' : 'bad'}>
              {p.inStock ? t('Available', 'उपलब्ध') : t('Out of stock', 'स्टॉक ख़त्म')}
            </span>
          )}
        </Link>
        <Toggle
          on={p.inStock}
          disabled={stock.isPending}
          onChange={(v) => stock.mutate(v)}
          label={t(`${productName(p, lang)} in stock`, `${productName(p, lang)} स्टॉक में`)}
        />
      </div>
      <label className="scard__rate">
        <span>
          {t("Today's rate", 'आज का रेट')}
          {p.priceIsStale && !saved ? <em className="stale">{t('old — update', 'पुराना — बदलें')}</em> : null}
          {saved ? <em className="savedok">✓ {t('saved', 'सेव')}</em> : null}
        </span>
        <span className="scard__in">
          ₹
          <input
            inputMode="decimal"
            value={price}
            onChange={(e) => onPrice(e.target.value)}
            aria-label={t(`Rate for ${productName(p, lang)}`, `${productName(p, lang)} का रेट`)}
          />
        </span>
        <span className="scard__u">/{unitLabel(p.unit, lang)}</span>
      </label>
    </article>
  );
}
