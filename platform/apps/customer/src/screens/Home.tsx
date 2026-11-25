import { useMemo } from 'react';
import { useNavigate } from 'react-router';
import { useI18n } from '@rozbazaar/web';
import { useAreas, useBookings, useCatalog, useLastOrder } from '../api/queries';
import { Art } from '../art/Art';
import { pname, slotLine, VENDOR_TYPES } from '../lib/model';
import { soonMsg } from '../app/Layout';
import { useShop } from '../state/shop';
import { useUI } from '../state/ui';
import { useCart } from '../state/useCart';
import { useMe } from '../state/useMe';
import { ProductCard, Skeletons } from '../ui/ProductCard';
import { IgIcon, LINKS, PlayIcon, WaIcon, YtIcon } from '../ui/Social';
import { useToast } from '../ui/Toast';
import { UnreadDot } from '../ui/UnreadDot';
import { Waitlist } from '../ui/Waitlist';
import { VENDOR_SITE } from '../config';

export default function Home() {
  const { t, lang } = useI18n();
  const nav = useNavigate();
  const toast = useToast();
  const shop = useShop();
  const ui = useUI();
  const { loggedIn, initial, me } = useMe();
  const { q, products: all, favs, served } = useCatalog(shop.area, loggedIn);
  const areas = useAreas();
  const bookings = useBookings(loggedIn);
  const last = useLastOrder(loggedIn && Boolean(bookings.data?.length));
  const { addCart, prod } = useCart();
  const openCat = (type: string) => nav(`/cat/${type}`);
  const soon = () => toast(soonMsg(t));

  const deals = useMemo(() => all.filter((p) => p.kal && p.fresh).slice(0, 7), [all]);
  const hero = useMemo(() => {
    const real = all.filter((p) => p.price > 0 && p.fresh);
    return [...real.filter((p) => p.kal), ...real.filter((p) => !p.kal)].slice(0, 4);
  }, [all]);
  const counts = useMemo(() => {
    const c: Record<string, number> = { vegetable: 0, fruit: 0, onion_potato: 0 };
    for (const p of all) c[p.cat] = (c[p.cat] ?? 0) + 1;
    return c;
  }, [all]);
  const servedCount = (areas.data ?? []).filter((a) => a.served).length || (areas.data ?? []).length;

  function repeatOrder() {
    const items = last.data ?? [];
    if (!items.length) return toast(t('No previous order yet', 'अभी कोई पिछला ऑर्डर नहीं'));
    let added = 0;
    for (const i of items) {
      const p = prod(i.productId);
      if (p?.fresh) {
        addCart(p.id, Number(i.qty || 1));
        added++;
      }
    }
    toast(
      added
        ? t('Last order added to basket', 'पिछला ऑर्डर टोकरी में डाल दिया')
        : t('Those items are not in stock today', 'वह सामान आज स्टॉक में नहीं'),
    );
  }

  return (
    <div className="scr on" id="s-home">
      {/* DESKTOP HERO */}
      <section id="heroDesk">
        <div className="hd-in">
          <div>
            <span className="hd-eyebrow rv d1">
              <i />
              <span>
                {t('NO EXTRA CHARGES · LOCAL VENDORS ONLY', 'कोई अतिरिक्त शुल्क नहीं · अपने लोकल वेंडर')}
              </span>
            </span>
            <h1 className="hd-h1 rv d2">
              <span>{t('Book a slot.', 'स्लॉट बुक करें।')}</span>
              <br />
              <em>{t('Fresh veggies at home.', 'सब्ज़ी घर पर।')}</em>
            </h1>
            <p className="hd-sub rv d3">
              {t(
                "A real vendor from your own area comes to your door in the slot you pick, weighs everything in front of you, and takes cash or UPI. No app-price games — just today's mandi rate.",
                'आपके ही इलाके का वेंडर, आपके चुने हुए स्लॉट में घर आता है। सामने तौलता है, कैश या UPI लेता है। कोई छुपा हुआ चार्ज नहीं — बस आज का मंडी रेट।',
              )}
            </p>
            <div className="hd-search rv d4">
              <span>🔍</span>
              <input
                id="deskQ"
                placeholder={t('Try "potato", "tomato", "banana"…', 'खोजें "आलू", "टमाटर", "केला"…')}
                value={shop.query}
                onChange={(e) => {
                  shop.setQuery(e.target.value);
                  nav('/search');
                }}
                aria-label={t('Search', 'खोजें')}
              />
              <button className="btn-g" onClick={() => nav('/slot')}>
                {t('Book vendor', 'वेंडर बुक करें')}
              </button>
            </div>
            <div className="hd-cta rv d5">
              <button className="btn-lg" onClick={() => nav('/slot')}>
                {t('Pick your slot →', 'अपना स्लॉट चुनें →')}
              </button>
              <button
                className="btn-out"
                onClick={() => {
                  const el = document.getElementById('catRow');
                  if (el) window.scrollTo({ top: el.offsetTop - 90, behavior: 'smooth' });
                }}
              >
                {t("Browse today's rates", 'आज के रेट देखें')}
              </button>
            </div>
            <div className="hd-trust rv d6">
              <div>
                <b>{servedCount || 8}</b>
                <span>{t('villages served', 'गाँव कवर')}</span>
              </div>
              <div>
                <b>3</b>
                <span>{t('slots a day', 'स्लॉट रोज़')}</span>
              </div>
              <div>
                <b>₹0</b>
                <span>{t('extra charge for you', 'आपसे कोई अतिरिक्त शुल्क')}</span>
              </div>
            </div>
          </div>
          <div className="hd-art rv d3">
            <div className="ft-blob" />
            {hero.map((p, i) => (
              <div className={`ft ft-${i + 1}`} key={p.id}>
                <div className="em">
                  <Art photo={p.photo} artKey={p.artKey} em={p.em} alt={p.en} />
                </div>
                <div className="nm">{pname(p, lang)}</div>
                <div className="pr">
                  ₹{p.price}
                  <span style={{ fontSize: 11 }}>/{p.unit}</span>
                </div>
                <div className="cap">
                  {p.kal ? t('🔥 freshly priced', '🔥 नया रेट') : t("today's mandi rate", 'आज का मंडी रेट')}
                </div>
              </div>
            ))}
            <div className="ft-slot">
              <span>{t('ROZBAZAAR COMES', 'RozBazaar आएगा')}</span>
              <b>{slotLine(shop.sel, t, lang)}</b>
            </div>
          </div>
        </div>
      </section>

      {/* DESKTOP: category cards */}
      <section id="catRow">
        <div className="shell">
          <div className="cat-grid">
            <button className="cat-card" onClick={() => openCat('vegetable')}>
              <div className="ce">🥬</div>
              <div className="cn">{t('Vegetables', 'सब्ज़ी')}</div>
              <div className="cc">
                <span>{counts.vegetable}</span> <span>{t('items · daily rate', 'सामान · रोज़ का रेट')}</span>
              </div>
              <div className="cgo">{t('Browse →', 'देखें →')}</div>
            </button>
            <button className="cat-card" onClick={() => openCat('fruit')}>
              <div className="ce">🍎</div>
              <div className="cn">{t('Fruits', 'फल')}</div>
              <div className="cc">
                <span>{counts.fruit}</span> <span>{t('items · seasonal', 'सामान · मौसमी')}</span>
              </div>
              <div className="cgo">{t('Browse →', 'देखें →')}</div>
            </button>
            <button className="cat-card" onClick={() => openCat('onion_potato')}>
              <div className="ce">🧅</div>
              <div className="cn">{t('Onion–Potato', 'प्याज़–आलू')}</div>
              <div className="cc">
                <span>{counts.onion_potato}</span> <span>{t('items · bulk ok', 'सामान · बोरी भी')}</span>
              </div>
              <div className="cgo">{t('Browse →', 'देखें →')}</div>
            </button>
            <button className="cat-card" onClick={() => nav('/slot')}>
              <div className="ce">🕖</div>
              <div className="cn">{t('Pick a slot', 'स्लॉट चुनें')}</div>
              <div className="cc">{t('Morning · Afternoon · Evening', 'सुबह · दोपहर · शाम')}</div>
              <div className="cgo">{t('Book now →', 'अभी बुक करें →')}</div>
            </button>
          </div>
        </div>
      </section>

      {/* PHONE / TABLET HERO */}
      <div className="h-hdr">
        <div className="h-brand">
          <button className="h-chip" onClick={() => nav('/')}>
            <img src="/brand/wordmark.png" alt="RozBazaar" />
          </button>
          <div className="h-icons">
            <button
              className="h-ic nbell"
              onClick={() => ui.setNotifsOpen(true)}
              aria-label={t('Notifications', 'सूचनाएँ')}
            >
              🔔
              <UnreadDot />
            </button>
            <button
              className="h-ic"
              onClick={() => nav('/bookings')}
              aria-label={t('My bookings', 'मेरी बुकिंग')}
            >
              📋
            </button>
            <button
              className="h-ic"
              onClick={() => nav('/account')}
              aria-label={me?.name ?? t('My account', 'मेरा अकाउंट')}
              title={me?.name ?? undefined}
            >
              {initial ? <span className="h-av">{initial}</span> : '👤'}
            </button>
          </div>
        </div>
        <div className="h-row">
          <div>
            <div className="h-slot-lbl">{t('RozBazaar delivers', 'RozBazaar आएगा')}</div>
            <div className="h-slot" id="hSlot">
              {slotLine(shop.sel, t, lang)}
            </div>
            <button className="h-loc" onClick={() => ui.setAreaOpen(true)}>
              📍{' '}
              <span id="hArea" className="area-name">
                {shop.area}
              </span>{' '}
              <span>▾</span>
            </button>
          </div>
        </div>
        <div className="h-search" onClick={() => nav('/search')} role="button" tabIndex={0}>
          <span>🔍</span>
          <div className="rot">
            <span>{t('Search "tomato"…', 'खोजें "टमाटर"…')}</span>
            <span>{t('Search "apple"…', 'खोजें "सेब"…')}</span>
            <span>{t('Search "coriander"…', 'खोजें "धनिया"…')}</span>
          </div>
          <span
            onClick={(e) => {
              e.stopPropagation();
              toast(t('Voice search — coming soon', 'वॉइस सर्च — जल्द आ रहा है'));
            }}
          >
            🎤
          </span>
        </div>
        <div className="h-tabs nosb">
          <button className="h-tab on">
            <span className="ti">🧺</span>
            <span>{t('All', 'सब')}</span>
          </button>
          <button className="h-tab" onClick={() => openCat('vegetable')}>
            <span className="ti">🥬</span>
            <span>{t('Vegetables', 'सब्ज़ी')}</span>
          </button>
          <button className="h-tab" onClick={() => openCat('fruit')}>
            <span className="ti">🍎</span>
            <span>{t('Fruits', 'फल')}</span>
          </button>
          <button className="h-tab" onClick={() => openCat('onion_potato')}>
            <span className="ti">🧅</span>
            <span>{t('Onion-Potato', 'प्याज़-आलू')}</span>
          </button>
          <button className="h-tab" onClick={soon}>
            <span className="ti">⚡</span>
            <span>{t('2-3 hours', '2-3 घंटे')}</span>
          </button>
        </div>
      </div>
      <div className="scallop" />
      <div className="promo-zone">
        <div className="promo-hd">{t("TODAY'S OFFERS", 'आज के ऑफ़र')}</div>
        <div className="promo-grid">
          <button className="pt pt-tall" onClick={() => openCat('vegetable')}>
            <div className="pn">
              {t('Fresh veggies', 'ताज़ा सब्ज़ी')}
              <br />
              {t('this morning', 'आज सुबह')}
            </div>
            <div className="pe">🥬</div>
          </button>
          <button className="pt pt-1" onClick={() => openCat('onion_potato')}>
            <div className="pn">
              {t('Sack rates', 'बोरी रेट')}
              <br />
              {t('onion & potato', 'प्याज़-आलू')}
            </div>
            <div className="pe">🧅</div>
          </button>
          <button className="pt pt-2" onClick={() => openCat('vegetable')}>
            <div className="pn">
              {t('Leafy greens', 'हरी पत्ती')}
              <br />
              {t('super fresh', 'एकदम ताज़ी')}
            </div>
            <div className="pe">🥗</div>
          </button>
          <button className="pt pt-3" onClick={() => openCat('fruit')}>
            <div className="pn">
              {t('Seasonal', 'मौसमी')}
              <br />
              {t('fruits', 'फल')}
            </div>
            <div className="pe">🍎</div>
          </button>
          <button className="pt pt-4" onClick={soon}>
            <div className="pn">
              {t('2–3 hours', '2–3 घंटे')}
              <br />
              {t('⚡ SOON', '⚡ जल्द')}
            </div>
            <div className="pe">⚡</div>
          </button>
        </div>
      </div>
      <div className="scallop bot" />

      {all.length ? (
        <div className="sec">
          <div className="sec-hd">
            <h2>{t('Most bought', 'सबसे ज़्यादा बिका')}</h2>
            <p>{t('in your area', 'आपके इलाके में')}</p>
          </div>
          <div className="rail nosb" id="quadRail">
            {VENDOR_TYPES.map((v) => {
              const items = all.filter((p) => p.cat === v.id);
              return (
                <button className="quad" key={v.id} onClick={() => openCat(v.id)}>
                  <div className="box">
                    {items.slice(0, 4).map((i) => (
                      <i key={i.id}>
                        <Art photo={i.photo} artKey={i.artKey} em={i.em} alt={i.en} />
                      </i>
                    ))}
                    <span className="more">
                      +{Math.max(items.length - 4, 0)} {t('more', 'और')}
                    </span>
                  </div>
                  <div className="qn">{lang === 'en' ? v.en : v.hi}</div>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="sec">
        <div className="sec-hd">
          <h2>{t("Today's best rate", 'आज का सस्ता')}</h2>
          <button className="all" onClick={() => openCat('vegetable')}>
            {t('See all ›', 'सब देखें ›')}
          </button>
        </div>
        <div className="rail nosb" id="dealRail">
          {q.isPending ? (
            <Skeletons n={4} />
          ) : (
            deals.map((p) => <ProductCard key={p.id} p={p} fav={favs.has(p.id)} />)
          )}
        </div>
      </div>

      {loggedIn && bookings.data?.length && last.data?.length ? (
        <div className="repeat" id="repeatCard" style={{ display: 'flex' }}>
          <div className="ri">🔁</div>
          <div>
            <b>{t('Order the same again', 'फिर से ऑर्डर करें')}</b>
            <span>
              {last.data
                .slice(0, 4)
                .map((i) => {
                  const p = prod(i.productId);
                  return `${p ? pname(p, lang) : i.name} ${i.qty}${i.unit === 'kg' ? 'kg' : ''}`;
                })
                .join(' · ')}
            </span>
          </div>
          <button className="rb" onClick={repeatOrder}>
            {t('Repeat', 'दोबारा मँगाएँ')}
          </button>
        </div>
      ) : null}

      <div className="sec">
        <div className="sec-hd">
          <h2>{t('Everything available today', 'आज सब कुछ उपलब्ध')}</h2>
          <p id="gridCount">{all.length ? `${all.length} ${t('items', 'सामान')}` : ''}</p>
        </div>
        <div className="grid" id="homeGrid">
          {q.isPending ? (
            <Skeletons n={6} />
          ) : q.isError ? (
            <div className="empty" style={{ gridColumn: '1/-1' }}>
              <div className="ee">😕</div>
              <b>{t('Could not load', 'लोड नहीं हुआ')}</b>
              <button
                className="bigbtn"
                style={{ marginTop: 20, padding: '14px 28px' }}
                onClick={() => void q.refetch()}
              >
                {t('Try again', 'फिर कोशिश करें')}
              </button>
            </div>
          ) : !all.length ? (
            <div className="empty" style={{ gridColumn: '1/-1' }}>
              <div className="ee">🌾</div>
              <b>
                {served
                  ? t('Nothing in stock right now', 'अभी कुछ स्टॉक में नहीं')
                  : t(`No vendor in ${shop.area} yet`, `अभी ${shop.area} में कोई वेंडर नहीं`)}
              </b>
              <p>
                {served
                  ? t(
                      'The vendor is restocking — check back soon',
                      'वेंडर सामान भर रहा है — थोड़ी देर में देखें',
                    )
                  : t(
                      'Tell us you want RozBazaar here and we will bring a vendor',
                      'बताइए कि यहाँ RozBazaar चाहिए, हम वेंडर लाएँगे',
                    )}
              </p>
              {served ? null : <Waitlist />}
            </div>
          ) : (
            all.map((p) => <ProductCard key={p.id} p={p} fav={favs.has(p.id)} />)
          )}
        </div>
      </div>

      <div className="sec">
        <div className="sec-hd">
          <h2>{t('Follow RozBazaar', 'RozBazaar को फ़ॉलो करें')}</h2>
        </div>
        <div className="follow-row">
          <a className="follow-item" href={LINKS.ig} target="_blank" rel="noopener noreferrer">
            <IgIcon gid="fig1" />
            <span>{t('Instagram', 'इंस्टाग्राम')}</span>
          </a>
          <a className="follow-item" href={LINKS.wa} target="_blank" rel="noopener noreferrer">
            <WaIcon />
            <span>{t('WhatsApp', 'व्हाट्सऐप')}</span>
          </a>
          <a className="follow-item" href={LINKS.yt} target="_blank" rel="noopener noreferrer">
            <YtIcon />
            <span>{t('YouTube', 'यूट्यूब')}</span>
          </a>
          <a className="follow-item" href={LINKS.founder} target="_blank" rel="noopener noreferrer">
            <IgIcon gid="fig2" />
            <span>{t('Founder', 'संस्थापक')}</span>
          </a>
          <a className="follow-item" href={LINKS.kishan} target="_blank" rel="noopener noreferrer">
            <PlayIcon />
            <span>{t('Kishan AI', 'किसान AI')}</span>
          </a>
        </div>
      </div>
      <div className="mfoot">
        <div className="ml">
          <button className="vend" onClick={() => window.open(VENDOR_SITE, '_blank', 'noopener')}>
            {t('🧑‍🌾 Become a vendor', '🧑‍🌾 वेंडर बनें')}
          </button>
          <button onClick={() => nav('/how')}>{t('How it works', 'यह कैसे काम करता है')}</button>
          <button onClick={() => nav('/contact')}>{t('Contact', 'संपर्क')}</button>
          <a href="/privacy.html">{t('Privacy policy', 'गोपनीयता नीति')}</a>
        </div>
        <p>
          {t(
            '© 2026 RozBazaar · Payment always direct to the vendor — cash or UPI · Made in Haryana 🌾',
            '© 2026 RozBazaar · पेमेंट हमेशा सीधे वेंडर को — कैश या UPI · हरियाणा में बना 🌾',
          )}
        </p>
      </div>
    </div>
  );
}
