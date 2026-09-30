import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CreatedBooking } from '@rozbazaar/shared';
import { ApiError, Button, dayLabel, rupees, slotLabel, Spinner, useI18n, useToast } from '@rozbazaar/web';
import { api } from '../../api/client';
import { keys, useAddresses } from '../../api/queries';
import { PageHeader } from '../../components/PageHeader';
import { useShop } from '../../state/shop';
import { useBasket } from '../basket/useBasket';

export default function CheckoutPage() {
  const { t, lang } = useI18n();
  const nav = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const shop = useShop();
  const basket = useBasket();
  const addresses = useAddresses(true);
  const list = (addresses.data ?? []).filter((a) => a.area === shop.area);
  const chosen = list.find((a) => a.id === shop.addressId) ?? list.find((a) => a.isDefault) ?? list[0];

  useEffect(() => {
    if (!shop.itemCount) nav('/basket', { replace: true });
    else if (!shop.slot) nav('/slot', { replace: true });
  }, [shop.itemCount, shop.slot, nav]);

  const book = useMutation({
    mutationFn: () =>
      api.post<CreatedBooking>('/v1/customer/bookings', {
        type: basket.bookingType,
        addressId: chosen!.id,
        date: shop.slot!.date,
        slot: shop.slot!.slot,
        items: basket.lines.map((l) => ({ productId: l.product.id, qty: l.qty })),
        note: shop.note || undefined,
        vendorId: shop.cartVendorId,
      }),
    onSuccess: (created) => {
      // The success page empties the basket; doing it here would re-trigger the
      // "empty basket → go to basket" guard above and override this navigation.
      void qc.invalidateQueries({ queryKey: keys.bookings });
      nav('/success', { replace: true, state: created });
    },
    onError: (e) => {
      const code = e instanceof ApiError ? e.businessCode : undefined;
      toast.show(e.message, 'bad');
      if (code === 'VENDOR_FULL') nav('/slot');
      if (code === 'OUT_OF_STOCK') {
        void qc.invalidateQueries({ queryKey: ['home'] });
        nav('/basket');
      }
    },
  });

  if (addresses.isPending || basket.loading) return <Spinner />;
  const s = shop.slot;

  return (
    <div className="page">
      <PageHeader title={t('Confirm booking', 'बुकिंग पक्की करें')} back="/slot" step={{ n: 3, of: 3 }} />
      <div className="page__body">
        <h2 className="sech">{t('Deliver to', 'कहाँ पहुँचाएँ')}</h2>
        {list.length === 0 ? (
          <div className="rb-card rv d1">
            <p>{t(`Add your address in ${shop.area}`, `${shop.area} में अपना पता जोड़ें`)}</p>
            <Link
              className="rb-btn rb-btn--secondary rb-btn--block"
              to="/address/new?next=/checkout"
              style={{ marginTop: 12 }}
            >
              <span>+ {t('Add address', 'पता जोड़ें')}</span>
            </Link>
          </div>
        ) : (
          <div className="addrpick rv d1" role="radiogroup" aria-label={t('Address', 'पता')}>
            {list.map((a) => (
              <button
                key={a.id}
                type="button"
                role="radio"
                aria-checked={a.id === chosen?.id}
                className={`addrcard ${a.id === chosen?.id ? 'is-on' : ''}`}
                onClick={() => shop.setAddressId(a.id)}
              >
                <b>
                  {a.label ?? t('Home', 'घर')} {a.isDefault ? '⭐' : ''}
                </b>
                <span>{[a.house, a.street, a.area].filter(Boolean).join(', ')}</span>
                {a.landmark ? (
                  <small>
                    {t('Near', 'पास')}: {a.landmark}
                  </small>
                ) : null}
              </button>
            ))}
            <Link to="/address/new?next=/checkout" className="linkbtn">
              + {t('Another address', 'दूसरा पता')}
            </Link>
          </div>
        )}

        <h2 className="sech">{t('Summary', 'सारांश')}</h2>
        <div className="rb-card summary rv d2">
          <div>
            <span>{t('When', 'कब')}</span>
            <b>{s ? `${dayLabel(s.date, lang)}, ${slotLabel(s.slot, lang)}` : '—'}</b>
          </div>
          <div>
            <span>{t('Vendor', 'वेंडर')}</span>
            <b>{basket.vendorName}</b>
          </div>
          <div>
            <span>{t('Items', 'सामान')}</span>
            <b>{basket.lines.length}</b>
          </div>
          <div className="summary__total">
            <span>{t('Estimated total', 'अनुमानित कुल')}</span>
            <b>{rupees(basket.estTotal)}</b>
          </div>
        </div>
        <p className="paynote rv d3">
          💵{' '}
          {t(
            'Pay the vendor directly after the final weighing — cash or UPI. RozBazaar never asks for money online.',
            'पक्के तौल के बाद सीधे वेंडर को पैसे दें — नकद या UPI। RozBazaar कभी ऑनलाइन पैसे नहीं माँगता।',
          )}
        </p>
      </div>
      <div className="stickybar">
        <Button block loading={book.isPending} disabled={!chosen} onClick={() => book.mutate()}>
          {t('Confirm booking', 'बुकिंग पक्की करें')} · {rupees(basket.estTotal)}
        </Button>
      </div>
    </div>
  );
}
