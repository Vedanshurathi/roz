import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import type { Booking } from '@rozbazaar/shared';
import {
  Button,
  ErrorState,
  ItemImage,
  qty,
  rupees,
  Sheet,
  Spinner,
  useI18n,
  useToast,
} from '@rozbazaar/web';
import { api } from '../../api/client';
import { useBill } from '../../api/queries';

/**
 * Bill approval — the highest-trust moment. Every changed line is spelled out (not just a new
 * total), unchanged lines fold away, the old total is struck through.
 */
export function BillSheet(props: {
  booking: Booking;
  names: Map<string, string>;
  onClose: () => void;
  onDone: () => void;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const bill = useBill(props.booking.id);
  const [showSame, setShowSame] = useState(false);
  const [disputing, setDisputing] = useState(false);
  const [reason, setReason] = useState('');

  const approve = useMutation({
    mutationFn: () => api.post(`/v1/customer/bookings/${props.booking.id}/approve`),
    onSuccess: () => {
      toast.show(t('Bill approved ✓', 'बिल मंज़ूर ✓'), 'good');
      props.onDone();
    },
    onError: (e) => toast.show(e.message, 'bad'),
  });
  const dispute = useMutation({
    mutationFn: () => api.post(`/v1/customer/bookings/${props.booking.id}/dispute`, { reason }),
    onSuccess: () => {
      toast.show(t('The vendor will re-check the bill', 'वेंडर बिल फिर से जाँचेगा'), 'good');
      props.onDone();
    },
    onError: (e) => toast.show(e.message, 'bad'),
  });

  const productOf = new Map(props.booking.items.map((i) => [i.id, i.productId]));
  const lineName = (l: { itemId: string; name: string }) => {
    const pid = productOf.get(l.itemId);
    return (pid && props.names.get(pid)) || l.name;
  };
  const lines = bill.data?.lines ?? [];
  const changed = lines.filter((l) => l.change !== 'same');
  const same = lines.filter((l) => l.change === 'same');

  const describe = (l: (typeof lines)[number]) => {
    if (l.change === 'removed') return t('removed', 'हटाया');
    if (l.change === 'added') return `${t('added', 'जोड़ा')} · ${qty(l.finalQty)} × ${rupees(l.finalPrice)}`;
    return `${qty(l.bookedQty)} → ${qty(l.finalQty)}${l.bookedPrice !== l.finalPrice ? ` · ${rupees(l.bookedPrice)} → ${rupees(l.finalPrice)}` : ''}`;
  };

  return (
    <Sheet
      open
      onClose={props.onClose}
      title={t('Check your bill', 'अपना बिल जाँचें')}
      footer={
        disputing ? (
          <div className="stack">
            <textarea
              className="rb-textarea"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
              placeholder={t(
                'What is wrong? e.g. tomatoes were 2 kg, not 3',
                'क्या ग़लत है? जैसे: टमाटर 3 नहीं 2 किलो थे',
              )}
              aria-label={t('Reason', 'कारण')}
            />
            <Button
              block
              variant="danger"
              loading={dispute.isPending}
              disabled={reason.trim().length < 3}
              onClick={() => dispute.mutate()}
            >
              {t('Send to vendor', 'वेंडर को भेजें')}
            </Button>
          </div>
        ) : (
          <div className="stack">
            <Button block loading={approve.isPending} disabled={!bill.data} onClick={() => approve.mutate()}>
              ✓ {t('Bill is correct — approve', 'बिल सही है — मंज़ूर करें')}
            </Button>
            <Button block variant="ghost" onClick={() => setDisputing(true)}>
              {t('Something is wrong', 'कुछ ग़लत है')}
            </Button>
          </div>
        )
      }
    >
      {bill.isPending ? (
        <Spinner />
      ) : bill.isError ? (
        <ErrorState message={bill.error.message} onRetry={() => bill.refetch()} />
      ) : (
        <>
          <div className="billtot">
            {bill.data.estTotal !== bill.data.finalTotal ? <s>{rupees(bill.data.estTotal)}</s> : null}
            <b>{rupees(bill.data.finalTotal)}</b>
          </div>
          {changed.length ? (
            <h3 className="sech">{t('What changed at the door', 'दरवाज़े पर क्या बदला')}</h3>
          ) : null}
          <ul className="billlines">
            {changed.map((l) => (
              <li key={l.itemId} className={`is-${l.change}`}>
                <ItemImage src={l.imageUrl} name={l.name} size={40} />
                <span>
                  <b>{lineName(l)}</b>
                  <small>{describe(l)}</small>
                </span>
                <em>{l.delta === 0 ? '' : `${l.delta > 0 ? '+' : '−'}${rupees(Math.abs(l.delta))}`}</em>
              </li>
            ))}
          </ul>
          {same.length ? (
            <button
              type="button"
              className="linkbtn"
              onClick={() => setShowSame((x) => !x)}
              aria-expanded={showSame}
            >
              {showSame
                ? t('Hide unchanged items', 'बिना बदले सामान छिपाएँ')
                : t(`+ ${same.length} unchanged items`, `+ ${same.length} बिना बदले सामान`)}
            </button>
          ) : null}
          {showSame ? (
            <ul className="billlines">
              {same.map((l) => (
                <li key={l.itemId}>
                  <ItemImage src={l.imageUrl} name={l.name} size={40} />
                  <span>
                    <b>{lineName(l)}</b>
                    <small>
                      {qty(l.finalQty)} × {rupees(l.finalPrice)}
                    </small>
                  </span>
                  <em />
                </li>
              ))}
            </ul>
          ) : null}
        </>
      )}
    </Sheet>
  );
}

export function CancelSheet(props: {
  onClose: () => void;
  onSubmit: (reason: string) => void;
  busy: boolean;
}) {
  const { t } = useI18n();
  const reasons = [
    t('Plans changed', 'प्लान बदल गया'),
    t('Booked by mistake', 'ग़लती से बुक हुआ'),
    t('Wrong time slot', 'ग़लत समय चुना'),
  ];
  const [reason, setReason] = useState(reasons[0]!);
  return (
    <Sheet
      open
      onClose={props.onClose}
      title={t('Cancel this order?', 'यह ऑर्डर रद्द करें?')}
      footer={
        <Button block variant="danger" loading={props.busy} onClick={() => props.onSubmit(reason)}>
          {t('Yes, cancel', 'हाँ, रद्द करें')}
        </Button>
      }
    >
      <div className="stack" role="radiogroup" aria-label={t('Reason', 'कारण')}>
        {reasons.map((r) => (
          <button
            key={r}
            type="button"
            role="radio"
            aria-checked={reason === r}
            className={`rb-chip ${reason === r ? 'is-on' : ''}`}
            onClick={() => setReason(r)}
          >
            {r}
          </button>
        ))}
      </div>
    </Sheet>
  );
}

const WORDS: Array<[string, string]> = [
  ['Bad', 'बेकार'],
  ['Okay', 'ठीक'],
  ['Good', 'अच्छा'],
  ['Very good', 'बहुत अच्छा'],
  ['Excellent!', 'ज़बरदस्त!'],
];

export function RateSheet(props: {
  vendor: string | null;
  busy: boolean;
  onClose: () => void;
  onSubmit: (stars: number, comment: string) => void;
}) {
  const { t, lang } = useI18n();
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  return (
    <Sheet
      open
      onClose={props.onClose}
      title={t(`How was ${props.vendor ?? 'the vendor'}?`, `${props.vendor ?? 'वेंडर'} कैसे रहे?`)}
      footer={
        <Button block loading={props.busy} disabled={!stars} onClick={() => props.onSubmit(stars, comment)}>
          {t('Submit', 'भेजें')}
        </Button>
      }
    >
      <div className="rate" role="radiogroup" aria-label={t('Stars', 'स्टार')}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={stars === n}
            aria-label={`${n}`}
            className={n <= stars ? 'is-on' : ''}
            onClick={() => setStars(n)}
          >
            ★
          </button>
        ))}
      </div>
      <p className="rate__word">
        {stars ? (lang === 'hi' ? WORDS[stars - 1]![1] : WORDS[stars - 1]![0]) : ' '}
      </p>
      <textarea
        className="rb-textarea"
        maxLength={500}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder={t('Anything to add? (optional)', 'कुछ कहना है? (ज़रूरी नहीं)')}
        aria-label={t('Comment', 'टिप्पणी')}
      />
    </Sheet>
  );
}
