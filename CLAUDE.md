# RozBazaar — context for Claude Code

Read this whole file before changing anything. It is the handover from ~4 weeks
of building in claude.ai chat. The mistakes listed under "Hard-won lessons"
were each made at least once — don't repeat them.

> **In this repo (`Vedanshurathi/roz`)** the contents of `admin/` sit at the
> repo root (`server.js`, `src/`, `public/`) because Render deploys from here.
> `database/`, `customer/`, `vendor/` and `docs/` are here too (customer and
> vendor are still deployed by uploading to Hostinger by hand).
> `brand/rozbazaar-logo.png` is the official logo: orange-to-green "R" shopping
> bag with speed lines, "Roz" in green, "Bazaar" in dark navy.

---

## 1. What this is

**RozBazaar** — slot-based, hyperlocal sabzi/fruit/pyaaz-aloo delivery for the
villages of the Pataudi / Haileymandi belt, Haryana, India.

- Customer picks a **slot** (morning 7–11, afternoon 12–4, evening 5–8), adds
  items, books. A real local vendor (thela-wala) comes in that window.
- Vendor **weighs at the door**, finalises the bill in the vendor app, customer
  pays **directly** (cash or UPI). A 4-digit **delivery OTP** confirms handover.
- **Zero commission.** There is no fee column anywhere in the schema — platform
  revenue is genuinely ₹0 today. The admin dashboard reports **GMV**, not revenue.
  Don't invent a revenue number.
- Three-sided: customer app, vendor app, admin console.

**Founder / sole owner:** Vedanshu Rathi (vedanshurathi@gmail.com).
Instagram: @roz.bzaar (brand), @vedanshu.rathi (personal).
Business docs: `docs/` (pitch deck summary, problem validation, Haryana govt schemes).

---

## 2. Repo layout

```
customer/          → deployed to Hostinger public_html (rozbazaar.shop)
  index.html         single-file customer app (~535 KB: HTML+CSS+JS, inline SVG art)
  sw.js              service worker for web push — MUST sit at public_html root
  og.jpg             link-preview image (1200×630)
  _headers _redirects  Netlify-style headers/redirects (kept for portability)
vendor/            → also deployed to the same public_html (rozbazaar.shop/vendor.html)
  vendor.html        single-file vendor app (~400 KB)
  og-vendor.jpg
staff/             → also deployed to the same public_html (rozbazaar.shop/staff.html)
  staff.html         single-file read-only staff app for employees (logo inlined)
admin-web/         → also deployed to the same public_html (rozbazaar.shop/admin.html)
  admin.html         single-file admin console (Supabase login, admin_* RPCs directly)
admin/             → Node/Express app on Render
  server.js          Express, CSP headers, session cookie, serves public/
  src/router.js      /api/* routes (all behind requireAuth)
  src/store.js       data layer — calls Supabase RPCs, OR mock data when USE_SUPABASE≠true
  src/mock.js        mock dataset for local dev
  public/            index.html, app.js, styles.css (vanilla JS SPA, 9 tabs)
database/
  SCHEMA.md          every table, enum, cron job and all 124 RPC signatures
  DUMP_FULL_SCHEMA.md  how to pull the real .sql with function bodies
docs/              business context
```

In production, `index.html`, `vendor.html`, `sw.js`, `og.jpg`, `og-vendor.jpg`
all live **side by side** in Hostinger `public_html`. They're split into folders
here only for clarity.

---

## 3. Infrastructure

| piece | where | notes |
|---|---|---|
| Domain | rozbazaar.shop (hosted on Hostinger) | |
| Customer app | https://rozbazaar.shop → Hostinger `public_html/index.html` | static upload, no build step |
| Vendor app | https://rozbazaar.shop/vendor.html → same `public_html` | static upload, no build step |
| Staff app | https://rozbazaar.shop/staff.html → same `public_html` | static upload, no build step |
| Admin (new) | https://rozbazaar.shop/admin.html → same `public_html` | static upload; login = Supabase email/password of an `admins` row |
| Admin | Render web service `srv-d9vkutn40ujc738b0dp0` → https://rozbazaar-admin.onrender.com | auto-deploys from GitHub |
| Admin repo | https://github.com/Vedanshurathi/roz | contents of `admin/` at repo root |
| Database | Supabase `srvpfyjmwaruebbkqkdj` (Mumbai, Postgres 17) | |
| Supabase URL | https://srvpfyjmwaruebbkqkdj.supabase.co | anon key is inlined in the HTML files (public by design) |

