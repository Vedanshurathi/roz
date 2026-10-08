import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { useI18n } from '@rozbazaar/web';
import { api } from '../api/client';
import { keys, useBookings } from '../api/queries';
import { vtype } from '../lib/model';
import { useMe } from '../state/useMe';
import { Stars, starWord } from '../ui/Stars';
import { useToast } from '../ui/Toast';

export default function Rate() {
  const { id } = useParams();
  const { t, lang } = useI18n();
  const nav = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const { loggedIn } = useMe();
  const b = useBookings(loggedIn).data?.find((x) => x.id === id);
  const [stars, setStars] = useState(0);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!stars) return toast(t('Tap a star first', 'पहले स्टार दबाएँ'));
    setBusy(true);
    try {
      await api.post(`/v1/customer/bookings/${id}/rating`, { stars, comment: note.trim() || undefined });
      toast(t('Thank you for the rating! 🙏', 'रेटिंग के लिए धन्यवाद! 🙏'));
      await qc.invalidateQueries({ queryKey: keys.bookings });
      nav('/bookings');
    } catch (e) {
      toast((e as Error).message || t('Rating not saved', 'रेटिंग सेव नहीं हुई'));
    } finally {
      setBusy(false);
    }
  }
  const v = vtype(b?.type);
  return (
    <div className="scr on" id="s-rate">
      <div className="topbar">
        <button className="bk" onClick={() => nav('/bookings')} aria-label={t('Back', 'वापस')}>
          ←
        </button>
        <div>
          <h1>{t('Rate the vendor', 'वेंडर को रेटिंग दें')}</h1>
        </div>
      </div>
      <div className="pg" style={{ maxWidth: 440, textAlign: 'center' }}>
        <div style={{ fontSize: 64, margin: '22px 0 6px' }}>🧑‍🌾</div>
        <div
          style={{ fontFamily: 'var(--disp)', fontSize: 22, fontWeight: 800, letterSpacing: -0.5 }}
          id="rateName"
        >
          {b?.vendorName || t('Your vendor', 'आपका वेंडर')}
        </div>
        <div className="muted" id="rateId">
          {lang === 'en' ? v.en : v.hi}
          {b ? ` · ${b.code}` : ''}
        </div>
        <Stars value={stars} onPick={setStars} />
        <div className="starword" id="starword">
          {starWord(stars, t)}
        </div>
        <textarea
          className="field"
          id="rateNote"
          rows={3}
          maxLength={500}
          style={{ marginTop: 16 }}
          placeholder={t('Anything else? (optional)', 'और कुछ कहना है? (वैकल्पिक)')}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <button
          className={`bigbtn ${busy ? 'busy' : ''}`}
          style={{ width: '100%', marginTop: 18 }}
          disabled={busy}
          onClick={() => void submit()}
        >
          {t('Submit rating', 'रेटिंग भेजें')}
        </button>
      </div>
    </div>
  );
}
