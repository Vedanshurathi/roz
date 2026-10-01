import express, { type Express, type RequestHandler } from 'express';
import cookieParser from 'cookie-parser';
import { pinoHttp } from 'pino-http';
import { randomUUID } from 'node:crypto';
import type { Logger } from 'pino';
import type { Env } from './config/env.js';
import type { Deps } from './deps.js';
import { Sealer } from './lib/crypto.js';
import { createLogger } from './lib/logger.js';
import { createAuthGateway } from './supabase/auth.js';
import { createRpcGateway } from './supabase/rpc.js';
import { SessionManager } from './security/session.js';
import { createLimiters } from './security/rate-limit.js';
import { corsPolicy, securityHeaders } from './security/headers.js';
import { csrfGuard } from './security/csrf.js';
import { ImageStore } from './modules/images/image-store.js';
import { errorHandler, notFoundHandler } from './middleware/errors.js';
import { imageRoutes, publicRoutes } from './modules/public/routes.js';
import { customerAuthRoutes } from './modules/customer/auth.routes.js';
import { customerRoutes } from './modules/customer/routes.js';
import { vendorAuthRoutes } from './modules/vendor/auth.routes.js';
import { vendorRoutes } from './modules/vendor/routes.js';

/** Wires real implementations. Tests pass their own `overrides` (fake Supabase, etc.). */
export function buildDeps(env: Env, overrides: Partial<Deps> = {}): Deps {
  const logger = overrides.logger ?? createLogger(env);
  const timeoutMs = env.UPSTREAM_TIMEOUT_MS;
  const auth =
    overrides.auth ?? createAuthGateway({ url: env.SUPABASE_URL, anonKey: env.SUPABASE_ANON_KEY, timeoutMs });
  const rpc =
    overrides.rpc ??
    createRpcGateway({
      url: env.SUPABASE_URL,
      anonKey: env.SUPABASE_ANON_KEY,
      serviceKey: env.SUPABASE_SERVICE_ROLE_KEY,
      timeoutMs,
      onUnexpected: (info) => logger.warn(info, 'unexpected response from database'),
    });
  const sealer = new Sealer([
    env.SESSION_SECRET,
    ...(env.SESSION_SECRET_PREVIOUS ? [env.SESSION_SECRET_PREVIOUS] : []),
  ]);
  const sessions =
    overrides.sessions ??
    new SessionManager(sealer, auth, {
      secure: env.isProd,
      maxAgeDays: { customer: 60, vendor: 30 },
      logger,
      transport: env.SESSION_TRANSPORT,
    });
  const images = overrides.images ?? new ImageStore();
  return {
    env,
    logger,
    auth,
    rpc,
    sessions,
    images,
    limiters: overrides.limiters ?? createLimiters(),
    map: overrides.map ?? { images, apiUrl: env.PUBLIC_API_URL },
  };
}

/** Bodies are tiny except product/profile photos. */
function jsonBody(): RequestHandler {
  const small = express.json({ limit: '32kb', strict: true });
  const large = express.json({ limit: '600kb', strict: true });
  return (req, res, next) =>
    (/^\/v1\/vendor\/(products|profile)(\/|$)/.test(req.path) ? large : small)(req, res, next);
}

export function createApp(d: Deps): Express {
  const { env } = d;
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY);
  app.set('etag', false);

  app.use(
    pinoHttp({
      logger: d.logger as Logger,
      genReqId: (req, res) => {
        const incoming = req.headers['x-request-id'];
        const id =
          typeof incoming === 'string' && /^[A-Za-z0-9-]{8,64}$/.test(incoming) ? incoming : randomUUID();
        res.setHeader('X-Request-Id', id);
        return id;
      },
      customLogLevel: (_req, res, err) =>
        err || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info',
      serializers: {
        req: (req: { id: unknown; method: string; url: string }) => ({
          id: req.id,
          method: req.method,
          url: req.url?.split('?')[0],
        }),
      },
    }),
  );
  if (env.CLIENT_IP_HEADER) {
    // e.g. Supabase Edge sits behind Cloudflare, which sets cf-connecting-ip (clients can't forge it).
    const header = env.CLIENT_IP_HEADER.toLowerCase();
    app.use((req, _res, next) => {
      const v = req.headers[header];
      const ip = (Array.isArray(v) ? v[0] : v)?.split(',')[0]?.trim();
      if (ip) Object.defineProperty(req, 'ip', { value: ip, configurable: true });
      next();
    });
  }
  app.use(securityHeaders({ hsts: env.isProd, crossSite: env.SESSION_TRANSPORT === 'header' }));
  app.use(corsPolicy(env.CORS_ORIGINS));
  app.use(d.limiters.global);
  app.use(jsonBody());
  app.use(cookieParser());
  app.use(csrfGuard(env.CORS_ORIGINS, { requireOrigin: env.isProd }));

  app.get('/healthz', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({ status: 'ok' });
  });

  app.use('/v1/public', publicRoutes(d));
  app.use('/v1/img', imageRoutes(d));
  app.use('/v1/customer', customerAuthRoutes(d));
  app.use('/v1/customer', customerRoutes(d));
  app.use('/v1/vendor', vendorAuthRoutes(d));
  app.use('/v1/vendor', vendorRoutes(d));

  app.use(notFoundHandler);
  app.use(errorHandler(d.logger));
  return app;
}
