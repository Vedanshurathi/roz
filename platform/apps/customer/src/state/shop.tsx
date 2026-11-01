/**
 * What the customer is putting together: village, basket, chosen slot/vendor, note for the vendor.
 * Kept on the phone (localStorage) so a basket survives closing the app and the Google login
 * redirect — same as the original app.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { storage } from '@rozbazaar/web';
import type { Sel } from '../lib/model';

const K = {
  area: 'rbx.area',
  cart: 'rbx.cart2',
  sel: 'rbx.sel',
  note: 'rbx.note',
  checkout: 'rbx.pendingCheckout',
  query: 'rbx.query',
} as const;

export type Cart = Record<string, number>;
const EMPTY_SEL: Sel = { type: null, day: 0, slot: null, vendorId: null };

interface Shop {
  area: string;
  setArea(a: string): void;
  cart: Cart;
  count: number;
  addOne(id: string, qty?: number): void;
  setQty(id: string, delta: number): void;
  clearCart(): void;
  sel: Sel;
  setSel(patch: Partial<Sel>): void;
  note: string;
  setNote(n: string): void;
  /** Address chosen for this order (the "Deliver to which address?" sheet). */
  addrId: string | null;
  setAddrId(id: string | null): void;
  /** Login/address were opened in the middle of placing an order. */
  pendingCheckout: boolean;
  setPendingCheckout(v: boolean): void;
  query: string;
  setQuery(q: string): void;
}

const Ctx = createContext<Shop | null>(null);

function session<T>(key: string, fallback: T): T {
  try {
    const v = sessionStorage.getItem(key);
    return v === null ? fallback : (JSON.parse(v) as T);
  } catch {
    return fallback;
  }
}
function setSession(key: string, v: unknown) {
  try {
    sessionStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* storage blocked */
  }
}

export function ShopProvider({ children }: { children: ReactNode }) {
  // The original app opened on Khandewla; the location prompt then moves people to their village.
  const [area, setAreaState] = useState<string>(() => storage.get<string>(K.area) || 'Khandewla');
  const [cart, setCart] = useState<Cart>(() => storage.get<Cart>(K.cart) ?? {});
  const [sel, setSelState] = useState<Sel>(() => ({
    ...EMPTY_SEL,
    ...(storage.get<Partial<Sel>>(K.sel) ?? {}),
    day: 0,
  }));
  const [note, setNote] = useState<string>(() => storage.get<string>(K.note) ?? '');
  const [addrId, setAddrId] = useState<string | null>(null);
  const [pendingCheckout, setPendingState] = useState<boolean>(() => session(K.checkout, false));
  const [query, setQuery] = useState('');

  useEffect(() => {
    storage.set(K.cart, cart);
  }, [cart]);
  useEffect(() => {
    storage.set(K.sel, sel);
  }, [sel]);
  useEffect(() => {
    storage.set(K.note, note);
  }, [note]);

  const setArea = useCallback((a: string) => {
    setAreaState((prev) => {
      if (prev !== a) {
        // A basket priced by one village's vendor cannot follow you to another village.
        setCart({});
        setSelState((s) => ({ ...s, type: null, slot: null, vendorId: null }));
      }
      return a;
    });
    storage.set(K.area, a);
  }, []);

  const addOne = useCallback(
    (id: string, qty = 1) => setCart((c) => ({ ...c, [id]: (c[id] ?? 0) + qty })),
    [],
  );
  const setQty = useCallback(
    (id: string, delta: number) =>
      setCart((c) => {
        const n = (c[id] ?? 0) + delta;
        const next = { ...c };
        if (n <= 0) delete next[id];
        else next[id] = n;
        return next;
      }),
    [],
  );
  const clearCart = useCallback(() => setCart({}), []);
  const setSel = useCallback((patch: Partial<Sel>) => setSelState((s) => ({ ...s, ...patch })), []);
  const setPendingCheckout = useCallback((v: boolean) => {
    setPendingState(v);
    setSession(K.checkout, v);
  }, []);

  const count = Object.values(cart).reduce((a, b) => a + b, 0);
  const value = useMemo(
    () => ({
      area,
      setArea,
      cart,
      count,
      addOne,
      setQty,
      clearCart,
      sel,
      setSel,
      note,
      setNote,
      addrId,
      setAddrId,
      pendingCheckout,
      setPendingCheckout,
      query,
      setQuery,
    }),
    [
      area,
      setArea,
      cart,
      count,
      addOne,
      setQty,
      clearCart,
      sel,
      setSel,
      note,
      addrId,
      pendingCheckout,
      setPendingCheckout,
      query,
    ],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useShop(): Shop {
  const v = useContext(Ctx);
  if (!v) throw new Error('useShop must be used inside ShopProvider');
  return v;
}
