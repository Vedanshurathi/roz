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
- **Minimum order: admin-set** (`app_settings.min_order`, default ₹50; admin → Settings → "Minimum order",
  `admin_set_min_order`). Customer site reads it with `public_app_config()` (anon) into `MIN_BASKET`; each vendor's
  order must reach it; `customer_create_booking` enforces it (code `BELOW_MIN`) — migration `20261016d_min_order_booking_guards.sql`.
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
  og-customer.jpg    link-preview image (1200×630) — og:image points here (?v=2); og.jpg is the same picture.
                     After changing it, use a NEW file name (WhatsApp/Facebook cache by URL) and re-scrape.
  _headers _redirects  Netlify-style headers/redirects (kept for portability)
vendor/            → OLD vendor app, NOT deployed any more (kept for reference). rozbazaar.shop/vendor.html is now
                     customer/vendor.html — a 1 KB page that forwards to vendor.rozbazaar.shop (it was a 404 on 16 Oct 2026)
  vendor.html        single-file vendor app (~400 KB)
  og-vendor.jpg
vendor-site/       → its OWN Hostinger website — the vendor app to use (old UI + phone/password login)
  index.html         single-file vendor app — registered: phone + password; first time: Google registration
  sw.js, manifest.webmanifest, icon-*.png, badge-96.png, .htaccess, robots.txt
  og-vendor.jpg      link-preview image (og:image = https://vendor.rozbazaar.shop/og-vendor.jpg; rozbazaar.shop's copy is gone)
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
scripts/
  site-csp.py        re-pins the inline-script hash of admin-site / staff-site (run after editing them)
  test-voice-parser.js  node scripts/test-voice-parser.js — tests the customer site's voice-order parser
docs/              business context
platform/          NEW (30 Sep 2026): TypeScript/Express API + React customer & vendor apps
                   (npm workspaces). Replaces customer/index.html + vendor-site/ once deployed.
                   Read platform/README.md and platform/docs/* before touching it.
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
  GPS session; keeps the most accurate fix for up to 20 s, stops at ±20 m; a passing "unavailable"/timeout
  error no longer ends it; a second caller gets the running search's best fix at once) and a Leaflet map
  (satellite = Esri World Imagery, maxNativeZoom 18, map = OSM, from jsdelivr) with a draggable 📍 pin.
  **Map speed (16 Oct 2026):** `warmMap()` fetches Leaflet + preconnects the tile hosts when the address
  screen (or the basket, for a customer with no address) opens; the map shows at the FIRST GPS reading
  (~0.2 s, it used to wait up to 20 s) and the pin follows sharper readings until the customer moves it;
  no GPS / "I'll type it myself" → `openVillageMap()` shows the chosen village so they can tap their house
  (nothing is captured until they tap/drag). Tap/drag sets `addrCoords.pinned`; fixes worse than ±60 m show a red "location is rough" hint. Home
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
  **My account → "🩺 Check notifications & location"** (`openCheck`/`runCheck`): shows on the person's phone app vs
  browser (`IN_APP` = `?source=pwa` start URL or `android-app://` referrer — the Play app), notification permission,
  service worker, push subscription saved, location permission, a real GPS test (`ckGeo`) and a test push
  (`customer_test_push` → poll `customer_test_push_status` for sent / delivered; one per 30 s; migration
  `20260927a_customer_push_selftest.sql`). Blocked-permission hints (`unblockHow`) say "Phone Settings → Apps →
  RozBazaar" inside the app and "tap 🔒" in the browser.
  **Play Store app** = TWA `shop.rozbazaar.twa` (PWABuilder). Upload key = `signing.keystore` alias `rozbazaar`
  (SHA-256 67:8E…07:E0; kept by Vedanshu, never commit it). `customer/.well-known/assetlinks.json` lists that key,
  Google's app-signing keys and an older build key. In the app, notification + location permission belong to the
  RozBazaar app in Android settings (notification delegation), not to Chrome.
  **Several addresses** (migration `20260926l_multi_address.sql`): `ADDRS` = all saved (`customer_my_addresses`,
  hidden ones excluded), `addr` = the one this order goes to. My account lists them (tap = edit, ⭐ =
  `customer_set_default_address`, 🗑 = `customer_delete_address` — hides instead of deleting when old
  bookings use it). `openAddrEditor(id|null)` opens the form (new = empty form). "Other" asks for a
  name (saved in `addresses.label`). At "Confirm booking" with 2+ addresses a "Deliver to which
  address?" sheet opens ("Deliver here — confirm booking" when it books); the basket card has Change.
  **Saving an address never books** (16 Oct 2026 — it used to place the order the moment an address added
  during checkout was saved): back to the basket with that address chosen, "Confirm booking" pulses. Auto-filled text = house no., road, mohalla/hamlet + OUR
  village — never OSM's display_name (it gave "Farrukhnagar, Gurgaon, Haryana, India").
- Home ends with small social chips + a navy mini-footer ("Become a vendor" → `VENDOR_SITE`
  = https://vendor.rozbazaar.shop/). `#s-home` has bottom padding so nothing hides under the
  bottom nav / cart bar.
- **Login:** Google OAuth OR phone-only (`signInAnonymously()` + `customer_phone_login`).
  Phone login had **no OTP by design** (anyone who types the number gets that account). **One account on several
  devices (16 Oct 2026, migration `20261016a_shared_login_cart_sync.sql`):** phone login on a 2nd device used to MOVE
  `customers.auth_user_id` to it, silently logging the 1st device out (cart/orders/🔔 gone there). Now extra devices are
  linked in `customer_logins (auth_user_id → customer_id)`; `my_customer_id()` = own row OR link, `my_customer_uid()` =
  the customer's primary auth user. Customer notifications stay stored under the primary user (`customer_notifications`
  / `customer_mark_read` read those) and `save_push_subscription(role customer)` saves every device's subscription under
  it, so pushes reach all devices. `customer_me / set_profile / update_profile / set_language / my_lang / my_role /
  customer_bootstrap` use `my_customer_id()` (bootstrap never creates a 2nd empty row for a linked device).
  **Shared basket:** `customer_carts (customer_id, items {product uuid: qty}, vendor_id, rev)`, `customer_cart_get()`,
  `customer_cart_apply(p_changes {id: qty, 0 = remove}, p_vendor, p_clear)`. Page: `cartLogin()` at login /
  session restore (guest basket merges in = bigger qty of each; a device that already shared this account's
  basket (`rb_cart_owner`) takes the account's basket, so an order placed elsewhere doesn't come back), `cartChanged()`
  from `syncCart()` sends the diff vs `CART_SRV` (600 ms), `pullCart()` on focus / basket open / every 12 s
  ("Basket updated from your other device"), booking → `pushCart()` at once, logout keeps the account's basket.
  If logging in mid-checkout added items from the other device, the basket opens instead of booking. Since 4 Oct 2026
  there is an **SMS OTP switch** (`app_settings.customer_otp`, admin → Settings → "Customer login: SMS OTP",
  `admin_set_customer_otp`), **off** until Supabase Auth → Phone has an SMS provider. When on, the page uses
  `signInWithOtp({phone:'+91…'})` + `verifyOtp` and `customer_phone_login` refuses (code `OTP_REQUIRED`) any
  session that is not the phone-verified Supabase user for that number. `customer_login_config()` (anon)
  tells the page. The platform/ API still uses the anonymous path — turn OTP on only for the live site.
- Login is only required at booking time, never to browse.
- **No spoken welcome any more** (removed 8 Oct 2026 on Vedanshu's request, both live sites; the `voice/` folders are
  deleted). The engine code (`introVoice`, `playVoice`, `say`, `VOX`, `#greetCard` CSS) is still in both files but nothing calls
  it — don't wire it back unasked. The step-by-step first-visit guide was also removed earlier — don't bring it back unasked.
  What the voice used to do for the rates board is now `rememberRates()` at load: the board compares with `RATES_PREV`
  (rb_rates read once at load), then today's rates are saved for the next visit.
- **Saved items** (4 Oct 2026): the ♥ on a product card = `customer_toggle_favourite`; Account → “❤️ Saved items” opens
  `#savedSheet` (`openSaved/renderSaved`, refreshes `favourites` from `customer_home`), cards with ADD, note for saved items
  not sold in the current village.
- **Slot list** uses `customer_slot_status_for(type, area, date, p_vendor = sel.vendorId)` → seats left with the basket's
  vendor (“N ऑर्डर की जगह बाकी”), `closed` = vendor switched the slot off (“बंद”); `paintSlotList()` refreshes every 30 s.
- Product images are inline SVG illustrations via `pImg()` / `art()`; a vendor's
  uploaded photo overrides the illustration.
- **No emojis on screen** (4 Oct 2026): an icon engine (`ICO` path set, `EMO_ICON` emoji → icon map, `ic(name)` →
  `<i class="ic"><svg>`) runs `emojiToIcons()` at load and from a MutationObserver, so every emoji anywhere (markup,
  toasts, translated text) becomes a vector icon; unmapped emojis/flags are dropped. **Food emojis become clean
  cut-out photos** instead (`EMO_PHOTO` → `customer/img/items/<name>.webp`, 31 transparent 160 px WebP files made with rembg
  from Commons photos — upload the `img/` folder with the site; `icPhoto()`, `img.ic.ph`; falls back to the line icon if it
  can't load) — category tabs, offer tiles, cards, and the no-drawing product fallback. Emojis in code are fine — they are
  converted — but add a mapping in `EMO_ICON` for a new one.
- **Get the app** (8 Oct 2026): strip at the top of the mobile home header (`#appStrip`, × hides it 3 days via
  `rb_appstrip_hide`) + "App" pill in the desktop nav (`#navGet`) → `getApp()`. Android = one tap downloads
  `customer/app/RozBazaar.apk` straight away, no sheet (TWA `shop.rozbazaar.twa` 1.0.0.0, signed with the upload key
  67:8E…07:E0 that is in assetlinks — NOT the Play-signed build); iPhone = small `#iosTip` bubble pointing at Share →
  "Add to Home Screen" (iOS allows no APK and no install prompt; Vedanshu asked for no big sheet); computer = `#appSheet` with only a QR code to `/?get=app` (opens the flow on the phone). Also a row in My account (`#acctGetApp`). Installed check: `checkAppInstalled()` uses Chrome's
  `navigator.getInstalledRelatedApps()` (manifest `related_applications` = play `shop.rozbazaar.twa` + the webapp; the APK
  carries asset statements for rozbazaar.shop), re-checked when the tab comes back: installed → every Download button hidden,
  not installed (incl. after an uninstall) → shown again. Browsers without that API (iPhone etc.): after a download tap
  (`rb_app_dl`) the top strip/pill hide for 7 days, the Account row stays. Always hidden inside the app (`appInstalled()`).
  `.htaccess` serves `.apk` as `application/vnd.android.package-archive`. Downloads are logged as `log_visit('apk_download')`.
  Replace the APK file when a new version is built (same file name).
- **ADD → qty stepper**: `addBtn(id)` renders ADD or `− qty +` (`.qstep`) from `cart`; `paintAllAdds()` (end of
  `syncCart`) keeps every card in sync; cards wrap it in `<span class="addw" data-pid>`.
- **Today's rates** board on Home (`#ratesSec`, `renderRates`): cheapest price per item, ▲/▼ vs `rb_rates`, first 8 +
  "All N rates", each row has the stepper.
- **Chat FAQ**: Contact screen shows `FAQ` (14 questions, `k` keywords, bilingual `q`/`a`) as chips → answer bubble;
  typing in the message box suggests matches (`faqSuggest`). Sending a message works as before.
- **Profile name + photo**: Account → Edit (`#profSheet`, `openProfileEdit`, `saveProfileEdit`) →
  `customer_set_profile(p_name, p_photo, p_remove_photo)`. Photos are square JPEG data URLs made by `shrinkPhoto(file,size)`
  (customer 240 px, vendor 320 px), checked by `rb_valid_photo()` (≤ 300 KB, data:image only). Customer photo is shown only
  in the vendor app (`booking_full.customer_photo`), vendor photo only to customers (`booking_full.vendor_photo`, vendor
  banner, Call button). Migration `20261004e_profile_photos_catalog.sql`.

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
- `send-push` has `verify_jwt=false` but since 4 Oct 2026 needs the `x-rb-push-secret` header (= `app_settings.push_secret`,
  sent by `push_note`); anything else gets 403.

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
- **124 catalog items** (p108–p127 added 4 Oct 2026: mango, mosambi, kinnow, sitaphal, plum, peach, fig, kiwi, dragon fruit,
  amla, mulberry, raw mango, lemon, raw banana, raw papaya, green garlic, lettuce, cherry tomato, baby potato, red onion).
  121 have a real photo (Wikimedia Commons, 480 px, Storage bucket `item-photos`, `catalog/<key>.jpg`); p123 green garlic,
  p54 lotus stem, p89 sangri keep the drawing. Photos are picked by eye: `item-photos` mode `compare` ([{key,title,q}] →
  current photo + Wikipedia-article images + Commons hits as previews), then mode `catalog` with [{key,file:'File:…'}].
  Call it through `net.http_post` in small batches (4 items) — big batches time out.
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
- **Slots screen autosaves** (16 Oct 2026): every toggle / ± / village tap saves ~1 s later (`slotsChanged` → `saveSlots(true)`,
  also flushed when leaving the screen; status line "Saved — customers see it now"). Village chips show the real villages
  (all green when the slot covers all) and a tap turns THAT village off — it used to make the tapped village the only one
  (Vedanshu's own vendor ended up with evening = "Jatola only"); the last village can't be removed; all slots off → warning.
- **Slots screen = settings for every day** (4 Oct 2026; it used to save TODAY only, so tomorrow kept the default open/15):
  `vendor_get_slot_settings()` (capacity, open, booked today/tomorrow) + `vendor_save_slot_settings(p_slots)` (one call;
  defaults table + every future day row, never below orders already booked; slot villages too). See “Slots & seats” below.
- **All orders** tab (5th bottom-nav button + link under Home + desktop duty-nav): `vendor_orders(p_from, p_to)` (≤ 62 days,
  cancelled included, no delivery code), ranges Today / Yesterday / 7 / 30 days / coming 7, status chips To do / Completed /
  Cancelled / Missed with counts, tap a card = items, reason, payment, call; today's open order → “Open order”. Home stays
  “only orders still to do”.
- **Spoken welcome** on every open / reload: `vendorGreet()` (same engine as the customer site), recordings `vgreet` /
  `vgreet_n` (“नमस्ते! रोज़बाज़ार वेंडर ऐप में आपका स्वागत है। आज के ऑर्डर देखिए, और समय पर पहुँचिए।”), name from
  `VENDOR.name`. Profile → “🔊 आवाज़ वाला स्वागत: चालू/बंद”.
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
- **Home = only orders still to do** (`ACTIVE_ST` = new / way / bill / paidwait / disp). Delivered ones are not shown
  (none on Home — sales are on the Dashboard); missed / under review / cancelled are hidden too. `ST_IN` now maps disputed →
  `disp` (button "weigh again & re-send bill" → `startBill()`), missed → `missed`, pending_review → `review`
  (no action button) — they used to fall back to `new` and showed "I'm on the way". NEXT = the order already in progress.
- **Home layout = the original one** (earnings hero + day pills on top, orders grouped under simple slot headers
  सुबह/दोपहर/शाम with customer cards + price, "जल्दी वाले काम" box at the bottom). A slot-board/coloured-band version
  and two footer redesigns were tried on 27 Sep and **rejected by Vedanshu — don't bring them back**.
  (`vendor_day_counts(p_from,p_to)` from that attempt still exists in the DB, unused.)
- **Language: Hindi by default**, remembered in `localStorage.rb_vlang`, synced with `set_language` (after login and
  on change) so pushes match. Hindi mode is Devanagari (day names, toasts, notification card fixed).
- **Vendor profile photo** (Profile → photo) is saved with `vendor_set_photo` (it used to change only on the phone);
  customers' photos show on Home order cards (`.cav`) and the order screen.
- Item photos/names: `vendor_my_products` also returns `name_en` + `stock_image_url` (migration
  `20260927b_vendor_products_photo_name.sql`); `pImg` = vendor photo → catalog photo → drawing (on load error);
  `pname` shows `name_en` in English. `p.en` stays the vendor's typed name (editing must not rename items).

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
- **Interns see plain English** (27 Sep): `L(hinglish, english)` picks by `isIntern()`; covers menu, titles
  (`TITLES_EN`), Welcome, My tasks, task modals/toasts, My account, notifications drawer, push card, `when()`.
  Sales keep Hinglish. The login screen is still Hinglish (shown before we know who logs in). Server side,
  `admin_add_task` / `admin_reopen_task` send interns English notifications (migration
  `20260927d_intern_english_notifications.sql`).
- **Intern workspace** (28 Sep, migration `20260928a_intern_workspace.sql`): interns get **My tasks** as their own to-do
  sheet (inline-edit table + Board view To do/Doing/Done, filters, search, CSV) — rows they add are `staff_tasks.source='self'`
  (full edit/delete via `staff_task_save` / `staff_task_delete`, interns only = `my_intern_id()`); admin-given rows
  (`source='admin'`) only change status (`staff_set_task_status`, now also `doing`; admins notified only for admin tasks).
  New columns `category`, `link`. **Files & links** (`staff_files` + private Storage bucket `staff-files`, path
  `<staff_id>/…`, 25 MB; storage policies = own folder or `is_admin()`; `team_file_add/team_files/team_file_delete`; opened with
  signed URLs). **Meetings** (`staff_meetings`; `team_meeting_save/team_meetings/team_meeting_cancel/team_meeting_notes`,
  `team_people`; Google Meet link pasted from meet.google.com/new + "Add to Google Calendar" template link; cron
  `rz-meeting-reminders` every 5 min → 15-min reminder). **Daily report** (`staff_daily_reports`, `staff_report_save`,
  `team_reports`; admins notified). Admin console → "🧑‍💻 Intern workspace" tab shows all of it per intern (sheet, files +
  send file/link to an intern, meetings, reports + who hasn't reported today); admin task edit also sets type + link
  (`admin_task_meta`). Meetings nav is visible to sales too.
- **Intern workspace round 2** (28 Sep, migration `20260928b_intern_tools.sql`): My tasks default = **List view** (groups
  Overdue / Today / Tomorrow / Next 7 days / Later / No date / Done-folded, round tick buttons, quick-add bar with due/type/priority,
  "Good morning" hero with today's % ring + 7-day bars); Sheet + Board still there. **Checklist** per task (`staff_tasks.checklist`
  jsonb `[{t,d}]`, `staff_task_checklist(p_id, p_checklist)` — works on admin tasks too; `staff_task_save` unchanged).
  **Meetings: Gmail guests** (`staff_meetings.guest_emails`; `team_meeting_save` got `p_guests text[]` — old 8-arg version dropped)
  → the card's "✉️ Send Gmail invites" opens a Google Calendar template with `&add=<emails>`; saving there makes Google email the
  invite (we have no Google API — the person's own Calendar sends it). 5 new intern tools (intern nav only): **Work timer**
  (`work_sessions`, one open per person, `staff_clock('in'|'out')`, `team_timesheet`; caps a session at 14 h), **Content calendar**
  (`content_posts`, week grid + ideas, `team_posts/team_post_save/team_post_delete`), **Bugs & ideas** (`dev_issues`,
  `team_issues/team_issue_save/team_issue_delete`; high/critical bugs notify admins, assignee notified), **Team notes**
  (`team_notes`, pin = admin only, `team_notes_list/team_note_save/team_note_delete`), **Leave** (`leave_requests`,
  `staff_leave_request/team_leaves/staff_leave_cancel`, admin `admin_leave_decide` → notifications both ways). Admin →
  Intern workspace has sub-tabs Timesheet / Content / Bugs & ideas / Notes / Leave (pending-leave banner). A silent 45 s refresh no
  longer re-renders while someone is typing in the staff site (`typing()`).
- **Team collaboration round 3** (28 Sep, migration `20260928c_team_collab.sql`): `notifications.url` (push_note sends it;
  both sites' `sw.js` open an https url on tap, 🔔 rows show "Join"). Meetings notify every invitee + admins with time + Meet
  link (`team_notify_url`), again 15 min before and at start (`start_notified`); `with_admin` is a real choice now ("👑 Invite
  the admin" / "Doosre admins ko bhi bulao"), the creator is never notified about their own meeting. **Shared tasks**:
  `staff_tasks.collaborators` (owner picks via `staff_task_share`); collaborators see the task (`staff_my_tasks`), change status,
  tick checklist, attach files; `task_json` has `owner`, `owner_name`, `collab_names`, `comments`. **Task comments**
  (`task_comments`, `task_comments_list/task_comment_add/task_comment_delete`; owner + collaborators + admins; admin comments from
  Intern workspace 💬). **File sharing between teammates**: `staff_files.shared_with` (`team_file_share`), Storage read policy
  also allows `can_read_staff_file(name)` (shared with me / on a task I work on). **Team chat** (`team_messages`,
  `team_chat/team_chat_send/team_chat_delete`; @firstname / @all / @admin notify) — staff nav for everyone + admin Intern
  workspace tab. Staff site for interns: **🏠 Home** day view (`vHome`: today's focus, next meeting + Join, hours + timer, report,
  chat preview, shared tasks, bugs on me), nav grouped Work / Me, phone bottom bar (`#bnav`), "n" = new task. The chat bubble class
  is `.cm.mine` — `.me` is the sidebar user block (`.me b{display:block}` broke bubbles).
- **Interns give tasks to each other** (29 Sep, migration `20260929a_intern_give_tasks.sql`): `staff_tasks.source='peer'` +
  `assigned_by` (giver's staff id). `staff_task_assign(p_to uuid[], p_title, p_details, p_priority, p_due, p_category, p_link)` —
  interns only, to active interns only, one copy per person, each notified "📌 X gave you a task". The receiver owns it like an admin
  task (status / checklist / files / comments / add teammates); the giver sees it (`staff_my_tasks` returns it with `given_by_me`),
  can edit or delete it (`staff_task_save` / `staff_task_delete`), can't change its status, and is notified on done / not done /
  comments (`task_people` includes `assigned_by`). Staff site: the front end splits these into `GIVEN` (not in `TASKS`, so they
  don't count as my work); New-task drawer has "Who does it?" chips (Me / interns); Home has "📤 Give a task", **📌 Given to you**
  (open admin + peer tasks) and **📤 You gave** cards; task filters "📌 Given to me" / "📤 I gave". Admin → Intern workspace shows
  them with a "📌 giver" pill and a filter.
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
  block, same-number flag), Villages (add, active toggle, "📍 Location set karo" = full-screen Leaflet map
  (`openPinMap`): draggable pin / tap the map, "Meri GPS" keeps the sharpest reading for 20 s, paste coordinates
  (DMS, decimal or a Google Maps link — `parseCoords`), radius slider, other villages shown as dots; Save =
  `admin_set_area_point(…, verified=true)`. Leaflet 1.9.4 from jsdelivr with sha384 SRI; CSP allows jsdelivr CSS +
  Esri/OSM tiles. Use sha384 for any SRI inside the inline script — `site-csp.py` refuses a 2nd `'sha256-…'`), Messages,
  Staff (add employee with role, edit name/role, approve/reject password requests,
  reset password, turn off), Traffic, Launch check. Customer + vendor drawers show full order history.
- Modals replace `prompt()`/`confirm()`; one delegated click listener on `data-act`.

### Platform (`platform/`) — TypeScript API + React apps (built 30 Sep 2026, not yet deployed)
- Vedanshu asked for a real backend (TypeScript + Express), React frontends split into files, and proper
  security. Layout:
  - `packages/shared` — zod schemas, enums, API types; the API and both apps use them.
  - `packages/web` — React kit: API client, i18n `t(en, hi)`, components, design tokens, push helper, and
    the `.htaccess`/CSP build plugin.
  - `apps/api` — Express.
  - `apps/customer`, `apps/vendor` — Vite + React 19 + React Router + TanStack Query.
  - `e2e/` — Playwright journeys.
- **The API runs on Supabase Edge Functions** (1 Oct 2026, free): `https://srvpfyjmwaruebbkqkdj.supabase.co/functions/v1/api`,
  function `api` = `import` of `supabase/functions/api/bundle.js` pinned to a commit via jsDelivr (repo is public), JWT
  verification off. `npm run build:edge` regenerates that folder from `apps/api` + `packages/shared`. On Edge the session
  travels in the `X-RB-Session` header (`SESSION_TRANSPORT=header`; supabase.co is another site, cookies would be blocked),
  Google login returns it as `#rbs=` in the URL, client IP = `cf-connecting-ip`, session secret =
  `app_settings.api_session_secret`. Supabase Auth redirect URLs must include the two `/functions/v1/api/v1/*/auth/callback`
  URLs. Rate limits are per Edge instance (looser). The old temporary function `rb-ipcheck` is a 410 stub — can be deleted.
- **Browsers only talk to the API** (on Hostinger it would be `api.rozbazaar.shop`, a rozbazaar.shop sub-domain because
  cookies are SameSite=Lax). The API holds the Supabase tokens in encrypted HttpOnly cookies (`rb_c`
  customer, `rb_v` vendor) and calls the same RPCs as the logged-in user. Business rules stay in Postgres.
- The API adds:
  - CORS allow-list and CSRF (`X-Requested-With: rozbazaar` + Origin check);
  - rate limits (login, wrong passwords, OTP guesses, bookings);
  - zod validation;
  - helmet headers;
  - pino logs with redaction;
  - row → camelCase mappers (the vendor never gets `deliveryOtp`);
  - an image cache (`/v1/img/:hash`) instead of base64 photos inside JSON.
- The vendor login email is looked up server-side (service key); the browser never sees it.
- Local dev with no production data: `npm run dev:mock` runs the API against
  `apps/api/src/dev/fake-supabase.ts`, an in-memory fake of every RPC used (demo vendor 8198941588 / sabzi1234).
  **When you add an RPC call to the API, implement it in the fake too** (same rules as the real one).
- Checks:
  - `npm run lint`, `typecheck`, `test` (36 API tests incl. security + full order lifecycle, app unit tests),
    `build`;
  - `npm run e2e` (3 browser journeys; run them against `vite preview`, which sends the real CSP).
- Web apps: strict CSP (`script-src 'self'`, `style-src 'self'`) — **no inline `<script>`/`<style>` anywhere**,
  including static pages like `privacy.html` (its CSS/JS are separate files).
- **Customer app = exact port of `customer/index.html`** (1 Oct 2026, Vedanshu: "exact look it was in past"):
  original CSS verbatim in `apps/customer/src/styles/legacy.css` (+ small `app.css`), original markup/class names
  (`.scr on`, `#nav`, `.cart`, `.bn`, `#foot`, `.loc-ask`, `.sheet-wrap` …), the 106 SVG drawings in `src/art/drawings.ts`
  (generated from the old file; rendered by `Art`), Leaflet bundled from npm (tiles/Nominatim allowed in the CSP via
  `extraImgHosts`/`extraConnectHosts`), Fraunces self-hosted. Screens in `src/screens/`, pop-ups in `src/overlays/`,
  basket/checkout rules in `src/state/` (`useCart` = fly-to-cart + vendor picker, `useCheckout` = stock → ₹50 → slot →
  login → address → book). Keep it looking like the old app; don't swap in the web kit's components.
- Vendor app keeps the **original Home layout** (hero + day pills + slot groups + quick actions) and is
  Hindi by default.
- Docs: `platform/docs/DEPLOY.md` (all on Hostinger: API as a Node.js app or VPS, apps as static sites, beta sub-domains first, rollback),
  `SECURITY.md` (controls + what's still open), `PARITY.md` (what is not ported yet: Leaflet map pin, customer
  self-check screen, favourites UI, recurring orders…), `ARCHITECTURE.md`.
- DB migration `database/migrations/20260930a_security_hardening.sql` (applied):
  - anon lost execute on login-only/admin functions (booking, admin catalogue/products/messages, vendor
    product/slot/earnings, `vendor_login_email`, `can_read_staff_file`);
  - `admin_areas()` got `admin_guard()`;
  - new `customer_me()` and `product_image(id)`.
  - `vendor_login_lookup` stays anon only until the old vendor site is retired.

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

### Security lockdown (4 Oct 2026 — migrations `20261004a/b/c`)
- **No table/view/sequence privileges for `anon` / `authenticated`** (and none by default for new tables). Before this,
  RLS only checked ownership, so through `/rest/v1/<table>` a vendor could approve itself or its products, mark a
  booking delivered without the code, a customer could change totals or delete payments, and anyone could read vendor
  phones. Every site only uses RPCs, so nothing broke. **A new table needs no grants — add an RPC instead.**
  When you write a test as `authenticated`, do table setup before `set_config('role',…)`.
- Order-state rules in the RPCs: `vendor_set_status` only forward (repeat = ok, no-op), vendor cancel only before the
  bill, OTP issue only after the bill, customer dispute only on a bill, payment 0 < amount ≤ 1,00,000, bill lines
  qty 0–1000 / price 0–1,00,000, a bill can only add the vendor's own products. `customer_update_profile` validates
  the number and refuses one used by another customer. `maps_url` is internal only.
- **Stored XSS fix in both live sites**: vendor item names and customer names / notes / addresses went into
  `innerHTML` unescaped. `rpc()` in `customer/index.html` and `vendor-site/index.html` now passes every response
  through `safeData()` (`< > " ' \`` → look-alike ‹ › ” ’ ‘; data:image and https URLs kept). Keep all server data
  going through `rpc()`.
- Still open (by choice): `vendor_login_lookup` returns a vendor's login email; `notification_track` and
  `log_visit` are anon-callable; Supabase "leaked password protection" is a dashboard toggle (Auth → Passwords).

### Slots & seats (4 Oct 2026, migration `20261004d_slot_settings.sql`)
- `vendor_slot_defaults(vendor, slot, capacity, is_open)` = the vendor's standing setting; `slot_cap_default()` /
  `slot_open_default()` are used by every reader (`customer_slot_status_for`, `customer_available_vendors`, `match_vendor`,
  `customer_create_booking`, `vendor_my_slots`) when a day has no `vendor_slots` row.
- `vendor_slots.booked_count` is **recounted from real bookings** (status not cancelled / missed) by `slot_recount()` on every
  booking insert / update / delete (`tg_slot_count`, triggers `trg_slot_ins/upd/del`) — a cancelled order frees its seat at once.
  `admin_reassign_booking` no longer touches the counter itself. 10 drifted counts were fixed on 4 Oct.
- `customer_slot_status(type, area, date)` still exists (platform API uses it) and just calls `customer_slot_status_for(…, null)`.
- The Supabase MCP `execute_sql` / `apply_migration` hang on `DROP …` (they wait for a confirmation nobody can give here) —
  avoid DROP in tool calls; keep old signatures and add a new function instead.

### Booking guards in `customer_create_booking` (16 Oct 2026, migration `20261016d`)
Refused on the server, not just hidden in the app: today's slot after its cut-off (60 min before start, same rule as
`customer_slot_status_for`; code `SLOT_PAST`), dates more than 14 days ahead, qty outside 0 < q ≤ 100 / > 60 lines
(`BAD_QTY`), total under `min_order()` (`BELOW_MIN`), a 7th open order for the same day (`TOO_MANY`), a vendor who does
not cover the address's village in that slot (`vendor_covers_area_in_slot` — it was only checking `areas_served`),
other vendors' items (`OTHER_VENDOR`). `vendor_record_payment` notifies admins (`payment_low`) when the payment is under
80% of the bill (commission is computed from payments). Rating comment / dispute reason / order note are cut to 500 chars.
Still open by choice: phone login has no OTP until an SMS provider is set (anyone who types a number gets that account).

