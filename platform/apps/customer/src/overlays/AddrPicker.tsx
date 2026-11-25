import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useI18n } from '@rozbazaar/web';
import { useAddresses, useSession } from '../api/queries';
import { addrIcon, addrName } from '../lib/model';
import { useShop } from '../state/shop';
import { useUI } from '../state/ui';
import { useCheckout } from '../state/useCheckout';

/** "Deliver to which address?" — shown at booking when there are 2+ saved addresses. */
export function AddrPicker() {
  const { t } = useI18n();
  const ui = useUI();
  const shop = useShop();
  const nav = useNavigate();
  const loggedIn = Boolean(useSession().data?.authenticated);
  const addresses = useAddresses(loggedIn);
  const { createBooking } = useCheckout();
  const list = addresses.data ?? [];
  const [pick, setPick] = useState<string | null>(null);
  const open = Boolean(ui.addrPick);

  useEffect(() => {
    if (open) setPick(shop.addrId ?? list.find((a) => a.isDefault)?.id ?? list[0]?.id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset the choice each time it opens
  }, [open]);

  const close = () => ui.setAddrPick(null);
  return (
    <div className={`sheet-wrap ${open ? 'on' : ''}`} id="addrSheet" style={{ zIndex: 160 }}>
      <div className="sheet-bg" onClick={close} />
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={t('Deliver to which address?', 'किस पते पर मँगाना है?')}
      >
        <div className="sheet-grab" />
        <div className="sheet-hd">
          <div>
            <b>{t('Deliver to which address?', 'किस पते पर मँगाना है?')}</b>
            <span>{t('the vendor comes to the address you pick', 'वेंडर आपके चुने पते पर आएगा')}</span>
          </div>
          <button className="bk" onClick={close} aria-label={t('Close', 'बंद करें')}>
            ✕
          </button>
        </div>
        <div style={{ padding: '0 16px', maxHeight: '52vh', overflowY: 'auto' }}>
          {list.length ? (
            list.map((a) => (
              <button
                key={a.id}
                className={`addr-pick ${a.id === pick ? 'on' : ''}`}
                onClick={() => setPick(a.id)}
              >
                <span className="rd" />
                <span style={{ fontSize: 22 }}>{addrIcon(a.label)}</span>
                <span className="at">
                  <b>
                    {addrName(a.label, t)}
                    {a.isDefault ? (
                      <small style={{ fontSize: 10.5, color: 'var(--g-dk)' }}>
                        {' '}
                        · {t('default', 'मुख्य')}
                      </small>
                    ) : null}
                  </b>
                  <span>
                    {[a.house, a.street, a.area].filter(Boolean).join(', ')}
                    {a.landmark ? ` · ${a.landmark}` : ''}
                    {a.lat != null ? ` · 📍 ${t('pin saved', 'पिन सेव')}` : ''}
                  </span>
                </span>
              </button>
            ))
          ) : (
            <p className="muted" style={{ padding: '10px 0' }}>
              {t('No saved address yet', 'अभी कोई पता सेव नहीं')}
            </p>
          )}
        </div>
        <div
          style={{ padding: '12px 16px calc(18px + env(safe-area-inset-bottom))', display: 'grid', gap: 10 }}
        >
          <button
            className="ghostbtn"
            style={{ margin: 0 }}
            onClick={() => {
              close();
              nav('/address/new?from=checkout');
            }}
          >
            {t('+ Add a new address', '+ नया पता जोड़ें')}
          </button>
          {list.length ? (
            <button
              className="bigbtn"
              onClick={() => {
                if (!pick) return;
                const thenBook = ui.addrPick?.thenBook;
                shop.setAddrId(pick);
                close();
                if (thenBook) void createBooking(pick);
              }}
            >
              {t('Deliver here', 'यहीं मँगाएँ')}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
