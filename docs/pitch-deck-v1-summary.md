# RozBazaar Investor Pitch Deck — v1 (2026-08-20)

## What was built
A 12-slide, fully animated investor/pilot-competition pitch deck for RozBazaar, delivered as:
- `RozBazaar_Pitch_Deck.html` — self-contained animated deck (16:9, RozBazaar brand tokens, keyboard/click nav, speaker-notes drawer)
- `RozBazaar_Pitch_Deck.pdf` — static 12-page export for submission
- `RozBazaar_Pitch_Companion.md` — per-slide speaker notes, 30-sec elevator pitch, 2-min pitch, likely investor Q&A, missing-data checklist

## Source constraints followed
Built strictly from the user's locked brief (not from the two uploaded reference PDFs, which were used only for visual/design inspiration — RozBazaar brand colors, mockup style, tempo-vehicle motif, comparison-table and map conventions). Explicitly excluded anything the reference PDFs contained that the brief didn't authorize: no founder photo, no invented traction numbers (e.g. "1,250 bookings", "320 vendors"), no award claims (e.g. "Startup Dangal Top 5"), no 2–3 hour delivery framing, no unfair competitor claims.

Design system used: the `rozbazaar-ui` skill's token palette (--g:#1E8E3E green, navy #101B30, cream #FCF8F0, etc.) and Sora/Plus Jakarta Sans typography.

## Known open item — launch date discrepancy
The brief said to use "22 August 2026" only if confirmed by source material. The uploaded reference PDFs actually show **23 August 2026**, not 22 August. Since neither matched with full confidence, the deck currently shows "Launch date: [To be confirmed]" and flags this discrepancy in the companion doc's missing-data list. **Needs a decision from the founder before final submission.**

## Other missing data (flagged in deck as [Insert data] and in companion doc)
Founder's name, funding ask amount, all pilot metrics (pre-pilot), AOV, monthly revenue, vendor/booking/customer milestone numbers, legal/business structure for a minor-led venture (not addressed in source material — flagged as a likely investor question), tax/compliance review status.

## If asked to revise later
- All slide content lives in `index.html` in the working directory of that session (not persisted — rebuild from this summary + original brief if needed).
- Structure: 12 `<section class="slide">` blocks, one per required slide, with `data-notes`/`data-time` attributes driving the in-deck speaker-notes panel (kept in sync with the companion doc).
- Pilot-area diagram (slide 8) uses static percentage-based positions + SVG lines (not JS trigonometry) — this was a deliberate fix after an earlier JS-based version mispositioned markers.
