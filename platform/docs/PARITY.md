# Parity with the old single-file apps

What the React apps already do, and what is still only in `customer/index.html` or
`vendor-site/index.html`. Check this before cut-over (DEPLOY.md §5).

✅ = done and covered by a browser journey.
☑️ = done, checked by hand or by unit/API tests only.
❌ = not ported yet.

## Customer (`apps/customer`)

| feature                                                                                  | status  | notes                                                                                                                                        |
| ---------------------------------------------------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Browse without login, village picker, "use my location" (refuses fixes worse than ±3 km) | ✅      |                                                                                                                                              |
| Category tabs, search                                                                    | ✅      |                                                                                                                                              |
| Item photos: vendor photo → catalogue photo → fallback                                   | ☑️      | Fallback is an emoji. The old app drew SVG illustrations.                                                                                    |
| Item sold by 2+ vendors → vendor picker with prices; one vendor per booking              | ✅      |                                                                                                                                              |
| Basket: out-of-stock marking, note for the vendor                                        | ✅      |                                                                                                                                              |
| Slot picker (5 days × 3 slots, full / not served shown)                                  | ✅      |                                                                                                                                              |
| Phone login (no OTP — founder's decision)                                                | ✅      | Rate limited per IP and per phone                                                                                                            |
| Google login                                                                             | ☑️      | Server-side PKCE. Needs the Supabase redirect URLs (DEPLOY.md §2) before it works live.                                                      |
| Address: GPS + village + house / street / landmark                                       | ✅      |                                                                                                                                              |
| Leaflet map with a draggable 📍 pin, satellite view                                      | ❌      | GPS fix + village only for now                                                                                                               |
| Several addresses, default ⭐, delete, choose at checkout                                | ✅      |                                                                                                                                              |
| Booking → success with delivery code                                                     | ✅      |                                                                                                                                              |
| My orders: tracker, delivery code, call vendor, cancel                                   | ✅      |                                                                                                                                              |
| Bill check: every changed line, approve / "something is wrong"                           | ✅      |                                                                                                                                              |
| Rating                                                                                   | ✅      |                                                                                                                                              |
| Order again                                                                              | ☑️      |                                                                                                                                              |
| 🔔 in-app notifications                                                                  | ☑️      |                                                                                                                                              |
| Web push (order confirmed, on the way, bill ready…)                                      | ☑️      | The service worker registers, and the subscription is saved via the API. Real delivery to a phone is not yet verified (needs a real device). |
| "🩺 Check notifications & location" self-test screen, test push                          | ❌      | API ready: `POST /v1/customer/push/test`, `GET /v1/customer/push/test/:id`                                                                   |
| Favourites                                                                               | ❌      | API ready: `POST /v1/customer/favourites/:id/toggle`                                                                                         |
| Recurring (repeat) orders                                                                | ❌      |                                                                                                                                              |
| "How it works" page, chat bubble                                                         | ❌      |                                                                                                                                              |
| Waitlist for unserved villages, contact form, "Become a vendor" link, privacy page       | ✅ / ☑️ |                                                                                                                                              |
| English ↔ Hindi (Devanagari), synced to the account                                      | ✅      |                                                                                                                                              |
| Play Store app (TWA): `assetlinks.json`, start URL `/?source=pwa`                        | ☑️      | Carried in the build. Re-check Play app login after cut-over.                                                                                |
| Offline DEMO mode                                                                        | —       | Replaced by `npm run dev:mock` (fake Supabase)                                                                                               |

## Vendor (`apps/vendor`)

| feature                                                                                                                                                               | status | notes                                               |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | --------------------------------------------------- |
| Phone + password login; "not registered" / "no password yet" guidance                                                                                                 | ✅     | The login email is now looked up on the server only |
| First-time: Google → "what I sell + villages" → make a password                                                                                                       | ☑️     | Needs the Supabase redirect URLs live               |
| Password change = request, approved by admin                                                                                                                          | ☑️     |                                                     |
| Home in the **original layout**: sale today + "you keep ₹X", stats, online switch, day pills, orders grouped by slot, NEXT card with Navigate/Call, quick-actions box | ✅     | The rejected redesigns were not brought back        |
| New-order toast + buzz while open; web push when closed                                                                                                               | ☑️     | Same caveat as customer push                        |
| Order: on the way → reached → bill → payment (cash/UPI) → delivery code                                                                                               | ✅     |                                                     |
| Disputed order → weigh again & re-send; missed / under review / cancelled shown read-only                                                                             | ☑️     |                                                     |
| Bill builder: rate + quantity per line, remove/undo, add items (search understands "aloo" = आलू)                                                                      | ✅     |                                                     |
| Stock: in/out switch, today's rate autosaves as you type, approval status, stale-rate hint                                                                            | ✅     |                                                     |
| Add/edit item with a phone photo (shrunk + EXIF removed on the phone), delete                                                                                         | ✅     |                                                     |
| Catalogue: add with rate + unit                                                                                                                                       | ✅     |                                                     |
| Slots: open/close + max orders per slot per day, villages per slot                                                                                                    | ✅     |                                                     |
| Dashboard: today / yesterday / 7 / 30 days / this month, commission, what you keep, month-to-date, cash vs UPI, chart, top items, every sale                          | ✅     |                                                     |
| Profile: details, villages, language, alerts, password, reviews, contact, logout                                                                                      | ✅     |                                                     |
| Hindi by default                                                                                                                                                      | ✅     |                                                     |
| Chat bubble                                                                                                                                                           | ❌     |                                                     |

## Not part of this rebuild

- The staff site (`staff-site/`) and admin site (`admin-site/`, `admin/`) keep calling Supabase
  directly. Moving them behind the API is SECURITY.md #7.
