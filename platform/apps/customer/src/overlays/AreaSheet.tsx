import { useI18n } from '@rozbazaar/web';
import { useAreas } from '../api/queries';
import { useShop } from '../state/shop';
import { useUI } from '../state/ui';
import { useDetectArea } from '../state/useDetectArea';
import { useToast } from '../ui/Toast';

/** "Choose your area" — prices and vendors change by village. */
export function AreaSheet() {
  const { t } = useI18n();
  const ui = useUI();
  const shop = useShop();
  const toast = useToast();
  const areas = useAreas();
  const detect = useDetectArea();
  const close = () => ui.setAreaOpen(false);
  const pick = (name: string) => {
    ui.setGuess(null);
    close();
    if (name === shop.area) return;
    shop.setArea(name);
    toast(t(`Showing ${name}`, `${name} दिखा रहे हैं`));
  };
  const list = [...(areas.data ?? [])];
  if (ui.guess?.area)
    list.sort((a, b) => (a.name === ui.guess!.area ? -1 : b.name === ui.guess!.area ? 1 : 0));

  return (
    <div className={`sheet-wrap ${ui.areaOpen ? 'on' : ''}`} id="areaSheet">
      <div className="sheet-bg" onClick={close} />
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={t('Choose your area', 'अपना इलाका चुनें')}
      >
        <div className="sheet-grab" />
        <div className="sheet-hd">
          <div>
            <b>{t('Choose your area', 'अपना इलाका चुनें')}</b>
            <span>{t('prices and vendors change by village', 'हर गाँव में रेट और वेंडर अलग')}</span>
          </div>
          <button className="bk" onClick={close} aria-label={t('Close', 'बंद करें')}>
            ✕
          </button>
        </div>
        <div style={{ padding: '0 16px 12px' }}>
          <button className="use-loc" onClick={() => void detect()}>
            <span>◎</span>
            <span>{t('Use my location', 'मेरी लोकेशन से पता करें')}</span>
          </button>
        </div>
        <div style={{ padding: '0 16px' }}>
          {ui.guess?.area ? (
            <div className="guess">
              📍{' '}
              {t(
                `You seem to be near ${ui.guess.area}. Tap the right one — prices differ by village.`,
                `आप ${ui.guess.area} के पास लग रहे हैं। सही वाला दबाएँ — हर गाँव का रेट अलग है।`,
              )}
            </div>
          ) : null}
        </div>
        <div className="slots" id="areaList" style={{ padding: '0 16px 26px' }}>
          {list.map((a) => (
            <button
              key={a.name}
              className={`slot ${a.name === shop.area ? 'sel' : ''}`}
              onClick={() => pick(a.name)}
            >
              <span className="se">{a.served ? '🟢' : '📍'}</span>
              <div style={{ minWidth: 0 }}>
                <b>{a.name}</b>
                <span>
                  {a.name === shop.area
                    ? t('current area', 'अभी यही है')
                    : a.served
                      ? t('vendor available', 'वेंडर उपलब्ध है')
                      : t('no vendor yet', 'अभी वेंडर नहीं')}
                </span>
              </div>
              {a.name === shop.area ? (
                <span className="cap">✓</span>
              ) : a.served ? null : (
                <span className="cap">{t('SOON', 'जल्द')}</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
