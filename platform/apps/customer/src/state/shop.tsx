/**
 * Client state that isn't server data: chosen village, the basket, and the checkout choices.
 * Persisted per device (not secret). A booking goes to ONE vendor, so the basket remembers
 * whose items it holds and refuses to silently mix vendors.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Product, TimeSlot } from '@rozbazaar/shared';
import { storage } from '@rozbazaar/web';
import { STORAGE } from '../config';

export interface SlotChoice {
  date: string;
  slot: TimeSlot;
}

interface Persisted {
  cart: Record<string, number>;
  vendorId: string | null;
}

interface Shop {
  area: string | null;
  setArea(area: string): void;
  cart: Record<string, number>;
  cartVendorId: string | null;
  itemCount: number;
  /** Bumps on every add, so the cart bar can replay its "pop". */
  bump: number;
  add(p: Product): 'added' | 'other-vendor';
  setQty(productId: string, qty: number): void;
  replaceWith(p: Product): void;
  clearCart(): void;
  slot: SlotChoice | null;
  setSlot(s: SlotChoice | null): void;
  note: string;
  setNote(n: string): void;
  addressId: string | null;
  setAddressId(id: string | null): void;
}

const Ctx = createContext<Shop | null>(null);

export function ShopProvider({ children }: { children: ReactNode }) {
  const [area, setAreaState] = useState<string | null>(() => storage.get<string>(STORAGE.area));
  const [basket, setBasket] = useState<Persisted>(
    () => storage.get<Persisted>(STORAGE.cart) ?? { cart: {}, vendorId: null },
  );
  const [checkout, setCheckout] = useState<{
    slot: SlotChoice | null;
    note: string;
    addressId: string | null;
  }>(() => storage.get(STORAGE.checkout) ?? { slot: null, note: '', addressId: null });
  const [bump, setBump] = useState(0);

  useEffect(() => storage.set(STORAGE.cart, basket), [basket]);
  useEffect(() => storage.set(STORAGE.checkout, checkout), [checkout]);

  const setArea = useCallback((a: string) => {
    setAreaState((prev) => {
      if (prev !== a) setBasket({ cart: {}, vendorId: null }); // another village = other vendors
      return a;
    });
    storage.set(STORAGE.area, a);
  }, []);

  const add = useCallback(
    (p: Product): 'added' | 'other-vendor' => {
      if (basket.vendorId && basket.vendorId !== p.vendorId && Object.keys(basket.cart).length)
        return 'other-vendor';
      setBasket((b) => ({ vendorId: p.vendorId, cart: { ...b.cart, [p.id]: (b.cart[p.id] ?? 0) + 1 } }));
      setBump((n) => n + 1);
      return 'added';
    },
    [basket],
  );

  const setQty = useCallback((productId: string, qty: number) => {
    setBasket((b) => {
      const cart = { ...b.cart };
      if (qty <= 0) delete cart[productId];
      else cart[productId] = qty;
      return { cart, vendorId: Object.keys(cart).length ? b.vendorId : null };
    });
  }, []);

  const replaceWith = useCallback((p: Product) => {
    setBasket({ vendorId: p.vendorId, cart: { [p.id]: 1 } });
    setBump((n) => n + 1);
  }, []);

  const clearCart = useCallback(() => setBasket({ cart: {}, vendorId: null }), []);

  const value = useMemo<Shop>(
    () => ({
      area,
      setArea,
      cart: basket.cart,
      cartVendorId: basket.vendorId,
      itemCount: Object.values(basket.cart).reduce((n, q) => n + q, 0),
      bump,
      add,
      setQty,
      replaceWith,
      clearCart,
      slot: checkout.slot,
      setSlot: (slot) => setCheckout((c) => ({ ...c, slot })),
      note: checkout.note,
      setNote: (note) => setCheckout((c) => ({ ...c, note: note.slice(0, 500) })),
      addressId: checkout.addressId,
      setAddressId: (addressId) => setCheckout((c) => ({ ...c, addressId })),
    }),
    [area, setArea, basket, bump, add, setQty, replaceWith, clearCart, checkout],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useShop(): Shop {
  const v = useContext(Ctx);
  if (!v) throw new Error('useShop must be used inside ShopProvider');
  return v;
}
