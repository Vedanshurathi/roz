/* ============================================================
   Every admin API route, security header, and the signed-cookie
   session — shared verbatim by both entry points:

     server.js               → traditional Node host (Render, Railway,
                                Fly.io, a VPS). Full control, always on.
     netlify/functions/api.js → Netlify Functions (serverless). Same
                                code, cold-starts, sleeps between calls.

   Security posture:
   - Password is never stored or compared in plaintext — only a
     bcrypt hash (ADMIN_PASSWORD_HASH), generated once via
     `npm run make-password`.
   - Missing ADMIN_PASSWORD_HASH or SESSION_SECRET fails CLOSED:
     every request is rejected, rather than silently falling back
     to a guessable default. A misconfigured admin panel should be
     unreachable, not insecure-but-working.
   - Every login attempt (success or failure) is logged with a
     timestamp and the caller's IP, for later review in whatever
     log viewer the host provides.
   ============================================================ */
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const express = require('express');
const store = require('./store');

const PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || '';
const SECRET = process.env.SESSION_SECRET || '';
const CONFIGURED = !!(PASSWORD_HASH && SECRET);

if (!CONFIGURED) {
  console.error('\n  ⚠️  ADMIN NOT CONFIGURED — every request will be rejected.');
  if (!PASSWORD_HASH) console.error('     Missing ADMIN_PASSWORD_HASH — run: npm run make-password');
  if (!SECRET)        console.error('     Missing SESSION_SECRET — set any long random string');
  console.error('  This is intentional: an unconfigured admin panel must stay locked, not fall back to a weak default.\n');
}

function log(event, req, extra = '') {
  const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip || 'unknown';
  console.log(`[admin-auth] ${new Date().toISOString()} ${event} ip=${ip} ${extra}`.trim());
}

const sign = v => v + '.' + crypto.createHmac('sha256', SECRET).update(v).digest('hex').slice(0, 32);
const verify = c => {
  if (!CONFIGURED || !c) return false;
  const i = c.lastIndexOf('.');
  if (i < 0) return false;
  const v = c.slice(0, i);
  return sign(v) === c && Number(v) > Date.now();
};
const cookieOf = (req, name) => (req.headers.cookie || '')
  .split(';').map(s => s.trim()).find(s => s.startsWith(name + '='))?.slice(name.length + 1);

function requireAuth(req, res, next) {
  if (verify(decodeURIComponent(cookieOf(req, 'rb_admin') || ''))) return next();
  res.status(401).json({ ok: false, error: CONFIGURED ? 'unauthorised' : 'admin not configured — see server logs' });
}

const hits = new Map();
function loginLimit(req, res, next) {
  const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip || 'x';
  const now = Date.now();
  const rec = hits.get(ip) || { n: 0, t: now };
  if (now - rec.t > 15 * 60_000) { rec.n = 0; rec.t = now; }
  rec.n++; hits.set(ip, rec);
  if (rec.n > 10) { log('RATE_LIMITED', req); return res.status(429).json({ ok: false, error: 'Too many attempts. Wait 15 minutes.' }); }
  next();
}

const wrap = fn => async (req, res) => {
  try { res.json({ ok: true, data: await fn(req) }); }
  catch (e) { res.status(400).json({ ok: false, error: e.message }); }
};

/* Builds the router mounted at "/api" by server.js and at the
   function root by netlify/functions/api.js. Routes are written
   WITHOUT the /api prefix so both mounts work unchanged. */
function buildRouter() {
  const router = express.Router();
  router.use(express.json({ limit: '256kb' }));

  router.use((req, res, next) => {
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(self), camera=(), microphone=()');
    next();
  });

  router.post('/login', loginLimit, async (req, res) => {
    if (!CONFIGURED) return res.status(503).json({ ok: false, error: 'Admin panel is not configured yet — see server logs.' });
    const given = String(req.body?.password || '');
    let ok = false;
    try { ok = given.length > 0 && await bcrypt.compare(given, PASSWORD_HASH); } catch (e) { ok = false; }
    if (!ok) { log('LOGIN_FAILED', req); return res.status(401).json({ ok: false, error: 'Wrong password' }); }
    log('LOGIN_OK', req);
    const exp = String(Date.now() + 8 * 3600_000);
    res.setHeader('Set-Cookie',
      `rb_admin=${encodeURIComponent(sign(exp))}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${8 * 3600}` +
      (req.secure || req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : ''));
    res.json({ ok: true });
  });
  router.post('/logout', (req, res) => {
    log('LOGOUT', req);
    res.setHeader('Set-Cookie', 'rb_admin=; HttpOnly; Path=/; Max-Age=0');
    res.json({ ok: true });
  });
  router.get('/me', (req, res) =>
    res.json({ ok: verify(decodeURIComponent(cookieOf(req, 'rb_admin') || '')),
               configured: CONFIGURED,
               mode: store.USE_SUPABASE ? 'supabase' : 'mock' }));

  router.get ('/snapshot',              requireAuth, wrap(()  => store.snapshot()));
  router.post('/vendors',               requireAuth, wrap(r => store.addVendor(r.body)));
  router.post('/vendors/:id/review',    requireAuth, wrap(r => store.reviewVendor(r.params.id, r.body.decision)));
  router.post('/customers/:id/block',   requireAuth, wrap(r => store.blockCustomer(r.params.id, !!r.body.blocked)));
  router.post('/bookings/:id/resolve',  requireAuth, wrap(r => store.resolveBooking(r.params.id)));
  router.post('/areas/point',           requireAuth, wrap(r => store.setAreaPoint(r.body.name, r.body.lat, r.body.lng)));
  router.post('/products/:id/review',   requireAuth, wrap(r => store.reviewProduct(r.params.id, r.body.decision, r.body.note)));
  router.get ('/products',              requireAuth, wrap(()  => store.allProducts()));
  router.post('/products/:id/update',   requireAuth, wrap(r => store.updateProduct(r.params.id, r.body.price, r.body.in_stock)));
  router.get ('/messages',              requireAuth, wrap(()  => store.allMessages()));
  router.post('/messages/:id/read',     requireAuth, wrap(r => store.markMessageRead(r.params.id, r.body.read)));
  router.post('/areas',                 requireAuth, wrap(r => store.addArea(r.body.name, r.body.active)));

  return router;
}

module.exports = { buildRouter, store, CONFIGURED };
