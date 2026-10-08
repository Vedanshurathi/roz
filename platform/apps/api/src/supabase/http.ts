import { upstream } from '../lib/errors.js';

export interface UpstreamResponse<T> {
  status: number;
  body: T;
}

/** fetch + JSON with a hard timeout. Network failures and timeouts become a 502, never a hang. */
export async function fetchJson<T>(
  url: string,
  init: RequestInit & { timeoutMs: number },
): Promise<UpstreamResponse<T>> {
  const { timeoutMs, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(url, { ...rest, signal: AbortSignal.timeout(timeoutMs) });
  } catch (err) {
    const e = upstream();
    (e as Error & { cause?: unknown }).cause = err;
    throw e;
  }
  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { message: text.slice(0, 300) };
    }
  }
  return { status: res.status, body: body as T };
}
