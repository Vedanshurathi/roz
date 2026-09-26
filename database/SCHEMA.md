# RozBazaar — Database Reference

Supabase project `srvpfyjmwaruebbkqkdj` · Mumbai (ap-south-1) · Postgres 17
URL: `https://srvpfyjmwaruebbkqkdj.supabase.co`

Snapshot taken 26 Sep 2026 straight from the live database.
Function *bodies* are not in this file — pull them with the command in
`DUMP_FULL_SCHEMA.md`. This file tells you what exists and how it fits together.

---

## Live row counts (at snapshot)

| table | rows | | table | rows |
|---|---|---|---|---|
| vendors | 3 | | payments | 28 |
| customers | 14 | | ratings | 17 |
| products | 26 | | areas | 8 |
| bookings | 52 | | catalog_items | 104 |
| waitlist | 6 | | | |

Mostly test/dry-run data from development — treat as real production rows
anyway. Never bulk-delete without asking Vedanshu.

---

## Enums

| enum | values |
|---|---|
| `booking_status` | placed, on_the_way, reached, bill_final, bill_approved, paid, delivered, completed, cancelled, missed, disputed, pending_review |
| `pay_method` | cash, **upi_direct**, online  ← note: not `upi` |
| `product_review_status` | pending, approved, rejected |
| `schedule_mode` | one_time, recurring |
| `time_slot` | morning, afternoon, evening |
| `vendor_status` | pending, approved, rejected, suspended |
| `vendor_type` | vegetable, fruit, onion_potato |

Slot windows (from `slot_window()`): morning 07–11, afternoon 12–16, evening 17–20 IST.

---

## Tables

### vendors
```
id uuid PK · auth_user_id uuid · name text NOT NULL · phone text NOT NULL
shop_name text · v_type vendor_type NOT NULL · vehicle text
areas_served text[] NOT NULL DEFAULT '{}'
status vendor_status DEFAULT 'pending' · applied_at · reviewed_at · reviewed_by · review_note
is_active boolean DEFAULT true · default_capacity int DEFAULT 15 · photo_url
avg_rating numeric · total_ratings int · total_orders int · created_at · lang DEFAULT 'en'
```

### vendor_slots  — per-day capacity
```
id · vendor_id NOT NULL · slot_date date NOT NULL · slot time_slot NOT NULL
capacity int DEFAULT 15 · booked_count int DEFAULT 0 · is_open boolean DEFAULT true
```
No row for a date = vendor's `default_capacity` applies and slot is open.

### vendor_slot_areas  — per-slot village restriction (added Sep 2026)
```
id · vendor_id NOT NULL · slot time_slot NOT NULL · area text NOT NULL · created_at
UNIQUE(vendor_id, slot, area)
```
No rows for a slot = vendor covers all of `areas_served` in that slot.
Rows present = only those villages. Always read through
`vendor_covers_area_in_slot()`, never directly.

### customers
```
id · auth_user_id NOT NULL · auth_provider DEFAULT 'google' · name · email · phone
is_blocked boolean DEFAULT false · created_at · lang DEFAULT 'hi'
```

### addresses
```
id · customer_id NOT NULL · label DEFAULT 'Ghar' · house_no · street · landmark
area text NOT NULL · lat · lng · is_default · created_at
```

### products  — one row per vendor per item
```
id · vendor_id NOT NULL · name NOT NULL · name_hi · image_url · unit DEFAULT 'kg'
price numeric NOT NULL · price_updated_at · in_stock DEFAULT true
category vendor_type NOT NULL · sort_order · created_at
review_status product_review_status DEFAULT 'pending' · reviewed_by · reviewed_at · review_note
catalog_key text  ← links to catalog_items.key when picked from the catalogue
```

### catalog_items  — master list of 104 items vendors pick from
```
key text PK · name_en · name_hi · desc_en · desc_hi · category · default_unit
art_key · is_active DEFAULT true · sort_order
```

### bookings
```
id · code text (RB-######) · customer_id NOT NULL · vendor_id · schedule_id
address_id NOT NULL · v_type vendor_type NOT NULL · booking_date date NOT NULL
slot time_slot NOT NULL · status booking_status DEFAULT 'placed'
delivery_otp text NOT NULL · otp_verified_at · otp_attempts · otp_issue_note
bill_final_at · bill_approved_at · est_total · final_total · note
cancel_reason · dispute_reason · admin_note · created_at · updated_at
```

