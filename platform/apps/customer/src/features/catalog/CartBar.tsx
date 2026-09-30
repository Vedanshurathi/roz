import { useEffect, useRef } from 'react';
import { Link } from 'react-router';
import { rupees, useI18n } from '@rozbazaar/web';
import { useShop } from '../../state/shop';
import { useBasket } from '../basket/useBasket';

/** Slides up with the first item; pops each time something lands in it. */
export function CartBar() {
  const { t } = useI18n();
  const shop = useShop();
  const basket = useBasket();
  const icon = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!shop.bump || !icon.current) return;
    icon.current.animate(
      [{ transform: 'scale(1)' }, { transform: 'scale(1.35)' }, { transform: 'scale(1)' }],
      {
        duration: 320,
        easing: 'cubic-bezier(.34,1.56,.64,1)',
      },
    );
  }, [shop.bump]);

  if (!shop.itemCount) return null;
  return (
    <Link to="/basket" className="cartbar">
      <span className="cartbar__icon" id="cartbar-icon" ref={icon} aria-hidden>
        🧺
      </span>
      <span className="cartbar__txt">
        <b>
          {shop.itemCount} {t(shop.itemCount === 1 ? 'item' : 'items', 'सामान')}
        </b>
        <small>
          {rupees(basket.estTotal)} · {t('estimated', 'अनुमानित')}
          {basket.vendorName ? ` · ${basket.vendorName}` : ''}
        </small>
      </span>
      <span className="cartbar__go">{t('View basket', 'टोकरी देखें')} ›</span>
    </Link>
  );
}
