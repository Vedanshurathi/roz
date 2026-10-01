import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useI18n } from '@rozbazaar/web';
import { api } from '../api/client';
import { useSession } from '../api/queries';
import { Art } from '../art/Art';
import { pname, slotBadge, type P } from '../lib/model';
import { useCart } from '../state/useCart';
import { useShop } from '../state/shop';
import { useUI } from '../state/ui';
import { useToast } from './Toast';

/** The original product card: picture, ♡, ADD, weight, name, vendor, slot, today's rate. */
export function ProductCard({ p, fav }: { p: P; fav: boolean }) {
  const { t, lang } = useI18n();
  const { fly } = useCart();
  const { sel } = useShop();
  const ui = useUI();
  return (
    <div className={`pcard${p.fresh ? '' : ' oos'}`}>
      <div className="pimg">
        <Art photo={p.photo} artKey={p.artKey} em={p.em} alt={p.en} />
        <FavButton id={p.id} on={fav} />
        {p.fresh ? (
          <button
            className="add"
            onClick={(e) => fly(e, p.id)}
            aria-label={t(`Add ${p.en}`, `${p.hi} जोड़ें`)}
          >
            ADD
          </button>
        ) : (
          <span className="oosbadge">{t('Out of stock', 'स्टॉक खत्म')}</span>
        )}
      </div>
      <span className="wt">{p.unit}</span>
      <div className="pn">{pname(p, lang)}</div>
      {p.vendorName ? (
        <div
          className="pvendor"
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            ui.setVendorPick({ pid: p.id, productName: pname(p, lang) });
          }}
        >
          🧑 {p.vendorName}
          {p.vendorRating > 0 ? <span className="pv-star"> ⭐ {p.vendorRating.toFixed(1)}</span> : null}
        </div>
      ) : null}
      <div className="pslot">🕖 {slotBadge(sel, t, lang)}</div>
      <div className="prow">
        <span className="pp">₹{p.price}</span>
        {p.kal ? (
          <span className="mrp fresh-rate">{t('🔥 Freshly priced', '🔥 नया रेट')}</span>
        ) : (
          <span className="mrp">{t("today's mandi rate", 'आज का मंडी रेट')}</span>
        )}
      </div>
    </div>
  );
}

function FavButton({ id, on }: { id: string; on: boolean }) {
  const { t } = useI18n();
  const toast = useToast();
  const qc = useQueryClient();
  const loggedIn = Boolean(useSession().data?.authenticated);
  const m = useMutation({
    mutationFn: () => api.post<{ faved: boolean }>(`/v1/customer/favourites/${id}/toggle`),
    onSuccess: (r) => {
      toast(r.faved ? t('Saved', 'सेव हो गया') : t('Removed', 'हटा दिया'));
      void qc.invalidateQueries({ queryKey: ['home'] });
    },
    onError: (e) => toast(e.message),
  });
  const shown = m.isPending ? !on : on;
  return (
    <button
      className={`fav ${shown ? 'on' : ''}`}
      aria-label={t('Save', 'सेव करें')}
      aria-pressed={shown}
      onClick={(e) => {
        e.stopPropagation();
        if (!loggedIn) return toast(t('Log in to save favourites', 'फ़ेवरेट सेव करने के लिए लॉगिन करें'));
        m.mutate();
      }}
    >
      {shown ? '♥' : '♡'}
    </button>
  );
}

export function Skeletons({ n }: { n: number }) {
  return (
    <>
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="pcard sk-card">
          <div className="sk sk1" />
          <div className="sk sk2" />
          <div className="sk sk3" />
        </div>
      ))}
    </>
  );
}
