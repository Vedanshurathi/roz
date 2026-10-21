/**
 * SESSION_TRANSPORT=header — the API on Supabase Edge Functions (a different site from the apps,
 * so cross-site cookies are not an option). The sealed session travels in X-RB-Session.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { harness, ORIGIN, VENDOR_ORIGIN, type Harness } from './helpers.js';

const BETA = 'http://localhost:5175';
const H = 'x-rb-session';
let h: Harness;

beforeAll(async () => {
  h = await harness({
    limitScale: 50,
    env: { SESSION_TRANSPORT: 'header', CORS_ORIGINS: `${ORIGIN},${VENDOR_ORIGIN},${BETA}` },
  });
});
afterAll(() => h.close());

const send = (t: request.Test, origin = ORIGIN) =>
  t.set('Origin', origin).set('X-Requested-With', 'rozbazaar');

describe('header sessions', () => {
  it('phone login returns the session in X-RB-Session, never as a cookie', async () => {
    const res = await send(request(h.app).post('/v1/customer/auth/phone')).send({
      name: 'Edge Test',
      phone: '9811100001',
    });
    expect(res.status).toBe(200);
    expect(res.headers['set-cookie']).toBeUndefined();
    const token = res.headers[H] as string;
    expect(token).toMatch(/^v1\./);
    expect(token).not.toMatch(/eyJ/); // no readable JWT inside

    const me = await send(request(h.app).get('/v1/customer/session')).set('X-RB-Session', token);
    expect(me.body.data).toMatchObject({
      authenticated: true,
      user: { name: 'Edge Test', phone: '9811100001' },
    });

    const anon = await send(request(h.app).get('/v1/customer/session'));
    expect(anon.body.data.authenticated).toBe(false);
  });

  it('a tampered token is refused and the app is told to forget it', async () => {
    const login = await send(request(h.app).post('/v1/customer/auth/phone')).send({
      name: 'Tamper',
      phone: '9811100002',
    });
    const bad = (login.headers[H] as string).slice(0, -3) + 'abc';
    const res = await send(request(h.app).get('/v1/customer/session')).set('X-RB-Session', bad);
    expect(res.body.data.authenticated).toBe(false);
    expect(res.headers[H]).toBe('cleared');
  });

  it('a customer token is useless on vendor routes', async () => {
    const login = await send(request(h.app).post('/v1/customer/auth/phone')).send({
      name: 'Cross',
      phone: '9811100003',
    });
    const res = await send(request(h.app).get('/v1/vendor/me'), VENDOR_ORIGIN).set(
      'X-RB-Session',
      login.headers[H] as string,
    );
    expect(res.status).toBe(401);
  });

  it('logout clears the stored token', async () => {
    const login = await send(request(h.app).post('/v1/customer/auth/phone')).send({
      name: 'Bye',
      phone: '9811100004',
    });
    const res = await send(request(h.app).post('/v1/customer/auth/logout')).set(
      'X-RB-Session',
      login.headers[H] as string,
    );
    expect(res.status).toBe(204);
    expect(res.headers[H]).toBe('cleared');
  });

  it('CORS lets the apps send and read X-RB-Session', async () => {
    const pre = await request(h.app)
      .options('/v1/customer/session')
      .set('Origin', ORIGIN)
      .set('Access-Control-Request-Method', 'GET')
      .set('Access-Control-Request-Headers', 'x-rb-session,x-requested-with');
    expect(pre.headers['access-control-allow-headers']?.toLowerCase()).toContain('x-rb-session');
    const res = await send(request(h.app).get('/v1/public/areas'));
    expect(res.headers['access-control-expose-headers']?.toLowerCase()).toContain('x-rb-session');
    // product photos are loaded cross-site from the apps
    expect(res.headers['cross-origin-resource-policy']).toBe('cross-origin');
  });

  it('google login comes back to the app that started it, with the session in the fragment', async () => {
    const start = await request(h.app)
      .get('/v1/customer/auth/google?returnTo=/basket')
      .set('Referer', `${BETA}/login`);
    expect(start.status).toBe(302);
    const oauthCookie = (start.headers['set-cookie'] as unknown as string[])
      .map((c) => c.split(';')[0])
      .join('; ');
    // the fake Supabase "Google" approves and redirects to our callback with a code
    const provider = await fetch(start.headers.location as string, { redirect: 'manual' });
    const callback = new URL(provider.headers.get('location')!);
    const done = await request(h.app)
      .get(callback.pathname + callback.search)
      .set('Cookie', oauthCookie);
    expect(done.status).toBe(302);
    const loc = done.headers.location as string;
    expect(loc.startsWith(`${BETA}/basket#rbs=v1.`)).toBe(true);
    const token = loc.split('#rbs=')[1]!;
    const me = await send(request(h.app).get('/v1/customer/session'), BETA).set('X-RB-Session', token);
    expect(me.body.data.authenticated).toBe(true);
  });

  it('an unknown Referer falls back to the configured app', async () => {
    const start = await request(h.app)
      .get('/v1/customer/auth/google')
      .set('Referer', 'https://evil.example/');
    const oauthCookie = (start.headers['set-cookie'] as unknown as string[])
      .map((c) => c.split(';')[0])
      .join('; ');
    const done = await request(h.app).get('/v1/customer/auth/callback?code=nope').set('Cookie', oauthCookie);
    expect(done.headers.location).toBe(`${ORIGIN}/login?error=google`);
  });
});
