# Parity with the old single-file apps

What the React apps already do, and what is still only in `customer/index.html` or
`vendor-site/index.html`. Check this before cut-over (DEPLOY.md §5).

✅ = done and covered by a browser journey.
☑️ = done, checked by hand or by unit/API tests only.
❌ = not ported yet.

## Customer (`apps/customer`)

Since 1 Oct 2026 the customer app is a **screen-by-screen port of `customer/index.html`**: the
original CSS is used as-is (`src/styles/legacy.css`), the original markup and class names are kept,
and the 106 hand-drawn SVG item pictures are carried over (`src/art/drawings.ts`). It should look
and behave exactly like the old app, on phone, tablet and laptop (the old app's own desktop layout:
top bar, hero, category cards, footer).

| feature                                                                                        | status  | notes                                                                                                     |
| ---------------------------------------------------------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------- |
| Splash, "Which village are you in?" ask, village sheet, "use my location" (±3 km rule)         | ☑️      |                                                                                                           |
| Home: hero with slot line, rotating search hints, tabs, offer tiles, Most bought, best rate    | ✅      | Laptop: hero with real price tiles, category cards, footer                                                |
| Item pictures: vendor photo → catalogue photo → hand-drawn SVG (also when a photo fails)       | ✅      |                                                                                                           |
| Category screen: side rail, filters (price / freshest / rate dropped), vendor banner + chip    | ☑️      |                                                                                                           |
| Search with typo-tolerant matching, popular searches                                           | ☑️      |                                                                                                           |
| Item sold by 2+ vendors → vendor picker with prices; different-vendor warning                  | ✅      |                                                                                                           |
| Favourites ♡, price-change toasts for basket/favourite items, basket reminder                  | ☑️      |                                                                                                           |
| Fly-to-cart, cart bar with ₹50 minimum progress                                                | ✅      |                                                                                                           |
| Slot picker: type (auto when only one), vendor list / compact confirmation, 5 days, N/A slots  | ✅      |                                                                                                           |
| Basket: out-of-stock marking, note for the vendor, address card with Change                    | ✅      |                                                                                                           |
| Phone login (no OTP — founder's decision) / Google (name + number kept across the redirect)    | ✅ / ☑️ | Google needs the Supabase redirect URLs (DEPLOY.md §2)                                                    |
| Address: precise GPS (best fix in 20 s), Leaflet map with draggable 📍, satellite / map        | ☑️      | Checked in the browser with a fake GPS fix. Map tiles come from Esri / OpenStreetMap (allowed in the CSP) |
| Address auto-fill from OpenStreetMap (small parts + our village), village from our boundaries  | ☑️      |                                                                                                           |
| Several addresses: Home / Shop / Parents' home / named, default ⭐, delete, choose at checkout | ✅      |                                                                                                           |
| Success with burst + delivery code + "alert me" card                                           | ✅      |                                                                                                           |
| Bookings: tracker, delivery code, see bill, rate, order again, call vendor, cancel             | ✅      |                                                                                                           |
| Bill check: every changed line, unchanged folded, approve / "something's wrong" (with reason)  | ✅      |                                                                                                           |
| Order-complete pop-up with stars (delivered or completed, once per order); rating screen       | ✅      |                                                                                                           |
| 🔔 notifications sheet + unread dot + toast; "keep asking" permission bar                      | ☑️      |                                                                                                           |
| "🩺 Check notifications & location" with GPS test and test push                                | ☑️      | Real push delivery needs a real phone                                                                     |
| My account, How it works (animated), Contact form, chat bubble, Become a vendor, privacy       | ☑️      |                                                                                                           |
| Waitlist for unserved villages (asks for a number when logged out)                             | ☑️      |                                                                                                           |
| English ↔ Hindi (Devanagari), synced to the account                                            | ✅      |                                                                                                           |
| Play Store app (TWA): `assetlinks.json`, start URL `/?source=pwa`                              | ☑️      | Re-check Play app login after cut-over                                                                    |
| Recurring (repeat) orders                                                                      | ❌      | The old app had no screen for them either                                                                 |
| Voice search                                                                                   | —       | "coming soon" toast, as before                                                                            |
| Offline DEMO mode                                                                              | —       | Replaced by `npm run dev:mock` (fake Supabase)                                                            |

Small, deliberate differences: no Roman Hindi anywhere (the splash line and a few labels were Roman
Hindi); the vendor-picker sort chips sit in one row (the old `.row` class was never defined); the
"order complete" pop-up also appears for paid (`completed`) orders, not only `delivered`.

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