### booking_items
```
id · booking_id NOT NULL · product_id · product_name NOT NULL · unit · image_url
qty NOT NULL · price_at_booking NOT NULL · final_qty · final_price
added_at_door boolean · removed boolean
```

### booking_schedules  — recurring orders
```
id · customer_id · address_id · v_type · mode schedule_mode · weekdays int[]
slot · start_date · end_date · is_active · template jsonb · last_spawned · created_at
```

### payments
```
id · booking_id NOT NULL · method pay_method NOT NULL · amount NOT NULL · paid_at
```

### ratings
```
id · booking_id NOT NULL · vendor_id NOT NULL · stars int NOT NULL · comment · created_at
```

### areas  — the 8 served villages
```
id · name NOT NULL · is_active · lat · lng · radius_km DEFAULT 4
coords_verified boolean · sort_order · created_at
```
Villages: Khandewla, Haileymandi, Rampur, Tirpari, Basunda, Jatola, Jatauli, Todapur.

### staff  — employees who can open the staff app (added 26 Sep 2026)
```
id · auth_user_id NOT NULL UNIQUE → auth.users · name NOT NULL · phone
is_active boolean DEFAULT true · created_at
```
RLS on, no policies — read only through `is_staff()` / `staff_me()` / `staff_snapshot()`.

### Supporting tables
- `admins` — id, auth_user_id, name. Admin = `e9370460-2105-4c1f-9b16-877d1fff1ed6`
- `waitlist` — customer_id, area, v_type, phone, notified (demand where no vendor serves)
- `favourites` — customer_id, product_id
- `notifications` — user_id, role, type, title/title_en, message/message_en, booking_id, is_read
- `push_subscriptions` — web-push endpoints (user_id, role, endpoint, p256dh, auth_key…)
- `messages` — contact-form messages to admin
- `audit_log` — actor, actor_role, action, entity, entity_id, detail
- `site_visits` — page, visited_on (IST date)

### Views
`booking_full` (bookings joined with customer/vendor/address/items — used by
`customer_my_bookings`, `vendor_bookings`), `admin_overview`, `bill_diff`,
`live_products`, `live_vendors`.

### Security
- RLS enabled on every table, 37 policies. Clients never touch tables directly —
  everything goes through `SECURITY DEFINER` RPCs.
- Identity helpers: `my_customer_id()`, `my_vendor_id()`, `my_role()`, `is_admin()`.
- Every `admin_*` RPC starts with `perform admin_guard();`.

---

## Cron jobs (pg_cron — times are UTC)

| job | schedule (UTC) | = IST | does |
|---|---|---|---|
| rz-expire-missed | `0 * * * *` | hourly | `job_expire_missed()` — marks past, unfulfilled bookings missed |
| rz-spawn-recurring | `0 20 * * *` | 01:30 | `job_spawn_recurring()` — creates bookings from schedules |
| rz-price-reminder | `30 23 * * *` | 05:00 | `job_price_reminders()` — nudges vendors with stale prices |

---

## RPC return convention

Every RPC returns `jsonb`:
```json
{ "ok": true,  "data": ... }
{ "ok": false, "msg": "Hindi/English message shown to the user" }
```
Frontends check `r.ok`, never exceptions (except `admin_guard`, which raises).

---

## All 124 public functions

`[definer]` = SECURITY DEFINER.

