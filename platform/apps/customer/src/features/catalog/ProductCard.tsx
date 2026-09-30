import { useRef, useState } from 'react';
import type { Product } from '@rozbazaar/shared';
import { ItemImage, rupees, Stars, Stepper, useI18n } from '@rozbazaar/web';
import { flyToCart } from '../../components/flyToCart';
import { productName } from './names';

/** One item. `options` > 1 means several vendors sell it — ADD opens the vendor picker. */
export function ProductCard(props: {
  product: Product;
  options: Product[];
  qty: number;
  onAdd: (p: Product) => boolean;
  onQty: (n: number) => void;
  onPick: () => void;
  index: number;
}) {
  const { t, lang } = useI18n();
  const { product: p, options, qty } = props;
  const pic = useRef<HTMLDivElement>(null);
  const [justAdded, setJustAdded] = useState(false);
  const multi = options.length > 1;
  const cheapest = Math.min(...options.map((o) => o.price));
  const anyInStock = options.some((o) => o.inStock);
  const name = productName(p, lang);

  function add() {
    if (multi) return props.onPick();
    if (!props.onAdd(p)) return;
    flyToCart(pic.current);
    setJustAdded(true);
    window.setTimeout(() => setJustAdded(false), 1000);
  }

  return (
    <article className={`pcard rv d${Math.min(6, (props.index % 6) + 1)} ${anyInStock ? '' : 'pcard--out'}`}>
      <div className="pcard__img" ref={pic}>
        <ItemImage src={p.imageUrl} name={p.nameEn ?? p.name} category={p.category} size={112} />
        {!anyInStock ? <span className="pcard__badge">{t('Out of stock', 'ख़त्म')}</span> : null}
      </div>
      <h3 className="pcard__name">{name}</h3>
      <div className="pcard__unit">{p.unit}</div>
      <div className="pcard__meta">
        {multi ? (
          <span className="rb-pill rb-pill--b">
            {t(`${options.length} vendors`, `${options.length} वेंडर`)}
          </span>
        ) : (
          <span className="pcard__vendor">
            {p.vendorName} <Stars value={p.vendorRating} size={12} />
          </span>
        )}
      </div>
      <div className="pcard__foot">
        <div className="pcard__price">
          {multi ? <small>{t('from', 'से')} </small> : null}
          {rupees(multi ? cheapest : p.price)}
          <small className="pcard__rate">{t("Today's rate", 'आज का रेट')}</small>
        </div>
        {qty > 0 && !multi ? (
          <Stepper value={qty} onChange={props.onQty} label={t(`Quantity of ${name}`, `${name} की मात्रा`)} />
        ) : (
          <button
            type="button"
            className={`addbtn ${justAdded ? 'addbtn--ok' : ''}`}
            onClick={add}
            disabled={!anyInStock}
            aria-label={t(`Add ${name}`, `${name} जोड़ें`)}
          >
            {justAdded ? '✓' : t('ADD', 'जोड़ें')}
          </button>
        )}
      </div>
    </article>
  );
}
