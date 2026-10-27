# RozBazaar pitch deck

`RozBazaar_Pitch_Deck.pdf` — the final deck (15 slides, 1920×1080), last updated 27 Oct 2026.

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
