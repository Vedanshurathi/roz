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
- **Commission: 10% (admin-editable).** Customers still pay vendors directly, so the app
  never collects money; "commission" = GMV × `commission_rate()` (setting in
  `app_settings`, changed from admin → Settings via `admin_set_commission`) — i.e. what
  vendors owe RozBazaar. `admin_finance_dashboard` returns `platform_revenue` (30 days),
  `platform_revenue_all` and `commission_rate`. Don't invent any other revenue number.
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
vendor/            → also deployed to the same public_html (rozbazaar.shop/vendor.html) — OLD vendor app
  vendor.html        single-file vendor app (~400 KB)
  og-vendor.jpg
vendor-site/       → its OWN Hostinger website — the vendor app to use (old UI + phone/password login)
  index.html         single-file vendor app — registered: phone + password; first time: Google registration
  sw.js, manifest.webmanifest, icon-*.png, badge-96.png, .htaccess, robots.txt
staff-site/        → its OWN Hostinger website for employees (same layout as admin-site)
  index.html         single-file staff app (sales + intern views) — login with phone + password
  sw.js, manifest.webmanifest, icon-*.png, badge-96.png   web push + installable PWA
admin-site/        → its OWN Hostinger website (separate from rozbazaar.shop)
  index.html         single-file admin console (Supabase login, admin_* RPCs directly)
  .htaccess          HTTPS redirect, noindex, CSP + security headers (Apache/LiteSpeed)
  robots.txt         Disallow all
  sw.js, manifest.webmanifest, icon-*.png, badge-96.png   web push + installable PWA
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
| Vendor app (new) | https://vendor.rozbazaar.shop → separate Hostinger website, `public_html` = contents of `vendor-site/` (rozbazaar.shop/vendor.html now forwards here) | static upload; its URL must be in Supabase Auth → URL Configuration → Redirect URLs for Google login |
| Staff app | https://employ.rozbazaar.shop → separate Hostinger website, `public_html` = contents of `staff-site/` | static upload; login = phone + password of a `staff` row |
| Admin (new) | https://admin.rozbazaar.shop → separate Hostinger website, `public_html` = contents of `admin-site/` | static upload; login = Supabase email/password of an `admins` row |
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
- **Bilingual:** `T(en, hi)` in JS; `data-en` / `data-hi` attributes in HTML. Since 26 Sep 2026
  English mode = proper English ("Vegetables", "Today, Morning 7–11") and Hindi mode = Devanagari
  ("सब्ज़ी", "आज, सुबह 7–11"). Keep it that way — no Roman Hindi in either. The choice is saved in
  `localStorage.rb_lang`, applied on load (`setLang(l, true)`), and synced to `customers.lang`
  (`set_language`) so push notifications arrive in the same language.
- Item names: `en` = `products.name_en` (real English, "Tomato"), `hi` = `name_hi` (Devanagari),
  `roman` = `name` (what the vendor typed, "Tamatar" — still searchable). Photo = vendor's
  `image_url` → else `stock_image_url` (real photo, see "Item photos") → else the SVG art.
- **Notifications (customer):** 🔔 in the header (mobile + desktop) opens a sheet from
  `customer_notifications()` (bilingual rows), `customer_mark_read()`; polled every 60 s while logged
  in. A bar above the bottom nav keeps asking (9 s after open, then 2 min after each close) until
  notifications AND location are allowed; if the browser blocked one it explains how to unblock.
  `syncPush()` saves the push subscription after login. Address: `getPreciseLocation()` (one shared
  GPS session; keeps the most accurate fix for up to 20 s, stops at ±20 m) then a Leaflet map
  (satellite = Esri World Imagery, map = OSM, loaded lazily from jsdelivr) with a draggable 📍 pin —
  tap/drag sets `addrCoords.pinned`; fixes worse than ±60 m show a red "location is rough" hint. Home
  "use my location" uses the same helper and never switches village on a fix worse than ±3 km.
  (A real address was once saved 57 km away from a coarse first fix.) House no. / street / landmark
  are optional — village + (GPS pin or any text).
  **"Save address" writes to the DB right away** (`customer_save_address`; editing passes
  `p_address_id` so it updates) — it used to only live in memory until the next booking. A guest's
  address is kept in `localStorage.rb_addr_draft` and saved on login (`loadMyAddress()`).
  Push: the customer app calls `save_push_subscription(..., p_role:'customer')` — without it an
  account that is also an admin/vendor got role `admin` and never received customer pushes
  (migration `20260926i_push_role_address_fix.sql`). A product photo that fails to load falls back
  to the SVG drawing (`artFail`).
  **Several addresses** (migration `20260926l_multi_address.sql`): `ADDRS` = all saved (`customer_my_addresses`,
  hidden ones excluded), `addr` = the one this order goes to. My account lists them (tap = edit, ⭐ =
  `customer_set_default_address`, 🗑 = `customer_delete_address` — hides instead of deleting when old
  bookings use it). `openAddrEditor(id|null)` opens the form (new = empty form). "Other" asks for a
  name (saved in `addresses.label`). At "Confirm booking" with 2+ addresses a "Deliver to which
  address?" sheet opens; the basket card has Change. Saving an address only books when it was added
  during checkout (`LOC_FROM_CHECKOUT`). Auto-filled text = house no., road, mohalla/hamlet + OUR
  village — never OSM's display_name (it gave "Farrukhnagar, Gurgaon, Haryana, India").