### Admin
```
admin_add_catalog_item(p_name_en, p_name_hi, p_desc_en, p_desc_hi, p_category, p_default_unit) [definer]
admin_add_vendor(p_name, p_phone, p_type vendor_type, p_areas text[], p_shop, p_vehicle, p_capacity int=15)
admin_areas() [definer]
admin_block_customer(p_customer uuid, p_blocked bool) [definer]
admin_bookings(p_date date, p_status booking_status, p_area text, p_limit int=100) [definer]
admin_cancel_booking(p_booking uuid, p_reason text) [definer]
admin_capacity_watch(p_days int=7) [definer]
admin_catalog_list() [definer]
admin_customers(p_limit int=100) [definer]
admin_daily_report(p_days int=14) [definer]
admin_demand_gaps() [definer]
admin_finance_dashboard(p_days int=30) [definer]      ← GMV, AOV, cash/UPI, trend, top vendors
admin_guard() [definer]
admin_link_vendor_login(p_vendor uuid, p_auth uuid) [definer]
admin_mark_message_read(p_message uuid, p_read bool=true) [definer]
admin_messages(p_limit int=100) [definer]
admin_overview_stats() [definer]
admin_pending_products() [definer]
admin_products() [definer]
admin_reassign_booking(p_booking uuid, p_vendor uuid) [definer]
admin_recompute_area_coords(p_min_samples int=5) [definer]
admin_remove_catalog_item(p_key text) [definer]
admin_resolve(p_booking uuid, p_status booking_status, p_note text) [definer]
admin_review_product(p_product uuid, p_decision product_review_status, p_note text) [definer]
admin_review_vendor(p_vendor uuid, p_decision vendor_status, p_note text) [definer]
admin_set_area_point(p_name, p_lat, p_lng, p_radius numeric=4, p_verified bool=true) [definer]
admin_update_product(p_product uuid, p_price, p_in_stock, p_name, p_name_hi, p_category, p_unit) [definer]
admin_upsert_area(p_name text, p_active bool=true) [definer]
admin_vendor_performance(p_days int=30) [definer]
admin_vendors(p_status vendor_status) [definer]
admin_visit_stats(p_days int=30) [definer]
```

### Vendor
```
vendor_activate_catalog_item(p_key, p_price, p_unit) [definer]
vendor_apply(p_name, p_phone, p_type, p_areas, p_shop, p_vehicle, p_capacity=15, p_lang='en') [definer]
vendor_bookings(p_date date=CURRENT_DATE) [definer]
vendor_bulk_prices(p_prices jsonb) [definer]
vendor_cancel_booking(p_booking, p_reason) [definer]
vendor_covers_area_in_slot(p_vendor_id, p_area, p_slot)        ← single source of truth for coverage
vendor_delete_product(p_product) [definer]
vendor_earnings_range(p_from date, p_to date) [definer]
vendor_earnings_week() [definer]
vendor_finalize_bill(p_booking, p_items jsonb) [definer]
vendor_get_slot_areas() [definer]
vendor_me() [definer]
vendor_my_pending_products() [definer]
vendor_my_products() [definer]
vendor_my_reviews(p_limit=30) [definer]
vendor_my_slots(p_from date=CURRENT_DATE, p_days=7) [definer]
vendor_record_payment(p_booking, p_method pay_method, p_amount) [definer]
vendor_report_otp_issue(p_booking, p_reason) [definer]
vendor_set_active(p_active bool) [definer]
vendor_set_capacity(p_date, p_slot, p_capacity, p_open=true) [definer]
vendor_set_slot_areas(p_slot time_slot, p_areas text[]) [definer]   ← empty/null array = unrestricted
vendor_set_status(p_booking, p_status) [definer]
vendor_set_stock(p_product, p_in_stock) [definer]
vendor_slot_route(p_date, p_slot, p_mode='driving') [definer]
vendor_stats(p_days=30) [definer]
vendor_upcoming(p_days=7) [definer]
vendor_update_profile(p_name, p_shop, p_vehicle, p_areas, p_capacity, p_photo) [definer]
vendor_upsert_product(p_name, p_unit, p_price, p_category text, p_image, p_sort, p_product_id, p_name_hi) [definer]
vendor_verify_otp(p_booking, p_otp) [definer]
```

