# Avir's home v2 — "Villa 07" (two-storey luxury villa in a gated society)
Design + stills for the house-tour video. Built entirely in code: `../luxury_villa.py` (helpers, materials, furniture),
`../luxury_villa_build.py` (plot, society, shell), `../luxury_villa_rooms.py` (rooms, backyard, lights, cameras, render).

    python3 -I luxury_villa.py <out_dir> --res 1600 --samples 64 --save          # all views + villa.blend
    python3 -I luxury_villa.py <out_dir> --res 640 --samples 16 --cams Living,Kitchen   # quick look at two views

## Concept
Modern Indian luxury: a calm warm-white house with walnut, brushed brass, Italian-beige marble floors, black Marquina and
green Udaipur marble as accents, boucle / linen / emerald and rust velvet fabrics. Golden-hour dusk: warm light inside,
blue-orange sky outside, pool glowing teal. Indian touches kept tasteful: pooja niche with a diya at the entrance, brass
jaali, a jhoola (swing) on the deck, marble everywhere.

## Plot (26 x 36 m, street on the south side)
| Zone | What is there |
|---|---|
| Front | boundary wall with walnut slats and brass "AVIR · VILLA 07", walk gate + drive gate, granite paver drive, car porch with timber soffit, lawn, palms, reflecting pool with brass spouts under the lounge window, bollard lights |
| House, ground floor | **Foyer** (walnut pivot door, brass-inlay marble floor, console + backlit round mirror, pendant cluster, **pooja niche**) → **floating walnut stair** with glass balustrade and step lights → **formal lounge / library** (cognac leather chairs, LED-lit walnut library wall, bar cabinet) → **double-height living room** (7.2 m glass wall to the pool, black-marble chimney breast with linear fireplace + TV, walnut slats, L-sofa, 17-globe chandelier) → **dining** (8-seat walnut table, emerald velvet chairs, linear brass pendant) → **kitchen** (charcoal + marble, black-marble waterfall island, brass stools, walnut tall units) · guest suite (closed for now) |
| House, first floor | **family lounge** + reading nook, **bridge** over the living void (art gallery wall), **creator studio** door with ON AIR light (the existing studio set attaches here), **master bedroom** (channel-tufted headboard on a walnut wall, bench, lounge corner, full-width glass to the balcony), **walk-in closet** (lit walnut wardrobes, marble island), **master bath** (freestanding tub against green marble, double vanity with backlit mirrors, glass rain shower), **balcony** over the pool |
| Back | teak deck with a **jhoola**, 11 x 4.2 m **pool** with marble coping, loungers, walnut **cabana** with sofas and a fire table, lawn, palms, uplit trees, hedges |
| Society | street with lamps and trees, 16 neighbouring villas (4 styles), 9 apartment towers with lit windows, back lane |

## Tour route (camera presets `Cam_<name>` in villa.blend)
Society (aerial) → Front → FrontAngle → Foyer → Lounge → Living → Dining → Kitchen → (stair) → LivingFromBridge →
FamilyLounge → MasterBedroom → Closet → MasterBath / MasterBathTub → Balcony → Backyard → Cabana.
Floor plans: `Cam_Plan_GF`, `Cam_Plan_FF` (orthographic; upper levels hidden).

## Not done yet (for the tour video itself)
- Avir standing / walking through the rooms: his current clips are seated; the tour needs stand, walk, turn and
  present-to-camera clips (to be made on his rig) and him rendered inside this scene with real shadows.
- Guest suite and studio interiors are closed doors in this version (the studio set already exists separately).
- Stylised planting and neighbours; no cars, people or small clutter yet.