- Home ends with small social chips + a navy mini-footer ("Become a vendor" → `VENDOR_SITE`
  = https://vendor.rozbazaar.shop/). `#s-home` has bottom padding so nothing hides under the
  bottom nav / cart bar.
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

### Team: sales, interns, tasks, targets, notifications (both sites)
- `staff.kind` = `sales` | `intern` (admin sets it; Team tab). **Sales** see orders, vendors,
  sale, customers, targets and tasks. **Interns** see only Welcome, Mere kaam, Account —
  `staff_snapshot()` and `staff_my_targets()` refuse them (`is_sales()`), not just the UI.
- **Tasks** (`staff_tasks`): admin → Kaam tab / "Kaam do" on a Team row (`admin_add_task` takes
  an array of staff ids, priority, due date). Staff mark ✓ Complete / ✕ Nahi ho paya (reason
  required) / back to todo (`staff_set_task_status`); admins get notified on done/not done.
- **Sales targets** (`sales_targets`): amount + type (or all) + period, for one sales person
  or the whole team (`staff_id` null). Progress = `target_achieved()` = same "sale" rule as
  dashboards. Shown on staff Today + Sale tabs and admin Targets tab (pace marker, days
  left, needed per day, on-track/behind/done/missed).
- **Notifications**: `team_notify()` → `notify_bi()` (in-app row + `send-push` edge function).
  Push subscriptions from these sites are saved with role `staff` / `admin`
  (`team_save_push`); `send-push` filters by role. Who gets what: new order / customer /
  vendor (triggers `trg_ops_new_*`, recurring spawns skipped) → admins + active sales; new
  task → assignee; new target → sales; task done/not done → admins. Interns never get ops
  alerts. Bell = `team_notifications()` / `team_mark_read()`. Each site has its own `sw.js`
  (CSP `worker-src 'self'`). iPhone push works only after "Add to Home Screen" (iOS 16.4+).
- Migration `database/migrations/20260926d_commission_tasks_targets_notifications.sql`.
- Known gap (pre-existing): `send-push` has `verify_jwt=false` and accepts any caller.

### Notifications to customers + admin broadcast (migration `20260926g_customer_notifications_broadcast.sql`)
- `notify_person(user, role, type, title_hi, title_en, msg_hi, msg_en, booking)` = in-app row + push in
  the person's language (`person_lang`). Customer gets: order confirmed (trigger on booking insert),
  vendor on the way / reached / paid / order complete / missed / under review (`tg_status_notify`),
  bill ready + cancelled (sent by the existing RPCs), 30-min slot reminder (cron 06:30/11:30/16:30
  IST) and night-before reminder (20:30 IST). `notify_user()` now pushes for customers too.
- Admin console → "📣 Notification bhejo": `admin_broadcast(audience all|customers|vendors|staff,
  title, message, title_en, message_en)`, templates, history + reach (`admin_broadcasts()`).
- **Delivery tracking** (migration `20260926p_notification_tracking.sql`): every push goes through
  `push_note(notification_id)` (called by `notify_person` / `notify_bi` / `notify_user`) → edge function
  `send-push` (source in `supabase/functions/send-push/`; private VAPID key read from
  `app_settings.vapid_private`, not in code) writes `push_devices/push_sent/push_failed/push_at` on the row
  and sends `nid` in the payload. Each site's `sw.js` calls `notification_track(nid, 'delivered')` when the
  push reaches the phone and `'opened'` when tapped (anon-callable; only sets those timestamps). The
  `*_mark_read` functions set `read_at` (seen in the app's 🔔). Broadcast rows get `broadcast_id`.
  Admin → "📬 Kisko mila / khola" (`admin_notification_report(p_broadcast, p_days, p_type)`) lists every
  recipient with name, phone, delivered / opened, filters, search, CSV; broadcast history shows
  sent / delivered / opened counts and a "Kisko mila" drawer. Notifications sent before 26 Sep 2026
  22:00 IST have no tracking ("purana").

### Item names + photos (migration `20260926h_item_names_photos.sql`, edge function `item-photos`)
- `catalog_items.english_name` (real English) + `image_url`; `products.name_en` + `stock_image_url`.
- 99/104 catalog items have a real photo: hand-picked Wikimedia Commons / Wikipedia images, 480 px
  thumbnails, stored in the public Storage bucket `item-photos` (`catalog/<key>.jpg`). p13, p31, p54,
  p64, p89, p90, p91, p92, p96, p97 keep the drawing (no good photo found).
- Trigger `tg_product_fill` (products insert / rename): fills `name_en`, Devanagari `name_hi` and
  `stock_image_url` from the matching catalog item (by key, English, Roman or Hindi name); for an
  unknown item it calls the `item-photos` function (mode `product`), which searches Commons and
  saves a photo. The function checks `app_settings.item_photos_token`; source in
  `supabase/functions/item-photos/`. Modes: `catalog` (items [{key,title|file}]), `product`
  ({id, query[, file]}), `candidates` (4–8 previews per query, for choosing by eye).

### Vendor app (`vendor-site/index.html`) — own Hostinger website
- **Same UI as `vendor/vendor.html`** (Vedanshu found a Spotify-style redesign too complex and asked to go
  back). It is that file plus: phone + password login, first-password screen, password-change request,
  logout, push via this site's own `./sw.js` + `vendor_save_push`. No CSP in `.htaccess` (inline onclick).
- **Login:** registered vendor → phone + password, no OTP / no number check. The page calls
  `vendor_login_lookup(phone)` (anon) → `{registered, has_password, email}` and signs in with that email
  (the vendor's Google account, or `<phone>@vendor.rozbazaar.shop` for vendors an admin created).
  Not registered → the old first-time flow (name + phone → Google → what I sell → `vendor_apply`) → then
  "Make your password" (`vendor_set_first_password`, works only while no password exists). Registered via
  Google but no password yet → log in with Google once, the app asks for a password.
- **Password change** = request (`vendor_request_password`, bcrypt hash in `vendor_password_requests`),
  admins notified; becomes real only when an admin approves in admin → Vendors
  (`admin_decide_vendor_password_request`). Admin can also set/reset directly: vendor drawer →
  "📱 Vendor app password" (`admin_set_vendor_login`, now also for Google-linked vendors).
  Same caveat as staff: Supabase's raw auth API still lets a logged-in user change their own password.
- **Notifications** (push): new order, slot in 30 min + slot start (cron), bill approved / customer
  cancelled / reassigned / price reminder (`notify_user` pushes for vendors), bill disputed, order missed,
  new rating, item approved/rejected, 20:45 daily summary, password approved/rejected.
- Migrations `20260926e_vendor_app_notifications.sql`, `20260926f_vendor_phone_password.sql`.
- **Dashboard tab** (was "Earnings"): `vendor_dashboard(p_from, p_to)` (migration `20260926k_vendor_dashboard.sql`)
  returns total sale, orders, avg, cash/UPI, commission (`commission_rate()` % of the sale — owed by the
  vendor, customers pay nothing extra), what the vendor keeps, booked/cancelled/missed, daily (or monthly
  > 62 days) chart, top items, every sale, and this month's commission. Sale rule = `vendor_sale_rows()`:
  payment row or status paid/delivered/completed; amount = payment else final_total; date = paid day (IST)
  else booking date. `vendor_stats` / `vendor_earnings_*` use the same rule now (they used UTC and only
  delivered/completed with a final bill). Home header shows today's sale + "you keep ₹X".
- Dates sent to the DB use `istISO(offset)` (customer + vendor apps) — `toISOString()` is UTC and gave
  yesterday between midnight and 5:30 AM IST.
- Privacy trade-off: `vendor_login_lookup` returns the login email of any vendor number that has a password.

### Staff app (`staff-site/index.html`)
- Its own Hostinger website (upload `index.html`, `.htaccess`, `robots.txt`). Read-only,
  responsive (laptop sidebar → phone drawer, down to 320 px). Same CSS base as the admin.
- **Login = 10-digit phone + password.** Supabase has no SMS provider, so each employee is
  an email/password auth user `<phone>@staff.rozbazaar.shop` (`staff_login_email()`); the
  page turns the typed phone into that address. Access = active row in `public.staff`
  (or `is_admin()`), checked by `is_staff()`. Session key `rb-staff-auth`.
- **Add / reset / disable employees from the admin console → Staff tab**
  (`admin_add_staff`, `admin_reset_staff_password`, `admin_set_staff_active`,
  `admin_staff_list` — migration `database/migrations/20260926b_staff_phone_login.sql`).
  `admin_add_staff` inserts straight into `auth.users` + `auth.identities`.
- Data: `staff_me()` (name, phone, is_admin) and `staff_snapshot()` only (migration
  `20260926_staff_app.sql`): bookings from the last 90 days + upcoming, and all vendors;
  no `delivery_otp`, no house/street, no GPS. Customers tab is derived from those bookings.
- **Click-through details (both staff and admin):** order → full detail + items; from an
  order, "Is customer ke sab orders" / "Vendor ke sab orders" open drawers with totals
  (orders, sale, avg, cancel/miss), top items and every order (each clickable). Customers
  rows open the same customer drawer. Staff group customers by `customer_id` (in snapshot).
- **Roles + approvals:** `staff.role` is set by the admin only (`admin_update_staff`);
  staff can rename themselves (`staff_update_my_name`). Staff password change is a request
  (`staff_request_password` stores only a bcrypt hash in `staff_password_requests`); it
  becomes the real password when an admin approves (`admin_decide_password_request`).
  The staff site no longer calls `auth.updateUser`. Caveat: Supabase itself still lets any
  logged-in user change their own password through the raw auth API, so the approval step
  is enforced by the app, not by Supabase. Migration `20260926c_staff_roles_password_approval.sql`.
- Tabs: Aaj ka plan (KPIs, slot board Subah/Dopahar/Shaam, village + vendor load),
  Orders (day/status/type/village filters, search, detail drawer, CSV), Vendors (cards,
  7-day chart drawer), Sale (today/yesterday/7/30/custom range, Sabzi/Pyaaz-Aloo/Fruits,
  cash vs UPI, daily bars, item/vendor/village breakdown, CSV), Customers (repeat,
  lapsed 30+ days, call/WhatsApp), Mera account (rename self, request password change + status).
- Auto-refresh every 45 s; a booking id not seen before → 🔔 toast + beep + Orders badge.
- "Sale" = booking with a payment row, or status paid/delivered/completed; amount =
  `pay_amount ?? final_total`. Item-wise = final bill lines (qty × per-unit `final_price`).
- Same CSP/SRI rules as the admin site: after editing the inline script run
  `python3 scripts/site-csp.py staff-site`.

### Admin console (`admin-site/index.html`) — the one to use
- Deployed as its own Hostinger website: upload `index.html`, `.htaccess`, `robots.txt`
  into that site's `public_html`. No Supabase redirect-URL setup needed (password login).
- **CSP pins the inline script by sha256** (in both the `<meta>` tag and `.htaccess`).
  After ANY edit to the inline `<script>`, run `python3 scripts/site-csp.py admin-site`,
  or the page loads blank. supabase-js is pinned to `@2.117.2` with an SRI hash —
  bumping the version needs a new `integrity=` (`npm pack` it and `openssl dgst -sha384`).
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
  Staff (add employee with role, edit name/role, approve/reject password requests,
  reset password, turn off), Traffic, Launch check. Customer + vendor drawers show full order history.
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
  No function uses `current_date` any more (migration `20260926n_ist_dates_row_checks.sql` rewrote all of
  them, and every `if rec is [not] null` on a table-row variable → `rec.id`).
- **Vendor picker:** `customer_vendors_for_product` matches the item by `name`, `name_en` or `catalog_key`
  (the app sends `products.name`, e.g. "Tamatar"). It used to get the English name and match nothing, so
  every item sold by 2+ vendors said "No one sells this here yet". Out-of-stock vendors are listed but
  can't be picked. `customer_create_booking` refuses out-of-stock items (`code OUT_OF_STOCK`, names them)
  and, when the customer's chosen vendor is full in that slot, returns `VENDOR_FULL` instead of silently
  giving the order to another vendor (migration `20260926m_vendor_picker_stock.sql`).
- **Stock/price freshness (customer):** `applyCatalogue()` updates items from the 25 s logged-in poll and
  `refreshCatalogue()` (app back on screen + every 3 min); basket marks items that went out of stock and
  blocks booking; the basket "note for the vendor" is now actually sent (`BASKET_NOTE` → `p_note`).
- **Messages in the right language:** `tr(hi, en)` looks the Roman-Hindi text up in `msg_i18n` → proper
  Devanagari / English; customer functions' plain messages are wrapped in `tr()`. The customer app always
  syncs `set_language` on login (phone login too, which also now saves push + loads 🔔).
- `vendor_finalize_bill` also works in status `disputed` (vendor re-weighs and re-sends the bill)
  (migration `20260926o_messages_i18n_bill_redo.sql`). Vendor Stock screen saves a rate as soon as it's
  typed (decimals allowed).

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
