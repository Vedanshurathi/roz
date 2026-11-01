import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { contactBody, passwordSchema, vendorProfileBody, type VendorProfile } from '@rozbazaar/shared';
import { Button, Field, pushState, Sheet, Skeleton, Stars, timeAgo, useI18n, useToast } from '@rozbazaar/web';
import { api } from '../../api/client';
import { useVendor } from '../../app/vendor-context';
import { keys, useAreas, usePasswordStatus, useReviews } from '../../api/queries';
import { typeLabel } from '../../lib/names';
import { useEnablePush } from '../home/PushCard';

export default function ProfilePage() {
  const { t, lang, setLang } = useI18n();
  const toast = useToast();
  const nav = useNavigate();
  const qc = useQueryClient();
  const vendor = useVendor();
  const [sheet, setSheet] = useState<'edit' | 'areas' | 'password' | 'contact' | null>(null);
  const push = useEnablePush();
  const pState = pushState();

  const logout = useMutation({
    mutationFn: () => api.post('/v1/vendor/auth/logout'),
    onSettled: () => {
      nav('/login', { replace: true });
      qc.clear();
      toast.show(t('Logged out', 'लॉगआउट हो गया'));
    },
  });

  return (
    <div className="page page--cream">
      <header className="topbar topbar--plain">
        <div className="topbar__t">
          <h1>{t('My profile', 'मेरी प्रोफ़ाइल')}</h1>
        </div>
      </header>
      <div className="wrap">
        <div className="profile card rv d1">
          <span className="profile__av" aria-hidden>
            {vendor.name.slice(0, 1).toUpperCase()}
          </span>
          <div>
            <b>{vendor.name}</b>
            <small>
              {vendor.phone ? `+91 ${vendor.phone}` : ''} · {typeLabel(vendor.type, lang)}
            </small>
            <span className="profile__meta">
              <Stars value={vendor.avgRating} /> {vendor.totalRatings ? `(${vendor.totalRatings})` : ''} ·{' '}
              {vendor.totalOrders} {t('orders', 'ऑर्डर')}
            </span>
          </div>
          <Button variant="ghost" onClick={() => setSheet('edit')}>
            {t('Edit', 'बदलें')}
          </Button>
        </div>

        <h2 className="sech">{t('Villages I serve', 'मेरे गाँव')}</h2>
        <div className="card">
          <p>{vendor.areas.join(', ') || t('None yet', 'अभी कोई नहीं')}</p>
          <Button variant="secondary" block onClick={() => setSheet('areas')} style={{ marginTop: 10 }}>
            {t('Change villages', 'गाँव बदलें')}
          </Button>
        </div>

        <h2 className="sech">{t('Language', 'भाषा')}</h2>
        <div className="chips" role="radiogroup" aria-label={t('Language', 'भाषा')}>
          <button
            type="button"
            role="radio"
            aria-checked={lang === 'hi'}
            className={`rb-chip ${lang === 'hi' ? 'is-on' : ''}`}
            onClick={() => setLang('hi')}
          >
            हिंदी
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={lang === 'en'}
            className={`rb-chip ${lang === 'en' ? 'is-on' : ''}`}
            onClick={() => setLang('en')}
          >
            English
          </button>
        </div>

        <h2 className="sech">{t('Order alerts on this phone', 'इस फ़ोन पर ऑर्डर अलर्ट')}</h2>
        <div className="card">
          <p>
            {pState === 'granted'
              ? t('✓ Alerts are allowed on this phone.', '✓ इस फ़ोन पर अलर्ट चालू हैं।')
              : pState === 'denied'
                ? t(
                    'Alerts are blocked. Allow notifications for this site in your browser / app settings.',
                    'अलर्ट बंद हैं। ब्राउज़र / ऐप सेटिंग में इस साइट के नोटिफ़िकेशन चालू करें।',
                  )
                : pState === 'unsupported'
                  ? t(
                      'This browser cannot show alerts. On iPhone, add the app to the Home Screen first.',
                      'यह ब्राउज़र अलर्ट नहीं दिखा सकता। iPhone पर पहले ऐप को होम स्क्रीन पर जोड़ें।',
                    )
                  : t('Alerts are off.', 'अलर्ट बंद हैं।')}
          </p>
          {pState !== 'unsupported' && pState !== 'denied' ? (
            <Button
              variant="secondary"
              block
              loading={push.isPending}
              onClick={() => push.mutate()}
              style={{ marginTop: 10 }}
            >
              🔔{' '}
              {pState === 'granted'
                ? t('Re-connect alerts', 'अलर्ट फिर से जोड़ें')
                : t('Turn on alerts', 'अलर्ट चालू करें')}
            </Button>
          ) : null}
        </div>

        <h2 className="sech">{t('App password', 'ऐप पासवर्ड')}</h2>
        <PasswordCard onChange={() => setSheet('password')} />

        <h2 className="sech">{t('What customers say', 'ग्राहक क्या कहते हैं')}</h2>
        <Reviews />

        <h2 className="sech">{t('Help', 'मदद')}</h2>
        <div className="stack">
          <Button variant="secondary" block onClick={() => setSheet('contact')}>
            💬 {t('Message RozBazaar', 'RozBazaar को संदेश भेजें')}
          </Button>
          <Button variant="danger" block loading={logout.isPending} onClick={() => logout.mutate()}>
            {t('Log out', 'लॉगआउट')}
          </Button>
        </div>
      </div>

      {sheet === 'edit' ? <EditSheet vendor={vendor} onClose={() => setSheet(null)} /> : null}
      {sheet === 'areas' ? <AreasSheet vendor={vendor} onClose={() => setSheet(null)} /> : null}
      {sheet === 'password' ? <PasswordSheet onClose={() => setSheet(null)} /> : null}
      {sheet === 'contact' ? <ContactSheet vendor={vendor} onClose={() => setSheet(null)} /> : null}
    </div>
  );
}

