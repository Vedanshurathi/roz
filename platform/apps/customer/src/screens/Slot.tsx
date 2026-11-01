import { useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router';
import { useI18n } from '@rozbazaar/web';
import { useCatalog, useSlots, useVendors } from '../api/queries';
import { dayLabels, SLOTS, VENDOR_TYPES } from '../lib/model';
import { useShop } from '../state/shop';
import { useMe } from '../state/useMe';
import { Skeletons } from '../ui/ProductCard';
import { Waitlist } from '../ui/Waitlist';

const compactBox = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  background: 'var(--lime-s)',
  borderRadius: 14,
  padding: '12px 15px',
} as const;

export default function Slot() {
  const { t, lang } = useI18n();
  const nav = useNavigate();
  const shop = useShop();
  const { sel, setSel } = shop;
  const { loggedIn } = useMe();
  const { types } = useCatalog(shop.area, loggedIn);
  const vendors = useVendors(shop.area);
  const days = dayLabels(t, lang);
  const slots = useSlots(sel.type, shop.area, days[sel.day]!.iso);
  const wrap = useRef<HTMLDivElement>(null);

  const avail = VENDOR_TYPES.filter((v) => types.some((x) => x.type === v.id));
  // One category only → it is already decided, no tap needed.
  useEffect(() => {
    if (avail.length === 1 && !sel.type) setSel({ type: avail[0]!.id });
  }, [avail, sel.type, setSel]);

  const list = useMemo(
    () =>
      [...(vendors.data ?? [])]
        .filter((v) => v.type === sel.type)
        .sort((a, b) => (b.avgRating ?? 0) - (a.avgRating ?? 0)),
    [vendors.data, sel.type],
  );
  // Was a vendor already chosen (while adding items, or earlier)? Then just confirm it.
  const alreadyChosen = useRef<boolean | null>(null);
  if (alreadyChosen.current === null && list.length)
    alreadyChosen.current = list.some((v) => v.id === sel.vendorId);
  useEffect(() => {
    if (list.length && !list.some((v) => v.id === sel.vendorId)) setSel({ vendorId: list[0]!.id });
  }, [list, sel.vendorId, setSel]);

  const rows = useMemo(() => slots.data ?? [], [slots.data]);
  // A chosen slot that just became unbookable is dropped.
  useEffect(() => {
    if (sel.slot && slots.isSuccess && !rows.some((s) => s.slot === sel.slot && !s.isPast && s.hasRoom))
      setSel({ slot: null });
  }, [rows, sel.slot, slots.isSuccess, setSel]);

  const closed = slots.isSuccess && rows.filter((s) => !s.isPast && s.hasRoom).length === 0;
  const ok = Boolean(sel.type && sel.slot && sel.vendorId);
  const chosenV = list.find((x) => x.id === sel.vendorId) ?? list[0];
  const showCompactV = list.length === 1 || Boolean(alreadyChosen.current);

  function pickType(id: (typeof VENDOR_TYPES)[number]['id']) {
    const first = !sel.type;
    setSel(sel.type !== id ? { type: id, vendorId: null } : { type: id });
    alreadyChosen.current = null;
    if (first)
      window.setTimeout(() => wrap.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 150);
  }

  return (
    <div className="scr on" id="s-slot">
      <div className="topbar">
        <button className="bk" onClick={() => nav(-1)} aria-label={t('Back', 'वापस')}>
          ←
        </button>
        <div>
          <h1>{t('Pick your slot', 'अपना स्लॉट चुनें')}</h1>
          <div className="sub">{t('the vendor comes in this window', 'वेंडर इसी समय में आएगा')}</div>
        </div>
      </div>
      <div className="pg">
        <div className="step">
          <div className="sn">
            <div className="sd on">1</div>
            <div className="sl on" />
            <div className="st">{t('Slot', 'स्लॉट')}</div>
          </div>
          <div className="sn">
            <div className={`sd ${ok ? 'on' : ''}`}>2</div>
            <div className={`sl ${ok ? 'on' : ''}`} />
            <div className="st">{t('Items', 'सामान')}</div>
          </div>
          <div className="sn">
            <div className="sd">3</div>
            <div className="sl" />
            <div className="st">{t('Confirm', 'पक्का करें')}</div>
          </div>
        </div>

        {avail.length === 1 ? (
          <div style={{ ...compactBox, marginBottom: 18 }}>
            <span style={{ fontSize: 22 }}>{avail[0]!.em}</span>
            <span style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--g-dk)' }}>
              {t('Ordering', 'मँगवा रहे हैं')}: {lang === 'en' ? avail[0]!.en : avail[0]!.hi}
            </span>
          </div>
        ) : (
          <>
            <div className="h2">{t('What are you ordering?', 'क्या मँगवाना है?')}</div>
            <div className="slots" id="vtypes">
              {avail.length ? (
                avail.map((v) => {
                  const ty = types.find((x) => x.type === v.id)!;
                  return (
                    <button
                      key={v.id}
                      className={`slot ${sel.type === v.id ? 'sel' : ''}`}
                      onClick={() => pickType(v.id)}
                    >
                      <span className="se">{v.em}</span>
                      <div>
                        <b>{lang === 'en' ? v.en : v.hi}</b>
                        <span>
                          {ty.vendorCount} {t(ty.vendorCount === 1 ? 'vendor' : 'vendors', 'वेंडर')}
                          {ty.avgRating ? ` · ${ty.avgRating}★` : ` · ${t('new', 'नया')}`}
                        </span>
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="empty" style={{ padding: '30px 10px' }}>
                  <div className="ee">🌾</div>
                  <b>{t(`No vendor in ${shop.area} yet`, `अभी ${shop.area} में कोई वेंडर नहीं`)}</b>
                  <p>{t('Tell us you want RozBazaar here', 'बताइए कि यहाँ RozBazaar चाहिए')}</p>
                  <Waitlist />
                </div>
              )}
            </div>
          </>
        )}

        {sel.type ? (
          <div id="vendorPickWrap" ref={wrap}>
            {vendors.isPending ? (
              <div id="slotVendorList" style={{ marginBottom: 6 }}>
                <Skeletons n={2} />
              </div>
            ) : showCompactV && chosenV ? (
              <div id="vendorCompact" style={{ ...compactBox, marginBottom: 6 }}>
                {chosenV.photoUrl ? (
                  <img
                    src={chosenV.photoUrl}
                    alt=""
                    style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover' }}
                  />
                ) : (
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: '50%',
                      background: 'var(--g)',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: 14,
                    }}
                  >
                    {(chosenV.name || '?')[0]!.toUpperCase()}
                  </div>
                )}
                <span style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--g-dk)' }}>
                  {t('Vendor', 'वेंडर')}: {chosenV.name}
                  {chosenV.avgRating && chosenV.avgRating > 0 ? ` · ⭐ ${chosenV.avgRating.toFixed(1)}` : ''}
                </span>
              </div>
            ) : (
              <>
                <div className="h2" id="vendorHeading">
                  {t('Choose your vendor', 'अपना वेंडर चुनें')}
                </div>
                <div id="slotVendorList" style={{ marginBottom: 6 }}>
                  {list.length ? (
                    list.map((v) => (
                      <button
                        key={v.id}
                        className={`vcard ${sel.vendorId === v.id ? 'sel' : ''}`}
                        onClick={() => setSel({ vendorId: v.id })}
                      >
                        {v.photoUrl ? (
                          <img className="vav" src={v.photoUrl} alt="" />
                        ) : (
                          <div className="vav">{(v.name || '?')[0]!.toUpperCase()}</div>
                        )}
                        <div className="vt">
                          <b>{v.name}</b>
                          <div className="vmeta">
                            {v.avgRating && v.avgRating > 0 ? (
                              <>
                                <span className="vstars">⭐ {v.avgRating.toFixed(1)}</span>
                                <span className="vdot">·</span>
                              </>
                            ) : null}
                            <span className="vch">
                              {v.ordersCompleted ?? 0} {t('orders done', 'ऑर्डर पूरे')}
                            </span>
                          </div>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="empty" style={{ padding: '20px 10px' }}>
                      <div className="ee">🧑‍🌾</div>
                      <b>{t('No vendor here yet', 'अभी कोई वेंडर नहीं')}</b>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        ) : null}

        <div className="h2">{t('Which day?', 'कौन सा दिन?')}</div>
        <div className="days nosb" id="days">
          {days.map((d) => (
            <button
              key={d.i}
              className={`day-pill ${sel.day === d.i ? 'sel' : ''}`}
              onClick={() => setSel({ day: d.i, slot: null })}
            >
              <i>{d.lbl}</i>
              <b>{d.num}</b>
              <span>{d.mon}</span>
            </button>
          ))}
        </div>

        <div className="h2">{t('Which time?', 'कौन सा समय?')}</div>
        <div className="slots" id="slotList">
          {!sel.type ? (
            <div className="note" style={{ marginTop: 4 }}>
              <span>👆</span>
              <span>{t('First choose what you are ordering', 'पहले चुनें क्या मँगवाना है')}</span>
            </div>
          ) : slots.isPending ? (
            <Skeletons n={3} />
          ) : (
            <>
              {SLOTS.map((base) => {
                const s = rows.find((r) => r.slot === base.id);
                const label = lang === 'en' ? base.en : base.hi;
                if (!s)
                  return (
                    <button key={base.id} className="slot full" disabled>
                      <span className="se">{base.em}</span>
                      <div style={{ minWidth: 0 }}>
                        <b>{label}</b>
                        <span>
                          {t(
                            'no vendor covers your village in this window',
                            'इस समय में आपके गाँव में कोई वेंडर नहीं',
                          )}
                        </span>
                      </div>
                      <span className="cap">{t('N/A', 'उपलब्ध नहीं')}</span>
                    </button>
                  );
                const past = s.isPast;
                const full = !past && !s.hasRoom;
                const off = past || full;
                return (
                  <button
                    key={base.id}
                    className={`slot ${off ? 'full' : ''} ${sel.slot === base.id ? 'sel' : ''}`}
                    disabled={off}
                    onClick={() => setSel({ slot: base.id })}
                  >
                    <span className="se">{base.em}</span>
                    <div style={{ minWidth: 0 }}>
                      <b>{label}</b>
                      <span>
                        {past
                          ? t('this window has already started', 'इसका समय निकल चुका है')
                          : full
                            ? t('vendor is fully booked', 'वेंडर भर गया')
                            : t('vendor comes in this window', 'वेंडर इसी समय में आएगा')}
                      </span>
                    </div>
                    <span className="cap">
                      {past
                        ? t('CLOSED', 'समय निकला')
                        : full
                          ? t('FULL', 'भरा')
                          : `${s.free} ${t('slots left', 'स्लॉट बचे')}`}
                    </span>
                  </button>
                );
              })}
              {closed ? (
                <div className="note" style={{ marginTop: 4 }}>
                  <span>🕐</span>
                  <span>
                    {t(
                      'Today is done — pick tomorrow above and the vendor will come then',
                      'आज का समय निकल गया — ऊपर से कल चुनें, वेंडर तब आएगा',
                    )}
                  </span>
                </div>
              ) : null}
            </>
          )}
        </div>

        <div className="note" style={{ marginTop: 20 }}>
          <span>💡</span>
          <span>
            {t(
              'This is not instant delivery. You choose the window; a real vendor from your area arrives inside it.',
              'यह तुरंत डिलीवरी नहीं है। आप समय चुनते हैं, और आपके इलाके का वेंडर उसी समय में आता है।',
            )}
          </span>
        </div>
      </div>
      <div className="stick">
        <div className="stick-in">
          <button
            className="bigbtn"
            id="slotGo"
            disabled={!ok}
            onClick={() => (shop.count > 0 ? nav('/basket') : nav(`/cat/${sel.type ?? 'vegetable'}`))}
          >
            {shop.count > 0
              ? t('Review & confirm →', 'ऑर्डर देखें और पक्का करें →')
              : t('Choose items →', 'सामान चुनें →')}
          </button>
        </div>
      </div>
    </div>
  );
}
