import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useI18n } from '@rozbazaar/web';

/** Three animated steps, auto-advancing every 4.2 s (tap a dot to jump). */
export default function How() {
  const { t } = useI18n();
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setStep((s) => (s + 1) % 3), 4200);
    return () => {
      window.clearInterval(id);
    };
  }, [step]);
  return (
    <div className="scr on" id="s-how">
      <div className="topbar">
        <button className="bk" onClick={() => nav(-1)} aria-label={t('Back', 'वापस')}>
          ←
        </button>
        <div>
          <h1>{t('How it works', 'यह कैसे काम करता है')}</h1>
          <div className="sub">{t('three steps, door to door', 'तीन कदम, घर तक')}</div>
        </div>
      </div>
      <div className="pg">
        <div className="howwrap" id="howAnim">
          <div className={`howstep ${step === 0 ? 'on' : ''}`}>
            <svg viewBox="0 0 200 160" className="howsvg" aria-hidden="true">
              <rect x="20" y="30" width="160" height="100" rx="14" fill="var(--g-s)" />
              <circle cx="60" cy="80" r="18" fill="var(--g)" className="howpulse" />
              <text x="60" y="86" textAnchor="middle" fontSize="18">
                🥕
              </text>
              <circle
                cx="105"
                cy="80"
                r="18"
                fill="var(--g)"
                className="howpulse"
                style={{ animationDelay: '.2s' }}
              />
              <text x="105" y="86" textAnchor="middle" fontSize="18">
                🍅
              </text>
              <circle
                cx="150"
                cy="80"
                r="18"
                fill="var(--g)"
                className="howpulse"
                style={{ animationDelay: '.4s' }}
              />
              <text x="150" y="86" textAnchor="middle" fontSize="18">
                🧅
              </text>
              <path d="M20 130 h160" stroke="var(--g)" strokeWidth="2" strokeDasharray="4 4" opacity=".4" />
            </svg>
            <b className="disp">{t('1. Pick your vendor & items', '1. वेंडर और सामान चुनें')}</b>
            <p>
              {t(
                "Choose your village, see who delivers there, and add what you need — no fixed price list, just what's in season.",
                'अपना गाँव चुनें, जो वेंडर वहाँ आता है उसे देखें, और जो चाहिए वह डालें — कोई तय कीमत नहीं, जो मौसम में है वही।',
              )}
            </p>
          </div>
          <div className={`howstep ${step === 1 ? 'on' : ''}`}>
            <svg viewBox="0 0 200 160" className="howsvg" aria-hidden="true">
              <circle cx="100" cy="70" r="34" fill="var(--g-s)" />
              <text x="100" y="80" textAnchor="middle" fontSize="34">
                ⚖️
              </text>
              <rect x="60" y="118" width="80" height="26" rx="8" fill="var(--navy)" className="howslide" />
              <text x="100" y="135" textAnchor="middle" fontSize="12" fill="#fff">
                ₹ bill
              </text>
            </svg>
            <b className="disp">
              {t('2. Vendor weighs & bills at your door', '2. वेंडर घर पर तौलकर बिल बनाता है')}
            </b>
            <p>
              {t(
                'Nothing is pre-packed. The vendor arrives, weighs it in front of you, and the price is based on exactly what you get.',
                'कुछ भी पहले से पैक नहीं होता। वेंडर आता है, आपके सामने तौलता है, और जो मिला उसी का दाम बनता है।',
              )}
            </p>
          </div>
          <div className={`howstep ${step === 2 ? 'on' : ''}`}>
            <svg viewBox="0 0 200 160" className="howsvg" aria-hidden="true">
              <rect x="55" y="30" width="90" height="100" rx="16" fill="var(--g-s)" />
              <text
                x="100"
                y="70"
                textAnchor="middle"
                fontSize="30"
                fontWeight="800"
                fill="var(--g-dk)"
                letterSpacing="4"
                className="howcode"
              >
                4821
              </text>
              <text x="100" y="105" textAnchor="middle" fontSize="26">
                ✅
              </text>
            </svg>
            <b className="disp">{t('3. Pay, share the code, done', '3. पेमेंट करें, कोड बताएँ, हो गया')}</b>
            <p>
              {t(
                "Pay however suits you, then read the code on your screen out loud to the vendor — that's what marks your order complete.",
                'जैसे सुविधा हो पेमेंट करें, फिर अपनी स्क्रीन वाला कोड वेंडर को बता दें — उसी से आपका ऑर्डर पूरा होता है।',
              )}
            </p>
          </div>
        </div>
        <div className="howdots">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className={`howdot ${step === i ? 'on' : ''}`}
              onClick={() => setStep(i)}
              role="button"
              tabIndex={0}
              aria-label={`${i + 1}`}
            />
          ))}
        </div>
        <button className="bigbtn" style={{ width: '100%', marginTop: 8 }} onClick={() => nav('/')}>
          {t('Start browsing →', 'देखना शुरू करें →')}
        </button>
      </div>
    </div>
  );
}
