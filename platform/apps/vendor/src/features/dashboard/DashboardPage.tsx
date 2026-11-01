import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ErrorState, istDate, rupees, Skeleton, slotLabel, useI18n } from '@rozbazaar/web';
import type { VendorDashboard } from '@rozbazaar/shared';
import { useDashboard, useProducts } from '../../api/queries';
import { productName } from '../../lib/names';

type Range = 'today' | 'yesterday' | 'week' | 'month30' | 'thisMonth';

function rangeDates(r: Range): [string, string] {
  const today = istDate(0);
  switch (r) {
    case 'today':
      return [today, today];
    case 'yesterday':
      return [istDate(-1), istDate(-1)];
    case 'week':
      return [istDate(-6), today];
    case 'month30':
      return [istDate(-29), today];
    case 'thisMonth':
      return [`${today.slice(0, 8)}01`, today];
  }
}

/** Sale, commission owed to RozBazaar and what the vendor keeps (commission_rate() in the DB). */
export default function DashboardPage() {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const [range, setRange] = useState<Range>('today');
  const [from, to] = rangeDates(range);
  const q = useDashboard(from, to);
  const chips: Array<[Range, string]> = [
    ['today', t('Today', 'आज')],
    ['yesterday', t('Yesterday', 'बीता कल')],
    ['week', t('7 days', '7 दिन')],
    ['month30', t('30 days', '30 दिन')],
    ['thisMonth', t('This month', 'इस महीने')],
  ];
  const fmtDay = (iso: string) =>
    new Date(`${iso}T12:00:00+05:30`).toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', {
      day: 'numeric',
      month: 'short',
      timeZone: 'Asia/Kolkata',
    });

  return (
    <div className="page page--cream">
      <header className="topbar topbar--plain">
        <div className="topbar__t">
          <h1>{t('Dashboard', 'डैशबोर्ड')}</h1>
          <p>{t('your sale, commission and earnings', 'आपकी बिक्री, कमीशन और कमाई')}</p>
        </div>
        <button
          type="button"
          className="topbar__icon"
          aria-label={t('Refresh', 'रिफ़्रेश')}
          onClick={() => void qc.invalidateQueries({ queryKey: ['dashboard'] })}
        >
          ↻
        </button>
      </header>
      <div className="wrap">
        <div className="chips chips--scroll" role="tablist">
          {chips.map(([k, label]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={range === k}
              className={`rb-chip ${range === k ? 'is-on' : ''}`}
              onClick={() => setRange(k)}
            >
              {label}
            </button>
          ))}
        </div>
        {q.isPending ? (
          <div className="stack">
            <Skeleton h={220} r={22} />
            <Skeleton h={80} r={18} />
          </div>
        ) : q.isError ? (
          <ErrorState
            message={q.error.message}
            onRetry={() => q.refetch()}
            retryLabel={t('Retry', 'फिर से')}
          />
        ) : (
          <Body
            d={q.data}
            label={from === to ? fmtDay(from) : `${fmtDay(from)} – ${fmtDay(to)}`}
            fmtDay={fmtDay}
          />
        )}
      </div>
    </div>
  );
}

