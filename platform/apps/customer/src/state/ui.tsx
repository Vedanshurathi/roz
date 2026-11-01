/** Which pop-up is open — the original app's sheets and centred cards. */
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { AreaMatch } from '@rozbazaar/shared';

export interface VendorPick {
  /** Compare vendors for one item (and add the chosen one), or browse every vendor in the village. */
  pid?: string;
  productName?: string;
  add?: boolean;
}

interface UI {
  areaOpen: boolean;
  setAreaOpen(v: boolean): void;
  guess: AreaMatch | null;
  setGuess(g: AreaMatch | null): void;
  vendorPick: VendorPick | null;
  setVendorPick(v: VendorPick | null): void;
  notifsOpen: boolean;
  setNotifsOpen(v: boolean): void;
  checkOpen: boolean;
  setCheckOpen(v: boolean): void;
  addrPick: { thenBook: boolean } | null;
  setAddrPick(v: { thenBook: boolean } | null): void;
  locAsk: boolean;
  setLocAsk(v: boolean): void;
  /** Vendor chosen on the category screen (null = all vendors). */
  catVendor: string | null;
  setCatVendor(id: string | null): void;
}

const Ctx = createContext<UI | null>(null);

export function UIProvider({ children }: { children: ReactNode }) {
  const [areaOpen, setAreaOpen] = useState(false);
  const [guess, setGuess] = useState<AreaMatch | null>(null);
  const [vendorPick, setVendorPick] = useState<VendorPick | null>(null);
  const [notifsOpen, setNotifsOpen] = useState(false);
  const [checkOpen, setCheckOpen] = useState(false);
  const [addrPick, setAddrPick] = useState<{ thenBook: boolean } | null>(null);
  const [locAsk, setLocAsk] = useState(false);
  const [catVendor, setCatVendor] = useState<string | null>(null);
  const value = useMemo(
    () => ({
      areaOpen,
      setAreaOpen,
      guess,
      setGuess,
      vendorPick,
      setVendorPick,
      notifsOpen,
      setNotifsOpen,
      checkOpen,
      setCheckOpen,
      addrPick,
      setAddrPick,
      locAsk,
      setLocAsk,
      catVendor,
      setCatVendor,
    }),
    [areaOpen, guess, vendorPick, notifsOpen, checkOpen, addrPick, locAsk, catVendor],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useUI(): UI {
  const v = useContext(Ctx);
  if (!v) throw new Error('useUI must be used inside UIProvider');
  return v;
}
