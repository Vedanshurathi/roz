/**
 * Local development without touching production: starts the fake Supabase and the real API
 * wired to it. `npm run dev:mock` in apps/api, then run the customer and vendor apps.
 *
 * Demo vendor login: phone 8198941588, password sabzi1234.
 */
import { startFakeSupabase, SANJIV_PASSWORD, SANJIV_PHONE } from './fake-supabase.js';
import { loadEnv } from '../config/env.js';
import { buildDeps, createApp } from '../app.js';

const fake = await startFakeSupabase({ port: Number(process.env.FAKE_SUPABASE_PORT ?? 54321) });
const env = loadEnv({
  ...process.env,
  NODE_ENV: 'development',
  SUPABASE_URL: fake.url,
  SUPABASE_ANON_KEY: fake.anonKey,
  SUPABASE_SERVICE_ROLE_KEY: fake.serviceKey,
  SESSION_SECRET: process.env.SESSION_SECRET ?? 'dev-only-secret-dev-only-secret-dev-only-secret',
  PUBLIC_API_URL: process.env.PUBLIC_API_URL ?? 'http://localhost:8080',
  CUSTOMER_APP_URL: process.env.CUSTOMER_APP_URL ?? 'http://localhost:5173',
  VENDOR_APP_URL: process.env.VENDOR_APP_URL ?? 'http://localhost:5174',
  CORS_ORIGINS: process.env.CORS_ORIGINS ?? 'http://localhost:5173,http://localhost:5174',
  TRUST_PROXY: '0',
});
const deps = buildDeps(env);
createApp(deps).listen(env.PORT, () => {
  deps.logger.info(`Mock stack: API http://localhost:${env.PORT} → fake Supabase ${fake.url}`);
  deps.logger.info(`Demo vendor login: ${SANJIV_PHONE} / ${SANJIV_PASSWORD}`);
});
