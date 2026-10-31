import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useI18n } from '@rozbazaar/web';
import { useAddresses } from '../api/queries';
import { Art } from '../art/Art';
import { lineOf, orderAddress } from '../lib/addr';
import { addrIcon, addrName, pname, slotLine, vtype } from '../lib/model';
import { useShop } from '../state/shop';
import { useUI } from '../state/ui';
import { useCart } from '../state/useCart';
import { useCheckout } from '../state/useCheckout';
import { useMe } from '../state/useMe';
import { useToast } from '../ui/Toast';

export default function Basket() {
  const { t, lang } = useI18n();
  const nav = useNavigate();
  const toast = useToast();
  const shop = useShop();
  const ui = useUI();
  const { loggedIn } = useMe();
  const { products, prod, total } = useCart();
  const { placeBooking } = useCheckout();
  const addrs = useAddresses(loggedIn);
  const addr = loggedIn ? orderAddress(addrs.data, shop.addrId) : null;

  // An item the vendor stopped selling since the basket was filled is removed (with a word).
  useEffect(() => {
    if (!products.length) return;
    const gone = Object.keys(shop.cart).filter((id) => !prod(id));
    if (!gone.length) return;
    gone.forEach((id) => shop.setQty(id, -(shop.cart[id] ?? 0)));
    toast(
      t(
        'An item is no longer sold and was removed from your basket',
        'एक सामान अब नहीं बिकता — टोकरी से हटा दिया',
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- when the catalogue changes
  }, [products]);

  const ids = Object.keys(shop.cart).filter((id) => prod(id));
  const v = vtype(shop.sel.type ?? prod(ids[0] ?? '')?.cat ?? 'vegetable');

  return (
    <div className="scr on" id="s-basket">
      <div className="topbar">
        <button className="bk" onClick={() => nav('/')} aria-label={t('Back', 'वापस')}>
          ←
        </button>
        <div>
          <h1>{t('Review your basket', 'टोकरी देखें')}</h1>
          <div className="sub">
            {t('prices are estimates until the vendor weighs', 'वेंडर के तौलने तक सब अनुमानित है')}
          </div>
        </div>
      </div>
      <div className="pg" id="basketBody">
        {!ids.length ? (
          <div className="empty">
            <div className="ee">🧺</div>
            <b>{t('Your basket is empty', 'टोकरी खाली है')}</b>
            <p>
              {t(
                'Add some vegetables and book a vendor for a slot',
                'सब्ज़ी डालें और वेंडर का स्लॉट बुक करें',
              )}
            </p>
            <button
              className="bigbtn"
              style={{ marginTop: 20, padding: '14px 28px' }}
              onClick={() => nav('/cat/vegetable')}
            >
              {t('Browse vegetables', 'सब्ज़ी देखें')}
            </button>
          </div>
        ) : (
          <>
            <div className="card" style={{ background: 'var(--lime-s)', borderColor: 'transparent' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 28 }}>{v.em}</span>
                <div>
                  <b style={{ fontSize: 15 }}>{lang === 'en' ? v.en : v.hi}</b>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--g-dk)' }}>
                    🕖{' '}
                    {shop.sel.slot
                      ? slotLine(shop.sel, t, lang)
                      : t('Slot not chosen yet', 'स्लॉट अभी नहीं चुना')}
                  </div>
                </div>
                <button className="pill" style={{ marginLeft: 'auto' }} onClick={() => nav('/slot')}>
                  {t('Change', 'बदलें')}
                </button>
              </div>
              <div
                style={{
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: 'var(--g-dk)',
                  marginTop: 12,
                  borderTop: '1px dashed rgba(20,104,44,.25)',
                  paddingTop: 11,
                }}
              >
                {addr ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ minWidth: 0, flex: 1 }}>
                      {addrIcon(addr.label)}{' '}
                      <b>
                        {t('Deliver to', 'यहाँ मँगाएँ')}: {addrName(addr.label, t)}
                      </b>
                      <br />
                      <span style={{ fontWeight: 600 }}>{lineOf(addr)}</span>
                    </span>
                    <button
                      className="pill"
                      onClick={() =>
                        (addrs.data?.length ?? 0) > 0
                          ? ui.setAddrPick({ thenBook: false })
                          : nav('/address/new?from=checkout')
                      }
                    >
                      {t('Change', 'बदलें')}
                    </button>
                  </div>
                ) : (
                  <>
                    📍{' '}
                    {t(
                      'Address not added yet — you will be asked before confirming',
                      'पता अभी नहीं डाला — पक्का करने से पहले पूछेंगे',
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="h2">{t('Your items', 'आपका सामान')}</div>
            <div className="card">
              {ids.map((id) => {
                const p = prod(id)!;
                return (
                  <div className="brow" key={id} style={p.fresh ? undefined : { opacity: 0.7 }}>
                    <div className="be">
                      <Art photo={p.photo} artKey={p.artKey} em={p.em} alt={p.en} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <b>{pname(p, lang)}</b>
                      <span>
                        {p.unit} · ₹{p.price}
                      </span>
                      {p.fresh ? null : (
                        <span style={{ display: 'block', color: '#D93025', fontWeight: 800 }}>
                          {t('Out of stock now — please remove', 'अभी स्टॉक ख़त्म — कृपया हटाएँ')}
                        </span>
                      )}
                    </div>
                    <div className="qty">
                      <button onClick={() => shop.setQty(id, -1)} aria-label={t('One less', 'एक कम')}>
                        −
                      </button>
                      <i>{shop.cart[id]}</i>
                      <button onClick={() => shop.setQty(id, 1)} aria-label={t('One more', 'एक और')}>
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="h2">{t('Note for the vendor', 'वेंडर के लिए नोट')}</div>
            <textarea
              className="field"
              id="vnote"
              rows={2}
              maxLength={300}
              value={shop.note}
              onChange={(e) => shop.setNote(e.target.value)}
              placeholder={t('e.g. more tomatoes, less coriander', 'जैसे: ज़्यादा टमाटर, कम धनिया')}
            />

            <div className="card" style={{ marginTop: 20 }}>
              <div className="trow">
                <span>
                  {t('Items', 'सामान')} ({shop.count})
                </span>
                <span>₹{total}</span>
              </div>
              <div className="trow">
                <span>{t('Delivery', 'डिलीवरी')}</span>
                <span style={{ color: 'var(--g)', fontWeight: 800 }}>{t('Free', 'मुफ़्त')}</span>
              </div>
              <div className="trow big">
                <div>
                  <b>₹{total}</b>
                  <span>{t('ESTIMATED TOTAL', 'अनुमानित कुल')}</span>
                </div>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: 'var(--mut)',
                    maxWidth: 170,
                    textAlign: 'right',
                  }}
                >
                  {t('final price is set at your door', 'आख़िरी दाम घर पर तय होगा')}
                </span>
              </div>
            </div>

            <div className="note">
              <span>⚖️</span>
              <span>
                {t(
                  'The vendor weighs everything in front of you and finalises the bill. Payment goes straight to the vendor — cash or UPI. Nothing is charged now.',
                  'वेंडर आपके सामने तौलकर फ़ाइनल बिल बनाएगा। पेमेंट सीधे वेंडर को — कैश या UPI। अभी कोई पैसा नहीं लगता।',
                )}
              </span>
            </div>
          </>
        )}
      </div>
      {ids.length ? (
        <div className="stick" id="basketStick" style={{ display: 'block' }}>
          <div className="stick-in">
            <div className="tot">
              <b id="stotal">₹{total}</b>
              <span>{t('Estimated total', 'अनुमानित कुल')}</span>
            </div>
            <button className="bigbtn" onClick={() => void placeBooking()}>
              {t('Confirm booking', 'बुकिंग पक्की करें')}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
