import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { TIME_SLOTS, type TimeSlot, type VendorSlotDay } from '@rozbazaar/shared';
import {
  Button,
  ErrorState,
  istDate,
  Skeleton,
  slotIcon,
  slotLabel,
  useI18n,
  useToast,
} from '@rozbazaar/web';
import { api } from '../../api/client';
import { useVendor } from '../../app/vendor-context';
import { keys, useSlotAreas, useSlots } from '../../api/queries';
import { Toggle } from '../../components/Toggle';

const DAYS = 7;

/** How many orders per slot, which slots are open, and which villages each slot covers. */
export default function SlotsPage() {
  const { t, lang } = useI18n();
  const vendor = useVendor();
  const from = istDate(0);
  const slots = useSlots(from, DAYS - 1);
  const [day, setDay] = useState(0);
  const date = istDate(day);
  const find = (slot: TimeSlot): VendorSlotDay =>
    slots.data?.find((s) => s.date === date && s.slot === slot) ?? {
      date,
      slot,
      isOpen: true,
      capacity: vendor.defaultCapacity,
      booked: 0,
    };

  return (
    <div className="page page--cream">
      <header className="topbar topbar--plain">
        <div className="topbar__t">
          <h1>{t('Slots', 'स्लॉट')}</h1>
          <p>{t('when you deliver, and how many orders', 'कब डिलीवरी करेंगे, और कितने ऑर्डर')}</p>
        </div>
      </header>
      <div className="wrap">
        <div className="daypills daypills--light" role="tablist" aria-label={t('Day', 'दिन')}>
          {Array.from({ length: DAYS }, (_, i) => {
            const iso = istDate(i);
            const d = new Date(`${iso}T12:00:00+05:30`);
            const name =
              i === 0
                ? t('Today', 'आज')
                : i === 1
                  ? t('Tmrw', 'कल')
                  : d.toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', {
                      weekday: 'short',
                      timeZone: 'Asia/Kolkata',
                    });
            return (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={day === i}
                className={`daypill ${day === i ? 'is-on' : ''}`}
                onClick={() => setDay(i)}
              >
                <i>{name}</i>
                <b>{Number(iso.slice(8))}</b>
              </button>
            );
          })}
        </div>
        {slots.isPending ? (
          <div className="stack">
            <Skeleton h={120} r={18} />
            <Skeleton h={120} r={18} />
            <Skeleton h={120} r={18} />
          </div>
        ) : slots.isError ? (
          <ErrorState
            message={slots.error.message}
            onRetry={() => slots.refetch()}
            retryLabel={t('Retry', 'फिर से')}
          />
        ) : (
          <div className="stack slotcards">
            {TIME_SLOTS.map((s) => (
              <SlotCard key={`${date}-${s}`} day={find(s)} from={from} />
            ))}
          </div>
        )}

        <h2 className="sech">{t('Villages in each slot', 'हर स्लॉट के गाँव')}</h2>
        <p className="rb-muted">
          {t(
            'Leave “All my villages” on, or pick where you go in that slot. Customers in other villages will not see you in that slot.',
            '“मेरे सब गाँव” रहने दें, या चुनें उस स्लॉट में कहाँ जाते हैं। बाकी गाँवों के ग्राहकों को आप उस स्लॉट में नहीं दिखेंगे।',
          )}
        </p>
        <SlotVillages areas={vendor.areas} />
      </div>
    </div>
  );
}

