/**
 * The shapes and rules the original customer app used (customer/index.html), kept so every screen
 * behaves exactly as before — now fed by the RozBazaar API instead of direct database calls.
 */
import type { Booking, Lang, Product, TimeSlot, VendorType } from '@rozbazaar/shared';
import { istDate } from '@rozbazaar/web';
import { ART_ALIAS, EMOJI_ALIAS } from '../art/drawings';

export type T = (en: string, hi: string) => string;

/** A product as the screens draw it. */
export interface P {
  id: string;
  en: string;
  hi: string;
  /** what the vendor typed, e.g. "Tamatar" — still searchable */
  roman: string;
  unit: string;
  price: number;
  /** the vendor changed this price in the last day ("🔥 freshly priced") */
  kal: boolean;
  cat: VendorType;
  /** in stock */
  fresh: boolean;
  photo: string | null;
  vendorId: string;
  vendorName: string | null;
  vendorRating: number;
  artKey: string | null;
  em: string;
}

export function toP(p: Product): P {
  const key = p.name.trim().toLowerCase();
  const updated = p.priceUpdatedAt ? Date.parse(p.priceUpdatedAt) : NaN;
  return {
    id: p.id,
    en: p.nameEn || p.name,
    hi: p.nameHi || p.name,
    roman: p.name,
    unit: p.unit,
    price: p.price,
    kal: Number.isFinite(updated) && Date.now() - updated < 26 * 3600_000,
    cat: p.category,
    fresh: p.inStock,
    photo: p.imageUrl,
    vendorId: p.vendorId,
    vendorName: p.vendorName,
    vendorRating: p.vendorRating ?? 0,
    artKey: p.catalogKey || ART_ALIAS[key] || null,
    em: EMOJI_ALIAS[key] || '🥬',
  };
}

export const pname = (p: Pick<P, 'en' | 'hi'>, lang: Lang) => (lang === 'en' ? p.en : p.hi);

export const VENDOR_TYPES: Array<{ id: VendorType; em: string; en: string; hi: string }> = [
  { id: 'vegetable', em: '🥬', en: 'Vegetable vendor', hi: 'सब्ज़ी वाला' },
  { id: 'onion_potato', em: '🧅', en: 'Onion–Potato vendor', hi: 'प्याज़–आलू वाला' },
  { id: 'fruit', em: '🍎', en: 'Fruit vendor', hi: 'फल वाला' },
];
export const vtype = (id: VendorType | null | undefined) =>
  VENDOR_TYPES.find((v) => v.id === id) ?? VENDOR_TYPES[0]!;

export const SLOTS: Array<{ id: TimeSlot; em: string; en: string; hi: string }> = [
  { id: 'morning', em: '🌅', en: 'Morning 7–11', hi: 'सुबह 7–11' },
  { id: 'afternoon', em: '☀️', en: 'Afternoon 12–4', hi: 'दोपहर 12–4' },
  { id: 'evening', em: '🌇', en: 'Evening 5–8', hi: 'शाम 5–8' },
];
export const slotOf = (id: TimeSlot) => SLOTS.find((s) => s.id === id)!;

/** Smallest booking a vendor's trip is worth. */
export const MIN_BASKET = 50;

const WD_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WD_HI = ['रवि', 'सोम', 'मंगल', 'बुध', 'गुरु', 'शुक्र', 'शनि'];

export interface DayLabel {
  i: number;
  iso: string;
  lbl: string;
  num: number;
  mon: string;
}
/** The next five days in India time. */
export function dayLabels(t: T, lang: Lang): DayLabel[] {
  return Array.from({ length: 5 }, (_, i) => {
    const iso = istDate(i);
    const d = new Date(`${iso}T12:00:00+05:30`);
    const wd = d.getUTCDay();
    const lbl =
      i === 0 ? t('Today', 'आज') : i === 1 ? t('Tomorrow', 'कल') : lang === 'en' ? WD_EN[wd]! : WD_HI[wd]!;
    return {
      i,
      iso,
      lbl,
      num: Number(iso.slice(8)),
      mon: d.toLocaleString('en', { month: 'short', timeZone: 'Asia/Kolkata' }),
    };
  });
}

export interface Sel {
  type: VendorType | null;
  day: number;
  slot: TimeSlot | null;
  vendorId: string | null;
}

