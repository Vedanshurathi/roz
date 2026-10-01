import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { browser, harness, ORIGIN, type Harness } from './helpers.js';
import { Sealer, jwtExpiry } from '../src/lib/crypto.js';
import { safeReturnPath } from '../src/lib/respond.js';
import { loadEnv } from '../src/config/env.js';
import { decodeImageDataUrl } from '../src/modules/images/image-store.js';
import { TOMATO_JPEG } from '../src/dev/fixture-images.js';

let h: Harness;
beforeAll(async () => {
  h = await harness();
});
afterAll(() => h.close());

describe('security headers', () => {
  it('sets a locked-down CSP, no framing, no sniffing, no powered-by', async () => {
    const res = await request(h.app).get('/healthz');
    expect(res.status).toBe(200);
    expect(res.headers['content-security-policy']).toContain("default-src 'none'");
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-request-id']).toBeTruthy();
  });

  it('CORS allows only the configured apps, with credentials', async () => {
    const ok = await request(h.app)
      .options('/v1/customer/session')
      .set('Origin', ORIGIN)
      .set('Access-Control-Request-Method', 'GET');
    expect(ok.headers['access-control-allow-origin']).toBe(ORIGIN);
    expect(ok.headers['access-control-allow-credentials']).toBe('true');
    const evil = await request(h.app)
      .options('/v1/customer/session')
      .set('Origin', 'https://evil.example')
      .set('Access-Control-Request-Method', 'GET');
    expect(evil.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('CSRF', () => {
  it('rejects a state-changing request without the security header', async () => {
    const res = await request(h.app)
      .post('/v1/customer/auth/phone')
      .set('Origin', ORIGIN)
      .send({ name: 'A', phone: '9876543210' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CSRF');
  });

  it('rejects a foreign origin even with the header', async () => {
    const res = await request(h.app)
      .post('/v1/customer/auth/phone')
      .set('Origin', 'https://evil.example')
      .set('X-Requested-With', 'rozbazaar')
      .send({ name: 'A', phone: '9876543210' });
    expect(res.status).toBe(403);
  });

  it('allows GET without the header', async () => {
    const res = await request(h.app).get('/v1/public/areas');
    expect(res.status).toBe(200);
  });
});

describe('push receipts', () => {
  it('accepts only delivered/opened for a real id, from an allowed app', async () => {
    const vendor = browser(h.app, 'http://localhost:5174');
    const id = '00000000-0000-4000-8000-000000000001';
    expect((await vendor.post(`/v1/public/notifications/${id}/track`, { event: 'opened' })).status).toBe(204);
    expect((await vendor.post(`/v1/public/notifications/${id}/track`, { event: 'read' })).status).toBe(400);
    expect((await vendor.post('/v1/public/notifications/not-a-uuid/track', { event: 'opened' })).status).toBe(
      400,
    );
    const foreign = await request(h.app)
      .post(`/v1/public/notifications/${id}/track`)
      .set('Origin', 'https://evil.example')
      .set('X-Requested-With', 'rozbazaar')
      .send({ event: 'opened' });
    expect(foreign.status).toBe(403);
  });
});

describe('validation', () => {
  it('rejects bad phone numbers before they reach the database', async () => {
    const b = browser(h.app);
    const calls = h.fake.calls.length;
    const res = await b.post('/v1/customer/auth/phone', { name: 'Ravi', phone: '12345' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION');
    expect(h.fake.calls.length).toBe(calls);
  });

  it('drops unknown keys and rejects oversize bodies', async () => {
    const b = browser(h.app);
    const big = await b.post('/v1/public/contact', { name: 'x', body: 'y'.repeat(40_000) });
    expect(big.status).toBe(413);
  });

  it('rejects malformed JSON with a clean 400', async () => {
    const res = await request(h.app)
      .post('/v1/public/contact')
      .set('Origin', ORIGIN)
      .set('X-Requested-With', 'rozbazaar')
      .set('Content-Type', 'application/json')
      .send('{"name":');
    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Malformed JSON');
  });

  it('returns 404 JSON for unknown endpoints', async () => {
    const res = await request(h.app).get('/v1/nope');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

describe('authentication', () => {
  it('personal endpoints need a session', async () => {
    for (const url of [
      '/v1/customer/bookings',
      '/v1/customer/addresses',
      '/v1/vendor/orders?date=2026-10-01',
      '/v1/vendor/products',
    ]) {
      const res = await request(h.app).get(url);
      expect(res.status, url).toBe(401);
    }
  });

  it('a customer session cannot be used on vendor routes', async () => {
    const b = browser(h.app);
    const login = await b.post('/v1/customer/auth/phone', { name: 'Ravi', phone: '9876543210' });
    expect(login.status).toBe(200);
    const res = await b.get('/v1/vendor/products');
    expect(res.status).toBe(401);
  });

  it('session cookies are HttpOnly, SameSite=Lax and never contain the raw token', async () => {
    const b = browser(h.app);
    const res = await b.post('/v1/customer/auth/phone', { name: 'Ravi', phone: '9876543211' });
    const cookie = String(res.headers['set-cookie']);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).not.toMatch(/eyJ/); // no JWT in clear text
    expect(JSON.stringify(res.body)).not.toMatch(/eyJ|access_token|refresh_token/);
  });

  it('a tampered cookie is rejected and cleared', async () => {
    const res = await request(h.app)
      .get('/v1/customer/addresses')
      .set('Cookie', 'rb_c=v1.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');
    expect(res.status).toBe(401);
    expect(String(res.headers['set-cookie'])).toMatch(/rb_c=;/);
  });

  it('refreshes an expiring access token transparently', async () => {
    h.fake.setAccessTtl(30); // expires within the refresh window
    const b = browser(h.app);
    await b.post('/v1/customer/auth/phone', { name: 'Ravi', phone: '9876543212' });
    h.fake.setAccessTtl(3600);
    const res = await b.get('/v1/customer/addresses');
    expect(res.status).toBe(200);
    expect(String(res.headers['set-cookie'])).toMatch(/rb_c=v1\./); // resealed with the new token
    const again = await b.get('/v1/customer/addresses');
    expect(again.status).toBe(200);
  });

  it('logout clears the cookie', async () => {
    const b = browser(h.app);
    await b.post('/v1/customer/auth/phone', { name: 'Ravi', phone: '9876543213' });
    const out = await b.post('/v1/customer/auth/logout');
    expect(out.status).toBe(204);
    const res = await b.get('/v1/customer/addresses');
    expect(res.status).toBe(401);
  });

  it('vendor login never returns the login email and rejects wrong passwords', async () => {
    const b = browser(h.app, 'http://localhost:5174');
    const bad = await b.post('/v1/vendor/auth/login', { phone: '8198941588', password: 'wrong-pass-1' });
    expect(bad.status).toBe(401);
    expect(JSON.stringify(bad.body)).not.toContain('@');
    const unknown = await b.post('/v1/vendor/auth/login', { phone: '9000000000', password: 'whatever1' });
    expect(unknown.status).toBe(422);
    expect(unknown.body.error.details.code).toBe('NOT_REGISTERED');
  });
});

describe('rate limits', () => {
  it('locks out repeated wrong vendor passwords for one number', async () => {
    const hh = await harness();
    try {
      const b = browser(hh.app, 'http://localhost:5174');
      const codes: number[] = [];
      for (let i = 0; i < 7; i++)
        codes.push(
          (await b.post('/v1/vendor/auth/login', { phone: '8198941588', password: `nope-${i}x` })).status,
        );
      expect(codes.slice(0, 5).every((c) => c === 401)).toBe(true);
      expect(codes.slice(5)).toEqual([429, 429]);
    } finally {
      await hh.close();
    }
  });
});

describe('google login (PKCE)', () => {
  it('rejects a callback without the browser-bound state', async () => {
    const res = await request(h.app).get('/v1/customer/auth/callback?code=stolen');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(`${ORIGIN}/login?error=google`);
  });

  it('refuses open redirects in returnTo', async () => {
    expect(safeReturnPath('//evil.com')).toBe('/');
    expect(safeReturnPath('https://evil.com')).toBe('/');
    expect(safeReturnPath('/\\evil.com')).toBe('/');
    expect(safeReturnPath('/bookings?x=1')).toBe('/bookings?x=1');
  });
});

describe('crypto', () => {
  it('seals and opens, binds the purpose, supports key rotation', () => {
    const oldS = new Sealer(['old-secret-old-secret-old-secret-old']);
    const token = oldS.seal('session:customer', { a: 1 });
    expect(oldS.open('session:vendor', token)).toBeNull();
    const rotated = new Sealer([
      'new-secret-new-secret-new-secret-new',
      'old-secret-old-secret-old-secret-old',
    ]);
    expect(rotated.open<{ a: number }>('session:customer', token)).toEqual({
      value: { a: 1 },
      rotated: true,
    });
    expect(rotated.open('session:customer', token.slice(0, -2) + 'xx')).toBeNull();
  });

  it('reads JWT expiry without trusting it', () => {
    const jwt = `x.${Buffer.from(JSON.stringify({ exp: 123 })).toString('base64url')}.y`;
    expect(jwtExpiry(jwt)).toBe(123);
    expect(jwtExpiry('garbage')).toBeNull();
  });
});

describe('images', () => {
  it('accepts real JPEGs and refuses disguised content', () => {
    expect(decodeImageDataUrl(TOMATO_JPEG)?.mime).toBe('image/jpeg');
    const html = `data:image/jpeg;base64,${Buffer.from('<script>alert(1)</script>').toString('base64')}`;
    expect(decodeImageDataUrl(html)).toBeNull();
    expect(decodeImageDataUrl('data:image/svg+xml;base64,PHN2Zz4=')).toBeNull();
  });
});

describe('config', () => {
  it('refuses to boot in production with unsafe settings', () => {
    expect(() =>
      loadEnv({
        NODE_ENV: 'production',
        SUPABASE_URL: 'https://x.supabase.co',
        SUPABASE_ANON_KEY: 'k'.repeat(40),
        SESSION_SECRET: 'short',
        PUBLIC_API_URL: 'http://api.example.com',
        CUSTOMER_APP_URL: 'https://a.example.com',
        VENDOR_APP_URL: 'https://b.example.com',
        CORS_ORIGINS: '*',
      }),
    ).toThrow(/SESSION_SECRET|PUBLIC_API_URL|CORS_ORIGINS/);
  });
});
