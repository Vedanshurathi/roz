import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { useI18n } from '@rozbazaar/web';
import { api } from '../api/client';
import { keys, useBill, useBookings } from '../api/queries';
import { Art } from '../art/Art';
import { ART_ALIAS } from '../art/drawings';
import { prettySlot } from '../lib/model';
import { useMe } from '../state/useMe';
import { useToast } from '../ui/Toast';

/** The highest-trust screen: every line that changed at the door, then approve or "something's wrong". */
export default function Bill() {
  const { id } = useParams();
  const { t, lang } = useI18n();
  const nav = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const { loggedIn } = useMe();
  const bill = useBill(id ?? null);
  const booking = useBookings(loggedIn).data?.find((b) => b.id === id);
  const [busy, setBusy] = useState(false);

  const WHY: Record<string, string> = {
    added: t('added at your door', 'घर पर जोड़ा गया'),
    changed: t('weighed at your door', 'घर पर तौला गया'),
    removed: t('vendor was out of stock', 'वेंडर के पास खत्म था'),
  };
  const d = bill.data;
  const changes = (d?.lines ?? []).filter((l) => l.change !== 'same');
  const unchanged = (d?.lines ?? []).filter((l) => l.change === 'same');
  const oldT = d?.estTotal ?? 0;
  const newT = d?.finalTotal ?? oldT;
  const vname = booking?.vendorName || t('The vendor', 'वेंडर');
  const art = (name: string) => ART_ALIAS[name.trim().toLowerCase()] ?? null;

  async function approve() {
    setBusy(true);
    try {
      await api.post(`/v1/customer/bookings/${id}/approve`);
      toast(t('Bill approved — pay the vendor now', 'बिल मंज़ूर हो गया — अब वेंडर को पेमेंट दें'));
      await qc.invalidateQueries({ queryKey: keys.bookings });
      nav('/bookings');
    } catch (e) {
      toast((e as Error).message || t('Could not approve', 'मंज़ूर नहीं हुआ'));
    } finally {
      setBusy(false);
    }
  }
  async function dispute() {
    const reason = window.prompt(t("What's wrong with the bill?", 'बिल में क्या गलत है?'), '');
    if (reason == null) return;
    if (reason.trim().length < 3) return toast(t('Please write what is wrong', 'कृपया लिखें क्या गलत है'));
    setBusy(true);
    try {
      await api.post(`/v1/customer/bookings/${id}/dispute`, { reason: reason.trim() });
      toast(
        t(
          'Sent to the vendor — they will weigh again and re-send the bill',
          'वेंडर को भेज दिया — वे फिर से तौलकर बिल भेजेंगे',
        ),
      );
      await qc.invalidateQueries({ queryKey: keys.bookings });
      nav('/bookings');
    } catch (e) {
      toast((e as Error).message || t('Could not send', 'नहीं भेज पाए'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="scr on" id="s-bill">
      <div className="topbar">
        <button className="bk" onClick={() => nav('/bookings')} aria-label={t('Back', 'वापस')}>
          ←
        </button>
        <div>
          <h1>{t("Vendor's final bill", 'वेंडर का फ़ाइनल बिल')}</h1>
          <div className="sub">
            {t('check what changed, then approve', 'क्या बदला देखें, फिर मंज़ूर करें')}
          </div>
        </div>
      </div>
      <div className="pg" id="billBody">
        {bill.isPending ? (
          <div className="card">
            <div className="sk" style={{ height: 120 }} />
          </div>
        ) : bill.isError || !d ? (
          <div className="empty">
            <div className="ee">😕</div>
            <b>{t('Could not load the bill', 'बिल लोड नहीं हुआ')}</b>
            <p>{bill.error?.message}</p>
          </div>
        ) : (
          <>
            <div className="card" style={{ background: 'var(--or-s)', borderColor: 'transparent' }}>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: '#7a3f04' }}>
                ⚖️ {t(`${vname} weighed everything at your door`, `${vname} ने आपके सामने तौला`)}
              </div>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: '#8a5a1e', marginTop: 5 }}>
                {d.code}
                {booking ? ` · 🕖 ${prettySlot(booking.date, booking.slot, t, lang)}` : ''}
              </div>
            </div>

            <div className="h2">{t('What changed', 'क्या बदला')}</div>
            <div className="card">
              {changes.length ? (
                changes.map((c) => (
                  <div className="diff" key={c.itemId}>
                    <div className="de">
                      <Art photo={c.imageUrl} artKey={art(c.name)} alt={c.name} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <b>{c.name}</b>
                      <span>
                        {c.change === 'removed'
                          ? t('removed — ', 'हटाया — ') + WHY.removed
                          : `${c.bookedQty} → ${c.finalQty} — ${WHY[c.change] ?? ''}`}
                      </span>
                    </div>
                    <div className={`amt ${c.delta > 0 ? 'up' : 'down'}`}>
                      {c.delta > 0 ? '+' : '−'}₹{Math.abs(c.delta)}
                    </div>
                  </div>
                ))
              ) : (
                <p className="muted" style={{ padding: '6px 0' }}>
                  {t('Nothing changed — same as you booked', 'कुछ नहीं बदला — जैसा बुक किया वैसा ही')}
                </p>
              )}
            </div>

            {unchanged.length ? (
              <details className="card" style={{ padding: '15px 17px' }}>
                <summary style={{ fontSize: 14, fontWeight: 800, cursor: 'pointer', listStyle: 'none' }}>
                  {unchanged.length === 1
                    ? t('1 item unchanged', '1 सामान वैसा ही है')
                    : t(
                        `${unchanged.length} more items unchanged`,
                        `${unchanged.length} सामान वैसे ही हैं`,
                      )}{' '}
                  ▾
                </summary>
                <div style={{ marginTop: 8 }}>
                  {unchanged.map((u) => (
                    <div className="diff" key={u.itemId}>
                      <div className="de">
                        <Art photo={u.imageUrl} artKey={art(u.name)} alt={u.name} />
                      </div>
                      <div>
                        <b>{u.name}</b>
                        <span>
                          {u.finalQty} × {u.unit}
                        </span>
                      </div>
                      <div className="amt">₹{Math.round(u.finalPrice * u.finalQty)}</div>
                    </div>
                  ))}
                </div>
              </details>
            ) : null}

            <div className="card">
              <div className="trow">
                <span>{t('Estimated at booking', 'बुकिंग पर अनुमानित')}</span>
                <span className="oldtot">₹{oldT}</span>
              </div>
              <div className="trow big billtot">
                <div>
                  <b>₹{newT}</b>
                  <span>{t('FINAL — VENDOR WEIGHED', 'फ़ाइनल — वेंडर ने तौला')}</span>
                </div>
                <span
                  style={{ fontSize: 13, fontWeight: 800, color: newT > oldT ? 'var(--or)' : 'var(--g)' }}
                >
                  {newT > oldT ? '+' : '−'}₹{Math.abs(newT - oldT)}
                </span>
              </div>
            </div>

            <div className="note">
              <span>💵</span>
              <span>
                {t(
                  `Pay ₹${newT} directly to ${vname} — cash or UPI. RozBazaar never touches your money.`,
                  `₹${newT} सीधे ${vname} को दें — कैश या UPI। RozBazaar पैसा नहीं लेता।`,
                )}
              </span>
            </div>
          </>
        )}
      </div>
      {d && d.status === 'bill_final' ? (
        <div className="stick">
          <div className="stick-in" style={{ flexDirection: 'column', gap: 9 }}>
            <button
              className={`bigbtn ${busy ? 'busy' : ''}`}
              style={{ width: '100%' }}
              disabled={busy}
              onClick={() => void approve()}
            >
              {t('Bill is right — Approve', 'बिल सही है — मंज़ूर करें')}
            </button>
            <button className="ghostbtn" disabled={busy} onClick={() => void dispute()}>
              {t("Something's wrong", 'कुछ गलत है')}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
