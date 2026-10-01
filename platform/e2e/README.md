# Browser journeys (end-to-end)

Real browser (Playwright, phone-sized) → real React apps → real API → **fake Supabase**. Nothing
here touches production.

```bash
# terminal 1 — API + fake Supabase (demo vendor 8198941588 / sabzi1234)
npm run dev:mock
# terminal 2 + 3 — the apps. Use `preview` (production build) to test under the real CSP headers:
npm run build && npm run preview -w @rozbazaar/customer
npm run preview -w @rozbazaar/vendor
# terminal 4
npm run e2e                 # all journeys
npm run e2e -- vendorDay    # one journey
```

| journey         | covers                                                                                                                                                                                                                                     |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `customerOrder` | village, vendor picker for items two vendors sell, one-vendor basket rule, slot, phone login, address, booking, delivery code                                                                                                              |
| `billApproval`  | vendor bills at the door (changed qty/rate), customer sees what changed and approves, payment, code, rating, Hindi mode                                                                                                                    |
| `vendorDay`     | Hindi login + wrong password + unregistered number, order lifecycle in the UI (on the way → bill with weigh/remove/add → UPI → wrong/right code), stock rate autosave + stock toggle, catalogue, slot capacity, dashboard, English, logout |

Any page error or console error fails the run — that includes Content-Security-Policy violations.
Screenshots land in `e2e/shots/` (git-ignored); a failing step saves `…-FAIL-<step>.png`.