function useSaveProfile(onDone: () => void) {
  const { t } = useI18n();
  const toast = useToast();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: unknown) => api.patch('/v1/vendor/profile', vendorProfileBody.parse(body)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.session });
      toast.show(t('Saved ✓', 'सेव हो गया ✓'), 'good');
      onDone();
    },
    onError: (e) => toast.show(e.message, 'bad'),
  });
}

function EditSheet({ vendor, onClose }: { vendor: VendorProfile; onClose: () => void }) {
  const { t } = useI18n();
  const [name, setName] = useState(vendor.name);
  const [shop, setShop] = useState(vendor.shopName ?? '');
  const [vehicle, setVehicle] = useState(vendor.vehicle ?? '');
  const [cap, setCap] = useState(String(vendor.defaultCapacity));
  const body = {
    name: name.trim() || undefined,
    shop: shop.trim() || undefined,
    vehicle: vehicle.trim() || undefined,
    capacity: Number(cap) || undefined,
  };
  const save = useSaveProfile(onClose);
  const valid = vendorProfileBody.safeParse(body).success;
  return (
    <Sheet
      open
      onClose={onClose}
      title={t('Your details', 'आपकी जानकारी')}
      footer={
        <Button block loading={save.isPending} disabled={!valid} onClick={() => save.mutate(body)}>
          {t('Save', 'सेव करें')}
        </Button>
      }
    >
      <Field label={t('Name', 'नाम')} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
      <Field
        label={t('Shop name', 'दुकान का नाम')}
        value={shop}
        onChange={(e) => setShop(e.target.value)}
        maxLength={80}
      />
      <Field
        label={t('Vehicle', 'गाड़ी')}
        value={vehicle}
        onChange={(e) => setVehicle(e.target.value)}
        maxLength={60}
      />
      <Field
        label={t('Usual orders per slot', 'हर स्लॉट में आम तौर पर ऑर्डर')}
        inputMode="numeric"
        value={cap}
        onChange={(e) => setCap(e.target.value.replace(/\D/g, '').slice(0, 3))}
        hint={t('Change single days on the Slots screen', 'किसी एक दिन के लिए स्लॉट स्क्रीन पर बदलें')}
      />
    </Sheet>
  );
}

function AreasSheet({ vendor, onClose }: { vendor: VendorProfile; onClose: () => void }) {
  const { t } = useI18n();
  const areas = useAreas();
  const [picked, setPicked] = useState<string[]>(vendor.areas);
  const save = useSaveProfile(onClose);
  const toggle = (a: string) => setPicked((p) => (p.includes(a) ? p.filter((x) => x !== a) : [...p, a]));
  return (
    <Sheet
      open
      onClose={onClose}
      title={t('Villages I serve', 'मेरे गाँव')}
      footer={
        <Button
          block
          loading={save.isPending}
          disabled={!picked.length}
          onClick={() => save.mutate({ areas: picked })}
        >
          {t('Save villages', 'गाँव सेव करें')}
        </Button>
      }
    >
      {areas.isPending ? (
        <Skeleton h={80} />
      ) : (
        <div className="chips">
          {(areas.data ?? []).map((a) => (
            <button
              key={a.name}
              type="button"
              aria-pressed={picked.includes(a.name)}
              className={`rb-chip ${picked.includes(a.name) ? 'is-on' : ''}`}
              onClick={() => toggle(a.name)}
            >
              {a.name}
            </button>
          ))}
        </div>
      )}
    </Sheet>
  );
}

