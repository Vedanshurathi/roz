/** Build-time configuration (Vite injects VITE_* at build). */
export const API_URL =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, '') || 'http://localhost:8080';

/** Web-push public key — public by design (the private half lives in Supabase app_settings). */
export const VAPID_PUBLIC_KEY =
  (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined) ||
  'BFlTM-YF_0e6X_gZBy4ptZzxxM25c_l-C9kIOKZOiKbYybWBQom8L0CEoU9xLRK5vyiJml4sSq0Q7OUmynyaOhQ';

/** Harmless per-device preferences only — the session itself is an HttpOnly cookie. */
export const STORAGE = {
  lang: 'rbx.vlang',
  pushDismissed: 'rbx.vpush',
  seenOrders: 'rbx.vseen',
  passwordLater: 'rbx.vpwlater',
} as const;

export const googleLoginUrl = (returnTo = '/welcome') =>
  `${API_URL}/v1/vendor/auth/google?returnTo=${encodeURIComponent(returnTo)}`;
