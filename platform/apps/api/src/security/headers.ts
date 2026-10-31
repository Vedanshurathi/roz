import helmet from 'helmet';
import cors from 'cors';
import type { RequestHandler } from 'express';
import { CSRF_HEADER } from './csrf.js';
import { SESSION_HEADER } from './session.js';

/** The API only ever returns JSON or images, so its CSP is "nothing may load". */
export function securityHeaders(opts: { hsts: boolean; crossSite?: boolean }): RequestHandler {
  return helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'none'"],
        formAction: ["'none'"],
      },
    },
    // Product photos are loaded by the web apps: same-site when the API is api.rozbazaar.shop,
    // cross-site when it runs on Supabase Edge (supabase.co).
    crossOriginResourcePolicy: { policy: opts.crossSite ? 'cross-origin' : 'same-site' },
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    referrerPolicy: { policy: 'no-referrer' },
    strictTransportSecurity: opts.hsts
      ? { maxAge: 63_072_000, includeSubDomains: true, preload: false }
      : false,
    xFrameOptions: { action: 'deny' },
  });
}

export function corsPolicy(allowedOrigins: readonly string[]): RequestHandler {
  const allowed = new Set(allowedOrigins);
  return cors({
    origin(origin, cb) {
      // Same-origin / curl requests have no Origin: allowed through CORS; CSRF guard still applies.
      if (!origin || allowed.has(origin)) return cb(null, true);
      cb(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', CSRF_HEADER, SESSION_HEADER],
    exposedHeaders: ['X-Request-Id', 'RateLimit', 'RateLimit-Policy', SESSION_HEADER],
    maxAge: 600,
  });
}

/** Authenticated JSON must never be cached by the browser or a proxy. */
export const noStore: RequestHandler = (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
};
