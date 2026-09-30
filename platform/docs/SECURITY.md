# Security

What protects RozBazaar now, and what is still open. Keep this file honest: when something
changes, update it in the same commit.

## Controls in place

### Sessions (apps/api/src/security/session.ts)

- **The browser never holds a Supabase token.** After login the API seals `{access, refresh,
user, expiry}` into a cookie:
  - AES-256-GCM with an HKDF-derived key; the purpose ("session:customer", "session:vendor",
    "oauth") is bound as associated data, so one cookie can't be replayed as another.
  - `HttpOnly`, `SameSite=Lax`, `Path=/`.
  - In production also `Secure` with the `__Host-` prefix (host-only, cannot be set by a
    subdomain).
- **Separate sessions** for customers (`rb_c`, 60 days) and vendors (`rb_v`, 30 days). A customer
  cookie is useless on vendor routes.
- **Tampered, expired or wrong-audience cookies** are rejected and cleared. When the refresh token
  is revoked, the session ends.
- **Key rotation:** set the new `SESSION_SECRET` and keep the old one in
  `SESSION_SECRET_PREVIOUS`. Old cookies still open, and are resealed with the new key.
- **Google login** is server-side PKCE. The verifier and return path live in a sealed
  10-minute `rb_oauth` cookie. `returnTo` only accepts same-site paths (no `//`, `/\`, absolute
  URLs or CR/LF).
- **The vendor login email** (the vendor's Google address) is looked up on the server with the
  service key and never sent to the browser. The old app returned it to anyone who typed a phone
  number.

### Requests (apps/api/src/app.ts, security/*)

- **CORS:** only the configured app origins, with credentials. Production refuses `*` and
  non-https origins at boot.
- **CSRF:**
  - Every state-changing request must carry `X-Requested-With: rozbazaar`. A custom header forces
    a CORS preflight, which a foreign site cannot pass.
  - Its `Origin`/`Referer` must be an allowed app.
  - This sits on top of SameSite=Lax cookies.
- **Rate limits** (per IP unless noted):

  | what                      | limit                                                                    |
  | ------------------------- | ------------------------------------------------------------------------ |
  | everything                | 300 requests/min                                                         |
  | customer login            | 20 per 15 min per IP, and 8 per hour per phone                           |
  | vendor wrong passwords    | 10 per 15 min per IP, and 5 per 15 min per phone (successes don't count) |
  | delivery-code guesses     | 8 per 15 min per order+IP (the DB also counts attempts)                  |
  | bookings                  | 20 per hour                                                              |
  | contact, waitlist, visits | 10 per hour                                                              |
  | password changes          | 5 per hour                                                               |
  | push receipts             | 240 per hour                                                             |

- **Validation:** zod on every body, query and param. Unknown keys are dropped. JSON bodies are
  capped at 32 KB (600 KB for photo uploads only).
- **Uploads:** photos must be real JPEG/PNG/WebP. Magic bytes are checked, not the declared type.
  The vendor app re-encodes photos on the phone, which also strips EXIF/GPS.
- **Headers:**
  - API: `default-src 'none'`, `frame-ancestors 'none'`, nosniff, no referrer, HSTS in
    production, and `Cache-Control: no-store` on every personal response. `X-Powered-By` and ETags
    are off.
- **Errors:** the same JSON shape every time, with a request ID. Stack traces and upstream details
  are never sent.
- **Logs:** pino, structured. Cookies, auth headers, passwords, tokens and OTPs are redacted.
- **Config:** the API refuses to start in production without https URLs, explicit CORS origins,
  a ≥32-character session secret and the service key.

### Database (database/migrations/20260930a_security_hardening.sql — applied 30 Sep 2026)

- Anonymous callers can no longer run:
  - the booking function;
  - admin catalogue/product/message functions;
  - vendor product, slot and earnings functions;
  - `can_read_staff_file`;
  - `vendor_login_email`.
- `rls_auto_enable` can't be run by anyone.
- `admin_areas()` now calls `admin_guard()` (it had no guard).
- New `customer_me()` (login required) and `product_image(id)` (public photo lookup for the image
  cache).
- Unchanged: every table has RLS, and every RPC decides who you are from the token
  (`my_customer_id()`, `my_vendor_id()`, `is_admin()`).

### Web apps

- **Strict CSP**, written into `.htaccess` by the build:
  - `script-src 'self'`, `style-src 'self'` (no inline code at all).
  - `connect-src` = own site + API.
  - `frame-ancestors 'none'`.
  - Plus HSTS, nosniff, `X-Frame-Options: DENY`, Permissions-Policy and COOP.
- **ESLint** forbids `dangerouslySetInnerHTML`. React escapes everything else.
- **Login redirects** (`?next=`) are checked by `safeNext` (same-site paths only).
- **Service workers:**
  - Only accept an https (or localhost) API origin.
  - Only track notification IDs that are UUIDs.
  - The customer worker only opens same-site paths from a push.
- **`localStorage`** holds only language, village and basket — nothing secret.
- **Dependencies:** `npm audit` reports 0 known vulnerabilities (30 Sep 2026).

### Tests that guard this (apps/api/test/security.test.ts)

- headers
- CORS
- CSRF (header and foreign origin)
- validation, oversize and malformed bodies
- cookie flags
- no JWT in cookies
- tampered cookies cleared
- token refresh and logout
- vendor login never leaking the email
- rate-limit lockout
- PKCE state
- open redirects
- crypto (purpose binding, rotation)
- image sniffing
- production config refusal
- push receipts

Mutation-checked: switching the CSRF guard off makes tests fail.

## Still open — decide / do these

| #   | risk                                                                                                                        | why it's open                                                                                                         | what to do                                                                                                                                         |
| --- | --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Customer phone login has no OTP.** Whoever types a number gets that account (orders, saved addresses).                    | Founder's decision (face-to-face village delivery). Rate limits slow abuse but can't stop someone who knows a number. | Add SMS/WhatsApp OTP (e.g. MSG91) when ready. The API's `POST /v1/customer/auth/phone` is the single place to add it.                              |
| 2   | Anonymous Supabase sign-ups are enabled (phone login uses them). A script could create many empty users.                    | Needed for phone login.                                                                                               | Turn on Supabase Auth CAPTCHA (Turnstile/hCaptcha), or move phone login to the API with OTP (#1).                                                  |
| 3   | `vendor_login_lookup` is still callable anonymously and returns the login email.                                            | The old vendor site (`vendor-site/`) still calls it from the browser.                                                 | After the new vendor app is live: `revoke execute on function public.vendor_login_lookup(text) from anon, public;` (the API uses the service key). |
| 4   | Edge function `send-push` has `verify_jwt=false`, so anyone can call it.                                                    | Pre-existing.                                                                                                         | Require a secret header, checked against `app_settings`, in the function.                                                                          |
| 5   | Rate limits are in memory, per API instance.                                                                                | Fine for one API instance.                                                                                            | Use a Redis store if the API ever runs on 2+ instances.                                                                                            |
| 6   | The **old** apps (single HTML files) are still live and keep their weaknesses (tokens in `localStorage`, direct RPC calls). | The React apps are ready but not yet deployed.                                                                        | Cut over (DEPLOY.md), then retire `customer/index.html` and `vendor-site/`.                                                                        |
| 7   | Staff and admin sites still talk to Supabase directly (supabase-js, tokens in the browser).                                 | Not part of this rebuild.                                                                                             | Same pattern: add `/v1/staff` and `/v1/admin` modules to the API and React apps for them.                                                          |
| 8   | Supabase's raw Auth API lets a logged-in user change their own password (bypassing admin approval).                         | Supabase behaviour.                                                                                                   | With the new apps users never hold a token, so they can't. Stays open for the staff/admin sites until #7.                                          |
