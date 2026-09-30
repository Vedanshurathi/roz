import type { ApiClient } from './api.js';

/**
 * Web push: registers the app's service worker (must be served from the site root, see sw.js) and
 * returns the subscription the API stores. Honest about every failure — it never claims alerts are
 * on when they are not.
 */
export type PushState = 'unsupported' | 'denied' | 'default' | 'granted';

export function pushState(): PushState {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window))
    return 'unsupported';
  return Notification.permission as PushState;
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export interface PushSubscriptionPayload {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  agent?: string;
}

/** Asks for permission if needed; resolves null when the person says no or the browser can't. */
export async function subscribePush(
  vapidPublicKey: string,
  swUrl = '/sw.js',
): Promise<PushSubscriptionPayload | null> {
  if (pushState() === 'unsupported') return null;
  const perm =
    Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
  if (perm !== 'granted') return null;
  const reg = await navigator.serviceWorker.register(swUrl, { scope: '/' });
  await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    }));
  const json = sub.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) return null;
  return {
    endpoint: json.endpoint,
    keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
    agent: navigator.userAgent.slice(0, 200),
  };
}

/**
 * Registers /sw.js (told where the API is, for delivery receipts), subscribes and saves the
 * subscription at `path`. Throws Error('denied' | 'unsupported') so the app can explain what to do.
 */
export async function enablePush(client: ApiClient, path: string, vapidPublicKey: string): Promise<void> {
  const swUrl = `/sw.js?api=${encodeURIComponent(new URL(client.baseUrl).origin)}`;
  const sub = await subscribePush(vapidPublicKey, swUrl);
  if (!sub) throw new Error(pushState() === 'denied' ? 'denied' : 'unsupported');
  await client.post(path, sub);
}