function Body({ d, label, fmtDay }: { d: VendorDashboard; label: string; fmtDay: (iso: string) => string }) {
  const { t, lang } = useI18n();
  const max = Math.max(1, ...d.chart.map((c) => c.total));
  const topMax = Math.max(1, ...d.items.map((i) => i.amount));
  // Sale lines carry the typed name ("Tamatar"); show the English / Hindi name when it is one of ours.
  const products = useProducts();
  const byTyped = new Map((products.data ?? []).map((p) => [p.name.toLowerCase(), productName(p, lang)]));
  return (
    <>
      <section className="salecard rv d1">
        <div className="salecard__h">
          <small>{t('TOTAL SALE', 'कुल बिक्री')}</small>
          <small>{label}</small>
        </div>
        <b className="salecard__big">{rupees(d.sale)}</b>
        <p>
          {d.orders} {t('orders', 'ऑर्डर')} · {t('avg', 'औसत')} {rupees(d.avg)}
        </p>
        <div className="salecard__split">
          <div>
            <small>{t(`RozBazaar commission (${d.rate}%)`, `RozBazaar कमीशन (${d.rate}%)`)}</small>
            <b className="neg">− {rupees(d.commission)}</b>
          </div>
          <div>
            <small>{t('You keep', 'आपके पास')}</small>
            <b className="pos">{rupees(d.net)}</b>
          </div>
        </div>
        <p className="salecard__fine">
          {t(
            `Customers pay nothing extra — ${d.rate}% of your total sale is RozBazaar's commission.`,
            `ग्राहक कुछ ज़्यादा नहीं देते — आपकी कुल बिक्री का ${d.rate}% RozBazaar का कमीशन है।`,
          )}
        </p>
      </section>

      <div className="monthcard rv d2">
        <div>
          <small>{t('This month — sale', 'इस महीने — बिक्री')}</small>
          <b>{rupees(d.monthSale)}</b>
        </div>
        <div>
          <small>{t('Commission to pay', 'कमीशन देना है')}</small>
          <b className="neg">{rupees(d.monthCommission)}</b>
        </div>
      </div>

      <div className="tiles rv d3">
        <div className="tile">
          <small>💵 {t('Cash', 'नकद')}</small>
          <b>{rupees(d.cash)}</b>
        </div>
        <div className="tile">
          <small>📱 UPI</small>
          <b>{rupees(d.upi)}</b>
        </div>
        <div className="tile">
          <small>📦 {t('Orders booked', 'बुक हुए ऑर्डर')}</small>
          <b>{d.booked}</b>
          <em>
            {d.open} {t('still open', 'अभी खुले')}
            {d.cancelled ? ` · ${d.cancelled} ${t('cancelled', 'रद्द')}` : ''}
            {d.missed ? ` · ${d.missed} ${t('missed', 'छूटे')}` : ''}
          </em>
        </div>
        <div className="tile">
          <small>⭐ {t('Rating', 'रेटिंग')}</small>
          <b>{d.rating ? d.rating.toFixed(1) : '—'}</b>
          <em>
            {d.ratings} {t('ratings', 'रेटिंग')}
          </em>
        </div>
      </div>

      {d.chart.length > 1 ? (
        <>
          <h2 className="sech">
            {d.monthly ? t('Month by month', 'महीने के हिसाब से') : t('Day by day', 'दिन के हिसाब से')}
          </h2>
          <div className="card">
            <div className="bars" role="img" aria-label={t('Sale chart', 'बिक्री चार्ट')}>
              {d.chart.map((c) => (
                <div key={c.date} className="bars__c" title={`${c.date}: ${rupees(c.total)}`}>
                  <span style={{ height: `${Math.max(3, (c.total / max) * 100)}%` }} />
                  <small>{d.monthly ? c.date.slice(5, 7) : Number(c.date.slice(8))}</small>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : null}

      {d.items.length ? (
        <>
          <h2 className="sech">{t('Top items', 'सबसे ज़्यादा बिके')}</h2>
          <div className="card">
            {d.items.slice(0, 8).map((i) => (
              <div key={i.name} className="topi">
                <div className="topi__h">
                  <b>
                    {byTyped.get(i.name.toLowerCase()) ?? i.name}{' '}
                    <small>
                      {i.qty} × {i.unit ?? ''}
                    </small>
                  </b>
                  <b>{rupees(i.amount)}</b>
                </div>
                <span className="topi__bar">
                  <i style={{ width: `${(i.amount / topMax) * 100}%` }} />
                </span>
              </div>
            ))}
          </div>
        </>
      ) : null}

      <h2 className="sech">{t('Every sale', 'हर बिक्री')}</h2>
      {d.list.length ? (
        <div className="card salelist">
          {d.list.map((s) => (
            <div key={s.code} className="salelist__i">
              <div>
                <b>{s.customerName ?? s.code}</b>
                <small>
                  {s.code} · {fmtDay(s.date)}
                  {s.slot ? ` · ${slotLabel(s.slot, lang)}` : ''}
                </small>
              </div>
              <div className="salelist__r">
                <b>{rupees(s.amount)}</b>
                <small>{s.method === 'cash' ? t('Cash', 'नकद') : s.method ? 'UPI' : '—'}</small>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="rb-muted">{t('No sales in these days yet.', 'इन दिनों में अभी कोई बिक्री नहीं।')}</p>
      )}
    </>
  );
}
