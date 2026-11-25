/**
 * The original app's chrome around every screen: top bar (tablet/laptop), cart bar, bottom nav
 * (phone), footer (laptop), chat bubble, splash, pop-ups and the background watchers.
 */
import { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { useI18n } from '@rozbazaar/web';
import { api } from '../api/client';
import { useAreas, useBookings, useCatalog, useNotifications } from '../api/queries';
import { MIN_BASKET, pname } from '../lib/model';
import { AddrPicker } from '../overlays/AddrPicker';
import { AreaSheet } from '../overlays/AreaSheet';
import { CheckSheet } from '../overlays/CheckSheet';
import { DonePopup } from '../overlays/DonePopup';
import { LocAsk } from '../overlays/LocAsk';
import { NotifSheet } from '../overlays/NotifSheet';
import { PermBar } from '../overlays/PermBar';
import { VendorPicker } from '../overlays/VendorPicker';
import { savePush } from '../state/push';
import { useShop } from '../state/shop';
import { useUI } from '../state/ui';
import { useCart } from '../state/useCart';
import { useCheckout } from '../state/useCheckout';
import { useMe } from '../state/useMe';
import { useToast } from '../ui/Toast';
import { UnreadDot } from '../ui/UnreadDot';
import { IgIcon, LINKS, PlayIcon, WaIcon, YtIcon } from '../ui/Social';
import { VENDOR_SITE } from '../config';

/** Which screen a path is, in the original app's names. */
export function screenOf(path: string): string {
  if (path === '/') return 'home';
  if (path.startsWith('/cat/')) return 'cat';
  if (path.startsWith('/address')) return 'loc';
  if (path.startsWith('/account')) return 'acct';
  if (path.startsWith('/bill/')) return 'bill';
  if (path.startsWith('/rate/')) return 'rate';
  return path.slice(1).split('/')[0] || 'home';
}
const NAVS = ['home', 'cat', 'search', 'bookings', 'acct'];

export const soonMsg = (t: (en: string, hi: string) => string) =>
  t('2–3 hour delivery — coming soon ⚡', '2–3 घंटे में डिलीवरी — जल्द आ रही है ⚡');

function readJSON<T>(store: Storage, key: string, fallback: T): T {
  try {
    return (JSON.parse(store.getItem(key) ?? 'null') as T) ?? fallback;
  } catch {
    return fallback;
  }
}
function writeJSON(store: Storage, key: string, v: unknown) {
  try {
    store.setItem(key, JSON.stringify(v));
  } catch {
    /* storage blocked */
  }
}

export function Layout() {
  const { t, lang, setLang } = useI18n();
  const nav = useNavigate();
  const { pathname } = useLocation();
  const scr = screenOf(pathname);
  const shop = useShop();
  const ui = useUI();
  const toast = useToast();
  const { me, loggedIn, needsProfile, initial } = useMe();
  const { total } = useCart();
  const { placeBooking } = useCheckout();
  const { products, favs } = useCatalog(shop.area, loggedIn);
  const areas = useAreas();
  const bookings = useBookings(loggedIn);
  const notifs = useNotifications(loggedIn);
  const [splash, setSplash] = useState(true);
  const [wide, setWide] = useState(() => window.innerWidth);

  // splash, visit ping, resize
  useEffect(() => {
    const id = window.setTimeout(() => setSplash(false), 2100);
    try {
      if (!sessionStorage.getItem('rbx.visit')) {
        sessionStorage.setItem('rbx.visit', '1');
        void api.post('/v1/public/visits', { page: 'customer' }).catch(() => undefined);
      }
    } catch {
      /* storage blocked */
    }
    const onResize = () => setWide(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  // Name + phone are needed before anything else (e.g. after a first Google login).
  useEffect(() => {
    if (needsProfile && scr !== 'login') {
      toast(t('Please add your name and number to continue', 'आगे बढ़ने के लिए नाम और नंबर डालें'));
      nav('/login', { replace: true });
    }
  }, [needsProfile, scr, nav, toast, t]);

  // After login: language synced, push saved, and a booking that was interrupted carries on.
  const adopted = useRef(false);
  useEffect(() => {
    if (!loggedIn || needsProfile || adopted.current) return;
    adopted.current = true;
    void api.put('/v1/customer/language', { lang }).catch(() => undefined);
    if ('Notification' in window && Notification.permission === 'granted')
      void savePush().catch(() => undefined);
    if (!shop.pendingCheckout && scr === 'login') nav('/account', { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per login
  }, [loggedIn, needsProfile]);
  useEffect(() => {
    if (!loggedIn) adopted.current = false;
  }, [loggedIn]);
  // (waits for the catalogue, so prices and stock are known — e.g. after the Google redirect)
  const catalogReady = products.length > 0;
  useEffect(() => {
    if (loggedIn && !needsProfile && catalogReady && shop.pendingCheckout && ['login', 'home'].includes(scr))
      void placeBooking();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- when login + catalogue are both ready
  }, [loggedIn, needsProfile, catalogReady, shop.pendingCheckout]);

  // "Your vendor is on the way" — once per order per visit.
  useEffect(() => {
    const seen = new Set(readJSON<string[]>(sessionStorage, 'rb_way_seen', []));
    let changed = false;
    for (const b of bookings.data ?? []) {
      if (b.status === 'on_the_way' && !seen.has(b.code)) {
        seen.add(b.code);
        changed = true;
        toast(
          '🛵 ' +
            (b.vendorName || t('Your vendor', 'आपका वेंडर')) +
            ' ' +
            t('is on the way!', 'रास्ते में है!'),
        );
      }
    }
    if (changed) writeJSON(sessionStorage, 'rb_way_seen', [...seen]);
  }, [bookings.data, toast, t]);

  // A price changed on something in the basket or a favourite.
  useEffect(() => {
    if (!products.length) return;
    const watched = new Set([...Object.keys(shop.cart), ...favs]);
    if (!watched.size) return;
    const seen = readJSON<Record<string, number>>(localStorage, 'rb_price_seen', {});
    for (const p of products) {
      if (!watched.has(p.id)) continue;
      const old = seen[p.id];
      if (old != null && old !== p.price) {
        const down = p.price < old;
        toast(
          `${down ? '📉' : '📈'} ${pname(p, lang)} ${t('price', 'का रेट')} ${down ? t('dropped', 'कम हुआ') : t('gone up', 'बढ़ गया')} — ₹${old} → ₹${p.price}`,
        );
      }
      seen[p.id] = p.price;
    }
    writeJSON(localStorage, 'rb_price_seen', seen);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when prices arrive
  }, [products]);

  // Items left in the basket from last time — a nudge at most every 6 hours.
  useEffect(() => {
    if (!shop.count) return;
    const last = Number(localStorage.getItem('rb_cart_remind_at') || 0);
    if (Date.now() - last < 6 * 3600_000) return;
    localStorage.setItem('rb_cart_remind_at', String(Date.now()));
    const n = shop.count;
    const id = window.setTimeout(
      () =>
        toast(
          '🧺 ' +
            t(
              `You still have ${n} item(s) waiting — finish your booking?`,
              `आपकी टोकरी में ${n} सामान अभी भी है — बुकिंग पूरी करें?`,
            ),
        ),
      3200,
    );
    return () => {
      window.clearTimeout(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once on open
  }, []);

  // New unread notification → toast.
  const lastUnread = useRef<string | null>(null);
  const unread = (notifs.data ?? []).filter((n) => !n.isRead);
  useEffect(() => {
    const top = unread[0];
    if (top && lastUnread.current !== null && top.id !== lastUnread.current)
      toast('🔔 ' + (lang === 'en' ? top.title.en : top.title.hi));
    lastUnread.current = top?.id ?? '';
    // eslint-disable-next-line react-hooks/exhaustive-deps -- when the list changes
  }, [notifs.data]);

  const gated = needsProfile;
  const cartShowing = shop.count > 0 && ['home', 'cat', 'search'].includes(scr);
  const showBn = NAVS.includes(scr) && !gated;
  const navKey = scr === 'search' ? 'cat' : scr;
  const pct = Math.min(100, Math.round((total / MIN_BASKET) * 100));
  const openCat = (type: string) => nav(`/cat/${type}`);
  const soon = () => toast(soonMsg(t));
  const first = me?.name?.trim().split(' ')[0];
  const onSearch = (v: string) => {
    shop.setQuery(v);
    if (scr !== 'search') nav('/search');
  };

  return (
    <>
      <div id="splash" className={splash ? '' : 'gone'} aria-hidden={!splash}>
        <img className="sp-logo" src="/brand/mark.png" alt="RozBazaar" />
        <div className="sp-brand">RozBazaar</div>
        <div className="sp-tag">
          {t('Book a slot, get fresh veggies at home', 'स्लॉट बुक करें, सब्ज़ी घर पर पाएँ')}
        </div>
        <div className="sp-area">{t('PATAUDI • HAILEYMANDI • NEARBY', 'पटौदी • हेलीमंडी • आस-पास')}</div>
        <div className="sp-dots">
          <i />
          <i />
          <i />
        </div>
      </div>

      <header id="nav" style={gated ? { pointerEvents: 'none' } : undefined}>
        <div className="nav-in">
          <img
            className="nav-logo"
            src="/brand/wordmark.png"
            alt="RozBazaar"
            onClick={() => nav('/')}
            style={{ cursor: 'pointer' }}
          />
          <nav className="nav-links">
            <button className={scr === 'home' ? 'on' : ''} onClick={() => nav('/')}>
              {t('Home', 'होम')}
            </button>
            <button
              className={pathname === '/cat/vegetable' ? 'on' : ''}
              onClick={() => openCat('vegetable')}
            >
              {t('Vegetables', 'सब्ज़ी')}
            </button>
            <button className={pathname === '/cat/fruit' ? 'on' : ''} onClick={() => openCat('fruit')}>
              {t('Fruits', 'फल')}
            </button>
            <button className={scr === 'bookings' ? 'on' : ''} onClick={() => nav('/bookings')}>
              {t('My bookings', 'मेरी बुकिंग')}
            </button>
          </nav>
          <div className="nav-search">
            <span>🔍</span>
            <input
              id="navQ"
              placeholder={t('Search "tomato", "apple"…', 'खोजें "टमाटर", "सेब"…')}
              value={shop.query}
              onChange={(e) => onSearch(e.target.value)}
              aria-label={t('Search', 'खोजें')}
            />
          </div>
          <div className="nav-right">
            <button className="pill" onClick={() => ui.setAreaOpen(true)}>
              📍 <span className="area-name">{shop.area}</span> ▾
            </button>
            <div className="lang">
              <button className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')}>
                EN
              </button>
              <button className={lang === 'hi' ? 'on' : ''} onClick={() => setLang('hi')}>
                HI
              </button>
            </div>
            <button
              className="pill nbell"
              onClick={() => ui.setNotifsOpen(true)}
              aria-label={t('Notifications', 'सूचनाएँ')}
              style={{ position: 'relative' }}
            >
              🔔
              <UnreadDot />
            </button>
            <button className="nav-cart" id="navCart" onClick={() => nav('/basket')}>
              🧺 <span>{t('Basket', 'टोकरी')}</span> <b id="navCnt">{shop.count}</b>
            </button>
            <button
              className="btn-g"
              id="navLoginBtn"
              onClick={() => nav(loggedIn && !needsProfile ? '/account' : '/login')}
            >
              {loggedIn && first && !needsProfile ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                  <span className="h-av" style={{ width: 20, height: 20, fontSize: 11 }}>
                    {initial}
                  </span>
                  {first}
                </span>
              ) : (
                t('Log in', 'लॉगिन')
              )}
            </button>
          </div>
        </div>
      </header>

      <Outlet />

      <div className={`cart ${cartShowing ? 'show' : ''}`} id="cart">
        <div className="in" id="cartIn" onClick={() => nav('/basket')} role="button" tabIndex={0}>
          <span style={{ fontSize: 22 }}>🧺</span>
          <div style={{ minWidth: 0 }}>
            <div className="cn" id="cn">
              {shop.count} {t(shop.count === 1 ? 'item' : 'items', 'सामान')}
            </div>
            <div className="ct" id="ct">
              ₹{total}
            </div>
            <div className="bar">
              <div className="fill" id="cfill" style={{ width: `${pct}%` }} />
            </div>
            <div className="goal" id="cgoal">
              {total >= MIN_BASKET
                ? t('🎉 Booking ready — the vendor’s trip is set', '🎉 बुकिंग तैयार है!')
                : t(
                    `₹${MIN_BASKET - total} more for a ₹${MIN_BASKET} minimum booking`,
                    `₹${MIN_BASKET - total} और — कम से कम बुकिंग ₹${MIN_BASKET}`,
                  )}
            </div>
          </div>
          <span className="cb">{t('View basket →', 'टोकरी देखें →')}</span>
        </div>
      </div>

      <nav className={`bn ${showBn ? 'show' : ''}`} id="bn">
        <button className={`bni ${navKey === 'home' ? 'on' : ''}`} onClick={() => nav('/')}>
          <span className="bi">🏠</span>
          <span>{t('Home', 'होम')}</span>
        </button>
        <button className={`bni ${navKey === 'cat' ? 'on' : ''}`} onClick={() => openCat('vegetable')}>
          <span className="bi">🧺</span>
          <span>{t('Shop', 'सामान')}</span>
        </button>
        <button className={`bni ${navKey === 'bookings' ? 'on' : ''}`} onClick={() => nav('/bookings')}>
          <span className="bi">📋</span>
          <span>{t('Bookings', 'बुकिंग')}</span>
        </button>
        <button className={`bni ${navKey === 'acct' ? 'on' : ''}`} onClick={() => nav('/account')}>
          <span className="bi" style={initial ? { fontWeight: 800 } : undefined}>
            {initial ?? '👤'}
          </span>
          <span>{t('Account', 'अकाउंट')}</span>
        </button>
      </nav>

      <footer id="foot">
        <div className="foot-in">
          <div>
            <img className="foot-logo" src="/brand/wordmark.png" alt="RozBazaar" />
            <p className="foot-blurb">
              {t(
                'RozBazaar connects households in Pataudi, Haileymandi and nearby villages with the vegetable, fruit and onion-potato vendors already working their streets. Book a slot, they come to you, you pay them directly.',
                'RozBazaar पटौदी, हेलीमंडी और आस-पास के गाँवों के घरों को उन्हीं वेंडरों से जोड़ता है जो पहले से गलियों में घूमते हैं। स्लॉट बुक करें, वे घर आते हैं, पेमेंट सीधे उन्हें।',
              )}
            </p>
          </div>
          <div>
            <h4>{t('AREAS WE SERVE', 'हम यहाँ आते हैं')}</h4>
            <ul id="footAreas">
              {(areas.data ?? []).map((a) => (
                <li key={a.name} onClick={() => shop.setArea(a.name)}>
                  {a.name}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4>{t('SHOP', 'सामान')}</h4>
            <ul>
              <li onClick={() => openCat('vegetable')}>{t('Vegetables', 'सब्ज़ी')}</li>
              <li onClick={() => openCat('fruit')}>{t('Fruits', 'फल')}</li>
              <li onClick={() => openCat('onion_potato')}>{t('Onion–Potato', 'प्याज़–आलू')}</li>
              <li onClick={() => nav('/slot')}>{t('Book a slot', 'स्लॉट बुक करें')}</li>
              <li onClick={() => nav('/bookings')}>{t('My bookings', 'मेरी बुकिंग')}</li>
            </ul>
          </div>
          <div>
            <h4>ROZBAZAAR</h4>
            <ul>
              <li onClick={() => window.open(VENDOR_SITE, '_blank', 'noopener')}>
                {t('Become a vendor', 'वेंडर बनें')}
              </li>
              <li onClick={() => nav('/how')}>{t('How it works', 'यह कैसे काम करता है')}</li>
              <li onClick={soon}>{t('2–3 hour delivery ⚡', '2–3 घंटे में डिलीवरी ⚡')}</li>
              <li onClick={() => nav('/contact')}>{t('Contact', 'संपर्क')}</li>
            </ul>
          </div>
          <div>
            <h4>{t('FOLLOW', 'फ़ॉलो करें')}</h4>
            <ul>
              <li className="flink" onClick={() => window.open(LINKS.ig, '_blank', 'noopener')}>
                <IgIcon gid="fig3" />
                Instagram
              </li>
              <li className="flink" onClick={() => window.open(LINKS.wa, '_blank', 'noopener')}>
                <WaIcon />
                {t('WhatsApp Channel', 'व्हाट्सऐप चैनल')}
              </li>
              <li className="flink" onClick={() => window.open(LINKS.yt, '_blank', 'noopener')}>
                <YtIcon />
                {t("Founder's YouTube", 'संस्थापक का YouTube')}
              </li>
              <li className="flink" onClick={() => window.open(LINKS.founder, '_blank', 'noopener')}>
                <IgIcon gid="fig4" />
                {t("Founder's Instagram", 'संस्थापक का Instagram')}
              </li>
              <li className="flink" onClick={() => window.open(LINKS.kishan, '_blank', 'noopener')}>
                <PlayIcon />
                Kishan Suraksha AI
              </li>
            </ul>
          </div>
        </div>
        <div className="foot-bot">
          <span>© 2026 RozBazaar</span>
          <span>
            {t(
              'Payment always direct to the vendor — cash or UPI',
              'पेमेंट हमेशा सीधे वेंडर को — कैश या UPI',
            )}
          </span>
          <span className="rt">
            {t(
              'Made in Haryana 🌾 · Founded by Vedanshu Rathi',
              'हरियाणा में बना 🌾 · संस्थापक: वेदांशु राठी',
            )}{' '}
            ·{' '}
            <a href="/privacy.html" style={{ color: 'inherit' }}>
              {t('Privacy', 'गोपनीयता')}
            </a>
          </span>
        </div>
      </footer>

      <button
        className="fab-contact"
        id="fabContact"
        onClick={() => nav('/contact')}
        aria-label={t('Contact us', 'संपर्क करें')}
        style={{
          display: ['contact', 'login', 'loc', 'basket'].includes(scr) ? 'none' : 'flex',
          bottom: cartShowing && wide < 900 ? 242 : undefined,
        }}
      >
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M4 4h16v12H7l-3 3V4z" fill="#fff" />
          <circle cx="8.5" cy="10" r="1.1" fill="#14682c" />
          <circle cx="12" cy="10" r="1.1" fill="#14682c" />
          <circle cx="15.5" cy="10" r="1.1" fill="#14682c" />
        </svg>
      </button>

      <AreaSheet />
      <LocAsk />
      <VendorPicker />
      <DonePopup />
      <NotifSheet />
      <AddrPicker />
      <CheckSheet />
      <PermBar />
    </>
  );
}