### Admin env vars (set on Render — never commit values)
```
USE_SUPABASE=true
SUPABASE_URL=https://srvpfyjmwaruebbkqkdj.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<from Supabase dashboard → API>
ADMIN_PASSWORD_HASH=<bcrypt hash — generate with: npm run make-password>
SESSION_SECRET=<random 64-hex>
PORT=<Render sets this>
```
Without `USE_SUPABASE=true` the admin runs on **mock data** and shows a yellow
"Mock data" banner — handy for local UI work, useless for real ops.

Admin auth user in Supabase: `e9370460-2105-4c1f-9b16-877d1fff1ed6`.

---

## 4. Architecture & conventions

### All data goes through RPCs
Frontends never read/write tables directly. Every operation is a
`SECURITY DEFINER` Postgres function returning jsonb:
`{ok:true, data:…}` or `{ok:false, msg:"…"}`. RLS is on for every table.
Identity inside RPCs comes from `my_customer_id()`, `my_vendor_id()`, `is_admin()`.
Every `admin_*` RPC begins with `perform admin_guard();`.

### Customer app (`customer/index.html`)
- Single file. Screens are `<div class="scr" id="s-NAME">`; navigate with `go('NAME')`.
  14 screens: home, cat, search, basket, slot, login, loc, bookings, acct, how,
  contact, rate, bill, success.
- `const DEMO = false;` — set true for a fully offline demo on mock data.
- Backend calls: `rpc(fn,args)` → Supabase; `mockApi(action,args)` is the
  action dispatcher that maps UI actions to real RPCs (or mock data in DEMO).
- Key state: `cart` {productId: qty}, `sel` {type, day, slot, vendorId},
  `user`, `addr`, `PRODUCTS`, `AREA`, `LANG`.
- **Bilingual:** `T(en, hi)` in JS; `data-en` / `data-hi` attributes in HTML.
  Hindi is written in Roman script in most UI copy ("Slot chuno", "sabzi ghar pe").
- **Login:** Google OAuth OR phone-only (`signInAnonymously()` + `customer_phone_login`).
  Phone login has **no OTP by design** — face-to-face village delivery; whoever
  last typed a number owns that account. Don't "fix" this without asking.
- Login is only required at booking time, never to browse.
- Product images are inline SVG illustrations via `pImg()` / `art()`; a vendor's
  uploaded photo overrides the illustration.

