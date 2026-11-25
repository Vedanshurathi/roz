import { useState } from 'react';
import { useI18n } from '@rozbazaar/web';
import { useProductVendors, useVendors } from '../api/queries';
import { useShop } from '../state/shop';
import { useUI } from '../state/ui';
import { useCart } from '../state/useCart';
import { useToast } from '../ui/Toast';
import { Skeletons } from '../ui/ProductCard';

type Sort = 'rating' | 'orders' | 'name';

/**
 * Zomato-style vendor picker: compare everyone selling one item (and add from the one you pick),
 * or browse every vendor in the village.
 */
export function VendorPicker() {
  const { t } = useI18n();
  const ui = useUI();
  const shop = useShop();
  const toast = useToast();
  const { prod, addCart } = useCart();
  const [sort, setSort] = useState<Sort>('rating');
  const pick = ui.vendorPick;
  const product = pick?.pid ? prod(pick.pid) : undefined;
  const productMode = Boolean(pick?.productName);
  // Matched by the vendor's own item name ("Tamatar") — the English name matched nothing.
  const forProduct = useProductVendors(
    shop.area,
    productMode ? (product?.roman ?? pick?.productName ?? null) : null,
  );
  const inArea = useVendors(pick ? shop.area : null);
  const open = Boolean(pick);
  const close = () => ui.setVendorPick(null);

  const name = pick?.productName ?? '';
  const title = pick?.add
    ? t(`Two vendors sell ${name}`, `दो वेंडर बेचते हैं: ${name}`)
    : productMode
      ? t(`Who sells ${name}?`, `कौन बेचता है ${name}?`)
      : t('Choose your vendor', 'अपना वेंडर चुनें');
  const sub = pick?.add
    ? t('Pick the one you want to buy from', 'जिससे लेना है उसे चुनें')
    : productMode
      ? t('Every vendor with this in stock right now', 'जिनके पास यह अभी स्टॉक में है')
      : t('Every vendor serving your village, side by side', 'आपके गाँव के सभी वेंडर, एक साथ');

  type Row = {
    id: string;
    name: string;
    rating: number;
    orders: number;
    price?: number;
    unit?: string;
    inStock?: boolean;
    productId?: string;
    count?: number | null;
    photo?: string | null;
  };
  const rows: Row[] = productMode
    ? (forProduct.data ?? []).map((v) => ({
        id: v.vendorId,
        name: v.vendorName,
        rating: v.avgRating ?? 0,
        orders: inArea.data?.find((x) => x.id === v.vendorId)?.ordersCompleted ?? 0,
        price: v.price,
        unit: v.unit,
        inStock: v.inStock,
        productId: v.productId,
      }))
    : (inArea.data ?? []).map((v) => ({
        id: v.id,
        name: v.name,
        rating: v.avgRating ?? 0,
        orders: v.ordersCompleted ?? 0,
        count: v.productCount,
        photo: v.photoUrl,
      }));
  if (sort === 'rating') rows.sort((a, b) => b.rating - a.rating);
  if (sort === 'orders') rows.sort((a, b) => b.orders - a.orders);
  if (sort === 'name') rows.sort((a, b) => a.name.localeCompare(b.name));
  const loading = productMode ? forProduct.isPending : inArea.isPending;
  // A booking goes to one vendor: the vendor already in the basket is the obvious choice.
  const cartVendor = pick?.add ? shop.sel.vendorId : null;

  function choose(r: Row) {
    if (pick?.add) {
      if (r.inStock === false)
        return toast(t(`${r.name} has this out of stock right now`, `अभी ${r.name} के पास यह ख़त्म है`));
      if (r.productId) {
        addCart(r.productId);
        shop.setSel({ vendorId: r.id, type: inArea.data?.find((x) => x.id === r.id)?.type ?? shop.sel.type });
        toast(t(`${name} added — from ${r.name}`, `${name} जुड़ गया — ${r.name} से`));
      }
      return close();
    }
    if (productMode) return close();
    ui.setCatVendor(r.id);
    close();
  }

  return (
    <>
      <div className={`loc-bg ${open ? 'on' : ''}`} onClick={close} />
      <div
        className={`loc-ask ${open ? 'on' : ''}`}
        style={{ maxHeight: '78vh', overflowY: 'auto' }}
        role="dialog"
        aria-modal="true"
        aria-hidden={!open}
      >
        <b className="disp" style={{ fontSize: 20 }}>
          {title}
        </b>
        <p style={{ marginTop: 4 }}>{sub}</p>
        <div className="row" style={{ justifyContent: 'center', marginTop: 14, gap: 8 }}>
          {(
            [
              ['rating', t('⭐ Top rated', '⭐ सबसे अच्छी रेटिंग')],
              ['orders', t('✅ Most orders', '✅ सबसे ज़्यादा ऑर्डर')],
              ['name', t('🔤 Name', '🔤 नाम')],
            ] as Array<[Sort, string]>
          ).map(([k, label]) => (
            <button key={k} className={`chip ${sort === k ? 'on' : ''}`} onClick={() => setSort(k)}>
              {label}
            </button>
          ))}
        </div>
        <div style={{ marginTop: 16, textAlign: 'left' }}>
          {!open ? null : loading ? (
            <Skeletons n={3} />
          ) : rows.length ? (
            rows.map((v) => (
              <button
                key={v.id}
                className={`vcard ${ui.catVendor === v.id ? 'sel' : ''}`}
                onClick={() => choose(v)}
                disabled={productMode && v.inStock === false}
                style={productMode && v.inStock === false ? { opacity: 0.5 } : undefined}
              >
                {v.photo ? (
                  <img className="vav" src={v.photo} alt="" />
                ) : (
                  <div className="vav">{(v.name || '?')[0]!.toUpperCase()}</div>
                )}
                <div className="vt">
                  <b>
                    {v.name}
                    {cartVendor && v.id === cartVendor ? (
                      <>
                        {' · '}
                        <span style={{ color: 'var(--g-dk)', fontWeight: 800 }}>
                          {t('already in your cart', 'पहले से टोकरी में')}
                        </span>
                      </>
                    ) : null}
                  </b>
                  <div className="vmeta">
                    {v.rating > 0 ? (
                      <>
                        <span className="vstars">⭐ {v.rating.toFixed(1)}</span>
                        <span className="vdot">·</span>
                      </>
                    ) : null}
                    <span className="vch">
                      {v.orders} {t('orders done', 'ऑर्डर पूरे')}
                    </span>
                    {productMode ? (
                      <>
                        <span className="vdot">·</span>
                        <span className="vch" style={{ color: 'var(--g-dk)', fontWeight: 800 }}>
                          ₹{v.price}/{v.unit}
                        </span>
                        {v.inStock === false ? (
                          <>
                            <span className="vdot">·</span>
                            <span className="vch" style={{ color: '#D93025', fontWeight: 800 }}>
                              {t('Out of stock', 'स्टॉक ख़त्म')}
                            </span>
                          </>
                        ) : null}
                      </>
                    ) : (
                      <>
                        <span className="vdot">·</span>
                        <span className="vch">
                          {v.count ?? 0} {t('items', 'सामान')}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </button>
            ))
          ) : (
            <div className="empty">
              <div className="ee">🧑‍🌾</div>
              <b>
                {productMode
                  ? t('No one sells this here yet', 'अभी कोई यह नहीं बेचता')
                  : t('No vendors here yet', 'अभी कोई वेंडर नहीं')}
              </b>
            </div>
          )}
        </div>
        {productMode ? null : (
          <button
            className="ghostbtn"
            style={{ marginTop: 6 }}
            onClick={() => {
              ui.setCatVendor(null);
              close();
            }}
          >
            {t('Show all vendors together', 'सभी वेंडर एक साथ दिखाएँ')}
          </button>
        )}
      </div>
    </>
  );
}
