/**
 * Placing a booking, step by step as in the original app:
 * stock + minimum → slot → login → address (ask which one when there are several) → book.
 */
import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import type { Address, CreatedBooking } from '@rozbazaar/shared';
import { ApiError, istDate, useI18n } from '@rozbazaar/web';
import { api, queryClient } from '../api/client';
import { keys, useSession, useVendors } from '../api/queries';
import { MIN_BASKET, pname, slotLine } from '../lib/model';
import { useToast } from '../ui/Toast';
import { useShop } from './shop';
import { useUI } from './ui';
import { useCart } from './useCart';

export function useCheckout() {
  const shop = useShop();
  const ui = useUI();
  const toast = useToast();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { t, lang } = useI18n();
  const session = useSession();
  const vendors = useVendors(shop.area);
  const { prod, total } = useCart();

  async function createBooking(addressId: string) {
    toast(t('Booking the vendor…', 'वेंडर को बता रहे हैं…'));
    const type =
      vendors.data?.find((v) => v.id === shop.sel.vendorId)?.type ??
      shop.sel.type ??
      prod(Object.keys(shop.cart)[0] ?? '')?.cat ??
      'vegetable';
    try {
      const created = await api.post<CreatedBooking>('/v1/customer/bookings', {
        type,
        addressId,
        date: istDate(shop.sel.day),
        slot: shop.sel.slot ?? 'morning',
        items: Object.entries(shop.cart).map(([productId, qty]) => ({ productId, qty })),
        note: shop.note.trim() || undefined,
        vendorId: shop.sel.vendorId ?? undefined,
      });
      const line = slotLine(shop.sel, t, lang);
      shop.clearCart();
      shop.setNote('');
      shop.setAddrId(null);
      shop.setPendingCheckout(false);
      void qc.invalidateQueries({ queryKey: keys.bookings });
      nav('/success', { replace: true, state: { ...created, slotLine: line } });
    } catch (e) {
      const code = e instanceof ApiError ? e.businessCode : undefined;
      if (code === 'OUT_OF_STOCK') {
        await qc.invalidateQueries({ queryKey: ['home'] });
        nav('/basket');
      }
      if (code === 'VENDOR_FULL' || code === 'NO_VENDOR') {
        shop.setSel({ slot: null });
        nav('/slot');
      }
      toast((e as Error).message || t('Could not book — try again', 'बुकिंग नहीं हुई — दोबारा कोशिश करें'));
    }
  }

  async function placeBooking() {
    const oos = Object.keys(shop.cart)
      .map(prod)
      .filter((p) => p && !p.fresh);
    if (oos.length)
      return toast(
        t('Out of stock now: ', 'अभी स्टॉक ख़त्म: ') +
          oos.map((p) => pname(p!, lang)).join(', ') +
          t(' — please remove', ' — कृपया हटाएँ'),
      );
    if (total < MIN_BASKET)
      return toast(t(`Minimum booking is ₹${MIN_BASKET}`, `कम से कम बुकिंग ₹${MIN_BASKET} है`));
    if (!shop.sel.slot) {
      toast(t('Pick a slot first', 'पहले स्लॉट चुनें'));
      return nav('/slot');
    }
    // Login only at booking time, never to browse.
    if (!session.data?.authenticated) {
      shop.setPendingCheckout(true);
      return nav('/login');
    }
    const addresses = await queryClient.fetchQuery({
      queryKey: keys.addresses,
      queryFn: () => api.get<Address[]>('/v1/customer/addresses'),
    });
    if (!addresses.length) {
      shop.setPendingCheckout(true);
      return nav('/address/new?from=checkout');
    }
    // More than one saved address: ask which one this order goes to.
    if (addresses.length > 1 && !shop.addrId) return ui.setAddrPick({ thenBook: true });
    const chosen =
      addresses.find((a) => a.id === shop.addrId) ?? addresses.find((a) => a.isDefault) ?? addresses[0]!;
    return createBooking(chosen.id);
  }

  return { placeBooking, createBooking };
}
