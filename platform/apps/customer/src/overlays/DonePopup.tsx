import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Booking } from '@rozbazaar/shared';
import { storage, useI18n } from '@rozbazaar/web';
import { api } from '../api/client';
import { keys, useBookings, useSession } from '../api/queries';
import { SuccessRing } from '../ui/Burst';
import { Stars, starWord } from '../ui/Stars';
import { useToast } from '../ui/Toast';

const SEEN = 'rb_done_seen';

/** "Order complete!" — appears once per delivered order, on any screen (Uber-style). */
export function DonePopup() {
  const { t } = useI18n();
  const toast = useToast();
  const qc = useQueryClient();
  const loggedIn = Boolean(useSession().data?.authenticated);
  const bookings = useBookings(loggedIn);
  const [done, setDone] = useState<Booking | null>(null);
  const [stars, setStars] = useState(0);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (done || !bookings.data) return;
    const seen = new Set(storage.get<string[]>(SEEN) ?? []);
    const b = bookings.data.find(
      (x) =>
        (x.status === 'delivered' || x.status === 'completed') && x.ratingStars == null && !seen.has(x.code),
    );
    if (b) {
      setDone(b);
      setStars(0);
      setNote('');
    }
  }, [bookings.data, done]);

  const markSeen = (code: string) => storage.set(SEEN, [...(storage.get<string[]>(SEEN) ?? []), code]);
  const rate = useMutation({
    mutationFn: () =>
      api.post(`/v1/customer/bookings/${done!.id}/rating`, { stars, comment: note.trim() || undefined }),
    onSuccess: () => {
      markSeen(done!.code);
      setDone(null);
      toast(t('Thank you for the rating! 🙏', 'रेटिंग के लिए धन्यवाद! 🙏'));
      void qc.invalidateQueries({ queryKey: keys.bookings });
    },
    onError: (e) => toast(e.message || t('Rating not saved', 'रेटिंग सेव नहीं हुई')),
  });

  const on = Boolean(done);
  return (
    <>
      <div className={`loc-bg ${on ? 'on' : ''}`} />
      <div
        className={`loc-ask ${on ? 'on' : ''}`}
        style={{ textAlign: 'center' }}
        role="dialog"
        aria-modal="true"
        aria-hidden={!on}
      >
        {on ? (
          <>
            <div
              className="burst-wrap"
              style={{ margin: '4px auto 6px', position: 'relative', width: 110, height: 110 }}
            >
              <SuccessRing delay={200} />
            </div>
            <b className="disp" style={{ fontSize: 22 }}>
              {t('Order complete!', 'ऑर्डर पूरा हो गया!')}
            </b>
            <p style={{ marginTop: 4 }}>
              {(() => {
                const v = done!.vendorName ?? t('your vendor', 'आपके वेंडर');
                return t(`Delivered by ${v}. How was it?`, `${v} ने डिलीवर किया। कैसा रहा?`);
              })()}
            </p>
            <div style={{ marginTop: 18 }}>
              <Stars value={stars} onPick={setStars} />
            </div>
            <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--g-dk)', minHeight: 18, marginTop: 4 }}>
              {starWord(stars, t)}
            </p>
            <textarea
              className="field"
              rows={2}
              style={{ marginTop: 6 }}
              maxLength={500}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('Anything to add? (optional)', 'कुछ कहना है? (वैकल्पिक)')}
            />
            <button
              className="bigbtn"
              style={{ width: '100%', marginTop: 14 }}
              disabled={rate.isPending}
              onClick={() => (stars ? rate.mutate() : toast(t('Tap a star first', 'पहले स्टार दबाएँ')))}
            >
              {t('Submit rating', 'रेटिंग भेजें')}
            </button>
            <button
              className="ghostbtn"
              style={{ marginTop: 8 }}
              onClick={() => {
                markSeen(done!.code);
                setDone(null);
              }}
            >
              {t('Skip for now', 'अभी के लिए छोड़ें')}
            </button>
          </>
        ) : null}
      </div>
    </>
  );
}
