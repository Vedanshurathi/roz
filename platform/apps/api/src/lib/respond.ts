import type { Response } from 'express';
import type { ApiSuccess } from '@rozbazaar/shared';

export function ok<T>(res: Response, data: T, message?: string | null, status = 200): void {
  const body: ApiSuccess<T> = message ? { data, message } : { data };
  res.status(status).json(body);
}

/** Relative in-app path only — blocks open redirects like "//evil.com" or "https://evil.com". */
export function safeReturnPath(v: unknown, fallback = '/'): string {
  if (typeof v !== 'string' || v.length > 200) return fallback;
  if (!v.startsWith('/') || v.startsWith('//') || v.startsWith('/\\') || /[\r\n]/.test(v)) return fallback;
  return v;
}
