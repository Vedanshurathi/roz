/**
 * Shared helpers for the browser journeys. They drive the real apps against the real API, which
 * talks to the fake Supabase (npm run dev:mock) — never production.
 */
import { chromium, request } from 'playwright';
import { existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const URLS = {
  api: process.env.E2E_API ?? 'http://localhost:8080',
  customer: process.env.E2E_CUSTOMER ?? 'http://localhost:5173',
  vendor: process.env.E2E_VENDOR ?? 'http://localhost:5174',
};
export const SHOTS = fileURLToPath(new URL('./shots/', import.meta.url));
mkdirSync(SHOTS, { recursive: true });

/** Demo vendor seeded in the fake Supabase (apps/api/src/dev/fake-supabase.ts). */
export const DEMO_VENDOR = { phone: '8198941588', password: 'sabzi1234' };

export const istDate = (offset = 0) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(
    new Date(Date.now() + offset * 864e5),
  );
export const randomPhone = (prefix = '98') =>
  prefix + String(Math.floor(1e7 + Math.random() * 89999999)).slice(0, 10 - prefix.length);

/** A phone-sized browser. Collects page errors and console errors (CSP violations show up there). */
export async function phone(name) {
  const executablePath = existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;
  const browser = await chromium.launch({ executablePath });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror ${e.message}`));
  page.on('console', (m) => {
    // 4xx responses are expected in the negative steps (wrong password, wrong code).
    if (m.type() === 'error' && !/status of 4\d\d/.test(m.text())) errors.push(`console ${m.text()}`);
  });
  const shot = (n) => page.screenshot({ path: `${SHOTS}${name}-${n}.png` });
  const step = async (label, fn) => {
    try {
      await fn();
    } catch (e) {
      await shot(`FAIL-${label.replace(/\W+/g, '-')}`).catch(() => undefined);
      throw new Error(`${name} › ${label}: ${e.message}`, { cause: e });
    }
  };
  return { browser, page, errors, shot, step, close: () => browser.close() };
}

/** An API client that behaves like one of our apps (allowed Origin + the CSRF header). */
export const apiAs = (origin) =>
  request.newContext({
    baseURL: URLS.api,
    extraHTTPHeaders: { Origin: origin, 'X-Requested-With': 'rozbazaar' },
  });

export async function ok(res, what) {
  if (!res.ok()) throw new Error(`${what}: ${res.status()} ${await res.text()}`);
  return (await res.json().catch(() => ({}))).data;
}