/** "Today, Morning 7–11" */
export function slotLine(sel: Sel, t: T, lang: Lang): string {
  if (!sel.slot) return t('Today, Morning 7–11', 'आज, सुबह 7–11');
  const d = dayLabels(t, lang)[sel.day]!;
  const s = slotOf(sel.slot);
  return `${d.lbl}, ${lang === 'en' ? s.en : s.hi}`;
}
/** "Today morning" on product cards */
export function slotBadge(sel: Sel, t: T, lang: Lang): string {
  if (!sel.slot) return t('This morning', 'आज सुबह');
  const d = dayLabels(t, lang)[sel.day]!;
  const s = slotOf(sel.slot);
  return `${d.lbl} ${(lang === 'en' ? s.en : s.hi).replace(/ \d.*/, '').toLowerCase()}`;
}

/** "Today, Morning 7–11" for a booking date. */
export function prettySlot(dateIso: string, slot: TimeSlot, t: T, lang: Lang): string {
  const s = slotOf(slot);
  const diff = Math.round(
    (Date.parse(`${dateIso}T00:00:00Z`) - Date.parse(`${istDate(0)}T00:00:00Z`)) / 864e5,
  );
  const lbl =
    diff === 0
      ? t('Today', 'आज')
      : diff === 1
        ? t('Tomorrow', 'कल')
        : new Date(`${dateIso}T12:00:00+05:30`).toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            timeZone: 'Asia/Kolkata',
          });
  return `${lbl}, ${lang === 'en' ? s.en : s.hi}`;
}

/* ---------- bookings: the four steps the tracker shows ---------- */
export type Step = 'confirmed' | 'reached' | 'delivered' | 'completed';
export const STEPS: Step[] = ['confirmed', 'reached', 'delivered', 'completed'];
const STATUS_MAP: Record<Booking['status'], Step> = {
  placed: 'confirmed',
  on_the_way: 'reached',
  reached: 'reached',
  bill_final: 'reached',
  bill_approved: 'delivered',
  paid: 'delivered',
  delivered: 'delivered',
  completed: 'completed',
  pending_review: 'delivered',
  cancelled: 'completed',
  missed: 'completed',
  disputed: 'reached',
};
export const stepOf = (b: Pick<Booking, 'status'>): Step => STATUS_MAP[b.status] ?? 'confirmed';
export function stepLbl(s: Step, t: T): string {
  return {
    confirmed: t('Confirmed', 'पक्का'),
    reached: t('Vendor coming', 'वेंडर आ रहा है'),
    delivered: t('Delivered', 'डिलीवर हुआ'),
    completed: t('Done', 'पूरा'),
  }[s];
}

/* ---------- addresses: Home / Shop / Parents' home / named ---------- */
export const KNOWN_TAGS = ['Ghar', 'Dukaan', 'Mummy ka ghar'] as const;
export function addrName(label: string | null | undefined, t: T): string {
  const M: Record<string, string> = {
    Ghar: t('Home', 'घर'),
    Home: t('Home', 'घर'),
    Dukaan: t('Shop', 'दुकान'),
    'Mummy ka ghar': t("Parents' home", 'मम्मी का घर'),
    Aur: t('Other', 'अन्य'),
  };
  return (label && M[label]) || label || M.Ghar!;
}
export function addrIcon(label: string | null | undefined): string {
  if (label === 'Dukaan') return '🏪';
  if (label === 'Mummy ka ghar') return '👵';
  if (!label || label === 'Ghar' || label === 'Home') return '🏠';
  return '📍';
}

/* ---------- search: forgives a wrong letter anywhere ("tamater", "bhindl") ---------- */
function editDistance(a: string, b: string): number {
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++)
      cur[j] = a[i - 1] === b[j - 1] ? prev[j - 1]! : 1 + Math.min(prev[j - 1]!, prev[j]!, cur[j - 1]!);
    prev = cur;
  }
  return prev[b.length]!;
}
function fuzzyHit(word: string, q: string): boolean {
  if (!word || !q) return false;
  if (word.includes(q)) return true;
  const tol = q.length <= 4 ? 1 : q.length <= 7 ? 2 : 3;
  return word
    .split(/\s+/)
    .concat([word])
    .some((p) => Math.abs(p.length - q.length) <= tol && editDistance(p, q) <= tol);
}
export function matches(p: P, q: string): boolean {
  const en = `${p.en} ${p.unit}`.toLowerCase();
  const hi = `${p.hi} ${p.roman} ${p.unit}`.toLowerCase();
  return en.includes(q) || hi.includes(q) || fuzzyHit(en, q) || fuzzyHit(hi, q);
}

/** "5 min ago" */
export function when(iso: string, t: T): string {
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (m < 1) return t('just now', 'अभी');
  if (m < 60) return m + t(' min ago', ' मिनट पहले');
  if (m < 1440) return Math.round(m / 60) + t(' h ago', ' घंटे पहले');
  const dd = Math.round(m / 1440);
  return dd + t(dd === 1 ? ' day ago' : ' days ago', ' दिन पहले');
}
