import request from 'supertest';
import type { Express } from 'express';
import { startFakeSupabase, type FakeSupabase } from '../src/dev/fake-supabase.js';
import { loadEnv } from '../src/config/env.js';
import { buildDeps, createApp } from '../src/app.js';
import { createLimiters } from '../src/security/rate-limit.js';
import { istDate } from '@rozbazaar/shared';

export const ORIGIN = 'http://localhost:5173';
export const VENDOR_ORIGIN = 'http://localhost:5174';

export interface Harness {
  app: Express;
  fake: FakeSupabase;
  close(): Promise<void>;
}

/** Real API + fake Supabase. `limitScale` > 1 loosens rate limits for flow tests. */
export async function harness(
  opts: { limitScale?: number; prod?: boolean; env?: Record<string, string> } = {},
): Promise<Harness> {
  const fake = await startFakeSupabase();
  const env = loadEnv({
    NODE_ENV: 'test',
    SUPABASE_URL: fake.url,
    SUPABASE_ANON_KEY: fake.anonKey,
    SUPABASE_SERVICE_ROLE_KEY: fake.serviceKey,
    SESSION_SECRET: 'test-secret-test-secret-test-secret-123456',
    PUBLIC_API_URL: 'http://localhost:8080',
    CUSTOMER_APP_URL: ORIGIN,
    VENDOR_APP_URL: VENDOR_ORIGIN,
    CORS_ORIGINS: `${ORIGIN},${VENDOR_ORIGIN}`,
    TRUST_PROXY: '0',
    ...opts.env,
  });
  const deps = buildDeps(env, { limiters: createLimiters(opts.limitScale ?? 1) });
  return { app: createApp(deps), fake, close: () => fake.close() };
}

/** An agent that keeps cookies and sends the headers a real browser app sends. */
export function browser(app: Express, origin = ORIGIN) {
  const agent = request.agent(app);
  const wrap = <T extends request.Test>(t: T) => t.set('Origin', origin).set('X-Requested-With', 'rozbazaar');
  return {
    agent,
    get: (url: string) => wrap(agent.get(url)),
    post: (url: string, body?: object) => wrap(agent.post(url)).send(body ?? {}),
    put: (url: string, body?: object) => wrap(agent.put(url)).send(body ?? {}),
    patch: (url: string, body?: object) => wrap(agent.patch(url)).send(body ?? {}),
    del: (url: string) => wrap(agent.delete(url)),
  };
}

export const tomorrow = () => istDate(1);
