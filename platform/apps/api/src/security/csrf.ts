/**
 * CSRF protection for cookie-authenticated requests.
 *
 * Every state-changing request must
 *   1. carry `X-Requested-With: rozbazaar` — a custom header a foreign page cannot add without a
 *      CORS preflight, which our CORS allowlist refuses; and
 *   2. come from an allowlisted Origin (or Referer when Origin is absent).
 * Together with SameSite=Lax cookies this blocks cross-site and cross-subdomain forgery.
 */
import type { RequestHandler } from 'express';
import { AppError } from '../lib/errors.js';

export const CSRF_HEADER = 'x-requested-with';
export const CSRF_VALUE = 'rozbazaar';
const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);

function originOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export function csrfGuard(
  allowedOrigins: readonly string[],
  opts: { requireOrigin: boolean },
): RequestHandler {
  const allowed = new Set(allowedOrigins);
  return (req, _res, next) => {
    if (SAFE.has(req.method)) return next();
    if (req.get(CSRF_HEADER) !== CSRF_VALUE) {
      return next(new AppError(403, 'CSRF', 'Request blocked (missing security header)'));
    }
    const origin = req.get('origin') ?? originOf(req.get('referer'));
    if (origin && !allowed.has(origin)) {
      return next(new AppError(403, 'CSRF', 'Request blocked (origin not allowed)'));
    }
    if (!origin && opts.requireOrigin) {
      return next(new AppError(403, 'CSRF', 'Request blocked (no origin)'));
    }
    next();
  };
}
