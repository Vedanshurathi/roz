import math, os, random
from PIL import Image, ImageDraw, ImageFont
LAT0, LAT1, LNG0, LNG1 = 28.355, 28.415, 76.755, 76.840
def px(lat, lng, z, s):
    n = 2 ** z * 256 * s
    x = (lng + 180) / 360 * n
    y = (1 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / math.pi) / 2 * n
    return x, y
random.seed(7)
# features in lat/lng
main_road = [(28.3990, 76.7560), (28.3935, 76.7750), (28.3895, 76.7860), (28.3871, 76.7921), (28.3851, 76.7965), (28.3838, 76.8010), (28.3815, 76.8150), (28.3790, 76.8400)]
side_roads = [
  [(28.4150, 76.7905), (28.4000, 76.7910), (28.3871, 76.7921)],
  [(28.3838, 76.8010), (28.3700, 76.8030), (28.3550, 76.8050)],
  [(28.3893, 76.7862), (28.3780, 76.7800), (28.3550, 76.7720)],
  [(28.3851, 76.7965), (28.3920, 76.8060), (28.4150, 76.8150)],
]
# village lanes around Jatola centre
lanes = []
cx, cy = 28.3836, 76.7985
for i in range(-3, 4):
    lanes.append([(cx + i * 0.0011, cy - 0.0045), (cx + i * 0.0011 + 0.0002, cy + 0.0045)])
for j in range(-4, 5):
    lanes.append([(cx - 0.0036, cy + j * 0.0011), (cx + 0.0036, cy + j * 0.0011 + 0.0002)])
pond = [(28.3800, 76.7940), (28.3808, 76.7958), (28.3800, 76.7972), (28.3790, 76.7962), (28.3792, 76.7945)]
def draw(z, s=2):
    x0, y0 = px(LAT1, LNG0, z, s); x1, y1 = px(LAT0, LNG1, z, s)
    tx0, ty0 = int(x0 // (256 * s)), int(y0 // (256 * s)); tx1, ty1 = int(x1 // (256 * s)), int(y1 // (256 * s))
    W, H = (tx1 - tx0 + 1) * 256 * s, (ty1 - ty0 + 1) * 256 * s
    ox, oy = tx0 * 256 * s, ty0 * 256 * s
    im = Image.new('RGB', (W, H), (238, 236, 225)); d = ImageDraw.Draw(im)
    P = lambda la, ln: (px(la, ln, z, s)[0] - ox, px(la, ln, z, s)[1] - oy)
    scale = 2 ** (z - 16) * s
    # fields: jittered grid of light green / beige plots
    step = 0.0032
    la = LAT0
    while la < LAT1:
        ln = LNG0
        while ln < LNG1:
            c = random.choice([(214, 232, 196), (224, 236, 205), (232, 228, 206), (206, 228, 190), (226, 233, 210)])
            a = P(la + step, ln); b = P(la, ln + step)
            g = max(1, int(3 * scale))
            d.rectangle([a[0] + g, a[1] + g, b[0] - g, b[1] - g], fill=c)
            ln += step
        la += step
    # village built-up area
    vil = [P(cx + 0.0042, cy - 0.0052), P(cx - 0.0042, cy + 0.0052)]
    d.rounded_rectangle([vil[0][0], vil[0][1], vil[1][0], vil[1][1]], radius=int(40 * scale), fill=(234, 226, 214))
    # houses
    for k in range(900):
        hla = cx + random.uniform(-0.0040, 0.0040); hln = cy + random.uniform(-0.0050, 0.0050)
        p = P(hla, hln); w = random.uniform(5, 9) * scale; h = random.uniform(5, 9) * scale
        d.rectangle([p[0], p[1], p[0] + w, p[1] + h], fill=(217, 205, 192))
    # pond
    d.polygon([P(*q) for q in pond], fill=(170, 211, 223))
    def road(pts, w, casing=(205, 197, 180), fill=(255, 255, 255)):
        q = [P(*p) for p in pts]
        d.line(q, fill=casing, width=int((w + 3) * scale), joint='curve')
        d.line(q, fill=fill, width=int(w * scale), joint='curve')
    for l in lanes: road(l, 4, casing=(222, 214, 200), fill=(250, 248, 243))
    for r in side_roads: road(r, 7)
    road(main_road, 11, casing=(214, 180, 120), fill=(252, 214, 164))
    # labels
    try:
        f = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', int(15 * scale))
        f2 = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', int(11 * scale))
    except Exception:
        f = f2 = ImageFont.load_default()
    if z >= 14:
        t = P(cx - 0.0050, cy - 0.0010); d.text(t, 'Jatola', fill=(70, 70, 70), font=f, stroke_width=int(3 * scale), stroke_fill=(255, 255, 255))
        t = P(28.3905, 76.7790); d.text(t, 'Pataudi Rd', fill=(110, 100, 90), font=f2, stroke_width=int(2 * scale), stroke_fill=(255, 255, 255))
    out = f'tiles/{z}'; 
    for tx in range(tx0, tx1 + 1):
        for ty in range(ty0, ty1 + 1):
            crop = im.crop(((tx - tx0) * 256 * s, (ty - ty0) * 256 * s, (tx - tx0 + 1) * 256 * s, (ty - ty0 + 1) * 256 * s)).resize((256, 256), Image.LANCZOS)
            os.makedirs(f'{out}/{tx}', exist_ok=True); crop.save(f'{out}/{tx}/{ty}.png')
    print(z, tx1 - tx0 + 1, ty1 - ty0 + 1)
for z in (14, 15, 16):
    draw(z)
