import { useMemo, useState, useDeferredValue } from 'react';
import { Link } from 'react-router';
import type { Product, VendorType } from '@rozbazaar/shared';
import { EmptyState, ErrorState, Skeleton, useI18n, useToast } from '@rozbazaar/web';
import { useAreas, useHome, useLastOrder, useSession } from '../../api/queries';
import { useShop } from '../../state/shop';
import { NotificationsButton } from '../notifications/NotificationsButton';
import { ProductCard } from './ProductCard';
import { AreaSheet, VendorPickerSheet, WaitlistCard } from './sheets';
import { itemKey, nameIndex, productName, TYPE_ICON, typeLabel } from './names';
import { CartBar } from './CartBar';

type Tab = 'all' | VendorType;

export default function HomePage() {
  const { t, lang, setLang } = useI18n();
  const toast = useToast();
  const shop = useShop();
  const session = useSession();
  const loggedIn = Boolean(session.data?.authenticated);
  const areas = useAreas();
  const home = useHome(shop.area, loggedIn);
  const lastOrder = useLastOrder(loggedIn);
  const [areaOpen, setAreaOpen] = useState(!shop.area);
  const [tab, setTab] = useState<Tab>('all');
  const [search, setSearch] = useState('');
  const q = useDeferredValue(search.trim().toLowerCase());
  const [picking, setPicking] = useState<Product[] | null>(null);

  // Group the same item sold by different vendors.
  const groups = useMemo(() => {
    const map = new Map<string, Product[]>();
    for (const p of home.data?.products ?? []) {
      const k = itemKey(p);
      map.set(k, [...(map.get(k) ?? []), p]);
    }
    return map;
  }, [home.data]);

  const cards = useMemo(() => {
    const out: { key: string; shown: Product; options: Product[] }[] = [];
    for (const [key, options] of groups) {
      // Show the vendor already in the basket, else the cheapest in-stock one.
      const inCart = options.find((o) => shop.cart[o.id]);
      const shown =
        inCart ?? [...options].sort((a, b) => Number(b.inStock) - Number(a.inStock) || a.price - b.price)[0]!;
      if (tab !== 'all' && shown.category !== tab) continue;
      if (q && !options.some((o) => [o.name, o.nameEn, o.nameHi].some((n) => n?.toLowerCase().includes(q))))
        continue;
      out.push({ key, shown, options });
    }
    return out.sort((a, b) => Number(b.shown.inStock) - Number(a.shown.inStock));
  }, [groups, tab, q, shop.cart]);

  const tabs = useMemo(() => {
    const present = new Set((home.data?.products ?? []).map((p) => p.category));
    return (['vegetable', 'onion_potato', 'fruit'] as const).filter((x) => present.has(x));
  }, [home.data]);

  function add(p: Product): boolean {
    if (shop.add(p) === 'other-vendor') {
      toast.show(
        t(
          'Your basket has another vendor’s items — one booking goes to one vendor.',
          'टोकरी में दूसरे वेंडर का सामान है — एक बुकिंग एक ही वेंडर को जाती है।',
        ),
        'bad',
      );
      return false;
    }
    return true;
  }

  function pickVendor(p: Product) {
    setPicking(null);
    if (!add(p)) return;
    toast.show(
      t(
        `${productName(p, lang)} added — from ${p.vendorName}`,
        `${productName(p, lang)} जुड़ गया — ${p.vendorName} से`,
      ),
      'good',
    );
  }

  const againNames = nameIndex(home.data?.products ?? [], lang);

  function orderAgain() {
    const products = home.data?.products ?? [];
    let added = 0;
    for (const item of lastOrder.data ?? []) {
      const p = products.find((x) => x.id === item.productId && x.inStock);
      if (p && shop.add(p) === 'added') added++;
    }
    toast.show(
      added
        ? t(`${added} items added`, `${added} सामान जुड़े`)
        : t('Those items are not available now', 'वो सामान अभी उपलब्ध नहीं'),
      added ? 'good' : 'bad',
    );
  }

  return (
    <div className="home">
      <header className="hhead">
        <div className="hhead__top">
          <img src="/brand/mark.png" alt="RozBazaar" className="hhead__logo" width={40} height={34} />
          <button type="button" className="hhead__area" onClick={() => setAreaOpen(true)}>
            <small>{t('Delivering to', 'डिलीवरी')}</small>
            <b>📍 {shop.area ?? t('Choose village', 'गाँव चुनें')} ▾</b>
          </button>
          <button
            type="button"
            className="langbtn"
            onClick={() => setLang(lang === 'en' ? 'hi' : 'en')}
            aria-label={t('Change language', 'भाषा बदलें')}
          >
            {lang === 'en' ? 'हि' : 'EN'}
          </button>
          <NotificationsButton enabled={loggedIn} />
        </div>
        <p className="hhead__promise rv d1">
          {t('Fresh sabzi at your door —', 'ताज़ी सब्ज़ी आपके दरवाज़े पर —')}{' '}
          <b>{t('in the time slot you choose', 'आपके चुने समय पर')}</b>
        </p>
        <label className="search rv d2">
          <span aria-hidden>🔍</span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('Search tomato, potato, apple…', 'टमाटर, आलू, सेब खोजें…')}
            aria-label={t('Search items', 'सामान खोजें')}
          />
        </label>
      </header>

      <div className="scallop" aria-hidden />

      {tabs.length > 1 ? (
        <div className="tabs" role="tablist" aria-label={t('Categories', 'श्रेणियाँ')}>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'all'}
            className={`rb-chip ${tab === 'all' ? 'is-on' : ''}`}
            onClick={() => setTab('all')}
          >
            🧺 {t('All', 'सब')}
          </button>
          {tabs.map((x) => (
            <button
              key={x}
              type="button"
              role="tab"
              aria-selected={tab === x}
              className={`rb-chip ${tab === x ? 'is-on' : ''}`}
              onClick={() => setTab(x)}
            >
              {TYPE_ICON[x]} {typeLabel(x, lang)}
            </button>
          ))}
        </div>
      ) : null}

      {loggedIn && (lastOrder.data?.length ?? 0) > 0 && !q ? (
        <div className="again rv d2">
          <span className="again__icon" aria-hidden>
            🔁
          </span>
          <div className="again__txt">
            <b>{t('Order again', 'फिर से ऑर्डर करें')}</b>
            <small>
              {lastOrder
                .data!.slice(0, 3)
                .map((i) => againNames.get(i.productId) ?? i.name)
                .join(', ')}
            </small>
          </div>
          <button type="button" className="rb-btn rb-btn--primary again__btn" onClick={orderAgain}>
            <span>{t('Add', 'जोड़ें')}</span>
          </button>
        </div>
      ) : null}

      <section className="grid-wrap" aria-live="polite">
        {!shop.area ? (
          <EmptyState
            icon="📍"
            title={t(
              'Choose your village to see what vendors have today',
              'आज वेंडर के पास क्या है, देखने के लिए गाँव चुनें',
            )}
          />
        ) : home.isPending ? (
          <div className="pgrid">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="pcard">
                <Skeleton h={112} r={14} />
                <Skeleton h={14} w="70%" />
                <Skeleton h={12} w="40%" />
              </div>
            ))}
          </div>
        ) : home.isError ? (
          <ErrorState
            message={home.error.message}
            onRetry={() => home.refetch()}
            retryLabel={t('Try again', 'फिर कोशिश करें')}
          />
        ) : !home.data!.served ? (
          <WaitlistCard area={shop.area} />
        ) : cards.length === 0 ? (
          <EmptyState
            icon="🔍"
            title={t('Nothing found', 'कुछ नहीं मिला')}
            text={t('Try another name', 'दूसरा नाम लिखकर देखें')}
          />
        ) : (
          <div className="pgrid">
            {cards.map((c, i) => (
              <ProductCard
                key={c.key}
                index={i}
                product={c.shown}
                options={c.options}
                qty={shop.cart[c.shown.id] ?? 0}
                onAdd={add}
                onQty={(n) => shop.setQty(c.shown.id, n)}
                onPick={() => setPicking(c.options)}
              />
            ))}
          </div>
        )}
      </section>

      <footer className="minifoot">
        <p>
          {t(
            'Prices are today’s rates. The vendor weighs at your door — you pay after checking.',
            'दाम आज के रेट हैं। वेंडर दरवाज़े पर तौलता है — जाँच कर पैसे दें।',
          )}
        </p>
        <Link to="/account">{t('Contact us', 'संपर्क करें')}</Link>
      </footer>

      <CartBar />

      <AreaSheet
        open={areaOpen}
        onClose={() => setAreaOpen(false)}
        areas={areas.data ?? []}
        current={shop.area}
        onPick={(a) => {
          shop.setArea(a);
          setAreaOpen(false);
        }}
      />
      {picking ? (
        <VendorPickerSheet
          options={picking}
          cartVendorId={shop.cartVendorId}
          onClose={() => setPicking(null)}
          onPick={pickVendor}
        />
      ) : null}
    </div>
  );
}
