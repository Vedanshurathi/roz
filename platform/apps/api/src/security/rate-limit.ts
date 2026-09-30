/**
 * Rate limits. In-memory store = correct for one API instance (Render starter). If the API is
 * scaled to several instances, switch the store to Redis (rate-limit-redis) — see docs/SECURITY.md.
 */
import { rateLimit, ipKeyGenerator, type RateLimitRequestHandler, type Options } from 'express-rate-limit';
import type { Request, Response } from 'express';
import type { ApiErrorBody } from '@rozbazaar/shared';

const MIN = 60_000;

function handler(message: string): Options['handler'] {
  return (req: Request, res: Response) => {
    const body: ApiErrorBody = { error: { code: 'RATE_LIMITED', message, requestId: String(req.id ?? '') } };
    res.status(429).json(body);
  };
}

function limiter(opts: {
  windowMs: number;
  limit: number;
  message: string;
  key?: (req: Request) => string;
  skipSuccessfulRequests?: boolean;
}): RateLimitRequestHandler {
  return rateLimit({
    windowMs: opts.windowMs,
    limit: opts.limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skipSuccessfulRequests: opts.skipSuccessfulRequests ?? false,
    keyGenerator: opts.key ?? ((req) => ipKeyGenerator(req.ip ?? '0.0.0.0')),
    handler: handler(opts.message),
  });
}

/** Normalised phone from the body, so one number can't be hammered from many IPs. */
function phoneKey(prefix: string) {
  return (req: Request): string => {
    const raw = (req.body as { phone?: unknown } | undefined)?.phone;
    const digits = typeof raw === 'string' ? raw.replace(/\D/g, '').slice(-10) : '';
    return digits.length === 10
      ? `${prefix}:${digits}`
      : `${prefix}:ip:${ipKeyGenerator(req.ip ?? '0.0.0.0')}`;
  };
}

export interface Limiters {
  global: RateLimitRequestHandler;
  customerLoginIp: RateLimitRequestHandler;
  customerLoginPhone: RateLimitRequestHandler;
  vendorLoginIp: RateLimitRequestHandler;
  vendorLoginPhone: RateLimitRequestHandler;
  otpVerify: RateLimitRequestHandler;
  booking: RateLimitRequestHandler;
  publicWrite: RateLimitRequestHandler;
  tracking: RateLimitRequestHandler;
  passwordChange: RateLimitRequestHandler;
}

export function createLimiters(scale = 1): Limiters {
  const n = (x: number) => Math.max(1, Math.round(x * scale));
  return {
    global: limiter({ windowMs: MIN, limit: n(300), message: 'Too many requests. Please slow down.' }),
    customerLoginIp: limiter({
      windowMs: 15 * MIN,
      limit: n(20),
      message: 'Too many login attempts. Try again in 15 minutes.',
    }),
    customerLoginPhone: limiter({
      windowMs: 60 * MIN,
      limit: n(8),
      key: phoneKey('clogin'),
      message: 'Too many logins for this number. Try again in an hour.',
    }),
    vendorLoginIp: limiter({
      windowMs: 15 * MIN,
      limit: n(10),
      skipSuccessfulRequests: true,
      message: 'Too many wrong attempts. Try again in 15 minutes.',
    }),
    vendorLoginPhone: limiter({
      windowMs: 15 * MIN,
      limit: n(5),
      skipSuccessfulRequests: true,
      key: phoneKey('vlogin'),
      message: 'Too many wrong passwords for this number. Try again in 15 minutes.',
    }),
    // A 4-digit code has 10,000 values; this keeps guessing hopeless (the DB also counts attempts).
    otpVerify: limiter({
      windowMs: 15 * MIN,
      limit: n(8),
      skipSuccessfulRequests: true,
      key: (req) => `otp:${String(req.params.id ?? '')}:${ipKeyGenerator(req.ip ?? '0.0.0.0')}`,
      message: 'Too many wrong codes. Ask the customer to read the code again, then wait a few minutes.',
    }),
    booking: limiter({
      windowMs: 60 * MIN,
      limit: n(20),
      message: 'Too many bookings from this device. Try again later.',
    }),
    publicWrite: limiter({
      windowMs: 60 * MIN,
      limit: n(10),
      message: 'Too many messages. Try again later.',
    }),
    // Push receipts ("delivered" / "opened") from service workers — cheap, but not unlimited.
    tracking: limiter({
      windowMs: 60 * MIN,
      limit: n(240),
      message: 'Too many requests.',
    }),
    passwordChange: limiter({
      windowMs: 60 * MIN,
      limit: n(5),
      message: 'Too many password changes. Try again later.',
    }),
  };
}
