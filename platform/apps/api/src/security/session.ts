/**
 * Server-side sessions in encrypted, HttpOnly cookies.
 *
 * - One cookie per app ("audience"): a customer session can never act on vendor routes.
 * - `__Host-` prefix in production: Secure, host-only, Path=/ — cannot be set by a subdomain.
 * - SameSite=Lax: not sent on cross-site sub-requests (CSRF), still sent on the OAuth redirect.
 * - The Supabase access token is refreshed here, shortly before it expires, and the cookie is
 *   rewritten; the browser never sees either token.
 */
import type { Request, Response, CookieOptions } from 'express';
import type { Logger } from 'pino';
import type { AuthGateway, AuthSession } from '../supabase/auth.js';
import { jwtExpiry, type Sealer } from '../lib/crypto.js';

export type Audience = 'customer' | 'vendor';

interface SessionPayload {
  v: 1;
  aud: Audience;
  at: string;
  rt: string;
  exp: number;
  uid: string;
  /** When this login happened (epoch s) — used for the absolute lifetime. */
  iat: number;
}

export interface ActiveSession {
  audience: Audience;
  userId: string;
  accessToken: string;
}

export interface OAuthState {
  v: 1;
  aud: Audience;
  verifier: string;
  returnTo: string;
  iat: number;
}

const REFRESH_BEFORE_S = 120;
const OAUTH_TTL_S = 600;

export class SessionManager {
  private readonly inflight = new Map<string, Promise<AuthSession>>();

  constructor(
    private readonly sealer: Sealer,
    private readonly auth: AuthGateway,
    private readonly opts: {
      secure: boolean;
      /** Cookie lifetime; also the absolute limit before a fresh login is required. */
      maxAgeDays: Record<Audience, number>;
      logger: Logger;
    },
  ) {}

  cookieName(aud: Audience): string {
    return `${this.opts.secure ? '__Host-' : ''}${aud === 'customer' ? 'rb_c' : 'rb_v'}`;
  }

  private oauthCookieName(): string {
    return `${this.opts.secure ? '__Host-' : ''}rb_oauth`;
  }

  private cookieOptions(maxAgeMs: number): CookieOptions {
    return { httpOnly: true, secure: this.opts.secure, sameSite: 'lax', path: '/', maxAge: maxAgeMs };
  }

  write(res: Response, aud: Audience, s: AuthSession, loginAt = Math.floor(Date.now() / 1000)): void {
    const payload: SessionPayload = {
      v: 1,
      aud,
      at: s.accessToken,
      rt: s.refreshToken,
      exp: jwtExpiry(s.accessToken) ?? s.expiresAt,
      uid: s.userId,
      iat: loginAt,
    };
    const remainingMs = Math.max(60_000, loginAt * 1000 + this.opts.maxAgeDays[aud] * 864e5 - Date.now());
    res.cookie(
      this.cookieName(aud),
      this.sealer.seal(`session:${aud}`, payload),
      this.cookieOptions(remainingMs),
    );
  }

  clear(res: Response, aud: Audience): void {
    res.clearCookie(this.cookieName(aud), {
      httpOnly: true,
      secure: this.opts.secure,
      sameSite: 'lax',
      path: '/',
    });
  }

  /** The raw access token for logout, without refreshing. */
  peekAccessToken(req: Request, aud: Audience): string | null {
    const opened = this.sealer.open<SessionPayload>(`session:${aud}`, req.cookies?.[this.cookieName(aud)]);
    return opened?.value.at ?? null;
  }

  /**
   * Returns the active session (refreshing it if needed) or null when there is none / it is dead.
   * A dead cookie is cleared so the browser stops sending it.
   */
  async resolve(req: Request, res: Response, aud: Audience): Promise<ActiveSession | null> {
    const raw = req.cookies?.[this.cookieName(aud)] as string | undefined;
    if (!raw) return null;
    const opened = this.sealer.open<SessionPayload>(`session:${aud}`, raw);
    const p = opened?.value;
    const now = Math.floor(Date.now() / 1000);
    if (!p || p.v !== 1 || p.aud !== aud || now - p.iat > this.opts.maxAgeDays[aud] * 86_400) {
      this.clear(res, aud);
      return null;
    }
    if (p.exp - now > REFRESH_BEFORE_S) {
      if (opened.rotated) this.rewrite(res, aud, p);
      return { audience: aud, userId: p.uid, accessToken: p.at };
    }
    try {
      const fresh = await this.refreshOnce(p.rt);
      if (fresh.userId !== p.uid) throw new Error('refresh returned a different user');
      this.write(res, aud, fresh, p.iat);
      return { audience: aud, userId: fresh.userId, accessToken: fresh.accessToken };
    } catch (err) {
      this.opts.logger.info({ aud, err: (err as Error).message }, 'session refresh failed — signing out');
      this.clear(res, aud);
      return null;
    }
  }

  /** Concurrent requests that all need a refresh share one call (refresh tokens are single-use). */
  private refreshOnce(refreshToken: string): Promise<AuthSession> {
    let p = this.inflight.get(refreshToken);
    if (!p) {
      p = this.auth.refresh(refreshToken).finally(() => {
        setTimeout(() => this.inflight.delete(refreshToken), 5_000).unref();
      });
      this.inflight.set(refreshToken, p);
    }
    return p;
  }

  private rewrite(res: Response, aud: Audience, p: SessionPayload): void {
    const remainingMs = Math.max(60_000, p.iat * 1000 + this.opts.maxAgeDays[aud] * 864e5 - Date.now());
    res.cookie(this.cookieName(aud), this.sealer.seal(`session:${aud}`, p), this.cookieOptions(remainingMs));
  }

  /* ---------- OAuth (PKCE) state, bound to this browser ---------- */

  writeOAuthState(res: Response, state: Omit<OAuthState, 'v' | 'iat'>): void {
    const value: OAuthState = { ...state, v: 1, iat: Math.floor(Date.now() / 1000) };
    res.cookie(
      this.oauthCookieName(),
      this.sealer.seal('oauth', value),
      this.cookieOptions(OAUTH_TTL_S * 1000),
    );
  }

  takeOAuthState(req: Request, res: Response): OAuthState | null {
    const opened = this.sealer.open<OAuthState>('oauth', req.cookies?.[this.oauthCookieName()]);
    res.clearCookie(this.oauthCookieName(), {
      httpOnly: true,
      secure: this.opts.secure,
      sameSite: 'lax',
      path: '/',
    });
    const s = opened?.value;
    if (!s || s.v !== 1 || Math.floor(Date.now() / 1000) - s.iat > OAUTH_TTL_S) return null;
    return s;
  }
}
