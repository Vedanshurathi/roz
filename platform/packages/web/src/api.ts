/**
 * The only way the web apps talk to the backend. No tokens here: the session lives in an
 * HttpOnly cookie the browser attaches (`credentials: 'include'`), which page scripts —
 * including any injected script — cannot read.
 */
import type { ApiErrorBody, ApiErrorCode, ApiSuccess } from '@rozbazaar/shared';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode | 'NETWORK' | 'TIMEOUT',
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** Business code from the DB, e.g. OUT_OF_STOCK, VENDOR_FULL, NOT_REGISTERED. */
  get businessCode(): string | undefined {
    const d = this.details as { code?: unknown } | undefined;
    return typeof d?.code === 'string' ? d.code : undefined;
  }
}

export interface ApiClient {
  readonly baseUrl: string;
  get<T>(path: string, query?: Record<string, string | number | boolean | undefined>): Promise<T>;
  post<T>(path: string, body?: unknown): Promise<T>;
  put<T>(path: string, body?: unknown): Promise<T>;
  patch<T>(path: string, body?: unknown): Promise<T>;
  del<T>(path: string): Promise<T>;
  /** Full URL for top-level navigations (e.g. Google login). */
  url(path: string, query?: Record<string, string>): string;
}

/** Header that carries the sealed session when the API runs on another site (Supabase Edge). */
export const SESSION_HEADER = 'X-RB-Session';

/**
 * The session token, when the API uses header sessions. It is the API's own sealed blob (the
 * Supabase tokens inside are encrypted), stored only on this phone.
 */
export const sessionStore = (key: string) => ({
  get(): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(v: string | null): void {
    try {
      if (v) localStorage.setItem(key, v);
      else localStorage.removeItem(key);
    } catch {
      /* storage blocked (private mode) — the session lasts until the tab closes */
    }
  },
});

/**
 * After a Google login the API sends the browser back with `#rbs=<token>` (header sessions).
 * Store it and remove it from the address bar before anything else runs.
 */
export function adoptSessionFromUrl(key: string): void {
  const m = /[#&]rbs=([A-Za-z0-9._-]+)/.exec(window.location.hash);
  if (!m) return;
  sessionStore(key).set(m[1]!);
  window.history.replaceState(null, '', window.location.pathname + window.location.search);
}

export function createApiClient(
  baseUrl: string,
  opts: { timeoutMs?: number; onUnauthenticated?: () => void; sessionKey?: string } = {},
): ApiClient {
  const base = baseUrl.replace(/\/+$/, '');
  const timeoutMs = opts.timeoutMs ?? 20_000;
  const session = opts.sessionKey ? sessionStore(opts.sessionKey) : null;
  // Read on every request (another tab may have logged in or out); `memo` covers blocked storage.
  let memo: string | null = null;
  const currentToken = () => session?.get() ?? memo;

  const url = (path: string, query?: Record<string, string | number | boolean | undefined>) => {
    const u = new URL(base + path);
    for (const [k, v] of Object.entries(query ?? {}))
      if (v !== undefined && v !== '') u.searchParams.set(k, String(v));
    return u.toString();
  };

  async function send<T>(
    method: string,
    path: string,
    body?: unknown,
    query?: Record<string, string | number | boolean | undefined>,
  ): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    // The custom header is our CSRF proof; only needed (and only sent) for writes so reads stay preflight-free.
    if (method !== 'GET') headers['X-Requested-With'] = 'rozbazaar';
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    // Header sessions (API on Supabase Edge). With cookie sessions the API never sends one.
    const token = currentToken();
    if (token) headers[SESSION_HEADER] = token;
    let res: Response;
    try {
      res = await fetch(url(path, query), {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        credentials: 'include',
        cache: 'no-store',
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      const timedOut = err instanceof DOMException && err.name === 'TimeoutError';
      throw new ApiError(
        0,
        timedOut ? 'TIMEOUT' : 'NETWORK',
        timedOut ? 'The network is slow. Please try again.' : 'No internet connection',
      );
    }
    const next = session ? res.headers.get(SESSION_HEADER) : null;
    if (session && next) {
      memo = next === 'cleared' ? null : next;
      session.set(memo);
    }
    if (res.status === 204) return undefined as T;
    let json: unknown = null;
    try {
      json = await res.json();
    } catch {
      /* non-JSON body */
    }
    if (!res.ok) {
      const e = (json as ApiErrorBody | null)?.error;
      if (res.status === 401) opts.onUnauthenticated?.();
      throw new ApiError(res.status, e?.code ?? 'INTERNAL', e?.message ?? 'Something went wrong', e?.details);
    }
    return (json as ApiSuccess<T>).data;
  }

  return {
    baseUrl: base,
    get: (p, q) => send('GET', p, undefined, q),
    post: (p, b) => send('POST', p, b ?? {}),
    put: (p, b) => send('PUT', p, b ?? {}),
    patch: (p, b) => send('PATCH', p, b ?? {}),
    del: (p) => send('DELETE', p),
    url: (p, q) => url(p, q),
  };
}