### Loophole fixes (17 Oct 2026, migrations `20261016e_audit_fixes.sql` + `20261016f_messages_hindi.sql`)
- **Spam from anyone (anon):** `customer_join_waitlist` (village must exist, 10-digit phone, one per day, admin push only if ≤10/hour),
  `customer_send_message` (≤2000 chars, ≤5/hour per customer or phone, ≤100/hour total), `log_visit` (<600 rows/minute).
- **Customers:** `customer_save_address` (village must exist, GPS in range, length limits, ≤20 addresses); phone login on a new
  device notifies the account ("🔐 New login on your account") and keeps the account's name; cancel reason ≤300.
  `customer_create_schedule` (recurring orders) is not callable by anyone — no site uses it, and it skipped every booking guard.
- **Seat race:** `customer_create_booking` takes `pg_advisory_xact_lock(vendor|date|slot)` and recounts real bookings before the
  insert, so two people can't both take the last place (`VENDOR_FULL`).
- **Vendors:** rates must be ₹1–₹1,00,000 (`vendor_bulk_prices`, `vendor_upsert_product`, `vendor_activate_catalog_item`);
  renaming an approved item or giving it a new photo sends it back to admin approval (`review_status='pending'`, message says so);
  category must be vegetable/fruit/onion_potato; photos go through `rb_valid_photo`; `vendor_update_profile` takes only villages
  that exist (≤30), capacity 1–60; `vendor_set_capacity` 0–60 and today..+60 days; `vendor_apply` refuses anonymous logins;
  **bill rate cap:** `vendor_finalize_bill` refuses a line rate above `booked rate × 2 + ₹20` (door-added items: app rate × 2 + ₹20),
  named in the message; door items with qty ≤ 0 are skipped.
