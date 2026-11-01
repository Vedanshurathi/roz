import type { Lang, VendorProduct, VendorType } from '@rozbazaar/shared';

/** English name / Devanagari name, falling back to what the vendor typed ("Tamatar"). */
export function productName(p: Pick<VendorProduct, 'name' | 'nameEn' | 'nameHi'>, lang: Lang): string {
  return (lang === 'hi' ? p.nameHi : p.nameEn) || p.name;
}

/** productId → name in the chosen language. Order lines carry the typed name only. */
export function nameIndex(products: ReadonlyArray<VendorProduct>, lang: Lang): Map<string, string> {
  return new Map(products.map((p) => [p.id, productName(p, lang)]));
}

export function typeLabel(t: VendorType, lang: Lang): string {
  const m: Record<VendorType, [string, string]> = {
    vegetable: ['Vegetables', 'सब्ज़ी'],
    onion_potato: ['Onion & Potato', 'प्याज़-आलू'],
    fruit: ['Fruits', 'फल'],
  };
  return lang === 'hi' ? m[t][1] : m[t][0];
}

export const TYPE_ICON: Record<VendorType, string> = { vegetable: '🥬', onion_potato: '🧅', fruit: '🍎' };

/** Units vendors sell by (same list as the old app). Stored as typed; shown translated. */
export const UNITS = ['kg', '500 g', '250 g', '100 g', 'pc', 'dozen', 'bunch', 'sack'] as const;

/** "1 kg" and "kg" are the same unit ("2 × 1 kg" reads badly) — keep one spelling. */
export const normUnit = (unit: string) => unit.trim().replace(/^1\s+/, '');

export function unitLabel(raw: string, lang: Lang): string {
  const unit = normUnit(raw);
  if (lang !== 'hi') return unit;
  const hi: Record<string, string> = {
    kg: 'किलो',
    '500 g': '500 ग्राम',
    '250 g': '250 ग्राम',
    '100 g': '100 ग्राम',
    pc: 'पीस',
    dozen: 'दर्जन',
    bunch: 'गड्डी',
    gaddi: 'गड्डी',
    sack: 'बोरी',
    bori: 'बोरी',
  };
  return hi[unit] ?? unit;
}

/** Step for the +/− buttons: half-kilos for loose weight, whole units otherwise. */
export const qtyStep = (unit: string) => (normUnit(unit).toLowerCase() === 'kg' ? 0.5 : 1);
