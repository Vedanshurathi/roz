import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { TIME_SLOTS, type TimeSlot } from '@rozbazaar/shared';
import {
  Button,
  dayLabel,
  ErrorState,
  istDate,
  Skeleton,
  slotIcon,
  slotLabel,
  useI18n,
} from '@rozbazaar/web';
import { PageHeader } from '../../components/PageHeader';
import { useSlots } from '../../api/queries';
import { useShop } from '../../state/shop';
import { useBasket } from '../basket/useBasket';

const DAYS = [0, 1, 2, 3, 4];

/** The screen that makes RozBazaar different: pick a day and a time window. */
export default function SlotPage() {
  const { t, lang } = useI18n();
  const nav = useNavigate();
  const shop = useShop();
  const basket = useBasket();
  const [date, setDate] = useState(() =>
    shop.slot && shop.slot.date >= istDate(0) ? shop.slot.date : istDate(0),
  );
  const [slot, setSlot] = useState<TimeSlot | null>(shop.slot?.date === date ? shop.slot.slot : null);
  const slots = useSlots(basket.bookingType, shop.area, date);

  useEffect(() => {
    if (!shop.itemCount) nav('/basket', { replace: true });
  }, [shop.itemCount, nav]);

  const status = (s: TimeSlot) => slots.data?.find((x) => x.slot === s);

  return (
    <div className="page">
      <PageHeader title={t('When should we come?', 'कब आएँ?')} back="/basket" step={{ n: 2, of: 3 }} />
      <div className="page__body">
        <h2 className="sech rv d1">{t('Day', 'दिन')}</h2>
        <div className="daypills rv d1" role="radiogroup" aria-label={t('Day', 'दिन')}>
          {DAYS.map((o) => {
            const iso = istDate(o);
            const d = new Date(`${iso}T12:00:00+05:30`);
            return (
              <button
                key={iso}
                type="button"
                role="radio"
                aria-checked={date === iso}
                className={`daypill ${date === iso ? 'is-on' : ''}`}
                onClick={() => {
                  setDate(iso);
                  setSlot(null);
                }}
              >
                <small>
                  {o < 2
                    ? dayLabel(iso, lang)
                    : d.toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', {
                        weekday: 'short',
                        timeZone: 'Asia/Kolkata',
                      })}
                </small>
                <b>{d.getDate()}</b>
              </button>
            );
          })}
        </div>

        <h2 className="sech rv d2">{t('Time', 'समय')}</h2>
        {slots.isError ? (
          <ErrorState message={slots.error.message} onRetry={() => slots.refetch()} />
        ) : (
          <div className="slots rv d2" role="radiogroup" aria-label={t('Time slot', 'समय')}>
            {TIME_SLOTS.map((s) => {
              const st = status(s);
              const off = !st || st.isPast || !st.hasRoom;
              return (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={slot === s}
                  disabled={slots.isPending || off}
                  className={`slottile ${slot === s ? 'is-on' : ''}`}
                  onClick={() => setSlot(s)}
                >
                  <span className="slottile__icon" aria-hidden>
                    {slotIcon(s)}
                  </span>
                  <b>{slotLabel(s, lang)}</b>
                  {slots.isPending ? (
                    <Skeleton h={12} w={70} />
                  ) : st?.isPast ? (
                    <small>{t('Time passed', 'समय निकल गया')}</small>
                  ) : !st?.hasRoom ? (
                    <small className="is-bad">{t('Full', 'भर गया')}</small>
                  ) : (
                    <small className="is-good">{t(`${st.free} spots left`, `${st.free} जगह बाकी`)}</small>
                  )}
                </button>
              );
            })}
          </div>
        )}
        <p className="rb-muted rv d3">
          {t(
            'A real local vendor comes in this window, weighs at your door and makes the bill.',
            'इसी समय में आपके इलाके का वेंडर आएगा, दरवाज़े पर तौलकर बिल बनाएगा।',
          )}
        </p>
      </div>
      <div className="stickybar">
        <Button
          block
          disabled={!slot}
          onClick={() => {
            shop.setSlot({ date, slot: slot! });
            nav('/checkout');
          }}
        >
          {slot
            ? `${dayLabel(date, lang)}, ${slotLabel(slot, lang)} — ${t('continue', 'आगे')} ›`
            : t('Pick a time', 'समय चुनें')}
        </Button>
      </div>
    </div>
  );
}
