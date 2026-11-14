#!/usr/bin/env python3
"""Design board for Villa 07 from the renders of luxury_villa.py: labelled floor plans + captioned room sheets.
  python3 make_board.py <renders_dir> <out_dir> [font.ttf]"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

SRC, OUT = Path(sys.argv[1]), Path(sys.argv[2]); OUT.mkdir(parents=True, exist_ok=True)
FONT = sys.argv[3] if len(sys.argv) > 3 else "/usr/share/fonts/opentype/inter/Inter-SemiBold.otf"
f = lambda s: ImageFont.truetype(FONT, s)
INK, GOLD, BG = (245, 240, 230), (255, 205, 90), (16, 13, 11)

# plan cameras: orthographic, centred on (13, 17.5), 40 m across
GF = [("FOYER", 5.3, 10.5), ("POOJA", 4.1, 12.4), ("STAIR", 3.9, 16.2), ("LOUNGE / LIBRARY", 10.0, 11.3), ("LIVING\n(double height)", 10.0, 16.4),
      ("DINING", 15.6, 16.5), ("KITCHEN", 17.6, 11.4), ("GUEST BEDROOM", 20.5, 16.2), ("CAR PORCH", 19.2, 5.4), ("ENTRY", 5.3, 4.0), ("LAWN", 9.6, 4.2),
      ("WATER FEATURE", 10.0, 7.7), ("DECK + JHOOLA", 13.0, 20.9), ("POOL", 14.0, 25.0), ("CABANA", 5.6, 25.6), ("SUN DECK", 21.3, 25.0), ("GARDEN", 13.0, 31.5), ("STREET", 13.0, -5.6)]
FF = [("FAMILY LOUNGE", 5.0, 10.6), ("READING NOOK", 5.7, 17.6), ("BRIDGE", 10.0, 12.75), ("CREATOR STUDIO", 10.0, 10.0), ("open to living\nbelow", 10.0, 16.4),
      ("MASTER BEDROOM", 18.0, 16.3), ("WALK-IN CLOSET", 15.5, 10.8), ("MASTER BATH", 20.5, 10.8), ("BALCONY", 18.0, 19.95), ("POOL", 14.0, 25.0), ("CABANA", 5.6, 25.6)]


def plan(name, labels, title):
    im = Image.open(SRC / f"{name}.png").convert("RGB"); R = im.size[0]; px = lambda x, y: ((x + 7) / 40 * R, (37.5 - y) / 40 * R)
    d = ImageDraw.Draw(im, "RGBA")
    for text, x, y in labels:
        cx, cy = px(x, y); ft = f(int(R * 0.0125)); bb = d.multiline_textbbox((0, 0), text, font=ft, align="center", spacing=2); w, h = bb[2] - bb[0], bb[3] - bb[1]
        d.rounded_rectangle((cx - w / 2 - 8, cy - h / 2 - 5, cx + w / 2 + 8, cy + h / 2 + 9), 7, fill=(12, 10, 9, 190))
        d.multiline_text((cx - w / 2, cy - h / 2), text, font=ft, fill=INK, align="center", spacing=2)
    x0, y0 = px(-3, 37.4); x1, y1 = px(29, -8.5 if name.endswith("GF") else -2.4); im = im.crop((int(x0), int(y0), int(x1), min(R, int(y1))))
    d = ImageDraw.Draw(im, "RGBA"); d.rectangle((0, 0, im.size[0], int(R * 0.05)), fill=(12, 10, 9, 215)); d.text((24, int(R * 0.011)), title, font=f(int(R * 0.022)), fill=GOLD)
    # scale bar: 5 m
    L = 5 / 40 * R; yb = im.size[1] - 40; d.rectangle((30, yb, 30 + L, yb + 8), fill=INK); d.text((30, yb - 30), "5 m", font=f(22), fill=INK); d.text((im.size[0] - 150, yb - 30), "N  ↑", font=f(26), fill=INK)
    im.save(OUT / f"{name}_labelled.jpg", quality=92); return im


def sheet(name, title, items, cols=2, w=1280):
    h = w * 9 // 16; pad, head, cap = 28, 120, 64; rows = (len(items) + cols - 1) // cols
    c = Image.new("RGB", (cols * w + (cols + 1) * pad, head + rows * (h + cap + pad) + pad), BG); d = ImageDraw.Draw(c)
    d.text((pad, 30), title, font=f(58), fill=GOLD)
    for i, (cam, label) in enumerate(items):
        x = pad + (i % cols) * (w + pad); y = head + (i // cols) * (h + cap + pad)
        c.paste(Image.open(SRC / f"{cam}.png").convert("RGB").resize((w, h), Image.LANCZOS), (x, y)); d.text((x + 4, y + h + 12), label, font=f(34), fill=INK)
    c.save(OUT / f"{name}.jpg", quality=90); return c


plan("Plan_GF", GF, "VILLA 07 · GROUND FLOOR + PLOT (26 × 36 m)")
plan("Plan_FF", FF, "VILLA 07 · FIRST FLOOR")
sheet("01_exterior_society", "AVIR'S HOME — VILLA 07 · exterior and society", [("Front", "Front elevation from the street"), ("FrontAngle", "Corner view with the neighbouring villas and towers"),
      ("Society", "The society: villas, towers, street"), ("Backyard", "Back garden: pool, deck, double-height glass")])
sheet("02_ground_floor", "GROUND FLOOR", [("Foyer", "Foyer: pooja niche, floating stair"), ("Lounge", "Formal lounge and library wall"), ("Living", "Double-height living room"),
      ("LivingFromBridge", "Living room seen from the bridge"), ("Dining", "Dining for eight"), ("Kitchen", "Kitchen with marble island"), ("GuestRoom", "Guest bedroom"), ("Cabana", "Cabana with fire table")])
sheet("03_first_floor", "FIRST FLOOR", [("Studio", "Creator studio"), ("StudioDesk", "Studio: Avir's camera view"), ("FamilyLounge", "Family lounge"), ("MasterBedroom", "Master bedroom"),
      ("Closet", "Walk-in closet"), ("MasterBath", "Master bath: vanity and rain shower"), ("MasterBathTub", "Master bath: freestanding tub"), ("Balcony", "Balcony over the pool")])
print("board ok ->", OUT)