### Vendor app (`vendor/vendor.html`)
- Same single-file pattern. 16 screens incl. home (today's runs), stock, item,
  catalog, slots, earn, profile, area, run (order detail), bill, pay, code (OTP).
  `s-prod` is dead code — unreachable.
- `api(action,args)` dispatcher → `rpc()`.
- Order lifecycle buttons: new → "I'm on the way" → "Reached — make bill" →
  send bill → take payment (cash/UPI) → enter customer's delivery code → complete.
- Vendors pick items from the 104-item `catalog_items` list or type their own;
  typed names are auto-categorised via the `ITEM_CATEGORY` dictionary.
- Slots screen: per-slot capacity + per-slot village restriction
  (`vendor_slot_areas`). Loads real saved values via `vendor_my_slots` /
  `vendor_get_slot_areas` on open.

### Staff app (`staff/staff.html`)
- Read-only, phone-first page for employees. Same single-file pattern; talks to
  Supabase directly with the public key.
- Login: Supabase **email + password**. Access = active row in `public.staff`
  (or `is_admin()`), checked by `is_staff()`. Session stored under its own
  `storageKey: 'rb-staff-auth'` so it never mixes with a customer login.
- Data: `staff_me()` and `staff_snapshot()` only (migration
  `database/migrations/20260926_staff_app.sql`). Snapshot = bookings from the last
  90 days + upcoming, and all vendors; no `delivery_otp`, no house/street, no GPS.
- Add an employee: Supabase Dashboard → Authentication → Users → Add user
  (email + password, auto-confirm), then
  `insert into staff (auth_user_id, name) select id, '<Name>' from auth.users where email = '<email>';`
  Remove: `update staff set is_active = false where ...`.
- Tabs: Orders (today/tomorrow/upcoming/7 days, status filters, search, tap for items,
  call buttons), Vendors (today's orders, today + 7-day sale), Sale (Sabzi / Pyaaz-Aloo /
  Fruits totals, cash vs UPI, 7-day bars, item-wise "kya kitna bika").
- "Sale" = booking with a payment row, or status paid/delivered/completed; amount =
  `pay_amount ?? final_total`. Item-wise = final bill lines (qty × per-unit `final_price`).

### Admin console (`admin-web/admin.html`) — the one to use
- Single file, light RozBazaar theme, works on desktop and phone (sidebar becomes a
  drawer under 860 px; tables scroll sideways inside their card).
- Login: Supabase email + password; allowed only if `staff_me().is_admin` is true
  (i.e. the account is in `public.admins`). Session key `rb-admin-auth`.
- Calls the same `admin_*` RPCs the Render admin's `store.js` uses, directly from the
  browser — safe because every one of them runs `admin_guard()` in the DB.
  `admin_pending_products` returns a bare array (no `{ok,data}` wrapper); `rpc()` handles both.
- Tabs: Overview (GMV today/week/month, AOV, 30-day chart, cash vs UPI, top vendors,
  14-day order bars, waitlist), Orders (filters + search; row → drawer with items,
  customer/vendor contact, reassign to a same-type live vendor, complete, OTP-less
  delivered, cancel with reason), Vendors (filters, add, approve/block/remove, drawer
  with sale, rating, upcoming orders, items), Products (approval queue, all products
  with inline price + stock + edit, master catalog add/remove), Customers (search,
  block, same-number flag), Villages (add, active toggle, set GPS point), Messages,
  Traffic, Launch check.
- Modals replace `prompt()`/`confirm()`; one delegated click listener on `data-act`.

### Admin (`admin/`) — older Render version
- Express serves `public/`; SPA calls `/api/*`; `/api/snapshot` returns
  everything the dashboard needs in one call (`store.snapshot()` fans out to ~11 RPCs).
- Tabs: Overview (finance: GMV, week-over-week trend, AOV, cash vs UPI, top
  vendors, 30-day chart), Launch readiness, Bookings (stat cards + search + status
  filters + cancel/resolve), Vendors, Products (edit name/category/unit/price/stock),
  Customers, Areas, Traffic, Messages.
- Click handling: one delegated listener; elements use `data-act` / `data-arg` / `data-arg2`.
- Asset paths in `public/index.html` are **relative** (`./styles.css`) on purpose.
- Every new store function needs **both** branches: the Supabase RPC call and
  the mock implementation — mock mode must keep working.

### Key business logic in the DB
- `match_vendor()` — auto-assigns least-loaded, best-rated vendor for a slot.
- `vendor_covers_area_in_slot(vendor, area, slot)` — the single source of truth
  for "does this vendor serve this village in this slot". Used by
  `customer_slot_status`, `match_vendor`, `customer_available_vendors`.
  Rule: village must be in `areas_served` AND (no slot restriction OR listed in
  `vendor_slot_areas` for that slot).
- `area_from_point(lat,lng)` — GPS → village using `areas` lat/lng/radius; returns
  `in_range`, `served`, `confident`. The customer address screen uses this, not
  reverse-geocode text matching.
- Multi-vendor items: tapping ADD on an item sold by 2+ vendors opens a picker
  (`customer_vendors_for_product`) showing each vendor's price. Single-vendor
  items add directly. The first item in the cart sets `sel.vendorId`; adding an
  item from a different vendor shows a warning toast (a booking goes to one vendor).
- Times: always `ist_date()` / `ist_now()` for business logic. The DB clock is UTC.

---

## 5. Hard-won lessons — read before touching the DB or tests

**Postgres / migrations**
1. `CREATE OR REPLACE FUNCTION` with a **changed parameter list creates a second
   overload** instead of replacing. Calls then fail with "function is not unique".
   This bit `vendor_upsert_product`, `customer_create_booking`,
   `admin_update_product` and others. When changing a signature:
   `DROP FUNCTION old_signature;` first. Then run the overload check in
   `database/DUMP_FULL_SCHEMA.md` — it must return zero rows.
2. `apply_migration` is one transaction — a syntax error anywhere silently rolls
   back everything. Verify with `pg_get_functiondef` afterwards.
3. Enum literals must match exactly: `pay_method` is `upi_direct`, not `upi`.
4. PL/pgSQL: test composite row variables with `rec.id IS NOT NULL`, not
   `rec IS NOT NULL` (unreliable in IF/ELSIF chains).
5. IST vs UTC caused 5.5-hour slot-expiry bugs. Use the `ist_*` helpers.

**Testing** (all changes were verified in Playwright, not by reading code)
6. Test RPCs as a specific user inside one `execute_sql` call:
   ```sql
   do $$ begin
     perform set_config('request.jwt.claims','{"sub":"<auth uuid>","role":"authenticated"}',true);
     perform set_config('role','authenticated',true);
   end $$;
   select some_rpc(...);
   ```
7. This is the **production** database. Create your own test rows, verify,
   then delete them. Never touch real in-progress bookings.
8. Browser tests of the HTML apps: intercept the Supabase CDN script and return a
   fake `window.supabase` whose `rpc()` returns shaped mock data. Make mock data
   match the real view shape exactly (e.g. `booking_full` has `v_type`, not `type`)
   or you'll chase phantom bugs.
9. Playwright gotchas that produced false alarms:
   - Scope selectors to the active screen (`#s-cat .add`, `#v-bookings tbody tr`) —
     hidden screens stay in the DOM.
   - ADD buttons run a 700 ms `fly()` animation before `addCart()` fires — wait ≥900 ms.
   - `.slot` is used for two different things; scope to `#slotList .slot`.
   - Items sold by 2 vendors open the vendor picker instead of adding.
   - Full-page screenshots misplace `position:fixed` elements — check the viewport shot.
   - Admin KPI numbers count up from 0; any code that re-renders a view directly
     (not via `render()`) must call `animateCounts()` or the cards stay at 0.
   - When mock values coincidentally equal defaults (capacity 15), the test proves
     nothing — use a distinct value.
10. Before calling anything a bug, reproduce it. Four of the "bugs" in one audit
    were test mistakes.

**Deployment**
11. If the admin shows unstyled plain text but data loads and the console is
    clean → it's the browser's **Reader Mode**, not the code. (Happened twice.)
12. `sw.js` must be at `public_html` root or push silently fails (the UI now
    reports this honestly instead of claiming success).
13. WhatsApp/Facebook cache link previews — after changing `og.jpg`, re-scrape
    with Facebook's Sharing Debugger.

---

## 6. Current state (26 Sep 2026)

**Built and working:** full customer ordering flow, vendor order lifecycle,
recurring schedules, ratings, disputes, waitlist, web push, admin console with
finance dashboard. Everything above verified end-to-end in the browser.

**Live data:** 3 vendors, 14 customers, 26 products, 52 bookings, 28 payments
(₹5,715 GMV), 17 ratings — mostly from development dry runs.

**Recent changes, newest first**
- Admin Bookings tab: stat cards, search, status filters (incl. "Needs attention")
- Admin: real RozBazaar wordmark logo on login + sidebar (was a placeholder leaf)
- Admin: relative asset paths
- Admin: finance dashboard (`admin_finance_dashboard` RPC + Business section)
- OG share images = real screenshots of each app (og.jpg / og-vendor.jpg)
- Customer: desktop bottom-nav no longer covers the footer; "Founded by Vedanshu Rathi" in footer
- Vendor: Slots screen now loads saved capacity (previously showed hardcoded 15/10/12 — saves worked, reads didn't)
- Per-slot village restriction (vendor chooses villages per slot); stale-restriction bug fixed
- Customer slot list shows "N/A — no vendor covers your village" instead of silently hiding a slot
- Customer: vendor shown on slot screen now matches the vendor whose item is in the cart
- Customer: no fake placeholder address before confirming
- Customer: chat bubble moves up when the cart bar is showing
- Customer: larger, dark back button (46 px box, 30 px arrow — Vedanshu wanted the arrow bigger, not the box)
- Customer: GPS address fill uses DB village boundaries; removed racing text-match guesser
- Admin: cancel booking (`admin_cancel_booking`, notifies both sides), full product edit
- Customer phone login, multi-vendor price picker, vendor category auto-detect

## 7. Open items / backlog

1. **Admin redesign of remaining tabs** — Vendors, Products, Customers, Areas,
   Traffic, Messages still on the older design. Overview and Bookings are done.
   Vedanshu wants a Zomato-admin-level console.
2. Onboard real vendors and customers; run a real end-to-end delivery dry run.
3. Audit Hindi copy across all three apps for completeness.
4. SMS / WhatsApp notifications (only in-app + web push today).
5. Unreproduced report: "after filling address on first order, customer lands on
   home instead of the order screen." Every automated path (phone login) lands on
   success correctly. Suspect: Google OAuth full-page redirect path. Needs a real device test.
6. Consider a real repo for customer/vendor too, instead of manual Hostinger uploads.
7. Commit `database/schema.sql` (see DUMP_FULL_SCHEMA.md) and move to migration files.

---

## 8. Working with Vedanshu

- Communication: informal, direct, brief. Often non-native English — read for intent.
- Wants clear step-by-step guidance when he has to do something himself (deploys, uploads).
- Short feedback is precise: "button same size, arrow bigger" means exactly that.
- When he says something "isn't working", reproduce it first — past reports turned
  out to be undeployed fixes, real bugs, or real UX problems, in roughly equal measure.
- Be honest about what's verified vs. assumed, and about scope left undone.
- He deploys himself: customer/vendor by uploading to Hostinger `public_html`,
  admin by pushing to GitHub `Vedanshurathi/roz` (Render auto-deploys).
