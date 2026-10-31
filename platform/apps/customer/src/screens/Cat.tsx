import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import type { VendorType } from '@rozbazaar/shared';
import { useI18n } from '@rozbazaar/web';
import { useCatalog, useVendors } from '../api/queries';
import { slotLine, VENDOR_TYPES } from '../lib/model';
import { soonMsg } from '../app/Layout';
import { useShop } from '../state/shop';
import { useUI } from '../state/ui';
import { useMe } from '../state/useMe';
import { ProductCard, Skeletons } from '../ui/ProductCard';
import { useToast } from '../ui/Toast';

type Filter = 'all' | 'cheap' | 'fresh' | 'drop';
const short = (s: string) => s.replace(' vendor', '').replace(' वाला', '');

export default function Cat() {
  const { type } = useParams();
  const { t, lang } = useI18n();
  const nav = useNavigate();
  const toast = useToast();
  const shop = useShop();
  const ui = useUI();
  const { loggedIn } = useMe();
  const { q, products, favs } = useCatalog(shop.area, loggedIn);
  const vendors = useVendors(shop.area);
  const [filter, setFilter] = useState<Filter>('all');
  const vt = VENDOR_TYPES.find((x) => x.id === type);

  // A filter or vendor picked for sabzi shouldn't stick to fruits.
  useEffect(() => {
    setFilter('all');
    ui.setCatVendor(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset per category
  }, [type]);

  const list = useMemo(() => {
    let l = products.filter((p) => p.cat === type);
    if (ui.catVendor) l = l.filter((p) => p.vendorId === ui.catVendor);
    if (filter === 'cheap') l = [...l].sort((a, b) => a.price - b.price);
    if (filter === 'fresh') l = l.filter((p) => p.fresh);
    if (filter === 'drop') l = l.filter((p) => p.kal);
    return l;
  }, [products, type, ui.catVendor, filter]);

  if (!vt) return <Navigate to="/" replace />;
  const vlist = vendors.data ?? [];
  const effective = ui.catVendor ?? (vlist.length === 1 ? vlist[0]!.id : null);
  const v = vlist.find((x) => x.id === effective);
  const pickedName = ui.catVendor ? vlist.find((x) => x.id === ui.catVendor)?.name : null;

  return (
    <div className="scr on" id="s-cat">
      <div className="topbar">
        <button className="bk" onClick={() => nav('/')} aria-label={t('Back', 'वापस')}>
          ←
        </button>
        <div>
          <h1 id="catTitle">{short(lang === 'en' ? vt.en : vt.hi)}</h1>
          <div className="sub" id="catSub">
            {list.length}
            {t(' items · ', ' सामान · ')}
            {t("today's rate", 'आज का रेट')}
          </div>
        </div>
        <button
          className="bk"
          style={{ marginLeft: 'auto' }}
          onClick={() => nav('/search')}
          aria-label={t('Search', 'खोजें')}
        >
          🔍
        </button>
      </div>
      <div className="catwrap">
        <div className="side nosb" id="catSide">
          {[...VENDOR_TYPES, { id: 'soon' as const, em: '⚡', en: '2–3 hours', hi: '2–3 घंटे' }].map((x) => (
            <button
              key={x.id}
              className={`sitem ${x.id === type ? 'on' : ''}`}
              onClick={() =>
                x.id === 'soon' ? toast(soonMsg(t)) : nav(`/cat/${x.id as VendorType}`, { replace: true })
              }
            >
              <div className="sic">{x.em}</div>
              <div className="sn">{short(lang === 'en' ? x.en : x.hi)}</div>
            </button>
          ))}
        </div>
        <div className="catbody">
          <div className="chips nosb">
            {(
              [
                ['all', t('All', 'सब')],
                ['cheap', t('↓ Price', '↓ सस्ता')],
                ['fresh', t('🌿 Freshest', '🌿 सबसे ताज़ा')],
                ['drop', t('📉 Rate dropped', '📉 रेट गिरा')],
              ] as Array<[Filter, string]>
            ).map(([f, label]) => (
              <button key={f} className={`chip ${filter === f ? 'on' : ''}`} onClick={() => setFilter(f)}>
                {label}
              </button>
            ))}
            <button
              className={`chip ${pickedName ? 'on' : ''}`}
              id="vendorChip"
              onClick={() => ui.setVendorPick({})}
            >
              🧑 {pickedName ?? t('Vendor', 'वेंडर')}
            </button>
          </div>
          {vlist.length ? (
            <div
              className="vendorban"
              id="vendorBanner"
              style={{ display: 'flex' }}
              onClick={() => ui.setVendorPick({})}
              role="button"
              tabIndex={0}
            >
              <div className="vban-av" id="vbanAvatar">
                {v ? (v.name || '?')[0]!.toUpperCase() : '🧑'}
              </div>
              <div className="vban-t">
                <b id="vbanName">
                  {v
                    ? v.name
                    : t(
                        `${vlist.length} vendors deliver here`,
                        `${vlist.length} वेंडर यहाँ डिलीवरी करते हैं`,
                      )}
                </b>
                <span id="vbanMeta">
                  {v
                    ? [
                        v.avgRating && v.avgRating > 0 ? '⭐ ' + v.avgRating.toFixed(1) : null,
                        `${v.ordersCompleted ?? 0} ${t('orders done', 'ऑर्डर पूरे')}`,
                      ]
                        .filter(Boolean)
                        .join(' · ')
                    : t('Tap to choose', 'चुनने के लिए टैप करें')}
                </span>
              </div>
              <span className="vban-ch">›</span>
            </div>
          ) : null}
          <div className="catban">
            <span style={{ fontSize: 26 }}>🕖</span>
            <div>
              <b id="catBanSlot">{slotLine(shop.sel, t, lang)}</b>
              <span>{t('vendor weighs at your door, you pay then', 'वेंडर घर पर तौलकर बिल बनाएगा')}</span>
            </div>
          </div>
          <div className="grid" id="catGrid">
            {q.isPending ? (
              <Skeletons n={6} />
            ) : list.length ? (
              list.map((p) => <ProductCard key={p.id} p={p} fav={favs.has(p.id)} />)
            ) : (
              <div className="empty" style={{ gridColumn: '1/-1' }}>
                <div className="ee">🧺</div>
                <b>{t('Nothing here right now', 'अभी कुछ नहीं है')}</b>
                <p>{t('Try another filter', 'दूसरा फ़िल्टर आज़माएँ')}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