### Customer
```
customer_approve_bill(p_booking) [definer]
customer_available_types(p_area) [definer]
customer_available_vendors(p_type, p_area, p_date, p_slot text) [definer]
customer_bill_preview(p_booking) [definer]
customer_bootstrap(p_name, p_phone, p_email, p_provider='google') [definer]
customer_cancel_booking(p_booking, p_reason) [definer]
customer_catalogue(p_type, p_area) [definer]
customer_create_booking(p_type, p_address_id, p_date, p_slot, p_items jsonb, p_note, p_vendor_id) [definer]
customer_create_schedule(p_type, p_address_id, p_weekdays int[], p_slot, p_start, p_end, p_items) [definer]
customer_delete_address(p_id) [definer]
customer_dispute_bill(p_booking, p_reason) [definer]
customer_home(p_area) [definer]
customer_join_waitlist(p_area, p_type, p_phone) [definer]
customer_last_order() [definer]
customer_my_addresses() [definer]
customer_my_bookings(p_limit=30) [definer]
customer_phone_login(p_name, p_phone) [definer]        ← phone-only login, no OTP (deliberate)
customer_rate(p_booking, p_stars, p_comment) [definer]
customer_save_address(p_label, p_house, p_street, p_landmark, p_area, p_lat, p_lng, p_make_default=true, p_address_id) [definer]
customer_send_message(p_name, p_body, p_phone, p_email) [definer]
customer_set_pin(p_address, p_lat, p_lng) [definer]
customer_skip_booking(p_booking) [definer]
customer_slot_status(p_type, p_area, p_date) [definer]
customer_stop_schedule(p_schedule) [definer]
customer_toggle_favourite(p_product) [definer]
customer_update_profile(p_name, p_phone) [definer]
customer_vendors_for_product(p_area, p_product_name) [definer]   ← powers the "pick a vendor" price picker
customer_vendors_in_area(p_area) [definer]
```

### Shared helpers
```
area_from_point(p_lat, p_lng) [definer]       ← GPS → village; returns in_range/served/confident
catalog_items_list() [definer]
is_admin() [definer] · my_customer_id() · my_vendor_id() · my_role() · my_lang()
ist_date() · ist_now() · ist_time()           ← ALWAYS use these, never now()/current_date for business logic
km_between(lat1, lng1, lat2, lng2)
log_action(p_action, p_entity, p_id, p_detail) [definer]
log_visit(p_page) [definer]
maps_url(p_address, p_mode) [definer]
mark_notification_read(p_id) · my_notifications(p_limit=30)
match_vendor(p_type, p_area, p_date, p_slot)   ← auto-assigns least-loaded, best-rated vendor
notify_bi(p_user, p_role, p_type, p_title_hi, p_title_en, p_msg_hi, p_msg_en, p_booking)
notify_user(p_user, p_role, p_type, p_title, p_msg, p_booking)
public_areas() [definer]
rls_auto_enable() [definer]
save_push_subscription(p_endpoint, p_p256dh, p_auth, p_agent) [definer]
set_language(p_lang) [definer]
slot_window(p_slot)
spawn_schedule_bookings(p_schedule, p_days=21) [definer]
tr(p_hi, p_en)
```

### Staff (added 26 Sep 2026 — `database/migrations/20260926_staff_app.sql`)
```
is_staff() [definer]          ← active staff row or is_admin(); not callable by clients
staff_me() [definer]          ← {name, is_admin} or ok:false
staff_snapshot() [definer]    ← {today, bookings (90 days + upcoming, trimmed), vendors}
staff_login_email(p_phone)    ← '<10 digits>@staff.rozbazaar.shop' (staff log in with phone + password)
admin_staff_list() · admin_add_staff(p_name, p_phone, p_password) [definer]
admin_set_staff_active(p_staff, p_active) · admin_reset_staff_password(p_staff, p_password) [definer]
```
(`20260926b_staff_phone_login.sql`; `staff_me()` now also returns `phone`.)
```
admin_add_staff(p_name, p_phone, p_password, p_role=null) · admin_update_staff(p_staff, p_name, p_role) [definer]
admin_password_requests() · admin_decide_password_request(p_request, p_approve) [definer]
staff_update_my_name(p_name) · staff_request_password(p_password) · staff_password_status() [definer]
```
(`20260926c_staff_roles_password_approval.sql`: `staff.role`, table `staff_password_requests`
(staff_id, new_hash, status pending/approved/rejected/replaced) — RLS on, no client access;
`staff_me()` returns `role`; `staff_snapshot()` bookings include `customer_id`.)

### Triggers & jobs
```
tg_booking_defaults() · tg_guard_delivered() · tg_slot_count() · tg_status_notify()
tg_touch_price() · tg_vendor_orders() · tg_vendor_rating()
job_expire_missed() · job_price_reminders() · job_spawn_recurring()
```
