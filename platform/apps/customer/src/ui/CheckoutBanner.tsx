import { useI18n } from '@rozbazaar/web';
import { useShop } from '../state/shop';
import { useCart } from '../state/useCart';

/** "Completing your order — 3 items · ₹120" on the login and address screens mid-checkout. */
export function CheckoutBanner() {
  const { t } = useI18n();
  const shop = useShop();
  const { total } = useCart();
  if (!shop.pendingCheckout || !shop.count) return null;
  return (
    <div className="ck-banner" style={{ display: 'flex' }}>
      <span className="ck-ic">🧺</span>
      <span>
        {t('Completing your order', 'अपना ऑर्डर पूरा करें')} — <b>{shop.count}</b> {t('items', 'सामान')} ·{' '}
        <b>₹{total}</b>
      </span>
    </div>
  );
}
