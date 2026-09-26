/* ============================================================
   RozBazaar Staff — read-only view for employees at /staff.

   Separate from the admin login on purpose:
   - own password (STAFF_PASSWORD_HASH, made with `npm run make-password`)
   - own cookie (rb_staff), signed with the same SESSION_SECRET
   - only ONE data route, GET /api/staff/snapshot, and it can't change anything
   - the snapshot is trimmed: no delivery OTPs, no house address, no GPS
   Missing STAFF_PASSWORD_HASH fails closed, same as the admin panel.
   ============================================================ */
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const express = require('express');
const store = require('./store');

const PASSWORD_HASH = process.env.STAFF_PASSWORD_HASH || '';
const SECRET = process.env.SESSION_SECRET || '';
const CONFIGURED = !!(PASSWORD_HASH && SECRET);
const HOURS = 12;

if (!CONFIGURED) {
  console.error('  ⚠️  STAFF APP NOT CONFIGURED — /staff login is locked.' +
    (PASSWORD_HASH ? '' : ' Missing STAFF_PASSWORD_HASH (run: npm run make-password).') +
    (SECRET ? '' : ' Missing SESSION_SECRET.'));
}

function log(event, req) {
  const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip || 'unknown';
  console.log(`[staff-auth] ${new Date().toISOString()} ${event} ip=${ip}`);
}

/* 'staff:' prefix so an admin cookie value can never pass as a staff one, or the reverse */
const sign = v => v + '.' + crypto.createHmac('sha256', SECRET).update('staff:' + v).digest('hex').slice(0, 32);
const verify = c => {
  if (!CONFIGURED || !c) return false;
  const i = c.lastIndexOf('.');
  if (i < 0) return false;
  const v = c.slice(0, i);
  const want = sign(v);
  return want.length === c.length &&
    crypto.timingSafeEqual(Buffer.from(want), Buffer.from(c)) && Number(v) > Date.now();
};
const cookieOf = (req, name) => (req.headers.cookie || '')
  .split(';').map(s => s.trim()).find(s => s.startsWith(name + '='))?.slice(name.length + 1);
const signedIn = req => verify(decodeURIComponent(cookieOf(req, 'rb_staff') || ''));

const hits = new Map();
function loginLimit(req, res, next) {
  const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip || 'x';
  const now = Date.now();
  const rec = hits.get(ip) || { n: 0, t: now };
  if (now - rec.t > 15 * 60_000) { rec.n = 0; rec.t = now; }
  rec.n++; hits.set(ip, rec);
  if (rec.n > 10) { log('RATE_LIMITED', req); return res.status(429).json({ ok: false, error: '15 minute baad try karo' }); }
  next();
}

function buildStaffRouter() {
  const router = express.Router();
  router.use(express.json({ limit: '16kb' }));
  router.use((req, res, next) => {
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  router.post('/login', loginLimit, async (req, res) => {
    if (!CONFIGURED) return res.status(503).json({ ok: false, error: 'Staff login abhi set nahi hua — admin se bolo' });
    const given = String(req.body?.password || '');
    let ok = false;
    try { ok = given.length > 0 && await bcrypt.compare(given, PASSWORD_HASH); } catch (e) { ok = false; }
    if (!ok) { log('LOGIN_FAILED', req); return res.status(401).json({ ok: false, error: 'Password galat hai' }); }
    log('LOGIN_OK', req);
    const exp = String(Date.now() + HOURS * 3600_000);
    res.setHeader('Set-Cookie',
      `rb_staff=${encodeURIComponent(sign(exp))}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${HOURS * 3600}` +
      (req.secure || req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : ''));
    res.json({ ok: true });
  });
  router.post('/logout', (req, res) => {
    res.setHeader('Set-Cookie', 'rb_staff=; HttpOnly; Path=/; Max-Age=0');
    res.json({ ok: true });
  });
  router.get('/me', (req, res) =>
    res.json({ ok: signedIn(req), configured: CONFIGURED, mode: store.USE_SUPABASE ? 'supabase' : 'mock' }));

  router.get('/snapshot', async (req, res) => {
    if (!signedIn(req)) return res.status(401).json({ ok: false, error: 'unauthorised' });
    try { res.json({ ok: true, data: await store.staffSnapshot() }); }
    catch (e) { res.status(400).json({ ok: false, error: e.message }); }
  });

  return router;
}

module.exports = { buildStaffRouter };
