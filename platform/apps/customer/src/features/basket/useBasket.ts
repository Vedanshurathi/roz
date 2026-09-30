import { useMemo } from 'react';
import type { Product, VendorCard, VendorType } from '@rozbazaar/shared';
import { useHome, useSession, useVendors } from '../../api/queries';
import { useShop } from '../../state/shop';

export interface BasketLine {
  product: Product;
  qty: number;
  lineTotal: number;
}

/** The basket joined with live catalogue data (price, stock, vendor). */
export function useBasket() {
  const shop = useShop();
  const session = useSession();
  const home = useHome(shop.area, Boolean(session.data?.authenticated));
  const vendors = useVendors(shop.area);

  return useMemo(() => {
    const byId = new Map((home.data?.products ?? []).map((p) => [p.id, p]));
    const lines: BasketLine[] = [];
    const missing: string[] = [];
    for (const [id, qty] of Object.entries(shop.cart)) {
      const p = byId.get(id);
      if (p) lines.push({ product: p, qty, lineTotal: p.price * qty });
      else missing.push(id);
    }
    const vendor: VendorCard | undefined = vendors.data?.find((v) => v.id === shop.cartVendorId);
    const outOfStock = lines.filter((l) => !l.product.inStock);
    const estTotal = lines.reduce((n, l) => n + l.lineTotal, 0);
    const bookingType: VendorType | null = vendor?.type ?? lines[0]?.product.category ?? null;
    return {
      lines,
      missing,
      vendor,
      vendorName: vendor?.name ?? lines[0]?.product.vendorName ?? null,
      outOfStock,
      estTotal,
      bookingType,
      loading: home.isPending || vendors.isPending,
    };
  }, [shop.cart, shop.cartVendorId, home.data, home.isPending, vendors.data, vendors.isPending]);
}