function PasswordCard({ onChange }: { onChange: () => void }) {
  const { t, lang } = useI18n();
  const q = usePasswordStatus();
  if (q.isPending) return <Skeleton h={90} r={18} />;
  const r = q.data?.request;
  return (
    <div className="card">
      <p>
        {q.data?.hasPassword
          ? t('You log in with your phone number and password.', 'आप फ़ोन नंबर और पासवर्ड से लॉगिन करते हैं।')
          : t('No password yet — you log in with Google.', 'अभी पासवर्ड नहीं — आप Google से लॉगिन करते हैं।')}
      </p>
      {r ? (
        <p className="rb-muted">
          {r.status === 'pending'
            ? t(
                `Change requested ${timeAgo(r.createdAt, lang)} — waiting for RozBazaar approval`,
                `${timeAgo(r.createdAt, lang)} बदलने को कहा — RozBazaar की मंज़ूरी बाकी`,
              )
            : r.status === 'approved'
              ? t('Your last change was approved ✓', 'पिछला बदलाव मंज़ूर हुआ ✓')
              : t('Your last change request was not approved', 'पिछला बदलाव मंज़ूर नहीं हुआ')}
        </p>
      ) : null}
      <Button
        variant="secondary"
        block
        onClick={onChange}
        style={{ marginTop: 10 }}
        disabled={r?.status === 'pending'}
      >
        🔑{' '}
        {q.data?.hasPassword ? t('Change password', 'पासवर्ड बदलें') : t('Make a password', 'पासवर्ड बनाएँ')}
      </Button>
    </div>
  );
}

function PasswordSheet({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const qc = useQueryClient();
  const status = usePasswordStatus();
  const first = status.data ? !status.data.hasPassword : false;
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const ok = passwordSchema.safeParse(pw).success && pw === pw2;
  const save = useMutation({
    mutationFn: () =>
      api.post(first ? '/v1/vendor/password/first' : '/v1/vendor/password/request', { password: pw }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.password });
      toast.show(
        first
          ? t('Password saved ✓', 'पासवर्ड बन गया ✓')
          : t('Sent to RozBazaar — it works once they approve', 'RozBazaar को भेजा — मंज़ूरी के बाद चलेगा'),
        'good',
      );
      onClose();
    },
    onError: (e) => toast.show(e.message, 'bad'),
  });
  return (
    <Sheet
      open
      onClose={onClose}
      title={first ? t('Make your password', 'अपना पासवर्ड बनाएँ') : t('Change password', 'पासवर्ड बदलें')}
      footer={
        <Button block loading={save.isPending} disabled={!ok} onClick={() => save.mutate()}>
          {first ? t('Save password', 'पासवर्ड सेव करें') : t('Ask for approval', 'मंज़ूरी माँगें')}
        </Button>
      }
    >
      {!first ? (
        <p className="rb-muted" style={{ marginBottom: 12 }}>
          {t(
            'For your safety, RozBazaar approves password changes.',
            'आपकी सुरक्षा के लिए RozBazaar पासवर्ड बदलाव मंज़ूर करता है।',
          )}
        </p>
      ) : null}
      <Field
        label={t('New password', 'नया पासवर्ड')}
        type="password"
        autoComplete="new-password"
        value={pw}
        maxLength={128}
        onChange={(e) => setPw(e.target.value)}
        hint={t('At least 8 characters, with letters and numbers', 'कम से कम 8 अक्षर, अक्षर और अंक दोनों')}
      />
      <Field
        label={t('Type it again', 'फिर से लिखें')}
        type="password"
        autoComplete="new-password"
        value={pw2}
        maxLength={128}
        onChange={(e) => setPw2(e.target.value)}
        error={pw2 && pw !== pw2 ? t('The two passwords are different', 'दोनों पासवर्ड अलग हैं') : null}
      />
    </Sheet>
  );
}

function Reviews() {
  const { t, lang } = useI18n();
  const q = useReviews();
  if (q.isPending) return <Skeleton h={90} r={18} />;
  if (!q.data?.length) return <p className="rb-muted">{t('No ratings yet.', 'अभी कोई रेटिंग नहीं।')}</p>;
  return (
    <div className="card reviews">
      {q.data.slice(0, 10).map((r, i) => (
        <div key={i} className="reviews__i">
          <div>
            <span className="rb-stars">{'★'.repeat(r.stars)}</span>
            <small>
              {r.customerName ?? t('Customer', 'ग्राहक')} · {timeAgo(r.createdAt, lang)}
            </small>
          </div>
          {r.comment ? <p>{r.comment}</p> : null}
        </div>
      ))}
    </div>
  );
}

function ContactSheet({ vendor, onClose }: { vendor: VendorProfile; onClose: () => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const [body, setBody] = useState('');
  const payload = { name: vendor.name, phone: vendor.phone ?? undefined, body: `[Vendor] ${body}` };
  const send = useMutation({
    mutationFn: () => api.post('/v1/public/contact', contactBody.parse(payload)),
    onSuccess: () => {
      toast.show(t('Message sent — we will call you back', 'संदेश मिल गया — हम फ़ोन करेंगे'), 'good');
      onClose();
    },
    onError: (e) => toast.show(e.message, 'bad'),
  });
  return (
    <Sheet
      open
      onClose={onClose}
      title={t('Message RozBazaar', 'RozBazaar को संदेश')}
      footer={
        <Button
          block
          loading={send.isPending}
          disabled={body.trim().length < 3 || !contactBody.safeParse(payload).success}
          onClick={() => send.mutate()}
        >
          {t('Send', 'भेजें')}
        </Button>
      }
    >
      <textarea
        className="rb-textarea"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={1900}
        placeholder={t('How can we help?', 'हम कैसे मदद करें?')}
        aria-label={t('Message', 'संदेश')}
      />
    </Sheet>
  );
}
