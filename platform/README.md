# RozBazaar platform

The customer and vendor apps rebuilt as proper software:

- **Backend:** TypeScript + Express API (`apps/api`), in front of Supabase.
- **Frontends:** React apps (`apps/customer`, `apps/vendor`), one small file per screen.

Nothing in here replaces the database. All business rules stay in the Postgres functions
described in `../database/SCHEMA.md`.

```
platform/
  packages/shared    zod schemas, enums, API types — used by the API *and* both apps
  packages/web       React kit: API client, i18n (English / Devanagari), UI components, tokens,
                     web-push helper, build plugin that writes .htaccess security headers
  apps/api           Express API — sessions, security, validation, talks to Supabase
  apps/customer      React customer app  → rozbazaar.shop
  apps/vendor        React vendor app    → vendor.rozbazaar.shop (Hindi by default)
  e2e/               Playwright browser journeys (real apps → real API → fake Supabase)
  docs/              ARCHITECTURE · SECURITY · DEPLOY · PARITY (what is / isn't ported yet)
```

## Run it on your laptop (no production data touched)

Needs Node 22 (`.nvmrc`).

```bash
cd platform
npm ci
npm run build:shared         # the shared package is compiled once (the API imports its dist/)
npm run dev:mock             # API on :8080 + an in-memory fake Supabase
npm run dev:customer         # http://localhost:5173
npm run dev:vendor           # http://localhost:5174  — demo vendor 8198941588 / sabzi1234
```

`dev:mock` starts the real API wired to `apps/api/src/dev/fake-supabase.ts`. The fake implements
every RPC the apps use, with the same permission rules (anonymous vs logged in, customer vs
vendor). To run against the real Supabase, copy `apps/api/.env.example` to `.env`, fill it in and
run `npm run dev:api`.

## Checks

| command | what it does |
|---|---|
| `npm run lint` | ESLint (TypeScript, React hooks, no raw HTML injection, no stray `console.log`) |
| `npm run typecheck` | strict TypeScript in every package |
| `npm test` | API tests (security + full order lifecycle against the fake), app unit tests |
| `npm run e2e` | browser journeys — see `e2e/README.md` (start the stack first) |
| `npm run build` | production builds; each app's `dist/` includes its `.htaccess` |
| `npm run format` | Prettier |

**Before pushing, all of these must pass:** lint, typecheck, test, build. Run e2e too when you
change a screen.

## Conventions

- **Every request body, query and param is validated with zod** (`packages/shared/src/schemas.ts`).
  The app uses the same schema to enable its buttons, so both sides agree.
- **The API maps database rows to camelCase contracts** (`packages/shared/src/types.ts`,
  `apps/api/src/modules/mappers.ts`). Unknown columns never reach a browser. The vendor's view of
  an order never contains the customer's delivery code.
- **Every visible string goes through `t(en, hi)`.** English mode is proper English; Hindi mode is
  Devanagari. No Roman Hindi.
- **One screen = one file** under `src/features/<area>/`. Shared bits live in `packages/web`.
- **No tokens in the browser.** Sessions are encrypted HttpOnly cookies (see `docs/SECURITY.md`).
