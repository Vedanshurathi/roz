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
    if (m.type() === 'error' && !/status of 4\d\d|Push API in incognito/.test(m.text()))
      errors.push(`console ${m.text()}`);
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

/**
 * Customer: from Home, puts Sanjiv's tomato + potato in the basket, books tomorrow morning with a
 * phone login and a new address. Returns the delivery code shown on the success screen.
 */
export async function customerBooks(p, { name, phonePrefix, house, shot = async () => undefined }) {
  await p.context().grantPermissions(['notifications', 'geolocation'], { origin: URLS.customer });
  await p.addInitScript(() => {
    try {
      sessionStorage.setItem('rbx.locAsked', '1');
    } catch {
      /* ignore */
    }
  });
  await p.goto(URLS.customer + '/');
  await p.waitForSelector('#homeGrid .pcard');
  await shot('01-home');
  // Tomato is sold by two vendors → the picker opens.
  await p.locator('#homeGrid .pcard', { hasText: 'Tomato' }).first().locator('.add').click();
  await p.waitForSelector('.loc-ask.on .vcard');
  await shot('02-vendor-picker');
  await p.locator('.loc-ask.on .vcard', { hasText: 'Sanjiv' }).click();
  await p.waitForTimeout(900);
  await p.locator('#homeGrid .pcard', { hasText: 'Potato' }).locator('.add').click();
  await p.waitForTimeout(900);
  // Geeta's apple: added with a "different vendor" warning (as in the original app), then removed.
  await p.locator('#homeGrid .pcard', { hasText: 'Apple' }).locator('.add').click();
  await p.waitForSelector('.toast.show:has-text("different vendor")');
  await p.waitForTimeout(900);
  await p.locator('#cartIn').click();
  await p.waitForURL(/basket/);
  await p.locator('.brow', { hasText: 'Apple' }).locator('.qty button').first().click();
  await p.fill('#vnote', 'Green gate, ring twice');
  await shot('03-basket');
  await p.getByRole('button', { name: 'Confirm booking' }).click();
  await p.waitForURL(/slot/);
  await p.locator('#days .day-pill').nth(1).click();
  await p.locator('#slotList .slot', { hasText: 'Morning' }).click();
  await p.locator('#slotGo').click();
  await p.waitForURL(/basket/);
  await p.getByRole('button', { name: 'Confirm booking' }).click();
  await p.waitForURL(/login/);
  await p.fill('#inName', name);
  await p.fill('#inPhone', randomPhone(phonePrefix));
  await p.locator('#phoneLoginBtn').click();
  await p.waitForURL(/address\/new/);
  await p.locator('#aArea').selectOption('Khandewla');
  await p.fill('#aHouse', house);
  await p.fill('#aLand', 'Near Hanuman temple');
  await shot('04-address');
  await p.getByRole('button', { name: /Save address/ }).click();
  await p.waitForURL(/success/);
  const otp = (await p.locator('#sucOtp').textContent())?.trim() ?? '';
  if (!/^\d{4}$/.test(otp)) throw new Error(`no delivery code on success page: ${otp}`);
  return otp;
}
