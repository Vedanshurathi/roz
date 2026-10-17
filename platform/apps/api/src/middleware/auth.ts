import type { RequestHandler } from 'express';
import type { Audience, SessionManager } from '../security/session.js';
import { unauthenticated } from '../lib/errors.js';

/** 401 unless the request carries a live session for this app. */
export function requireSession(sessions: SessionManager, aud: Audience): RequestHandler {
  return async (req, res, next) => {
    const s = await sessions.resolve(req, res, aud);
    if (!s) return next(unauthenticated());
    req.auth = s;
    next();
  };
}

/** Attaches the session when there is one; anonymous browsing continues without it. */
export function optionalSession(sessions: SessionManager, aud: Audience): RequestHandler {
  return async (req, res, next) => {
    const s = await sessions.resolve(req, res, aud);
    if (s) req.auth = s;
    next();
  };
}
