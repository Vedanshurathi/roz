/** Build-time configuration (Vite injects VITE_* at build). */
export const API_URL =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, '') || 'http://localhost:8080';
export const STORAGE = {
  lang: 'rbx.lang',
  area: 'rbx.area',
  cart: 'rbx.cart',
  checkout: 'rbx.checkout',
} as const;
export const VENDOR_SITE = 'https://vendor.rozbazaar.shop/';

/** Web-push public key — public by design (the private half lives in Supabase app_settings). */
export const VAPID_PUBLIC_KEY =
  (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined) ||
  'BFlTM-YF_0e6X_gZBy4ptZzxxM25c_l-C9kIOKZOiKbYybWBQom8L0CEoU9xLRK5vyiJml4sSq0Q7OUmynyaOhQ';
