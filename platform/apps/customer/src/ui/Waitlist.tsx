import { useState } from 'react';
import { useI18n } from '@rozbazaar/web';
import { api } from '../api/client';
import { useShop } from '../state/shop';
import { useMe } from '../state/useMe';
import { useToast } from './Toast';
import type { VendorType } from '@rozbazaar/shared';

/** "Notify me" for a village nobody serves yet (asks for a phone number when not logged in). */
export function Waitlist({ type = 'vegetable' }: { type?: VendorType }) {
  const { t } = useI18n();
  const toast = useToast();
  const { area } = useShop();
  const { me } = useMe();
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  async function join() {
    const p = (me?.phone || phone).replace(/\D/g, '').slice(-10);
    if (p.length !== 10)
      return toast(t('Enter your 10-digit mobile number', 'अपना 10 अंकों का मोबाइल नंबर लिखें'));
    setBusy(true);
    try {
      await api.post('/v1/public/waitlist', { area, type, phone: p });
      toast(t('Noted — we will tell you when a vendor starts here', 'नोट कर लिया — वेंडर आते ही बता देंगे'));
    } catch (e) {
      toast((e as Error).message || t('Could not save', 'सेव नहीं हुआ'));
    } finally {
      setBusy(false);
    }
  }
  if (me?.phone)
    return (
      <button
        className={`bigbtn ${busy ? 'busy' : ''}`}
        style={{ marginTop: 20, padding: '14px 28px' }}
        onClick={() => void join()}
      >
        {t('Notify me', 'मुझे बताएँ')}
      </button>
    );
  return (
    <div className="wl-row" style={{ marginLeft: 'auto', marginRight: 'auto' }}>
      <div className="phone-box" style={{ flex: 1, margin: 0 }}>
        <span className="cc">+91</span>
        <input
          inputMode="numeric"
          maxLength={10}
          placeholder={t('Mobile number', 'मोबाइल नंबर')}
          value={phone}
          onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
          aria-label={t('Mobile number', 'मोबाइल नंबर')}
        />
      </div>
      <button
        className={`bigbtn ${busy ? 'busy' : ''}`}
        style={{ padding: '12px 18px' }}
        onClick={() => void join()}
      >
        {t('Notify me', 'मुझे बताएँ')}
      </button>
    </div>
  );
}
