import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { contactBody, customerProfileBody } from '@rozbazaar/shared';
import { Button, Field, pushState, Sheet, Spinner, useI18n, useToast } from '@rozbazaar/web';
import { api } from '../../api/client';
import { keys, useAddresses, useSession } from '../../api/queries';
import { VENDOR_SITE } from '../../config';
import { useEnableAlerts } from '../notifications/PushAlerts';

export default function AccountPage() {
  const { t, lang, setLang } = useI18n();
  const toast = useToast();
  const nav = useNavigate();
  const qc = useQueryClient();
  const session = useSession();
  const user = session.data?.user ?? null;
  const loggedIn = Boolean(session.data?.authenticated);
  const addresses = useAddresses(loggedIn);
  const [editing, setEditing] = useState(false);
  const [contact, setContact] = useState(false);

  const logout = useMutation({
    mutationFn: () => api.post('/v1/customer/auth/logout'),
    onSuccess: () => {
      qc.clear();
      nav('/', { replace: true });
      toast.show(t('Logged out', 'लॉगआउट हो गया'));
    },
  });
  const setDefault = useMutation({
    mutationFn: (id: string) => api.post(`/v1/customer/addresses/${id}/default`),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.addresses }),
    onError: (e) => toast.show(e.message, 'bad'),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/v1/customer/addresses/${id}`),
    onSuccess: () => {
      toast.show(t('Address removed', 'पता हटा दिया'));
      void qc.invalidateQueries({ queryKey: keys.addresses });
    },
    onError: (e) => toast.show(e.message, 'bad'),
  });

  if (session.isPending) return <Spinner />;

  return (
    <div className="page">
      <header className="phead phead--plain">
        <h1>{t('My account', 'मेरा खाता')}</h1>
      </header>
      <div className="page__body">
        {loggedIn && user ? (
          <div className="profile rv d1">
            <span className="profile__av" aria-hidden>
              {(user.name ?? '?').slice(0, 1).toUpperCase()}
            </span>
            <div>
              <b>{user.name ?? t('Add your name', 'अपना नाम जोड़ें')}</b>
              <small>{user.phone ? `+91 ${user.phone}` : user.email}</small>
            </div>
            <Button variant="ghost" onClick={() => setEditing(true)}>
              {t('Edit', 'बदलें')}
            </Button>
          </div>
        ) : (
          <div className="rb-card rv d1">
            <p>
              {t(
                'Log in to see your orders and saved addresses.',
                'अपने ऑर्डर और पते देखने के लिए लॉगिन करें।',
              )}
            </p>
            <Link
              to="/login?next=/account"
              className="rb-btn rb-btn--primary rb-btn--block"
              style={{ marginTop: 12 }}
            >
              <span>{t('Log in', 'लॉगिन')}</span>
            </Link>
          </div>
        )}

        <h2 className="sech">{t('Language', 'भाषा')}</h2>
        <div className="langrow rv d2" role="radiogroup" aria-label={t('Language', 'भाषा')}>
          <button
            type="button"
            role="radio"
            aria-checked={lang === 'en'}
            className={`rb-chip ${lang === 'en' ? 'is-on' : ''}`}
            onClick={() => setLang('en')}
          >
            English
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={lang === 'hi'}
            className={`rb-chip ${lang === 'hi' ? 'is-on' : ''}`}
            onClick={() => setLang('hi')}
          >
            हिंदी
          </button>
        </div>

        {loggedIn ? (
          <>
            <h2 className="sech">{t('Saved addresses', 'सेव किए पते')}</h2>
            <ul className="addrlist rv d3">
              {(addresses.data ?? []).map((a) => (
                <li key={a.id} className="rb-card">
                  <Link to={`/address/${a.id}`} className="addrlist__main">
                    <b>
                      {a.label ?? t('Home', 'घर')}{' '}
                      {a.isDefault ? (
                        <span className="rb-pill rb-pill--g">{t('Default', 'मुख्य')}</span>
                      ) : null}
                    </b>
                    <span>{[a.house, a.street, a.area].filter(Boolean).join(', ')}</span>
                  </Link>
                  <div className="addrlist__act">
                    {!a.isDefault ? (
                      <button
                        type="button"
                        onClick={() => setDefault.mutate(a.id)}
                        aria-label={t('Make default', 'मुख्य बनाएँ')}
                      >
                        ⭐
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() =>
                        window.confirm(t('Remove this address?', 'यह पता हटाएँ?')) && remove.mutate(a.id)
                      }
                      aria-label={t('Remove', 'हटाएँ')}
                    >
                      🗑
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <Link to="/address/new" className="rb-btn rb-btn--secondary rb-btn--block">
              <span>+ {t('Add new address', 'नया पता जोड़ें')}</span>
            </Link>
          </>
        ) : null}

        {loggedIn ? <AlertsSection /> : null}

        <h2 className="sech">{t('Help', 'मदद')}</h2>
        <div className="stack rv d4">
          <Button variant="secondary" block onClick={() => setContact(true)}>
            💬 {t('Message RozBazaar', 'RozBazaar को संदेश भेजें')}
          </Button>
          <a className="rb-btn rb-btn--ghost rb-btn--block" href={VENDOR_SITE} rel="noopener">
            <span>🛺 {t('Become a vendor', 'वेंडर बनें')}</span>
          </a>
          {loggedIn ? (
            <Button variant="danger" block loading={logout.isPending} onClick={() => logout.mutate()}>
              {t('Log out', 'लॉगआउट')}
            </Button>
          ) : null}
        </div>
      </div>

      {editing && user ? (
        <ProfileSheet name={user.name ?? ''} phone={user.phone ?? ''} onClose={() => setEditing(false)} />
      ) : null}
      {contact ? (
        <ContactSheet name={user?.name ?? ''} phone={user?.phone ?? ''} onClose={() => setContact(false)} />
      ) : null}
    </div>
  );
}

function ProfileSheet(props: { name: string; phone: string; onClose: () => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const qc = useQueryClient();
  const [name, setName] = useState(props.name);
  const [phone, setPhone] = useState(props.phone);
  const save = useMutation({
    mutationFn: () => api.put('/v1/customer/profile', customerProfileBody.parse({ name, phone })),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.session });
      toast.show(t('Saved', 'सेव हो गया'), 'good');
      props.onClose();
    },
    onError: (e) => toast.show(e.message, 'bad'),
  });
  const valid = customerProfileBody.safeParse({ name, phone }).success;
  return (
    <Sheet
      open
      onClose={props.onClose}
      title={t('Your details', 'आपकी जानकारी')}
      footer={
        <Button block loading={save.isPending} disabled={!valid} onClick={() => save.mutate()}>
          {t('Save', 'सेव करें')}
        </Button>
      }
    >
      <Field
        label={t('Name', 'नाम')}
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={60}
        autoComplete="name"
      />
      <Field
        label={t('Mobile number', 'मोबाइल नंबर')}
        prefix="+91"
        inputMode="numeric"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        maxLength={14}
      />
    </Sheet>
  );
}

function ContactSheet(props: { name: string; phone: string; onClose: () => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const [name, setName] = useState(props.name);
  const [phone, setPhone] = useState(props.phone);
  const [body, setBody] = useState('');
  const payload = { name, body, phone: phone || undefined };
  const valid = contactBody.safeParse(payload).success;
  const send = useMutation({
    mutationFn: () => api.post('/v1/public/contact', contactBody.parse(payload)),
    onSuccess: () => {
      toast.show(t('Message sent — we will call you back', 'संदेश मिल गया — हम फ़ोन करेंगे'), 'good');
      props.onClose();
    },
    onError: (e) => toast.show(e.message, 'bad'),
  });
  return (
    <Sheet
      open
      onClose={props.onClose}
      title={t('Message us', 'हमें संदेश भेजें')}
      footer={
        <Button block loading={send.isPending} disabled={!valid} onClick={() => send.mutate()}>
          {t('Send', 'भेजें')}
        </Button>
      }
    >
      <Field label={t('Name', 'नाम')} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
      <Field
        label={t('Mobile number', 'मोबाइल नंबर')}
        prefix="+91"
        inputMode="numeric"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        maxLength={14}
      />
      <textarea
        className="rb-textarea"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={2000}
        placeholder={t('How can we help?', 'हम कैसे मदद करें?')}
        aria-label={t('Message', 'संदेश')}
      />
    </Sheet>
  );
}

function AlertsSection() {
  const { t } = useI18n();
  const enable = useEnableAlerts();
  const state = pushState();
  return (
    <>
      <h2 className="sech">{t('Order updates on this phone', 'इस फ़ोन पर ऑर्डर की सूचना')}</h2>
      <div className="rb-card rv d3">
        <p>
          {state === 'granted'
            ? t('✓ Notifications are allowed.', '✓ सूचनाएँ चालू हैं।')
            : state === 'denied'
              ? t(
                  'Notifications are blocked. Phone Settings → Apps → RozBazaar (or tap 🔒 in the browser) → allow.',
                  'सूचनाएँ बंद हैं। फ़ोन सेटिंग → ऐप्स → RozBazaar (या ब्राउज़र में 🔒) → चालू करें।',
                )
              : state === 'unsupported'
                ? t('This browser cannot show notifications.', 'यह ब्राउज़र सूचना नहीं दिखा सकता।')
                : t('Notifications are off.', 'सूचनाएँ बंद हैं।')}
        </p>
        {state === 'default' || state === 'granted' ? (
          <Button
            variant="secondary"
            block
            loading={enable.isPending}
            onClick={() => enable.mutate()}
            style={{ marginTop: 10 }}
          >
            🔔{' '}
            {state === 'granted'
              ? t('Re-connect notifications', 'सूचना फिर से जोड़ें')
              : t('Turn on notifications', 'सूचना चालू करें')}
          </Button>
        ) : null}
      </div>
    </>
  );
}
