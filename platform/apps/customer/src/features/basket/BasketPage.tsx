import { useNavigate } from 'react-router';
import { Button, EmptyState, ItemImage, rupees, Spinner, Stars, Stepper, useI18n } from '@rozbazaar/web';
import { PageHeader } from '../../components/PageHeader';
import { useShop } from '../../state/shop';
import { productName } from '../catalog/names';
import { useBasket } from './useBasket';

export default function BasketPage() {
  const { t, lang } = useI18n();
  const nav = useNavigate();
  const shop = useShop();
  const b = useBasket();

  if (!shop.itemCount) {
    return (
      <>
        <PageHeader title={t('Your basket', 'आपकी टोकरी')} back="/" />
        <EmptyState
          icon="🧺"
          title={t('Your basket is empty', 'टोकरी खाली है')}
          action={<Button onClick={() => nav('/')}>{t('Browse items', 'सामान देखें')}</Button>}
        />
      </>
    );
  }
  if (b.loading) return <Spinner />;

  return (
    <div className="page">
      <PageHeader title={t('Your basket', 'आपकी टोकरी')} back="/" step={{ n: 1, of: 3 }} />
      <div className="page__body">
        <div className="rb-card vendorline rv d1">
          <span aria-hidden>🛺</span>
          <div>
            <small>{t('Your vendor', 'आपके वेंडर')}</small>
            <b>
              {b.vendorName ?? '—'} <Stars value={b.vendor?.avgRating ?? null} size={12} />
            </b>
          </div>
        </div>

        <ul className="blines rv d2">
          {b.lines.map((l) => (
            <li key={l.product.id} className={l.product.inStock ? '' : 'is-out'}>
              <ItemImage
                src={l.product.imageUrl}
                name={l.product.nameEn ?? l.product.name}
                category={l.product.category}
                size={52}
              />
              <div className="blines__txt">
                <b>{productName(l.product, lang)}</b>
                <small>
                  {rupees(l.product.price)} / {l.product.unit}
                  {!l.product.inStock ? ` · ${t('now out of stock', 'अब ख़त्म')}` : ''}
                </small>
              </div>
              <Stepper
                value={l.qty}
                onChange={(n) => shop.setQty(l.product.id, n)}
                step={1}
                max={20}
                label={productName(l.product, lang)}
              />
            </li>
          ))}
        </ul>
        {b.missing.length ? (
          <p className="warn">
            {t(
              'Some items are no longer sold here and were left out.',
              'कुछ सामान अब यहाँ नहीं बिकते — हटा दिए गए।',
            )}{' '}
            <button
              type="button"
              className="linkbtn"
              onClick={() => b.missing.forEach((id) => shop.setQty(id, 0))}
            >
              {t('Remove them', 'हटाएँ')}
            </button>
          </p>
        ) : null}

        <label className="notefield rv d3">
          <span>{t('Note for the vendor (optional)', 'वेंडर के लिए नोट (ज़रूरी नहीं)')}</span>
          <textarea
            className="rb-textarea"
            maxLength={500}
            value={shop.note}
            onChange={(e) => shop.setNote(e.target.value)}
            placeholder={t('e.g. more tomatoes, less coriander', 'जैसे: ज़्यादा टमाटर, कम धनिया')}
          />
        </label>

        <div className="totals rv d4">
          <div>
            <span>{t('Estimated total', 'अनुमानित कुल')}</span>
            <b>{rupees(b.estTotal)}</b>
          </div>
          <p className="paynote">
            {t(
              'The vendor weighs at your door and makes the final bill. You pay the vendor directly — cash or UPI. No delivery fee.',
              'वेंडर दरवाज़े पर तौलकर पक्का बिल बनाएगा। पैसे सीधे वेंडर को दें — नकद या UPI। कोई डिलीवरी फ़ीस नहीं।',
            )}
          </p>
        </div>
      </div>
      <div className="stickybar">
        <Button block disabled={b.outOfStock.length > 0 || !b.lines.length} onClick={() => nav('/slot')}>
          {b.outOfStock.length
            ? t('Remove out-of-stock items first', 'पहले ख़त्म सामान हटाएँ')
            : `${t('Choose delivery slot', 'डिलीवरी का समय चुनें')} ›`}
        </Button>
      </div>
    </div>
  );
}
