import type { Logger } from 'pino';
import type { Env } from './config/env.js';
import type { RpcGateway } from './supabase/rpc.js';
import type { AuthGateway } from './supabase/auth.js';
import type { SessionManager } from './security/session.js';
import type { Limiters } from './security/rate-limit.js';
import type { ImageStore } from './modules/images/image-store.js';
import type { MapContext } from './modules/mappers.js';

/** Everything a route needs, passed in explicitly (easy to fake in tests). */
export interface Deps {
  env: Env;
  logger: Logger;
  rpc: RpcGateway;
  auth: AuthGateway;
  sessions: SessionManager;
  limiters: Limiters;
  images: ImageStore;
  map: MapContext;
}