function SlotCard({ day, from }: { day: VendorSlotDay; from: string }) {
  const { t, lang } = useI18n();
  const toast = useToast();
  const qc = useQueryClient();
  const [cap, setCap] = useState(day.capacity);
  const [open, setOpen] = useState(day.isOpen);
  useEffect(() => {
    setCap(day.capacity);
    setOpen(day.isOpen);
  }, [day.capacity, day.isOpen]);

  const save = useMutation({
    mutationFn: (v: { capacity: number; open: boolean }) =>
      api.post('/v1/vendor/slots/capacity', {
        date: day.date,
        slot: day.slot,
        capacity: v.capacity,
        open: v.open,
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.slots(from) }),
    onError: (e) => {
      toast.show(e.message, 'bad');
      setCap(day.capacity);
      setOpen(day.isOpen);
    },
  });

  // Save a moment after the last tap so + + + + is one request.
  useEffect(() => {
    if (cap === day.capacity && open === day.isOpen) return;
    const id = window.setTimeout(() => save.mutate({ capacity: cap, open }), 600);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- save is stable enough; only react to edits
  }, [cap, open]);

  const full = open && day.booked >= cap;
  return (
    <article className={`slotcard ${open ? '' : 'is-closed'}`}>
      <div className="slotcard__top">
        <span className="slotcard__ic" aria-hidden>
          {slotIcon(day.slot)}
        </span>
        <div className="slotcard__t">
          <b>{slotLabel(day.slot, lang)}</b>
          <small>
            {day.booked} {t('booked', 'बुक')}
            {full ? ` · ${t('full', 'भरा हुआ')}` : ''}
          </small>
        </div>
        <Toggle
          on={open}
          onChange={setOpen}
          label={t(`${slotLabel(day.slot, lang)} open`, `${slotLabel(day.slot, lang)} चालू`)}
        />
      </div>
      {open ? (
        <div className="slotcard__cap">
          <span>{t('Max orders', 'ज़्यादा से ज़्यादा ऑर्डर')}</span>
          <div className="qstep" role="group" aria-label={t('Max orders', 'ज़्यादा से ज़्यादा ऑर्डर')}>
            <button
              type="button"
              aria-label={t('Less', 'कम')}
              onClick={() => setCap((c) => Math.max(Math.max(1, day.booked), c - 1))}
            >
              −
            </button>
            <output aria-live="polite">{cap}</output>
            <button
              type="button"
              aria-label={t('More', 'ज़्यादा')}
              onClick={() => setCap((c) => Math.min(200, c + 1))}
            >
              +
            </button>
          </div>
          {save.isPending ? <small className="rb-muted">{t('saving…', 'सेव हो रहा…')}</small> : null}
        </div>
      ) : (
        <p className="slotcard__off">
          {t('Closed — no bookings in this slot', 'बंद — इस स्लॉट में बुकिंग नहीं')}
        </p>
      )}
    </article>
  );
}

function SlotVillages({ areas }: { areas: string[] }) {
  const { t, lang } = useI18n();
  const toast = useToast();
  const qc = useQueryClient();
  const q = useSlotAreas();
  const [draft, setDraft] = useState<Record<TimeSlot, string[] | null> | null>(null);
  useEffect(() => {
    if (q.data) setDraft(q.data);
  }, [q.data]);
  const save = useMutation({
    mutationFn: (v: { slot: TimeSlot; areas: string[] | null }) => api.put('/v1/vendor/slots/areas', v),
    onSuccess: () => {
      toast.show(t('Villages saved ✓', 'गाँव सेव हो गए ✓'), 'good');
      void qc.invalidateQueries({ queryKey: keys.slotAreas });
    },
    onError: (e) => toast.show(e.message, 'bad'),
  });
  if (q.isPending || !draft) return <Skeleton h={120} r={18} />;
  if (q.isError) return <ErrorState message={q.error.message} onRetry={() => q.refetch()} />;

  return (
    <div className="stack slotcards">
      {TIME_SLOTS.map((slot) => {
        const cur = draft[slot];
        const all = cur === null;
        const changed = JSON.stringify(cur) !== JSON.stringify(q.data[slot]);
        const toggle = (a: string) => {
          const base = cur ?? areas;
          const nextList = base.includes(a) ? base.filter((x) => x !== a) : [...base, a];
          setDraft({ ...draft, [slot]: nextList.length === areas.length ? null : nextList });
        };
        return (
          <div key={slot} className="card">
            <b className="sv__h">
              {slotIcon(slot)} {slotLabel(slot, lang)}
            </b>
            <div className="chips">
              <button
                type="button"
                aria-pressed={all}
                className={`rb-chip ${all ? 'is-on' : ''}`}
                onClick={() => setDraft({ ...draft, [slot]: null })}
              >
                {t('All my villages', 'मेरे सब गाँव')}
              </button>
              {areas.map((a) => {
                const on = all || cur.includes(a);
                return (
                  <button
                    key={a}
                    type="button"
                    aria-pressed={!all && on}
                    className={`rb-chip ${!all && on ? 'is-on' : ''}`}
                    onClick={() => toggle(a)}
                  >
                    {a}
                  </button>
                );
              })}
            </div>
            {changed ? (
              <Button
                block
                loading={save.isPending && save.variables?.slot === slot}
                disabled={cur !== null && cur.length === 0}
                onClick={() => save.mutate({ slot, areas: cur })}
              >
                {t('Save villages', 'गाँव सेव करें')}
              </Button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
