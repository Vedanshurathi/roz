# RozBazaar pitch deck

`RozBazaar_Pitch_Deck.pdf` — the final deck (16 slides, 1920×1080), last updated 27 Oct 2026. No competition branding — use it anywhere.

It is made from `deck.src.html` (one `<section class="slide">` per slide, all styles at the top).
To change a slide: edit `deck.src.html`, then

```
npm install        # lucide-static (icons) + playwright
npm run build      # → deck.html, RozBazaar_Pitch_Deck.pdf, preview/slide-NN.png
```

- Icons are written as `{{i:name}}` (any name from lucide.dev); `build.js` puts the SVG in.
- Fonts (Sora, Plus Jakarta Sans, Noto Sans Devanagari — all SIL Open Font License) are in `fonts/`.
- Photos and app screenshots are in `assets/`. `f-*.jpg` are the October 2026 features (voice ordering,
  live tracking, WhatsApp rates card, gali group), taken from the real customer site running locally on a
  fake backend with demo prices — see `screenshot-tool/` (`tiles.py` draws the village map, because map
  tiles could not be downloaded there).
- Numbers on the traction slide are real (27 Oct 2026) and count only real households — founder and intern
  test orders and test ratings are left out on purpose. Refresh them before the next pitch.

## Market numbers — how they are worked out (slide 7, checked 27 Oct 2026)

All spending figures are MoSPI's Household Consumption Expenditure Survey (HCES) 2023-24, at 2023-24 prices,
"without imputation" (what households actually spend).

| | Calculation | Result |
|---|---|---|
| **TAM — rural India** | ₹4,122 per person per month × (vegetables 6.03% + fresh fruit 2.66%) = ₹358 → × 12 × ~91.6 crore rural people (World Bank 2024: 63.1% of ~145 crore) | **≈ ₹3.9 lakh crore / year** |
| **SAM — rural Haryana** | Haryana rural spend ₹5,377 per person per month (30% above India's ₹4,122) × 8.69% = ₹467 → × 12 × 1.76 crore rural people (Technical Group projection 2024: 3.07 crore, 42.7% urban) | **≈ ₹9,900 crore / year** |
| **SOM — our belt** | 5,000 homes × 2 orders a week × ₹150 × 52 weeks | **₹7.8 crore GMV → ₹78 lakh at 10%** |

- Rural item shares from the HCES 2023-24 fact sheet trend table: vegetables 6.62% (2011-12) → 5.38% (2022-23) → 6.03%
  (2023-24); fresh fruit 2.25% → 2.54% → 2.66%; dry fruit 0.58% → 1.17% → 1.19% (dry fruit is left out — we don't sell it).
  Some websites quote "fruits 3.85%": that is fresh + dry together.
- Haryana's own item shares are not published in the fact sheet, so the national rural share (8.69%) is used for Haryana.
- The belt = Pataudi tehsil (1,20,012 people, 22,576 households, incl. Pataudi and Hailey Mandi towns) + Farrukhnagar
  tehsil (1,34,848 people; Khandewla is in it) — Census 2011, so ~2.55 lakh people and ~48,000 homes; the population has grown
  since. At Haryana's ₹5,607 per person a year that is ₹140 crore+ a year on vegetables and fresh fruit; ₹7.8 crore is ~5%
  of it, and 5,000 homes is about 1 in 10.
- The old v1 deck said ₹3.3 lakh crore (it used 17.9 crore households × 4.4 people ≈ 79 crore people, too few, and the
  2022-23 fruit share) and ₹5,600 crore for Haryana (it used India's average spend, not Haryana's higher one).

"Why now" (slide 8): rural internet users 548 M of 958 M (IAMAI–Kantar *Internet in India 2025*, Jan 2026); UPI 24.07 bn
payments in Sept 2026 (NPCI); quick commerce ₹64,000 crore GOV in FY25 → ₹2 lakh crore by FY28 (CareEdge Advisory, Jul 2025);
rural spend per person ₹3,773 → ₹4,122 (+9.2%) from 2022-23 to 2023-24 (MoSPI). Check for newer editions before each pitch.
The customer survey on slide 2 has only 10 people — a bigger survey would make it stronger.
