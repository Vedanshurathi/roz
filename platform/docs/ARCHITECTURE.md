# Architecture

```
 phone browser / Play app (TWA)
   │  rozbazaar.shop  (customer, static React build on Hostinger)
   │  vendor.rozbazaar.shop  (vendor, static React build on Hostinger)
   │
   │  fetch(credentials: 'include') + X-Requested-With: rozbazaar
   ▼
 api.rozbazaar.shop  — Express API (Hostinger Node.js app)          ← the only thing browsers talk to
   │  encrypted HttpOnly session cookie → user's Supabase access token (refreshed server-side)
   │  POST /rest/v1/rpc/<fn> with that token (or anon / service key where stated)
   ▼
 Supabase (Postgres 17, Mumbai) — SECURITY DEFINER RPCs, RLS on every table, edge functions
```

## Why a backend in front of Supabase

The old single-file apps called Supabase straight from the browser, with the session token in
`localStorage`. This caused four problems:

- Any injected script could read the token.
- Browsers learnt things they shouldn't (e.g. the vendor login email).
- There was no rate limiting and no input validation before the database.
- Every screen shipped as one 400–500 KB HTML file.

The API is a **backend-for-frontend**:

1. **Sessions** — it logs people in with Supabase Auth and keeps the Supabase tokens in an
   AES-256-GCM encrypted, HttpOnly, SameSite=Lax cookie. The browser never sees a JWT. Tokens are
   refreshed on the server when less than 2 minutes remain; concurrent refreshes are de-duplicated.
2. **Validation** — zod schemas from `packages/shared` check every body, query and param. They
   reject bad input with a 400 before it reaches Postgres.
3. **Security controls** — CORS allow-list, CSRF guard, rate limits, security headers, request
   IDs and structured logs with secrets redacted (see SECURITY.md).
4. **Contracts** — rows become typed camelCase objects. Data URLs of vendor photos become cached
   image URLs. `customer_home` went from ~870 KB to a few KB plus cacheable images.

Business rules stay in the database (`match_vendor`, `vendor_covers_area_in_slot`, bill and OTP
rules, commission). The API calls the same RPCs as the old apps, as the logged-in user. Postgres
still decides what that user may do (`my_customer_id()`, `my_vendor_id()`), so a bug in the API
cannot widen access.

## Request flow (example: vendor sends the bill)

1. `BillPage` builds the lines and calls `api.post('/v1/vendor/orders/:id/bill', body)`.
   `packages/web/src/api.ts` adds `X-Requested-With`, `credentials: 'include'` and a 20 s timeout.
2. Express middleware runs in this order: request ID + log → security headers → CORS → global
   rate limit → JSON body (32 KB; 600 KB only for product/profile photo uploads) → cookies → CSRF.
3. `requireSession('vendor')` opens the `rb_v` cookie. It refreshes the access token if needed,
   and clears the cookie if the session is dead.
4. The route validates with `finalizeBillBody` and maps it to `vendor_finalize_bill(p_booking,
p_items)`.
5. `rpc.call()` maps the result:
   - `{ok:false,msg}` → 422 with `details.code`
   - `P0001` → 422
   - `42501` → 403
   - `401` → 401
   - Supabase down or timed out → 502
6. The response is `{ data, message? }`. On an error it is
   `{ error: { code, message, requestId, details? } }`.

## Endpoints

| area          | routes (all under `/v1`)                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| public        | `GET public/areas`, `GET public/areas/locate`, `POST public/visits`, `POST public/contact`, `POST public/waitlist`, `POST public/notifications/:id/track` (push receipts), `GET img/:hash`                                                                                                                                                                                                                                    |
| customer auth | `GET customer/session`, `POST customer/auth/phone`, `PUT customer/profile`, `GET customer/auth/google` → `GET customer/auth/callback`, `POST customer/auth/logout`                                                                                                                                                                                                                                                            |
| customer      | `GET home`, `GET slots`, `GET vendors`, `GET vendors/available`, `GET product-vendors`, `PUT language`, `POST favourites/:id/toggle`, addresses (`GET`, `POST`, `POST :id/default`, `DELETE :id`), bookings (`GET`, `POST`, `GET :id/bill`, `POST :id/approve`, `/dispute`, `/cancel`, `/rating`), `GET last-order`, notifications (`GET`, `POST :id/read`), `POST push-subscriptions`, `POST push/test`, `GET push/test/:id` |
| vendor auth   | `GET vendor/session`, `POST vendor/auth/login`, Google (`auth/google`, `auth/callback`), `POST auth/logout`, `POST apply`, `GET password/status`, `POST password/first`, `POST password/request`, `PUT language`                                                                                                                                                                                                              |
| vendor        | `GET me`, `PATCH profile`, `POST active`, orders (`GET ?date=`, `POST :id/status`, `/bill`, `/payment`, `/verify`), products (`GET`, `POST`, `DELETE :id`, `POST :id/stock`, `POST prices`), `GET catalog`, `POST catalog/activate`, slots (`GET`, `POST capacity`, `GET`/`PUT areas`), `GET stats`, `GET dashboard?from&to`, `GET reviews`, `POST push-subscriptions`                                                        |

## Frontends

- **Vite 8 + React 19 + React Router 8 + TanStack Query 5.** Every screen is lazy-loaded, so the
  first load stays small on village 4G.
- **Data** lives in TanStack Query (`src/api/queries.ts`). Mutations invalidate the queries they
  change. Today's and tomorrow's vendor orders are polled every 20 s, and a new booking shows a
  toast and buzzes the phone. Web push covers the app-closed case.
- **Local state** is only what the device should remember: language, village, and the
  customer's basket (`localStorage`, harmless data only).
- **Route guards**:
  - `RequireLogin` (customer) sends people to `/login?next=`.
  - `RequireVendor` sends people to login or registration.
  - `RequireVendor` also gives pages the vendor through context, so a page can never render
    without one.
- **i18n** — `I18nProvider` + `t(en, hi)`. The chosen language is synced to the account
  (`set_language`) so pushes arrive in the same language.
- **Styling** — tokens and components in `packages/web/src/styles/kit.css` (the rozbazaar-ui
  design system), with a layout stylesheet per app. No inline `<style>`/`<script>`, because the
  CSP forbids them.
- **Hosting** — `@rozbazaar/web/hosting` writes `.htaccess` into each build: CSP, HSTS, HTTPS
  redirect, SPA fallback and caching. `vite preview` sends the same headers, so a production build
  is tested locally under the real policy.

## Adding a feature (checklist)

1. If the DB needs a change: add `database/migrations/<date>_<name>.sql`. Follow CLAUDE.md §5:
   drop a function before changing its signature, and verify with `pg_get_functiondef`.
2. Add a zod schema and a response type in `packages/shared`, then `npm run build:shared`.
3. Add the route in the right `apps/api/src/modules/*` file. Validate with `parse(...)` and map
   rows in `mappers.ts`.
4. Implement the RPC in `apps/api/src/dev/fake-supabase.ts` (same rules as the real one), and add
   a test in `apps/api/test/`.
5. Build the screen in `apps/<app>/src/features/...`. Use a query/mutation hook, and `t(en, hi)`
   for every string.
6. Run `npm run lint && npm run typecheck && npm test && npm run build`, then `npm run e2e` if the
   change touches a journey.
