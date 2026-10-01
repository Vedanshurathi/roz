import { useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { useMutation } from '@tanstack/react-query';
import { finalizeBillBody, money, type Booking, type VendorProduct } from '@rozbazaar/shared';
import { Button, ItemImage, rupees, Spinner, useI18n, useToast } from '@rozbazaar/web';
import { api } from '../../api/client';
import { useProducts } from '../../api/queries';
import { TopBar } from '../../components/TopBar';
import { nameIndex, productName, qtyStep, unitLabel } from '../../lib/names';
import { matchScore } from '../../lib/search';
import { phaseOf } from '../../lib/status';
import { useOrder } from './useOrder';

interface Line {
  key: string;
  itemId?: string;
  productId: string | null;
  name: string;
  unit: string;
  imageUrl: string | null;
  qty: string;
  price: string;
  removed: boolean;
}

const num = (s: string) => {
  const n = Number(s.replace(',', '.').trim());
  return Number.isFinite(n) ? n : NaN;
};

function linesFrom(order: Booking): Line[] {
  return order.items.map((i) => ({
    key: i.id,
    itemId: i.id,
    productId: i.productId,
    name: i.name,
    unit: i.unit,
    imageUrl: i.imageUrl,
    qty: String(i.finalQty ?? i.qty),
    price: String(i.finalPrice ?? i.price),
    removed: i.removed,
  }));
}

/** Weigh in front of the customer, fix the numbers, send. The customer approves on their phone. */
export default function BillPage() {
  const { q, order, base } = useOrder();
  if (q.isPending) return <Spinner />;
  if (!order) return <Navigate to="/" replace />;
  if (
    !['way', 'reached', 'bill', 'disputed'].includes(phaseOf(order.status)) ||
    order.status === 'bill_approved'
  )
    return <Navigate to={base} replace />;
  return <BillBuilder order={order} base={base} />;
}

function BillBuilder({ order, base }: { order: Booking; base: string }) {
  const { t, lang } = useI18n();
  const toast = useToast();
  const nav = useNavigate();
  const { refresh } = useOrder();
  const products = useProducts();
  const names = nameIndex(products.data ?? [], lang);
  const [lines, setLines] = useState<Line[]>(() => linesFrom(order));
  const [search, setSearch] = useState('');

  const patch = (key: string, p: Partial<Line>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...p } : l)));
  const active = lines.filter((l) => !l.removed);
  const total = money(active.reduce((s, l) => s + (num(l.qty) || 0) * (num(l.price) || 0), 0));
  const diff = money(total - order.estTotal);
  const invalid = active.some((l) => !(num(l.qty) > 0) || !(num(l.price) >= 0));

  const onBill = new Set(lines.map((l) => l.productId).filter(Boolean));
  const addable = useMemo(() => {
    const list = (products.data ?? []).filter(
      (p) => p.inStock && p.reviewStatus !== 'rejected' && p.reviewStatus !== 'pending' && !onBill.has(p.id),
    );
    if (!search.trim()) return list.slice(0, 8);
    return list
      .map((p) => ({ p, s: matchScore([p.name, p.nameEn, p.nameHi], search) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .map((x) => x.p)
      .slice(0, 8);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onBill is derived from lines
  }, [products.data, search, lines]);

  function add(p: VendorProduct) {
    setLines((ls) => [
      ...ls,
      {
        key: `new-${p.id}`,
        productId: p.id,
        name: p.name,
        unit: p.unit,
        imageUrl: p.imageUrl,
        qty: '1',
        price: String(p.price),
        removed: false,
      },
    ]);
    setSearch('');
  }

  const send = useMutation({
    mutationFn: () =>
      api.post<{ finalTotal: number | null }>(
        `/v1/vendor/orders/${order.id}/bill`,
        finalizeBillBody.parse({
          items: lines.map((l) =>
            l.itemId
              ? {
                  itemId: l.itemId,
                  finalQty: l.removed ? 0 : num(l.qty),
                  finalPrice: num(l.price) || 0,
                  removed: l.removed,
                }
              : { productId: l.productId!, finalQty: num(l.qty), finalPrice: num(l.price) },
          ),
        }),
      ),
    onSuccess: async () => {
      toast.show(
        t(
          'Bill sent — the customer approves it on their phone',
          'बिल भेज दिया — ग्राहक अपने फ़ोन पर मंज़ूर करेंगे',
        ),
        'good',
      );
      await refresh();
      nav(base, { replace: true });
    },
    onError: (e) => toast.show(e.message, 'bad'),
  });

  return (
    <div className="page page--cream page--bar">
      <TopBar
        title={t('Make the bill', 'बिल बनाओ')}
        sub={t('weigh, then fix the numbers', 'तोलो, फिर नंबर ठीक करो')}
        back={base}
      />
      <div className="wrap">
        <div className="note note--or">
          <span aria-hidden>⚖️</span>
          <span>
            {t(
              'Weigh in front of the customer, then fix the numbers here. They approve it on their phone.',
              'ग्राहक के सामने तोलो, फिर यहाँ नंबर ठीक करो। वो अपने फ़ोन पर मंज़ूरी देंगे।',
            )}
          </span>
        </div>

        <div className="sechd">
          <h2>{t('Items', 'सामान')}</h2>
          <span>{active.length}</span>
        </div>
        <div className="card">
          {lines.map((l) => {
            const name = (l.productId && names.get(l.productId)) || l.name;
            const step = qtyStep(l.unit);
            const u = unitLabel(l.unit, lang);
            if (l.removed)
              return (
                <div key={l.key} className="birow is-removed">
                  <ItemImage src={l.imageUrl} name={l.name} size={44} />
                  <div className="birow__t">
                    <b>{name}</b>
                    <span>{t('removed from the bill', 'बिल से हटाया')}</span>
                  </div>
                  <Button variant="ghost" onClick={() => patch(l.key, { removed: false })}>
                    {t('Undo', 'वापस')}
                  </Button>
                </div>
              );
            const bad = !(num(l.qty) > 0);
            return (
              <div key={l.key} className="birow">
                <ItemImage src={l.imageUrl} name={l.name} size={44} />
                <div className="birow__t">
                  <b>
                    {name}
                    {!l.itemId ? <span className="rb-pill rb-pill--b">{t('added', 'जोड़ा')}</span> : null}
                  </b>
                  <label className="brate">
                    {t('rate', 'रेट')} ₹
                    <input
                      inputMode="decimal"
                      value={l.price}
                      onChange={(e) =>
                        patch(l.key, { price: e.target.value.replace(/[^\d.,]/g, '').slice(0, 8) })
                      }
                      aria-label={t(`Rate for ${name}`, `${name} का रेट`)}
                    />
                    / {u}
                  </label>
                </div>
                <div
                  className={`qstep ${bad ? 'is-bad' : ''}`}
                  role="group"
                  aria-label={t(`Quantity of ${name}`, `${name} की मात्रा`)}
                >
                  <button
                    type="button"
                    aria-label={t('Less', 'कम')}
                    onClick={() =>
                      patch(l.key, { qty: String(Math.max(0, money((num(l.qty) || 0) - step))) })
                    }
                  >
                    −
                  </button>
                  <input
                    inputMode="decimal"
                    value={l.qty}
                    onChange={(e) =>
                      patch(l.key, { qty: e.target.value.replace(/[^\d.,]/g, '').slice(0, 6) })
                    }
                    aria-label={t('Exact quantity', 'सटीक मात्रा')}
                  />
                  <button
                    type="button"
                    aria-label={t('More', 'ज़्यादा')}
                    onClick={() => patch(l.key, { qty: String(money((num(l.qty) || 0) + step)) })}
                  >
                    +
                  </button>
                </div>
                <button
                  type="button"
                  className="birow__rm"
                  aria-label={t(`Remove ${name}`, `${name} हटाएँ`)}
                  onClick={() =>
                    l.itemId
                      ? patch(l.key, { removed: true })
                      : setLines((ls) => ls.filter((x) => x.key !== l.key))
                  }
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>

        <div className="sechd">
          <h2>{t('Add something', 'कुछ और जोड़ो')}</h2>
        </div>
        <div className="searchbox">
          <span aria-hidden>🔍</span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('Search your items… (aloo, tamatar)', 'अपना सामान ढूँढें… (aloo, टमाटर)')}
            aria-label={t('Search your items', 'अपना सामान ढूँढें')}
          />
        </div>
        <div className="addlist">
          {products.isPending ? (
            <Spinner />
          ) : addable.length ? (
            addable.map((p) => (
              <button key={p.id} type="button" className="addlist__i" onClick={() => add(p)}>
                <ItemImage src={p.imageUrl} name={p.name} category={p.category} size={36} />
                <span>
                  <b>{productName(p, lang)}</b>
                  <small>
                    {rupees(p.price)}/{unitLabel(p.unit, lang)}
                  </small>
                </span>
                <em>+ {t('Add', 'जोड़ें')}</em>
              </button>
            ))
          ) : (
            <p className="rb-muted">
              {search
                ? t(`Nothing matched “${search}”`, `“${search}” से कुछ नहीं मिला`)
                : t('Everything is already on the bill', 'सब कुछ बिल में है')}
            </p>
          )}
        </div>

        <div className="card" style={{ marginTop: 16 }}>
          <div className="trow">
            <span>{t('They ordered', 'उन्होंने मँगाया था')}</span>
            <s>{rupees(order.estTotal)}</s>
          </div>
          <div className="trow">
            <span>{t('You weighed', 'आपने तोला')}</span>
            <b>{rupees(total)}</b>
          </div>
          <div className="trow trow--big">
            <div>
              <b>{rupees(total)}</b>
              <small>{t('FINAL BILL', 'आख़िरी बिल')}</small>
            </div>
            <span className={diff > 0 ? 'up' : diff < 0 ? 'down' : ''}>
              {diff === 0 ? '—' : `${diff > 0 ? '+' : '−'}${rupees(Math.abs(diff))}`}
            </span>
          </div>
        </div>
      </div>
      <div className="stickybar">
        <div className="stickybar__in stickybar__in--row">
          <div className="bartot">
            <b>{rupees(total)}</b>
            <small>{t('FINAL', 'आख़िरी')}</small>
          </div>
          <Button loading={send.isPending} disabled={invalid || !active.length} onClick={() => send.mutate()}>
            {t('Send to customer', 'ग्राहक को भेजो')}
          </Button>
        </div>
      </div>
    </div>
  );
}
