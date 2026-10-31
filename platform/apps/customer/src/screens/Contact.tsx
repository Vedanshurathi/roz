import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useI18n } from '@rozbazaar/web';
import { api } from '../api/client';
import { useMe } from '../state/useMe';
import { useToast } from '../ui/Toast';

export default function Contact() {
  const { t } = useI18n();
  const nav = useNavigate();
  const toast = useToast();
  const { me } = useMe();
  const [name, setName] = useState(me?.name ?? '');
  const [phone, setPhone] = useState(me?.phone ?? '');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function send() {
    if (name.trim().length < 1) return toast(t('Add your name', 'नाम डालें'));
    if (body.trim().length < 3) return toast(t('Write a little more', 'थोड़ा और लिखें'));
    const p = phone.replace(/\D/g, '');
    if (p && p.length !== 10) return toast(t('Phone number should be 10 digits', 'फ़ोन नंबर 10 अंकों का हो'));
    setBusy(true);
    try {
      await api.post('/v1/public/contact', { name: name.trim(), body: body.trim(), phone: p || undefined });
      setDone(true);
    } catch (e) {
      toast((e as Error).message || t('Could not send — try again', 'भेज नहीं पाए — दोबारा कोशिश करें'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="scr on" id="s-contact">
      <div className="topbar">
        <button className="bk" onClick={() => nav(-1)} aria-label={t('Back', 'वापस')}>
          ←
        </button>
        <div>
          <h1>{t('Contact us', 'संपर्क करें')}</h1>
          <div className="sub">
            {t('goes straight to the RozBazaar team', 'सीधे RozBazaar टीम के पास जाता है')}
          </div>
        </div>
      </div>
      {done ? (
        <div className="pg" id="contactDone" style={{ textAlign: 'center', paddingTop: 60 }}>
          <div style={{ fontSize: 56 }}>✅</div>
          <b className="disp" style={{ display: 'block', fontSize: 22, marginTop: 14 }}>
            {t('Message sent', 'मैसेज चला गया')}
          </b>
          <p className="muted" style={{ marginTop: 8 }}>
            {t(
              'Thank you — someone from RozBazaar will read this.',
              'धन्यवाद — RozBazaar से कोई इसे ज़रूर पढ़ेगा।',
            )}
          </p>
          <button className="bigbtn" style={{ width: '100%', marginTop: 24 }} onClick={() => nav('/')}>
            {t('Back to home', 'होम पर जाएँ')}
          </button>
        </div>
      ) : (
        <div className="pg" id="contactForm">
          <label className="h2" htmlFor="cName" style={{ display: 'block' }}>
            {t('Your name', 'आपका नाम')}
          </label>
          <input
            className="field"
            id="cName"
            maxLength={60}
            placeholder={t('e.g. Sunita Devi', 'जैसे: सुनीता देवी')}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <label className="h2" htmlFor="cPhone" style={{ display: 'block' }}>
            {t('Phone (optional)', 'फ़ोन (वैकल्पिक)')}
          </label>
          <input
            className="field"
            id="cPhone"
            inputMode="numeric"
            maxLength={10}
            placeholder="98123 45670"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
          />
          <label className="h2" htmlFor="cBody" style={{ display: 'block' }}>
            {t('Message', 'मैसेज')}
          </label>
          <textarea
            className="field"
            id="cBody"
            rows={5}
            maxLength={2000}
            placeholder={t("What's on your mind?", 'क्या कहना चाहते हैं?')}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <button
            className={`bigbtn ${busy ? 'busy' : ''}`}
            style={{ width: '100%', marginTop: 16 }}
            disabled={busy}
            onClick={() => void send()}
            id="cSendBtn"
          >
            {t('Send message', 'मैसेज भेजें')}
          </button>
        </div>
      )}
    </div>
  );
}