- **Staff:** `team_post_save` edits only by the creator or an admin; `team_issue_save` edits only by creator, assignee or admin
  (any staff could rewrite anyone's post/bug by id before).
- **Messages:** 26 new `msg_i18n` rows; messages with a number or item name use `tr_dev(devanagari, english)` (internal, not
  callable from outside). Customer "bill ready" / "order cancelled" notifications are proper Hindi/English with a title
  ("🧾 बिल तैयार है — ₹150", not "Bill taiyaar hai — ₹355.0000"). Vendor-side notifications are still Hinglish (their old style).
- Vendor site: a refused bill no longer leaves the order marked "bill sent" on the phone; "Save villages" shows the server's
  refusal instead of always saying Saved.

### Uploaded photos are files, not data URLs (19 Oct 2026, migration `20261019a_photos_as_files.sql`)
- Vendor item photos (`products.image_url`), vendor profile photos (`vendors.photo_url`) and the copy in every booked item
  (`booking_items.image_url`) used to be base64 data URLs sent inside every list: `customer_home` 873 KB (re-sent every 25 s
  by a logged-in customer's poll), `customer_my_bookings` 557 KB, `admin_bookings` 2.6 MB (admin refreshes every 60 s) — the
  free plan's 5 GB/month egress would run out with a handful of users. Now 18 KB / 47 KB / 127 KB.
- Trigger `tg_photo_to_file` (after insert / update of those columns, only when the value is a `data:image/…`) → pg_net →
  edge function `item-photos` mode `own` → file `item-photos/u/<sha256-32>.<ext>` (public, 1-year cache, same photo = same
  file) → `photo_link_set(table, id, sha256-of-old-value, url)` (service role only) swaps the value only if the row still holds
  that photo. Takes ~1–2 s after a save; apps already treat https links like data URLs.
- `rb_valid_photo()` also accepts our own `…/item-photos/u/<hash>.<ext>` links (the vendor app sends the current photo back on
  edit), nothing else from outside. Customer profile photos stay data URLs on purpose (only vendors see them; a public link
  would be less private). Existing data was converted on 19 Oct (15 product/vendor photos + 35 booked-item copies → 16 files).
- `send-push` (19 Oct): reads its secret / VAPID key with retries and remembers only a successful read — two copies booting
  at once sometimes got a 401 on the first read and refused that push (one of the two 05:00 price reminders was lost every day).

### Four "crazy" features (20 Oct 2026 — migrations `20261020a_live_tracking.sql`, `20261020b_gali_groups.sql`)
- **Order by voice (customer site).** 🎤 in the home search bar, the search screen and the desktop nav, plus a home card
  ("Just say what you need") → `openVoice(true)` → `#voxSheet`. The phone's own `SpeechRecognition` (hi-IN default, en-IN toggle,
  `localStorage.rb_vox_lang`, 3 guesses per sentence → the best-understood one) writes into a text box the customer can also type
  in/correct; `VORDER.parse(text, PRODUCTS, preferVendors)` (pure, between `VOICE-PARSER-START/END`) turns it into packs:
  Hindi/Roman/English numbers (आधा, डेढ़, ढाई, सवा, साढ़े, पौने, सौ, digits), units (किलो, ग्राम, पाव, पीस, दर्जन, गड्डी, रुपये / "बीस का"),
  local names (`SYN`: घीया, गंठा, बताऊं, मिरच …), typos (edit distance). Quantity → whole packs of the vendor's unit
  ("approx" note when not exact). Same item at 2 vendors → the basket's vendor, else the vendor covering most of the list, else cheapest.
  Nothing enters the basket until "Add to basket". Out of stock / not sold here / not understood are listed. Functions are `vx*`
  (the old welcome-voice engine already owns `VOX` and `voxStop`). **`customer/.htaccess` Permissions-Policy must say
  `microphone=(self)`** (it said `microphone=()`, which silently blocks the mic). Test: `node scripts/test-voice-parser.js` (52 phrases).
  Logged as `log_visit('voice_open' / 'voice_order')`.
- **Live sabzi-wala tracking.** Vendor taps "I'm on the way" → vendor site `liveSync()` starts `watchPosition` + screen Wake Lock and
  sends `vendor_share_location` (every 15 s, or 6 s after moving 40 m, a 20 s heartbeat while standing still; a reading that came too
  soon is sent later, never dropped). A green bar ("Live location on — N customers can see you") sits on Home and the order screen
  (`.live-slot`); it stops when no order is on the way (server answers `sharing:false`). Customer site: Home banner `#wayBar`
  ("Sanjiv is on the way · ~8 min · Track"), "Track live on map" on My bookings → `#trackSheet` (Leaflet + OSM, house pin, moving
  thela, dashed line, ETA/distance, "updated N s ago", call) polling `customer_track` every 10 s; at ~700 m the DB sends
  "🛵 almost there" (`booking_near`) once. Phones stop GPS for background pages — the vendor must keep the app open (the bar says so).
  **Any date (21 Oct 2026, migration `20261021a_live_tracking_any_date.sql`):** the first real test marked TOMORROW's orders
  "on the way" at 11:20 PM and nothing was shared — the app only looked at today's list and the server only counted today's
  orders. Now every order marked on_the_way (yesterday … +14 days) counts; `vendor_live_needed()` is asked when the vendor app
  opens, every 20 s poll and when it comes back on screen, so sharing runs whatever day the screen shows and restarts on reopen.
- **Today's rates card for WhatsApp.** `rcDraw()` paints a 1080×1350 JPEG on a canvas: logo, date, village, up to 12 items with
  photos (Supabase Storage sends `Access-Control-Allow-Origin: *`; a failed photo falls back to the cut-out / a letter), link,
  QR (`RC_QR` = https://rozbazaar.shop/?src=card). Customer: "Send today's rates on WhatsApp" at the bottom of the rates board
  (cheapest rate per item, staples first). Vendor: green button on Stock & rates (pulses "Rates changed — tell your customers"
  after the first rate change of the day; `rb_rc_day`). Phones share the picture + caption with `navigator.share({files})`;
  elsewhere WhatsApp (wa.me) opens with the text and the picture downloads. Links carry `?a=<village>&src=wa_rates|wa_vendor|gali|card`:
  `RB_LINK` (read before the share-tag stripper, which now also removes `a` and `src`) opens that village (unknown name → default),
  skips the location prompt and logs the visit.
- **Gali group order.** Houses close together (default ≤150 m by GPS pin, or same village + same street text) that book the same
  vendor, day and slot form a group; at 3 houses (admin) every house gets a bonus the vendor brings (admin text, default
  "मुफ़्त धनिया-मिर्च" — no money changes in the app). Customer: home card "Order with your neighbours" (WhatsApp invite),
  slot list hint "2 neighbours booked this time — 1 more house = …" (`customer_gali_slots`, counts only), success screen
  "Gali group: 2 of 3 houses" + invite naming the slot/vendor, My bookings line (`customer_gali_status`). DB trigger
  `trg_gali_check` notifies every house + the vendor once when a group completes (`gali_complete`). Vendor: badge on order cards
  ("गली ग्रुप · 3 घर — दो मुफ़्त धनिया-मिर्च") + note on the order screen (`vendor_gali_groups`). Admin → Settings → "Gali group"
  (on/off, houses 2–10, metres 50–1000, bonus Hindi + English; `admin_set_gali`) shows how many orders are in complete groups.
- Not testable here without a real phone: speech recognition inside the Play-Store app (TWA), GPS while walking, Wake Lock,
  the Android share sheet. Everything else was tested in the browser with fakes, and the DB parts with rolled-back transactions.

### Service area — "not in your area yet" (21 Oct 2026, migration `20261021b_service_area.sql`)
- Vedanshu: anyone more than 8–10 km from Khandewla / Jatola gets "Thank you for using RozBazaar, but it's not available in your
  area". `app_settings.service_km` (default **8**, admin → Settings → "Service area", `admin_set_service_km` 1–50) = distance from the
  nearest active village that has a location. A new village added with a location in admin → Villages joins the area by itself.
- Server: `customer_save_address` refuses a pin outside (code `OUT_OF_AREA`, `data` = `service_area_check()`), `customer_create_booking`
  refuses an address whose pin is outside. An address with NO pin (village picked from the list) is allowed — that is how someone
  orders for family in a village. The 4 old far-away pins were left as they are (Vedanshu said no to clearing them); those
  customers see the sheet with "Change the address pin" when they book. Admin Settings shows how many saved pins are outside.
- Customer site: `#oosSheet` (`openOos(d, from)`; from = `loc` → "Pick a village", `addr` → stay and move the pin, `book` →
  "Change the address pin" = `openAddrEditor(addr.id)`). Shown by `detectArea()` when the GPS fix minus its error margin is beyond
  `SERVICE_KM` (on its own once a day, `rb_oos_day`; a tap on "Use my location" always shows it), by the address screen when the pin
  lands outside (`matchAreaFromCoords`, red line under the village + the sheet at most once a minute), before saving
  (`serviceCheck()` against `AREAS` lat/lng — also covers guests, whose address is only kept on the phone) and on the server codes.
  Between a village's own radius and `SERVICE_KM` the village list opens with "You are near X — please pick your village"
  (it used to say "we do not reach there" for anyone beyond the 2 km village radius). Logged as `log_visit('out_of_area')`.
- The platform/ API is not updated for this (not deployed); it passes the server's message through.

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
  **One booking = one vendor's items (16 Oct 2026, migration `20261016c_booking_one_vendor.sql`):** 11 real orders went
  to one vendor with the other vendor's items/prices. `customer_create_booking` refuses other vendors' items (code
  `OTHER_VENDOR`) and, with no vendor named but all items from one vendor, books that vendor instead of `match_vendor`'s pick.
  **Mixed basket = one order per vendor (16 Oct 2026, Vedanshu's ask):** `basketGroups()` splits the basket by vendor (the
  first chosen vendor first); the basket shows "2 vendors = 2 separate orders" + "Order 1 · <vendor>" groups with subtotals,
  each order needs ≥ ₹`MIN_BASKET` (`smallOrders`); `createBooking()` books each group separately (its own `p_vendor_id`,
  items, vendor type via `ensureVendorTypes`/`vendorTypeOf`) in the same slot; the success screen (`paintSuccess`) lists every
  order with its code + delivery code, and a failed one (e.g. VENDOR_FULL) stays in the basket with a note. The slot list
  (`getSlots`) asks `customer_slot_status_for` for every vendor in the basket and shows only slots ALL of them can do.
  If another vendor in the basket also has an item IN STOCK, the item row offers "Also with X · ₹y — move to that order"
  (`moveToVendor`; never automatic, never to a vendor without stock). Items sold by 2+ vendors: the card says "N vendors
  sell this — tap to compare"; tapping the card (`cardTap`) or ADD (when 2+ have it in stock) opens the comparison sheet
  with each vendor's own photo of the item, price, "lowest price", "already in your basket" / "separate order · own bill";
  "+" on an item already in the basket just adds (no sheet).
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
   Since Oct 2026 the Supabase MCP holds every DELETE (and a migration containing `delete from auth.users`) for the
   owner's confirmation and times out when nobody answers — prefer tests that create nothing (fake supabase in the
   browser), or test with SELECT/UPDATE-only paths. Leftover from 16 Oct: test customer phone `9000000071`
   ("Test Device", 2 anonymous auth users, push subscription on example.invalid switched off) — delete in the
   dashboard SQL editor.
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
13. Rolling back from the new React build to the old customer site: the new build's `.htaccess`
    CSP (`connect-src` = only the API, `script-src 'self'`) blocks supabase-js and Supabase, so the
    old app shows no products/vendors/villages. Always upload `customer/.htaccess` with the old files.
14. WhatsApp/Facebook cache link previews — after changing `og.jpg`, re-scrape
    with Facebook's Sharing Debugger.

---

## 6. Current state (26 Sep 2026)

**Built and working:** full customer ordering flow, vendor order lifecycle,
recurring schedules, ratings, disputes, waitlist, web push, admin console with
finance dashboard. Everything above verified end-to-end in the browser.

**Live data:** 3 vendors, 14 customers, 26 products, 52 bookings, 28 payments
(₹5,715 GMV), 17 ratings — mostly from development dry runs.

**Recent changes, newest first**
- 30 Sep 2026: `platform/` — TypeScript/Express API + React customer and vendor apps with server-side sessions,
  CSRF/CORS/rate limits/validation/CSP, and a fake Supabase for local dev and tests; DB security-hardening
  migration applied. Old apps still live until cut-over (platform/docs/DEPLOY.md).
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
7. `database/schema.sql` is from 26 Sep (outdated). A full current backup (structure + data) comes from
   `public.rb_backup_sql()` via the `rb-backup` Edge Function link (see database/DUMP_FULL_SCHEMA.md). Never commit a
   data backup — the repo is public.

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
