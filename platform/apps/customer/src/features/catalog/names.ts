import type { Lang, Product, VendorType } from '@rozbazaar/shared';

/** Item name in the chosen language: English name / Devanagari name, falling back to what the vendor typed. */
export function productName(p: Pick<Product, 'name' | 'nameEn' | 'nameHi'>, lang: Lang): string {
  return (lang === 'hi' ? p.nameHi : p.nameEn) || p.name;
}

/** Same item from different vendors (e.g. two vendors' tomatoes) share this key. */
export function itemKey(p: Pick<Product, 'name' | 'nameEn' | 'catalogKey'>): string {
  return (p.catalogKey || p.nameEn || p.name).trim().toLowerCase();
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

/** productId → name in the chosen language, from the live catalogue. Orders keep the vendor's typed name. */
export function nameIndex(
  products: ReadonlyArray<Pick<Product, 'id' | 'name' | 'nameEn' | 'nameHi'>>,
  lang: Lang,
): Map<string, string> {
  return new Map(products.map((p) => [p.id, productName(p, lang)]));
}
