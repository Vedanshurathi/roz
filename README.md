# RozBazaar Admin

Admin console for RozBazaar — vendor approval, product review, customer
management, area coverage, and traffic. **Runs entirely on mock data by
default** and never touches your Supabase project until you switch it on.

## Security — read this before deploying

- **The password is never stored in plaintext.** You generate a bcrypt
  hash once (`npm run make-password`) and only that hash goes in your
  environment. The plaintext password lives nowhere on disk.
- **Fails closed, not open.** If `ADMIN_PASSWORD_HASH` or `SESSION_SECRET`
  aren't set, the server refuses every login — you'll see a loud warning
  in the logs and a clear message in the UI. There is no fallback
  password. A misconfigured admin panel stays locked.
- Signed, HttpOnly, `SameSite=Strict` session cookie. 8-hour expiry.
- Timing-safe bcrypt comparison, 10 login attempts per IP per 15 minutes.
- Every login attempt (success, failure, rate-limited) is logged with a
  timestamp and IP — visible in whatever log viewer your host provides.
- CSP is `script-src 'self'` with **no** `unsafe-inline` — every button
  handler is event-delegated, not inline, so an injected `onclick`
  cannot execute.
- `X-Frame-Options: DENY`, nosniff, restrictive `Permissions-Policy`.
- The Supabase **service-role key** — which bypasses row-level security —
  never leaves this server. It's why this admin is a Node app and not a
  static page: a static page would have to ship that key to the browser.

## Set up your password (do this first)

```bash
npm install
npm run make-password
```

It asks for a password (8+ characters) and prints an `ADMIN_PASSWORD_HASH`
line. Paste that into your `.env` or your host's environment variables.
Then generate a session secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Paste that as `SESSION_SECRET`. Both are required — the server won't
start serving logins without them.

## Run it locally

```bash
cp .env.example .env      # fill in ADMIN_PASSWORD_HASH and SESSION_SECRET
npm start                 # http://localhost:4000
```

## Go live — connect your real data

1. Supabase → Project Settings → API → copy the **service_role** key
2. In `.env` (or your host's environment variables):
   ```
   USE_SUPABASE=true
   SUPABASE_URL=https://srvpfyjmwaruebbkqkdj.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=eyJ...
   ```
3. Restart

`src/store.js` is the only file that knows where data comes from — mock
and live return identical shapes. The header pill reads `MOCK DATA` or
`LIVE DATA` so you always know which you're looking at. There is no
sample or seeded data in the live path — every number you see once
`USE_SUPABASE=true` comes straight from your database.

## Deploying — two real options, both genuinely Node.js

### Option A — a traditional Node host (simplest, always-on)
Render, Railway, or Fly.io all have free tiers that run `server.js`
directly, no changes needed. Set the environment variables above in
their dashboard, deploy the repo, done. This is the option I'd pick —
no cold starts, no serverless quirks.

### Option B — Netlify, as Netlify Functions
Netlify's static hosting cannot run a long-lived Express process, so
this ships as a **serverless function** — still 100% Node.js, just
packaged the way Netlify can actually run it. Both entry points
(`server.js` and `netlify/functions/api.js`) share the exact same
`src/router.js` — identical auth, identical routes, identical security.

**Plain drag-and-drop of this folder onto Netlify's "Deploys" page only
uploads static files.** It doesn't provision the function. Use one of:

- **Git-connected site** (recommended) — push this folder to a GitHub
  repo, connect it in Netlify. It builds the function automatically
  from `netlify.toml` on every push.
- **Netlify CLI** — `npx netlify-cli login`, `npx netlify-cli init` to
  link the site once, then `npm run deploy:netlify` whenever you ship.

Either way, set `ADMIN_PASSWORD_HASH`, `SESSION_SECRET`, `USE_SUPABASE`,
`SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY` under Site settings →
Environment variables. **`SESSION_SECRET` matters even more here** — a
serverless function can cold-start on a fresh instance at any time, and
without it, every request after a cold start would be rejected outright.

## What's in here

- **Overview** — today's numbers, a 14-day sales chart, demand with no
  vendor (villages asking, nobody serving them)
- **Launch readiness** — six live checks on whether the site can take a
  real order right now, and exactly what's blocking it
- **Bookings** — every order, dispute resolution
- **Vendors** — approve/reject applications, add a vendor directly, see
  who's linked to a login and who isn't
- **Products** — a vendor's new item is invisible to every customer
  until approved here. Price/stock edits on already-approved items
  never come back through this queue — only brand-new items do.
- **Customers** — full list, spend, block/unblock, and a flag for the
  same phone number appearing under more than one login (common when
  someone switches Google accounts or moves from guest to signed-in)
- **Areas** — add a village, see coverage, pin real GPS coordinates
- **Traffic** — page-view counts for the customer site and vendor app,
  no cookies, no IP stored, no personal data — just a daily count

## Layout

```
server.js                 traditional Node entry point
netlify/functions/api.js  Netlify Functions entry point
netlify.toml              Netlify build + redirect config
scripts/hash-password.js  generates ADMIN_PASSWORD_HASH — run this first
src/router.js             the ONE place with all routes, auth, headers
src/store.js              the ONE place that knows mock vs. live data
src/mock.js               demo dataset, shaped exactly like real RPCs
public/                   the UI — no build step, no framework
```

## Notes

Mock-mode changes (approve a vendor, block a customer) live in server
memory and reset on restart — demo freely, nothing sticks and nothing
touches Supabase. Nothing in the mock dataset is ever mixed into a live
response; the two paths are completely separate in `src/store.js`.
