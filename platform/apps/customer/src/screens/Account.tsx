import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import type { Address } from '@rozbazaar/shared';
import { useI18n } from '@rozbazaar/web';
import { api } from '../api/client';
import { keys, useAddresses, useBookings } from '../api/queries';
import { lineOf } from '../lib/addr';
import { addrIcon, addrName } from '../lib/model';
import { useShop } from '../state/shop';
import { useUI } from '../state/ui';
import { useMe } from '../state/useMe';
import { useToast } from '../ui/Toast';
import { VENDOR_SITE } from '../config';

export default function Account() {
  const { t, lang, setLang } = useI18n();
  const nav = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const shop = useShop();
  const ui = useUI();
  const { me, loggedIn, needsProfile } = useMe();
  const addrs = useAddresses(loggedIn);
  const bookings = useBookings(loggedIn);
  const list = addrs.data ?? [];

  async function makeDefault(a: Address) {
    try {
      await api.post(`/v1/customer/addresses/${a.id}/default`);
      await qc.invalidateQueries({ queryKey: keys.addresses });
      toast(t('Default address changed', 'मुख्य पता बदल दिया'));
    } catch (e) {
      toast((e as Error).message || t('Could not change', 'बदला नहीं जा सका'));
    }
  }
  async function del(a: Address) {
    if (!window.confirm(t(`Delete "${addrName(a.label, t)}"?`, `"${addrName(a.label, t)}" हटाएँ?`))) return;
    try {
      await api.del(`/v1/customer/addresses/${a.id}`);
      await qc.invalidateQueries({ queryKey: keys.addresses });
      if (shop.addrId === a.id) shop.setAddrId(null);
      toast(t('Address deleted', 'पता हटा दिया'));
    } catch (e) {
      toast((e as Error).message || t('Could not delete', 'हटाया नहीं जा सका'));
    }
  }
  async function logout() {
    try {
      await api.post('/v1/customer/auth/logout');
    } catch {
      /* the cookie is cleared server-side either way */
    }
    shop.clearCart();
    shop.setAddrId(null);
    try {
      localStorage.removeItem('rb_price_seen');
    } catch {
      /* storage blocked */
    }
    nav('/');
    qc.removeQueries({ queryKey: keys.addresses });
    qc.removeQueries({ queryKey: keys.bookings });
    qc.removeQueries({ queryKey: keys.notifications });
    await qc.invalidateQueries({ queryKey: keys.session });
    void qc.invalidateQueries({ queryKey: ['home'] });
    toast(t('Logged out', 'लॉगआउट हो गया'));
  }

  const who = me
    ? me.email
      ? me.email + (me.phone ? ' · +91 ' + me.phone : '')
      : me.phone
        ? '+91 ' + me.phone
        : ''
    : '';
  return (
    <div className="scr on" id="s-acct">
      <div className="topbar">
        <button className="bk" onClick={() => nav('/')} aria-label={t('Back', 'वापस')}>
          ←
        </button>
        <div>
          <h1>{t('My account', 'मेरा अकाउंट')}</h1>
        </div>
      </div>
      <div className="pg">
        {loggedIn && needsProfile ? (
          <div className="note" style={{ marginBottom: 14 }}>
            <span>📱</span>
            <span>
              {t(
                'One step left — add your phone number so the vendor can reach you.',
                'बस एक चीज़ बाकी — अपना नंबर डाल दें ताकि वेंडर पहुँच सके।',
              )}
            </span>
            <button className="pill" style={{ marginLeft: 'auto' }} onClick={() => nav('/login')}>
              {t('Add', 'डालें')}
            </button>
          </div>
        ) : null}
        <div className="prof">
          <div className="av" id="avLetter">
            {(me?.name || t('G', 'मे'))[0]!.toUpperCase()}
          </div>
          <div>
            <b id="profName">{me?.name || t('Guest', 'मेहमान')}</b>
            <span id="profPhone">{loggedIn ? who : t('Not logged in', 'लॉगिन नहीं किया')}</span>
          </div>
          {loggedIn ? null : (
            <button
              className="pill"
              style={{ marginLeft: 'auto' }}
              onClick={() => nav('/login')}
              id="profBtn"
            >
              {t('Log in', 'लॉगिन')}
            </button>
          )}
        </div>

        {loggedIn ? (
          <>
            <div className="h2">{t('My addresses', 'मेरे पते')}</div>
            <div className="card" style={{ padding: '6px 17px' }}>
              <div id="addrList">
                {list.length ? (
                  list.map((a) => (
                    <div className="addr-row" key={a.id}>
                      <div className="ai">{addrIcon(a.label)}</div>
                      <button className="at" onClick={() => nav(`/address/${a.id}`)}>
                        <b>
                          {addrName(a.label, t)}
                          {a.isDefault && list.length > 1 ? (
                            <span className="def">{t('Default', 'मुख्य')}</span>
                          ) : null}
                          {a.lat != null ? <span className="pin">📍 {t('pin', 'पिन')}</span> : null}
                        </b>
                        <span>{lineOf(a)}</span>
                      </button>
                      {!a.isDefault && list.length > 1 ? (
                        <button
                          className="ab"
                          title={t('Make default', 'मुख्य बनाएँ')}
                          aria-label={t('Make default', 'मुख्य बनाएँ')}
                          onClick={() => void makeDefault(a)}
                        >
                          ⭐
                        </button>
                      ) : null}
                      <button
                        className="ab"
                        title={t('Delete', 'हटाएँ')}
                        aria-label={t('Delete', 'हटाएँ')}
                        onClick={() => void del(a)}
                      >
                        🗑
                      </button>
                    </div>
                  ))
                ) : (
                  <div style={{ padding: '16px 2px' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--mut)' }}>
                      {t('No address saved yet', 'अभी कोई पता सेव नहीं')}
                    </span>
                  </div>
                )}
              </div>
            </div>
            <button className="ghostbtn" onClick={() => nav('/address/new')}>
              {t('+ Add a new address', '+ नया पता जोड़ें')}
            </button>
          </>
        ) : null}

        <div className="h2">{t('Settings', 'सेटिंग्स')}</div>
        <div className="card" style={{ padding: '6px 17px' }}>
          <div className="arow">
            <div className="ai">🌐</div>
            <div>
              <b>{t('Language', 'भाषा')}</b>
              <span>English / हिंदी</span>
            </div>
            <div className="lang" style={{ marginLeft: 'auto' }}>
              <button className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')}>
                EN
              </button>
              <button className={lang === 'hi' ? 'on' : ''} onClick={() => setLang('hi')}>
                HI
              </button>
            </div>
          </div>
          <button className="arow" onClick={() => nav('/bookings')}>
            <div className="ai">📋</div>
            <div>
              <b>{t('My bookings', 'मेरी बुकिंग')}</b>
              <span id="acctBk">
                {bookings.data?.length ?? 0} {t('bookings', 'बुकिंग')}
              </span>
            </div>
            <span className="ch">›</span>
          </button>
          {loggedIn ? (
            <button className="arow" id="signOutRow" onClick={() => void logout()}>
              <div className="ai">⏻</div>
              <div>
                <b>{t('Sign out', 'लॉगआउट करें')}</b>
                <span>{me?.email || (me?.phone ? '+91 ' + me.phone : '')}</span>
              </div>
              <span className="ch">›</span>
            </button>
          ) : null}
          <button className="arow" onClick={() => window.open(VENDOR_SITE, '_blank', 'noopener')}>
            <div className="ai">🧑‍🌾</div>
            <div>
              <b>{t('Become a vendor', 'वेंडर बनें')}</b>
              <span>
                {t(
                  'sell in your village, get orders on your phone',
                  'अपने गाँव में बेचें, ऑर्डर फ़ोन पर पाएँ',
                )}
              </span>
            </div>
            <span className="ch">›</span>
          </button>
          <button className="arow" onClick={() => nav('/how')}>
            <div className="ai">🎬</div>
            <div>
              <b>{t('How it works', 'यह कैसे काम करता है')}</b>
              <span>{t('the whole process, in 3 steps', 'पूरा तरीका, 3 कदम में')}</span>
            </div>
            <span className="ch">›</span>
          </button>
          <button className="arow" onClick={() => nav('/contact')}>
            <div className="ai">💬</div>
            <div>
              <b>{t('Contact us', 'संपर्क करें')}</b>
              <span>{t('drop a message, we read every one', 'मैसेज छोड़ें, हम सब पढ़ते हैं')}</span>
            </div>
            <span className="ch">›</span>
          </button>
          <button className="arow" onClick={() => ui.setCheckOpen(true)}>
            <div className="ai">🩺</div>
            <div>
              <b>{t('Check notifications & location', 'सूचनाएँ और लोकेशन जाँचें')}</b>
              <span>
                {t('see what is blocked, send yourself a test', 'देखें क्या बंद है, खुद को टेस्ट भेजें')}
              </span>
            </div>
            <span className="ch">›</span>
          </button>
          <a className="arow" href="/privacy.html" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="ai">🔒</div>
            <div>
              <b>{t('Privacy policy', 'गोपनीयता नीति')}</b>
              <span>
                {t(
                  'what we collect and how to delete your account',
                  'हम क्या जानकारी लेते हैं और अकाउंट कैसे हटाएँ',
                )}
              </span>
            </div>
            <span className="ch">›</span>
          </a>
        </div>
        <p className="muted" style={{ textAlign: 'center', marginTop: 26, fontSize: 11.5 }}>
          {t('RozBazaar · Pataudi • Haileymandi • nearby villages', 'RozBazaar · पटौदी • हेलीमंडी • आस-पास')}
        </p>
      </div>
    </div>
  );
}
