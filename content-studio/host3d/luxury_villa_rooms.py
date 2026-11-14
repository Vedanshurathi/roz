# Rooms, backyard, lighting, cameras and render for luxury_villa.py (executed in its namespace).
PI2 = math.pi / 2


def downlights(name, pts, z):
    boxes(name, [((x, y, z - 0.004), (0.11, 0.11, 0.008), 0) for x, y in pts], [M["bulb"]])


def cove_x(name, y, x0, x1, z): box(name, ((x0 + x1) / 2, y, z), (x1 - x0, 0.03, 0.03), M["led"])
def cove_y(name, x, y0, y1, z): box(name, (x, (y0 + y1) / 2, z), (0.03, y1 - y0, 0.03), M["led"])


# =================================================================== GF — FOYER + STAIR HALL
CUR[0] = "GF"
boxes("FoyerInlay", [((5.0, 9.9, 0.004), (2.6, 0.03, 0.006), 0), ((5.0, 12.9, 0.004), (2.6, 0.03, 0.006), 0), ((3.7, 11.4, 0.004), (0.03, 3.0, 0.006), 0), ((6.3, 11.4, 0.004), (0.03, 3.0, 0.006), 0)], [M["brass"]])
box("FoyerInlayStone", (5.0, 11.4, 0.003), (2.2, 2.6, 0.004), M["marble_b"])
box("ConsoleTop", (6.72, 9.72, 0.86), (0.36, 0.95, 0.05), M["marble_w"], 0.008); boxes("ConsoleLegs", [((6.72, 9.72 + s * 0.4, 0.42), (0.3, 0.03, 0.84), 0) for s in (-1, 1)], [M["brass"]])
cyl("FoyerMirror", (6.905, 9.72, 1.75), 0.4, 0.02, M["mirror"], rot=(0, PI2, 0), verts=64); cyl("FoyerMirrorGlow", (6.915, 9.72, 1.75), 0.44, 0.015, M["led"], rot=(0, PI2, 0), verts=64)
vase("ConsoleVase", 6.72, 9.45, 0.885, 0.34); blobs("ConsoleBowl", [((6.72, 9.95, 0.92), (0.12, 0.12, 0.04), 0, (0, 0, 0))], [M["brass"]])
for k, (dx, dy, drop) in enumerate(((0, 0, 1.0), (0.35, 0.2, 1.35), (-0.3, 0.25, 1.2), (0.15, -0.35, 1.5), (-0.25, -0.25, 0.85))): pendant(f"FoyerPendant{k}", 5.0 + dx, 11.4 + dy, GH, drop, 0.09, 16)
# pooja niche on the west wall: marble back, brass sun disc, floating shelf with a diya
box("PoojaBack", (3.13, 11.5, 1.75), (0.05, 1.5, 2.3), M["marble_w"]); boxes("PoojaFrame", [((3.2, 10.72, 1.75), (0.16, 0.08, 2.4), 0), ((3.2, 12.28, 1.75), (0.16, 0.08, 2.4), 0), ((3.2, 11.5, 2.95), (0.16, 1.64, 0.08), 0)], [M["walnut_z"]])
cyl("PoojaSun", (3.17, 11.5, 2.05), 0.32, 0.02, M["brass"], rot=(0, PI2, 0), verts=48); cyl("PoojaSunGlow", (3.165, 11.5, 2.05), 0.38, 0.012, M["led"], rot=(0, PI2, 0), verts=48)
box("PoojaShelf", (3.38, 11.5, 1.05), (0.42, 1.3, 0.06), M["marble_w"], 0.008); cyl("Diya", (3.42, 11.5, 1.1), 0.05, 0.03, M["brass"], r2=0.035, verts=16)
blobs("DiyaFlame", [((3.42, 11.5, 1.14), (0.012, 0.012, 0.028), 0, (0, 0, 0))], [M["flame"]]); plight("DiyaL", (3.45, 11.5, 1.2), 5, (1.0, 0.55, 0.2), 0.02)
vase("PoojaKalash", 3.38, 11.05, 1.08, 0.2); vase("PoojaKalash2", 3.38, 11.95, 1.08, 0.16)
for s in (-1, 1): cyl("PoojaBell", (3.35, 11.5 + s * 0.52, 2.6), 0.04, 0.08, M["brass"], r2=0.02, verts=16); cyl("PoojaChain", (3.35, 11.5 + s * 0.52, 2.78), 0.004, 0.3, M["brass"], verts=6)
boxes("Jaali", [((6.9, 12.86 + i * 0.09, 1.5), (0.02, 0.015, 2.6), 0) for i in range(7)] + [((6.9, 13.13, 0.3 + j * 0.2), (0.02, 0.58, 0.015), 0) for j in range(13)], [M["brass"]])
plant("FoyerPlant", 3.55, 9.55, 0, 2.0, M["pot_w"], 0.4, 18)
# floating stair along the west wall: walnut treads on a black steel spine, glass balustrade
NR = 21; RISE = FZ / NR; GO = 0.225
boxes("StairTreads", [((3.85, 13.9 + GO * (i + 0.5), RISE * (i + 1) - 0.03), (1.25, GO + 0.03, 0.06), 0) for i in range(NR - 1)], [M["walnut"]], bevel=0.006)
sp = box("StairSpine", (3.85, 16.15, FZ / 2 - 0.14), (0.14, math.hypot(4.5, FZ) + 0.2, 0.2), M["black"]); sp.rotation_euler = (math.atan2(FZ, 4.5), 0, 0)
gr = box("StairGlass", (4.47, 16.15, FZ / 2 + 0.5), (0.012, math.hypot(4.5, FZ), 1.0), M["glass"]); gr.rotation_euler = (math.atan2(FZ, 4.5), 0, 0)
boxes("StairLEDs", [((3.28, 13.9 + GO * (i + 0.5), RISE * (i + 1) - 0.075), (0.04, 0.12, 0.012), 0) for i in range(0, NR - 1)], [M["led"]])
box("UnderStairBed", (3.85, 16.6, 0.03), (1.3, 3.4, 0.06), noisy("Pebbles", (0.7, 0.68, 0.64), (0.9, 0.88, 0.84), 90, 0.8, 1.0)); plant("UnderStairPlant", 3.8, 17.9, 0.05, 1.5, M["pot"], 0.35, 14)
cyl("Pedestal", (6.3, 14.3, 0.45), 0.2, 0.9, M["marble_b"]); blobs("Sculpture", [((6.3, 14.3, 1.12), (0.16, 0.1, 0.22), 0, (0.3, 0.2, 0.5)), ((6.33, 14.28, 1.42), (0.1, 0.09, 0.14), 0, (0.2, -0.3, 0))], [M["brass"]], seg=16)
downlights("FoyerSpots", [(4.0, 9.8), (6.0, 9.8), (4.0, 13.0), (6.0, 13.0), (5.6, 15.5), (5.6, 17.6)], GH); cove_y("FoyerCove", 3.14, 9.3, 13.4, GH - 0.06)
alight("FoyerFill", (5.0, 11.4, GH - 0.1), (5.0, 11.4, 0), 260, size=2.6); alight("StairFill", (5.6, 16.3, GH - 0.1), (5.2, 16.3, 0), 220, size=2.4)

# =================================================================== GF — FORMAL LOUNGE / LIBRARY
box("LoungeRug", (10.0, 11.3, 0.008), (3.8, 2.9, 0.016), M["rug_d"], 0.006)
armchair("LoungeChairA", (9.0, 11.9, 0), -2.3, M["leather"]); armchair("LoungeChairB", (11.0, 11.9, 0), 2.3, M["leather"]); armchair("LoungeChairC", (9.1, 10.3, 0), -0.75, M["leather"]); armchair("LoungeChairD", (10.9, 10.3, 0), 0.75, M["leather"])
round_table("LoungeTable", (10.0, 11.1, 0), 0.5, 0.42, M["marble_b"]); vase("LoungeVase", 10.0, 11.1, 0.42, 0.22); pendant("LoungePendant", 10.0, 11.1, GH, 1.3, 0.2, 60, globe=False)
# library wall (kitchen partition, west face): walnut shelving with LED-lit bays
shelf_it = [((12.88, 10.35, 1.5), (0.06, 2.2, 3.0), 0)] + [((12.7, 10.35, z), (0.34, 2.2, 0.04), 0) for z in (0.06, 0.62, 1.12, 1.62, 2.12, 2.62, 3.0)] + [((12.7, y, 1.5), (0.34, 0.04, 3.0), 0) for y in (9.27, 10.0, 10.72, 11.43)]
boxes("LibraryShelves", shelf_it, [M["walnut_z"]]); boxes("LibraryLED", [((12.84, 10.35, z - 0.03), (0.02, 2.1, 0.015), 0) for z in (0.62, 1.12, 1.62, 2.12, 2.62)], [M["led"]])
for j, z in enumerate((0.64, 1.14, 1.64, 2.14, 2.64)):
    for k, (ya, yb) in enumerate(((9.31, 9.97), (10.04, 10.69), (10.76, 11.4))):
        if (j + k) % 3 == 2: vase(f"LibVase{j}{k}", 12.68, (ya + yb) / 2, z, 0.26, M["brass"] if j % 2 else M["marble_b"])
        else: books(f"LibBooks{j}{k}", ya, yb, 12.68, z, 0.2, "y", 0.6 + 0.3 * ((j * 3 + k) % 2))
# bar cabinet on the foyer wall + art
box("BarCabinet", (7.38, 9.75, 0.5), (0.5, 0.9, 1.0), M["walnut_y"], 0.008); box("BarTop", (7.38, 9.75, 1.02), (0.54, 0.94, 0.04), M["marble_b"], 0.006)
for k in range(5): cyl(f"Bottle{k}", (7.34 + 0.05 * (k % 2), 9.45 + k * 0.14, 1.19), 0.035, 0.3, mat(f"BottleG{k}", ((0.1, 0.25, 0.12), (0.35, 0.18, 0.05), (0.05, 0.08, 0.2))[k % 3], 0.05, trans=0.6), verts=16, r2=0.015)
art("LoungeArt", (7.1, 9.75, 2.1), (0.8, 1.1), "y", 3)
plant("LoungePlant", 7.7, 12.2, 0, 1.9, M["pot_w"], 0.4, 16); floor_lamp("LoungeLamp", 7.65, 10.65, 0, 50)
downlights("LoungeSpots", [(8.2, 10.0), (11.8, 10.0), (8.2, 12.6), (11.8, 12.6)], GH); alight("LoungeFill", (10, 11.2, GH - 0.1), (10, 11.2, 0), 300, size=3.0)

# =================================================================== GF — DOUBLE-HEIGHT LIVING
slats_y("FeatureSlats", 12.83, 14.75, 18.9, 0.0, RZ, M["walnut_z"], 0.045, 0.03, 0.035, back=1)
box("ChimneyBreast", (12.74, 16.8, RZ / 2), (0.2, 2.6, RZ), M["marble_b"]); box("Hearth", (12.55, 16.8, 0.16), (0.6, 4.1, 0.32), M["marble_w"], 0.01)
box("FireBox", (12.66, 16.8, 0.62), (0.1, 1.9, 0.34), M["black"]); boxes("Flames", [((12.6, 15.95 + i * 0.1, 0.54 + 0.05 * abs(math.sin(i * 1.7))), (0.03, 0.06, 0.1 + 0.1 * abs(math.sin(i * 2.3))), 0) for i in range(18)], [M["flame"]])
plight("FireL", (12.4, 16.8, 0.6), 60, (1.0, 0.5, 0.18), 0.3); box("LivingTV", (12.62, 16.8, 1.85), (0.04, 2.1, 1.18), M["tv"], 0.004)
boxes("ChimneyLED", [((12.66, 15.48, RZ / 2), (0.02, 0.02, RZ - 0.2), 0), ((12.66, 18.12, RZ / 2), (0.02, 0.02, RZ - 0.2), 0)], [M["led"]])
rug("LivingRug", (10.1, 16.5, 0), (4.6, 4.0))
sofa("LivingSofaMain", (8.25, 16.75, 0), PI2, 3.5, 1.0); sofa("LivingSofaReturn", (9.85, 14.55, 0), math.pi, 2.3, 0.95)
boxes("SofaCushions", [((8.35, 15.5 + k * 0.85, 0.62), (0.14, 0.42, 0.42), k % 2) for k in range(4)], [M["velvet_g"], M["velvet_r"]], bevel=0.05)
box("SofaThrow", (8.7, 18.2, 0.52), (0.9, 0.5, 0.03), M["velvet_r"], 0.01)
round_table("CoffeeA", (10.45, 16.6, 0), 0.62, 0.36, M["marble_w"]); round_table("CoffeeB", (11.15, 15.85, 0), 0.4, 0.46, M["marble_b"])
vase("CoffeeVase", 10.3, 16.75, 0.36, 0.3); blobs("CoffeeBowl", [((10.7, 16.4, 0.39), (0.16, 0.16, 0.04), 0, (0, 0, 0))], [M["brass"]]); boxes("CoffeeBooks", [((11.15, 15.85, 0.475 + k * 0.03), (0.3, 0.22, 0.03), k) for k in range(3)], [M["velvet_g"], M["boucle"], M["leather"]])
armchair("LivingChairA", (10.2, 18.25, 0), 0.0, M["velvet_g"]); armchair("LivingChairB", (11.5, 18.1, 0), 0.5, M["velvet_g"]); round_table("LivingSide", (10.85, 18.45, 0), 0.2, 0.52, M["brass"])
plant("LivingPalm", 7.6, 18.45, 0, 2.6, M["pot_w"], 0.6, 22, 0.3, 0.6)
for k in range(17):   # statement chandelier: a cloud of brass-capped globes falling through the double height
    ang = k * 2.4; rr = 0.25 + 0.75 * ((k * 7) % 10) / 10; pendant(f"Chandelier{k}", 10.2 + rr * math.cos(ang), 16.4 + rr * math.sin(ang), RZ, 2.3 + ((k * 5) % 9) * 0.22, 0.085, 22)
for x in (7.35, 12.5): box("LivingSheer", (x, 18.86, RZ / 2), (0.7, 0.05, RZ - 0.2), M["sheer"])
cove_x("LivingCove", 13.62, 7.1, 12.9, GH - 0.08)
alight("LivingFill", (10, 16.3, RZ - 0.15), (10, 16.3, 0), 900, size=4.0); alight("LivingWallWash", (11.6, 16.8, 3.4), (12.8, 16.8, 2.2), 120, size=2.6)

# =================================================================== GF — DINING
box("DiningTop", (15.6, 16.5, 0.75), (1.15, 2.9, 0.06), M["walnut_y"], 0.012); boxes("DiningLegs", [((15.6, 16.5 + s * 0.9, 0.36), (0.7, 0.12, 0.72), 0) for s in (-1, 1)], [M["black"]], bevel=0.01)
for k, y in enumerate((15.4, 16.13, 16.87, 17.6)): dchair(f"DChairW{k}", (14.75, y, 0), PI2); dchair(f"DChairE{k}", (16.45, y, 0), -PI2)
box("DiningPendantBar", (15.6, 16.5, 2.1), (0.07, 2.3, 0.05), M["brass"]); box("DiningPendantGlow", (15.6, 16.5, 2.07), (0.05, 2.2, 0.015), M["bulb"])
for s in (-1, 1): cyl("DiningCord", (15.6, 16.5 + s * 0.9, 2.86), 0.004, 1.5, M["black"], verts=6)
alight("DiningDown", (15.6, 16.5, 2.02), (15.6, 16.5, 0), 240, size=0.3, size_y=2.2)
boxes("DiningRunner", [((15.6, 16.5, 0.782), (0.35, 2.2, 0.004), 0)], [M["linen"]]); vase("DiningVaseA", 15.6, 16.1, 0.785, 0.32); vase("DiningVaseB", 15.6, 16.9, 0.785, 0.22, M["marble_b"])
box("DiningConsole", (17.72, 16.8, 0.42), (0.4, 1.9, 0.84), M["walnut_y"], 0.008); art("DiningArt", (17.9, 16.8, 1.95), (1.7, 1.15), "y", 7); table_lamp("DiningLamp", 17.72, 16.05, 0.84, 20)
art("FeatureBackArt", (13.17, 16.8, 1.9), (2.4, 1.4), "y", 11, M["black"]); plant("DiningPlant", 17.4, 18.45, 0, 1.9, M["pot"], 0.4, 16)
downlights("DiningSpots", [(14.0, 14.4), (17.2, 14.4), (14.0, 18.4), (17.2, 18.4)], GH); alight("DiningFill", (15.6, 16.3, GH - 0.1), (15.6, 16.3, 0), 260, size=3.0)
# jhoola (traditional swing) on the covered deck outside the dining room
box("JhoolaSeat", (15.6, 20.3, 0.5), (1.7, 0.6, 0.07), M["walnut"], 0.01); box("JhoolaCushion", (15.6, 20.3, 0.58), (1.6, 0.52, 0.09), M["boucle"], 0.03)
boxes("JhoolaChains", [((15.6 + sx * 0.78, 20.3 + sy * 0.24, 2.1), (0.012, 0.012, 3.1), 0) for sx in (-1, 1) for sy in (-1, 1)], [M["brass"]])

# =================================================================== GF — KITCHEN
box("KitBase", (17.85, 9.44, 0.44), (8.9, 0.64, 0.88), M["cab"], 0.004); box("KitCounter", (17.85, 9.46, 0.9), (8.94, 0.68, 0.04), M["marble_w"], 0.006)
box("KitSplash", (17.85, 9.13, 1.0), (8.9, 0.02, 0.18), M["marble_w"]); boxes("KitHandles", [((13.9 + k * 0.89, 9.77, 0.78), (0.5, 0.012, 0.012), 0) for k in range(10)], [M["brass"]])
box("Hob", (16.6, 9.46, 0.925), (0.8, 0.5, 0.01), M["tv"]); box("Hood", (16.6, 9.3, 2.75), (0.9, 0.36, 0.5), M["black"]); box("KitSink", (19.6, 9.46, 0.915), (0.75, 0.42, 0.012), M["steel"])
cyl("KitTap", (19.6, 9.22, 1.08), 0.014, 0.34, M["brass"], verts=12); box("KitTapArm", (19.6, 9.3, 1.25), (0.025, 0.2, 0.025), M["brass"])
box("KitShelf", (20.6, 9.25, 2.55), (4.2, 0.28, 0.04), M["walnut"]); box("KitShelfLED", (20.6, 9.3, 2.52), (4.0, 0.02, 0.012), M["led"])
for k in range(6): vase(f"KitJar{k}", 19.0 + k * 0.62, 9.25, 2.57, 0.18 + 0.05 * (k % 2), M["marble_w"] if k % 2 else M["brass"])
box("KitTall", (22.6, 11.55, 1.35), (0.62, 3.5, 2.7), M["walnut_y"], 0.004); boxes("KitOvens", [((22.28, 10.6, 1.0 + k * 0.62), (0.012, 0.6, 0.48), 0) for k in range(2)], [M["tv"]])
boxes("KitTallLines", [((22.285, y, 1.35), (0.008, 0.012, 2.7), 0) for y in (10.2, 11.0, 11.9, 12.7)], [M["black"]]); box("KitTallNiche", (22.3, 12.3, 1.35), (0.03, 0.7, 0.5), M["led_soft"])
box("PantryWall", (13.36, 10.3, 1.35), (0.5, 2.2, 2.7), M["walnut_y"], 0.004); boxes("PantryLines", [((13.615, y, 1.35), (0.008, 0.012, 2.7), 0) for y in (9.75, 10.3, 10.85)], [M["black"]])
box("Island", (17.3, 11.75, 0.45), (3.3, 1.15, 0.9), M["marble_b"], 0.008); box("IslandInset", (17.3, 11.16, 0.42), (2.9, 0.02, 0.7), M["walnut"]); box("IslandTop", (17.3, 11.75, 0.92), (3.4, 1.25, 0.04), M["marble_b"], 0.008)
for k in range(4): stool(f"Stool{k}", (16.15 + k * 0.77, 12.62, 0))
for k in range(3): pendant(f"IslandPendant{k}", 16.3 + k * 1.0, 11.75, GH, 1.45, 0.13, 40, globe=False)
blobs("FruitBowl", [((17.9, 11.8, 0.965), (0.2, 0.2, 0.04), 0, (0, 0, 0))] + [((17.9 + 0.08 * math.cos(k * 2.1), 11.8 + 0.08 * math.sin(k * 2.1), 1.02), (0.045, 0.045, 0.045), 1, (0, 0, 0)) for k in range(5)], [M["brass"], mat("Orange", (0.95, 0.45, 0.05), 0.5)])
vase("IslandVase", 16.4, 11.8, 0.94, 0.3, M["marble_w"]); downlights("KitSpots", [(14.5 + i * 1.6, y) for i in range(5) for y in (10.2, 12.9)], GH)
alight("KitFill", (17.6, 11.4, GH - 0.1), (17.6, 11.4, 0), 520, size=5.5, size_y=2.8)

# =================================================================== FF — FAMILY LOUNGE + BRIDGE
CUR[0] = "FF"
z = FZ + 0.012
rug("FamRug", (5.0, 10.7, z), (3.2, 3.6)); sofa("FamSofa", (4.0, 10.7, z), PI2, 2.8, 0.95, M["linen"]); round_table("FamTable", (5.4, 10.7, z), 0.45, 0.36, M["marble_w"])
box("FamTV", (6.88, 10.7, z + 1.5), (0.04, 1.7, 0.98), M["tv"], 0.004); box("FamConsole", (6.7, 10.7, z + 0.25), (0.4, 2.4, 0.5), M["walnut_y"], 0.008); box("FamConsoleLED", (6.52, 10.7, z + 0.02), (0.02, 2.3, 0.02), M["led"])
armchair("FamChair", (5.2, 12.6, z), 2.8, M["velvet_r"]); floor_lamp("FamLamp", 3.5, 12.6, z, 45); plant("FamPlant", 3.5, 8.75, z, 1.9, M["pot_w"], 0.4, 16)
armchair("NookChair", (5.6, 18.1, z), 0.4, M["leather"]); round_table("NookTable", (6.4, 18.4, z), 0.2, 0.5, M["brass"]); floor_lamp("NookLamp", 6.6, 17.6, z, 35)
box("BridgeBench", (10, 12.32, z + 0.22), (2.0, 0.42, 0.44), M["velvet_g"], 0.04); art("BridgeArtA", (8.0, 12.11, z + 1.6), (1.0, 1.3), "x", 5); art("BridgeArtB", (11.9, 12.11, z + 1.6), (1.0, 1.3), "x", 9)
downlights("FFSpotsW", [(4.2, 9.2), (6.0, 9.2), (4.2, 12.4), (6.0, 12.4), (5.8, 15.4), (5.8, 17.6), (8.5, 12.8), (11.5, 12.8)], RZ)
alight("FamFill", (5.0, 10.8, RZ - 0.1), (5.0, 10.8, FZ), 300, size=3.0); alight("BridgeFill", (10, 12.75, RZ - 0.1), (10, 12.75, FZ), 140, size=1.2, size_y=5.0)

# =================================================================== FF — MASTER BEDROOM
slats_x("BedWallSlats", 13.61, 15.0, 21.0, FZ, RZ, M["walnut_z"], 0.05, 0.03, 0.03, back=-1)
boxes("Headboard", [((16.3 + k * 0.425, 13.72, z + 0.95), (0.4, 0.12, 1.3), 0) for k in range(9)], [M["boucle"]], bevel=0.04)
box("BedPlatform", (18.0, 14.85, z + 0.14), (2.4, 2.4, 0.28), M["walnut"], 0.01); box("Mattress", (18.0, 14.82, z + 0.42), (2.0, 2.1, 0.28), M["white"], 0.06)
box("Duvet", (18.0, 15.15, z + 0.59), (2.08, 1.5, 0.1), M["linen"], 0.045); box("BedThrow", (18.0, 15.65, z + 0.645), (2.12, 0.45, 0.03), M["velvet_g"], 0.012)
boxes("Pillows", [((17.5 + s * 0.0 + (k % 2) * 1.0, 13.98 + (k // 2) * 0.3, z + 0.66 - (k // 2) * 0.04), (0.78, 0.2, 0.44), k // 2) for k in range(4) for s in (0,)], [M["white"], M["boucle"]], bevel=0.07)
for s in (-1, 1):
    box("BedSide", (18.0 + s * 1.62, 13.9, z + 0.25), (0.55, 0.45, 0.5), M["walnut_y"], 0.008); pendant(f"BedPendant{s}", 18.0 + s * 1.62, 13.9, RZ, 2.0, 0.1, 24)
box("BedBench", (18.0, 16.35, z + 0.26), (1.7, 0.45, 0.3), M["velvet_g"], 0.05); boxes("BedBenchLegs", [((18.0 + sx * 0.75, 16.35 + sy * 0.17, z + 0.06), (0.03, 0.03, 0.12), 0) for sx in (-1, 1) for sy in (-1, 1)], [M["brass"]])
rug("BedRug", (18.0, 15.6, z), (4.4, 3.4)); armchair("BedChair", (21.7, 17.7, z), 0.9, M["boucle"]); round_table("BedChairTable", (20.9, 18.2, z), 0.22, 0.5, M["marble_w"]); floor_lamp("BedLamp", 22.5, 18.4, z, 40)
box("BedDresser", (14.0, 16.9, z + 0.4), (0.45, 1.8, 0.8), M["walnut_y"], 0.008); cyl("BedMirror", (13.115, 16.9, z + 1.6), 0.45, 0.02, M["mirror"], rot=(0, PI2, 0), verts=64); table_lamp("DresserLamp", 14.0, 17.55, z + 0.8, 18)
for x in (13.5, 22.6): box("BedSheer", (x, 18.86, FZ + FH / 2), (0.7, 0.05, FH - 0.15), M["sheer"])
plant("BedPlant", 22.65, 14.05, z, 1.8, M["pot_w"], 0.4, 14); cove_x("BedCove", 13.68, 15.0, 21.0, RZ - 0.06)
downlights("BedSpots", [(14.6, 15.0), (21.4, 15.0), (14.6, 18.0), (21.4, 18.0), (18.0, 17.6)], RZ); alight("BedFill", (18, 16.2, RZ - 0.1), (18, 16.2, FZ), 320, size=4.0)
# balcony: two chairs, table, planters
armchair("BalChairA", (16.2, 19.9, FZ + 0.02), 2.6, M["linen"]); armchair("BalChairB", (17.9, 19.9, FZ + 0.02), -2.6, M["linen"]); round_table("BalTable", (17.05, 20.2, FZ + 0.02), 0.25, 0.45, M["marble_b"])
plant("BalPlantA", 13.5, 20.3, FZ + 0.02, 1.4, M["pot"], 0.35, 12); plant("BalPlantB", 22.5, 20.3, FZ + 0.02, 1.6, M["pot"], 0.35, 12)

# =================================================================== FF — WALK-IN CLOSET
def wardrobe_y(name, x, y0, y1, face):   # runs along y, open towards `face` (+1 = +x)
    d = 0.6; cx = x + face * d / 2; it = [((x + face * 0.01, (y0 + y1) / 2, z + 1.35), (0.02, y1 - y0, 2.7), 0)]
    n = max(1, round((y1 - y0) / 0.95)); bw_ = (y1 - y0) / n
    it += [((cx, y0 + bw_ * i, z + 1.35), (d, 0.03, 2.7), 0) for i in range(n + 1)] + [((cx, (y0 + y1) / 2, z + h), (d, y1 - y0, 0.03), 0) for h in (0.08, 2.2, 2.7)]
    boxes(name, it, [M["walnut_z"]]); boxes(name + "LED", [((x + face * 0.05, (y0 + y1) / 2, z + 2.17), (0.015, y1 - y0 - 0.1, 0.012), 0)], [M["led"]])
    cl = []; pal = [mat(name + f"Cl{i}", c, 0.9) for i, c in enumerate(((0.85, 0.83, 0.8), (0.1, 0.12, 0.18), (0.4, 0.3, 0.2), (0.15, 0.25, 0.3), (0.6, 0.55, 0.5), (0.05, 0.05, 0.06)))]
    for i in range(n):
        yy = y0 + bw_ * i + 0.1
        while yy < y0 + bw_ * (i + 1) - 0.1: cl.append(((cx, yy, z + 1.55 - (0.25 if i % 2 else 0)), (0.42, 0.035, 1.0 if i % 2 == 0 else 0.6), rng.randrange(6))); yy += 0.07
        if i % 2: cl += [((cx, y0 + bw_ * (i + 0.5), z + 0.3 + k * 0.32), (d - 0.05, bw_ - 0.08, 0.025), 2) for k in range(2)]
    boxes(name + "Clothes", cl, pal); boxes(name + "Rail", [((cx, (y0 + y1) / 2, z + 2.08), (0.02, y1 - y0, 0.02), 0)], [M["brass"]])


wardrobe_y("WardrobeW", 13.1, 8.5, 12.1, 1); wardrobe_y("WardrobeE", 17.92, 8.5, 13.2, -1)
box("ClosetIsland", (15.5, 10.6, z + 0.45), (0.85, 1.7, 0.9), M["walnut_y"], 0.008); box("ClosetIslandTop", (15.5, 10.6, z + 0.92), (0.9, 1.75, 0.04), M["marble_w"], 0.006)
boxes("ClosetTray", [((15.5, 10.2, z + 0.95), (0.4, 0.3, 0.02), 0)], [M["brass"]]); blobs("ClosetWatch", [((15.45 + k * 0.1, 10.2, z + 0.975), (0.03, 0.03, 0.012), 0, (0, 0, 0)) for k in range(3)], [M["black"]])
cyl("ClosetPouf", (15.5, 12.4, z + 0.22), 0.32, 0.44, M["velvet_r"]); box("ClosetMirror", (16.6, 13.4, z + 1.2), (1.0, 0.02, 2.2), M["mirror"]); box("ClosetMirrorFrame", (16.6, 13.41, z + 1.2), (1.06, 0.02, 2.26), M["brass"])
rug("ClosetRug", (15.5, 11.2, z), (1.6, 3.6), M["rug_d"]); downlights("ClosetSpots", [(14.6, 9.4), (16.4, 9.4), (14.6, 12.0), (16.4, 12.0)], RZ)
alight("ClosetFill", (15.5, 10.8, RZ - 0.1), (15.5, 10.8, FZ), 260, size=2.6)

# =================================================================== FF — MASTER BATH
box("BathFloor", (20.5, 10.85, FZ + 0.014), (4.86, 5.1, 0.012), M["marble_w"]); box("BathGreenWall", (22.86, 10.85, FZ + FH / 2), (0.04, 5.1, FH), M["marble_g"])
boxes("BathGreenLED", [((22.83, 8.4, FZ + FH / 2), (0.02, 0.02, FH - 0.2), 0), ((22.83, 13.35, FZ + FH / 2), (0.02, 0.02, FH - 0.2), 0)], [M["led"]])
blobs("Bathtub", [((22.05, 10.7, z + 0.36), (0.42, 0.9, 0.36), 0, (0, 0, 0))], [M["white"]], seg=32); blobs("BathtubWater", [((22.05, 10.7, z + 0.6), (0.34, 0.8, 0.1), 0, (0, 0, 0))], [mat("TubInner", (0.75, 0.86, 0.88), 0.05)], seg=32)
cyl("TubFiller", (21.45, 11.4, z + 0.5), 0.016, 1.0, M["brass"], verts=12); box("TubFillerArm", (21.56, 11.4, z + 0.99), (0.24, 0.03, 0.03), M["brass"])
round_table("TubStool", (21.4, 9.7, z), 0.17, 0.44, M["walnut"], M["brass"]); plant("BathPlant", 20.2, 13.05, z, 1.7, M["pot_w"], 0.35, 14)
box("Vanity", (18.42, 11.4, z + 0.62), (0.56, 3.0, 0.4), M["walnut_y"], 0.008); box("VanityTop", (18.42, 11.4, z + 0.84), (0.6, 3.04, 0.04), M["marble_w"], 0.006); box("VanityLED", (18.5, 11.4, z + 0.4), (0.3, 2.9, 0.015), M["led"])
for s in (-1, 1):
    cyl("Basin", (18.42, 11.4 + s * 0.75, z + 0.91), 0.2, 0.1, M["white"], r2=0.16); cyl("BasinTap", (18.2, 11.4 + s * 0.75, z + 1.0), 0.012, 0.28, M["brass"], verts=12)
    cyl("VanityMirror", (18.09, 11.4 + s * 0.75, z + 1.65), 0.36, 0.02, M["mirror"], rot=(0, PI2, 0), verts=64); cyl("VanityMirrorGlow", (18.085, 11.4 + s * 0.75, z + 1.65), 0.4, 0.012, M["led"], rot=(0, PI2, 0), verts=64)
box("ShowerGlassA", (19.75, 9.0, z + 1.1), (0.012, 1.5, 2.2), M["glass"]); box("ShowerGlassB", (18.95, 9.76, z + 1.1), (0.75, 0.012, 2.2), M["glass"]); box("ShowerWall", (18.92, 8.31, z + 1.4), (1.66, 0.03, 2.8), M["marble_g"])
cyl("RainHead", (18.9, 9.0, z + 2.25), 0.16, 0.02, M["brass"]); cyl("RainArm", (18.9, 8.65, z + 2.3), 0.012, 0.7, M["brass"], rot=(PI2, 0, 0), verts=10)
boxes("TowelLadder", [((20.3 + s * 0.22, 8.4, z + 0.9), (0.025, 0.025, 1.8), 0) for s in (-1, 1)] + [((20.3, 8.4, z + 0.5 + k * 0.4), (0.44, 0.02, 0.02), 0) for k in range(4)], [M["brass"]]); box("Towel", (20.3, 8.43, z + 1.5), (0.4, 0.05, 0.5), M["white"], 0.02)
downlights("BathSpots", [(19.4, 10.6), (21.4, 10.6), (19.4, 12.6), (21.4, 12.6), (18.9, 9.0)], RZ); alight("BathFill", (20.4, 10.9, RZ - 0.1), (20.4, 10.9, FZ), 300, size=3.0)

# =================================================================== FF — CREATOR STUDIO (where Avir records)
CUR[0] = "FF"
slats_x("StudioSlats", 8.37, 7.9, 12.1, FZ, RZ, M["walnut_z"], 0.045, 0.03, 0.035, back=-1); box("StudioSlatLED", (10, 8.42, RZ - 0.07), (4.2, 0.03, 0.03), M["led"])
alight("StudioSlatGraze", (10, 8.62, RZ - 0.12), (10, 8.4, FZ + 1.2), 90, size=4.0, size_y=0.08)
fn = bpy.data.curves.new("StudioNeon", "FONT"); fn.body = "UNFILTERED AVIR"; fn.extrude = 0.012; fn.size = 0.2; fn.align_x = "CENTER"
no_ = bpy.data.objects.new("StudioNeon", fn); no_.location = (10, 8.45, z + 2.5); no_.rotation_euler = (math.radians(90), 0, math.pi); link(no_)
no_.data.materials.append(mat("NeonWarmWhite", (1.0, 0.92, 0.8), 0.3, emit=7, ecol=(1.0, 0.86, 0.68))); plight("StudioNeonL", (10, 8.8, z + 2.5), 20, (1.0, 0.86, 0.68), 0.3)
box("StudioDesk", (10, 9.85, z + 0.74), (1.9, 0.78, 0.045), M["walnut"], 0.008); boxes("StudioDeskLegs", [((10 + sx * 0.85, 9.85, z + 0.36), (0.05, 0.6, 0.72), 0) for sx in (-1, 1)], [M["black"]], bevel=0.006)
box("StudioDeskLED", (10, 10.22, z + 0.7), (1.8, 0.015, 0.015), M["led"])
# presenter chair (faces the door / camera)
cyl("StChairBase", (10, 9.15, z + 0.03), 0.3, 0.04, M["black"]); cyl("StChairPost", (10, 9.15, z + 0.25), 0.03, 0.42, M["steel"], verts=12)
box("StChairSeat", (10, 9.15, z + 0.5), (0.52, 0.5, 0.1), M["rug_d"], 0.04); box("StChairBack", (10, 8.92, z + 0.9), (0.5, 0.1, 0.72), M["rug_d"], 0.045); box("StChairStripe", (10, 8.865, z + 0.95), (0.08, 0.012, 0.5), M["brass"])
# monitor, keyboard, mouse, mic on a boom arm, mug
scr = np.zeros((90, 160, 3)); scr[:] = (0.03, 0.035, 0.05)
for r_ in range(12, 80, 6): scr[r_:r_ + 2, 14:14 + int(30 + 90 * abs(math.sin(r_ * 1.3)))] = ((0.55, 0.8, 0.6), (0.6, 0.7, 0.95), (0.9, 0.75, 0.5))[(r_ // 6) % 3]
mon = box("StudioMonitor", (9.3, 10.0, z + 1.08), (0.62, 0.025, 0.36), M["black"], 0.004, rotz=-0.35)
ms = box("StudioMonitorScreen", (9.296, 9.987, z + 1.08), (0.58, 0.004, 0.32), img_mat("StudioScreen", scr, emit=1.6), rotz=-0.35)
me_ = ms.data; uv_ = me_.uv_layers.new(name="UV")
for poly in me_.polygons:
    for li in poly.loop_indices:
        v_ = me_.vertices[me_.loops[li].vertex_index].co; uv_.data[li].uv = (0.5 - v_.x / 0.58, v_.z / 0.32 + 0.5)
cyl("StudioMonitorStand", (9.3, 10.02, z + 0.84), 0.015, 0.16, M["black"], verts=10); cyl("StudioMonitorFoot", (9.3, 10.02, z + 0.768), 0.1, 0.012, M["black"])
box("StudioKeyboard", (9.95, 9.72, z + 0.775), (0.42, 0.14, 0.018), M["black"], 0.004); blobs("StudioMouse", [((10.3, 9.72, z + 0.78), (0.03, 0.05, 0.016), 0, (0, 0, 0))], [M["black"]])
cyl("StudioMicBase", (10.72, 10.05, z + 0.78), 0.07, 0.02, M["black"]); mb = cyl("StudioMicArm", (10.62, 9.95, z + 0.98), 0.012, 0.5, M["black"], rot=(0.5, 0.45, 0), verts=10)
cyl("StudioMic", (10.5, 9.82, z + 1.2), 0.03, 0.14, M["steel"], rot=(1.2, 0, 0.4), verts=16); cyl("StudioMug", (10.75, 9.62, z + 0.81), 0.04, 0.09, M["white"], verts=20)
# shelves (east wall), acoustic panels (west wall)
for k, zz in enumerate((1.25, 1.75, 2.25)):
    box(f"StudioShelf{k}", (12.74, 9.9, z + zz), (0.3, 2.0, 0.04), M["walnut_y"], 0.006); box(f"StudioShelfLED{k}", (12.86, 9.9, z + zz - 0.03), (0.015, 1.9, 0.012), M["led"])
    books(f"StudioBooks{k}", 9.0 + 0.5 * (k % 2), 9.9 + 0.5 * (k % 2), 12.72, z + zz + 0.02, 0.2, "y", 0.9)
    vase(f"StudioVase{k}", 12.72, 10.5 - 0.9 * (k % 2), z + zz + 0.02, 0.22, M["brass"] if k % 2 else M["marble_w"])
box("StudioCube", (12.72, 10.75, z + 1.84), (0.14, 0.14, 0.14), mat("StudioCubeGlow", (1.0, 0.75, 0.45), 0.4, emit=5)); plant("StudioShelfPlant", 12.7, 9.25, z + 2.27, 0.45, M["pot_w"], 0.12, 8, 0.06, 0.1)
boxes("StudioAcoustic", [((7.13, 8.9 + k * 0.95, z + 1.6), (0.06, 0.8, 1.9), k % 3) for k in range(3)], [M["rug_d"], M["velvet_r"], M["velvet_g"]], bevel=0.02)
# recording kit facing the desk: camera on a tripod, softbox key light, second small panel light
boxes("StudioTripod", [((9.75 + 0.22 * math.cos(q), 11.45 + 0.22 * math.sin(q), z + 0.62), (0.025, 0.025, 1.3), 0, 0) for q in (0.5, 2.6, 4.7)], [M["black"]])
box("StudioCamera", (9.75, 11.42, z + 1.36), (0.14, 0.11, 0.1), M["black"], 0.01); cyl("StudioLens", (9.75, 11.32, z + 1.36), 0.04, 0.11, M["black"], rot=(PI2, 0, 0), verts=20)
cyl("SoftboxPole", (8.45, 11.2, z + 0.95), 0.015, 1.9, M["black"], verts=10); sb = box("Softbox", (8.52, 11.1, z + 1.95), (0.75, 0.2, 0.75), M["black"], 0.02, rotz=0.6)
sf_ = box("SoftboxFace", (8.6, 10.99, z + 1.95), (0.7, 0.012, 0.7), mat("SoftboxGlow", (1.0, 0.95, 0.88), 0.5, emit=3.2), rotz=0.6)
alight("StudioKey", (8.65, 10.9, z + 1.95), (10, 9.2, z + 1.2), 260, (1.0, 0.93, 0.85), 0.75)
floor_lamp("StudioLamp", 12.45, 8.85, z, 40); plant("StudioPlant", 7.55, 8.8, z, 1.9, M["pot_w"], 0.4, 16); rug("StudioRug", (10, 9.6, z), (3.4, 2.4), M["rug_d"])
box("StudioSofa", (7.62, 10.9, z + 0.22), (0.8, 1.5, 0.4), M["velvet_g"], 0.06); box("StudioSofaBack", (7.3, 10.9, z + 0.55), (0.2, 1.5, 0.5), M["velvet_g"], 0.06)
downlights("StudioSpots", [(8.4, 9.4), (11.6, 9.4), (8.4, 11.2), (11.6, 11.2)], RZ); alight("StudioFill", (10, 10.2, RZ - 0.1), (10, 10.2, FZ), 150, size=3.0)

# =================================================================== GF — GUEST BEDROOM
CUR[0] = "GF"
box("GuestOak", (20.5, 16.25, 0.006), (4.84, 5.3, 0.012), M["oak"])
box("GuestHeadboard", (22.84, 16.2, 0.95), (0.1, 2.3, 1.2), M["boucle"], 0.04); box("GuestPlatform", (21.75, 16.2, 0.14), (2.2, 1.8, 0.28), M["walnut_y"], 0.01)
box("GuestMattress", (21.78, 16.2, 0.42), (2.0, 1.6, 0.26), M["white"], 0.06); box("GuestDuvet", (21.45, 16.2, 0.58), (1.4, 1.66, 0.1), M["linen"], 0.045); box("GuestThrow", (20.95, 16.2, 0.635), (0.4, 1.7, 0.03), M["velvet_r"], 0.012)
boxes("GuestPillows", [((22.5, 16.2 + s * 0.4, 0.66), (0.22, 0.66, 0.4), 0) for s in (-1, 1)], [M["white"]], bevel=0.07)
for s in (-1, 1): box("GuestSide", (22.62, 16.2 + s * 1.22, 0.25), (0.45, 0.5, 0.5), M["walnut_y"], 0.008); table_lamp(f"GuestLamp{s}", 22.62, 16.2 + s * 1.22, 0.5, 20)
art("GuestArt", (22.88, 16.2, 2.2), (1.5, 0.9), "y", 13); rug("GuestRug", (21.2, 16.2, 0.012), (3.2, 2.8))
box("GuestWardrobe", (19.5, 13.92, 1.3), (2.4, 0.6, 2.6), M["walnut_z"], 0.006); boxes("GuestWardrobeLines", [((18.9 + k * 0.6, 14.225, 1.3), (0.008, 0.008, 2.6), 0) for k in range(3)], [M["black"]])
box("GuestDesk", (18.38, 16.8, 0.74), (0.5, 1.3, 0.04), M["walnut_y"], 0.008); boxes("GuestDeskLegs", [((18.38, 16.8 + s * 0.6, 0.36), (0.44, 0.03, 0.72), 0) for s in (-1, 1)], [M["brass"]])
cyl("GuestMirror", (18.11, 16.8, 1.55), 0.38, 0.02, M["mirror"], rot=(0, PI2, 0), verts=64); dchair("GuestChair", (18.95, 16.8, 0), -PI2, M["velvet_g"])
armchair("GuestArmchair", (19.4, 18.2, 0), 0.5, M["boucle"]); plant("GuestPlant", 22.5, 18.4, 0, 1.6, M["pot_w"], 0.35, 14)
downlights("GuestSpots", [(19.4, 15.0), (21.6, 15.0), (19.4, 17.6), (21.6, 17.6)], GH); cove_y("GuestCove", 22.76, 15.1, 17.3, GH - 0.06); alight("GuestFill", (20.4, 16.2, GH - 0.1), (20.4, 16.2, 0), 260, size=3.0)

# =================================================================== BACKYARD
CUR[0] = "Site"
box("Deck", (13, 20.95, -0.04), (20, 3.9, 0.08), M["teak_deck"]); box("CabanaDeck", (5.6, 25.6, -0.04), (5.6, 5.6, 0.08), M["teak_deck"]); box("PoolTerraceE", (21.3, 25.0, -0.04), (3.4, 4.6, 0.08), M["paver"])
box("PoolBed", (14, 25.0, -0.42), (11.0, 4.2, 0.06), M["pool_tile"]); box("PoolWater", (14, 25.0, -0.1), (11.0, 4.2, 0.04), M["water"])
boxes("PoolWalls", [((14, 22.9, -0.25), (11.0, 0.05, 0.4), 0), ((14, 27.1, -0.25), (11.0, 0.05, 0.4), 0), ((8.5, 25, -0.25), (0.05, 4.2, 0.4), 0), ((19.5, 25, -0.25), (0.05, 4.2, 0.4), 0)], [M["pool_tile"]])
boxes("PoolCoping", [((14, 22.72, -0.02), (11.7, 0.36, 0.06), 0), ((14, 27.28, -0.02), (11.7, 0.36, 0.06), 0), ((8.32, 25, -0.02), (0.36, 4.56, 0.06), 0), ((19.68, 25, -0.02), (0.36, 4.56, 0.06), 0)], [M["marble_w"]])
for k in range(4): plight(f"PoolL{k}", (10 + k * 2.7, 25.0, -0.3), 40, (0.2, 0.8, 1.0), 0.2)
alight("PoolGlow", (14, 25, 0.4), (14, 25, 3), 60, (0.3, 0.8, 1.0), 6.0)
for k, y in enumerate((23.5, 24.9, 26.3)):   # loungers on the east terrace, facing the pool
    box(f"Lounger{k}", (21.4, y, 0.2), (1.9, 0.7, 0.1), M["teak_deck"], 0.01); box(f"LoungerCushion{k}", (21.45, y, 0.29), (1.8, 0.64, 0.09), M["boucle"], 0.035)
    lb = box(f"LoungerBack{k}", (22.15, y, 0.5), (0.6, 0.64, 0.09), M["boucle"], 0.035); lb.rotation_euler = (0, -0.9, 0)
round_table("LoungerTable", (21.4, 24.2, 0), 0.2, 0.36, M["marble_w"], M["black"]); round_table("LoungerTable2", (21.4, 25.6, 0), 0.2, 0.36, M["marble_w"], M["black"])
# cabana: walnut pergola, outdoor sofas, fire table
boxes("PergolaPosts", [((x, y, 1.4), (0.14, 0.14, 2.8), 0) for x in (3.5, 7.7) for y in (23.3, 27.9)], [M["walnut_z"]]); boxes("PergolaBeams", [((5.6, y, 2.85), (4.5, 0.14, 0.18), 0) for y in (23.3, 27.9)], [M["walnut"]])
boxes("PergolaSlats", [((3.6 + k * 0.3, 25.6, 3.0), (0.06, 5.0, 0.12), 0) for k in range(14)], [M["walnut_y"]])
sofa("CabanaSofaA", (4.1, 25.6, 0), PI2, 3.0, 0.9, M["linen"], M["black"]); sofa("CabanaSofaB", (6.0, 27.55, 0), 0.0, 2.2, 0.9, M["linen"], M["black"])
box("FireTable", (6.1, 25.5, 0.2), (0.8, 1.4, 0.4), M["stone"], 0.01); boxes("FireTableFlames", [((6.1, 25.0 + i * 0.1, 0.44 + 0.04 * abs(math.sin(i * 1.9))), (0.05, 0.05, 0.08 + 0.08 * abs(math.sin(i * 2.7))), 0) for i in range(11)], [M["flame"]])
plight("FireTableL", (6.1, 25.5, 0.7), 70, (1.0, 0.5, 0.18), 0.25)
for k in range(3): cyl(f"Lantern{k}", (3.6 + k * 0.5, 22.95 - (k % 2) * 0.2, 0.18 + 0.05 * k), 0.09, 0.36 + 0.1 * k, M["shade"], verts=16); plight(f"LanternL{k}", (3.6 + k * 0.5, 22.9, 0.4), 6)
alight("CabanaDown", (5.6, 25.6, 2.7), (5.6, 25.6, 0), 120, size=3.0)
# planting + garden lighting
for i, (x, y, h) in enumerate(((20.8, 28.8, 5.8), (8.2, 28.6, 5.2), (24.4, 22.0, 4.8), (1.5, 22.4, 5.0))): palm(f"PalmB{i}", x, y, h, OUTZ)
for i, (x, y) in enumerate(((2.5, 33.6), (8.5, 34.2), (14.5, 33.8), (20, 34.3), (24.2, 31.5))): tree(f"BackTree{i}", x, y, 6.0 + i % 2, 2.2, OUTZ); plight(f"TreeUp{i}", (x, y - 1.6, 0.2), 60, (1.0, 0.8, 0.55), 0.2)
hedge("HedgeBackN", 0.6, 35.4, 25.4, 35.4, 1.5); hedge("HedgeBackE", 25.4, 21, 25.4, 35, 1.5); hedge("HedgeBackW", 0.6, 21, 0.6, 35, 1.5)
for i, x in enumerate((9.5, 12.5, 15.5, 18.5)): plant(f"DeckPlanter{i}", x, 27.9, OUTZ, 1.3, M["pot_w"], 0.4, 12, 0.3, 0.45)
plant("DeckPlantW", 3.6, 19.6, 0, 1.8, M["pot"], 0.4, 16); plant("DeckPlantE", 22.4, 19.6, 0, 1.8, M["pot"], 0.4, 16)
# facade wash lights
for i, x in enumerate((3.6, 7.6, 13.0, 18.0, 22.4)): plight(f"FrontUp{i}", (x, 7.7, 0.25), 45, (1.0, 0.78, 0.55), 0.15)
alight("FrontCladdingWash", (13, 6.0, 0.3), (13, 8.2, 5.5), 380, size=8.0, size_y=1.0); alight("EntryDown", (5.3, 8.5, GH - 0.15), (5.3, 8.5, 0), 120, size=1.2)
alight("DeckDown", (18, 19.9, 3.6), (18, 19.9, 0), 160, size=8.0, size_y=1.4)

exec(open(Path(__file__).with_name("luxury_villa_cars.py")).read())

# =================================================================== WORLD + SUN
w = bpy.data.worlds.new("GoldenDusk"); sc.world = w; w.use_nodes = True; nt = w.node_tree; bg = nt.nodes["Background"]
tc = nt.nodes.new("ShaderNodeTexCoord"); sp = nt.nodes.new("ShaderNodeSeparateXYZ"); nt.links.new(tc.outputs["Generated"], sp.inputs[0])
rp = nt.nodes.new("ShaderNodeValToRGB"); e = rp.color_ramp.elements; e[0].position = 0.0; e[0].color = (0.9, 0.42, 0.2, 1); e[1].position = 0.75; e[1].color = (0.04, 0.09, 0.26, 1)
for pos, col in ((0.07, (1.0, 0.56, 0.3, 1)), (0.22, (0.62, 0.42, 0.5, 1)), (0.42, (0.2, 0.28, 0.5, 1))): el = rp.color_ramp.elements.new(pos); el.color = col
nt.links.new(sp.outputs["Z"], rp.inputs["Fac"]); nt.links.new(rp.outputs["Color"], bg.inputs["Color"]); bg.inputs["Strength"].default_value = 0.9
sun = bpy.data.lights.new("Sun", "SUN"); sun.energy = 2.4; sun.color = (1.0, 0.6, 0.34); sun.angle = math.radians(3)
so = bpy.data.objects.new("Sun", sun); sc.collection.objects.link(so); so.rotation_euler = (Vector((13, 14, 0)) - Vector((-48, -38, 11))).to_track_quat("-Z", "Y").to_euler()

# =================================================================== CAMERAS
CAMS = {   # name: (location, target, lens, [collections hidden])
    "Front": ((12.4, -8.7, 3.4), (13.0, 9, 3.4), 20), "FrontAngle": ((-6.5, -9.5, 3.6), (12.5, 10, 3.2), 24),
    "Society": ((-26, -44, 34), (18, 22, 2), 26), "Foyer": ((5.4, 9.55, 1.55), (4.7, 15.5, 1.7), 17),
    "Lounge": ((12.3, 13.0, 1.5), (8.6, 9.8, 1.15), 18), "Living": ((7.5, 14.0, 1.6), (12.6, 17.6, 2.7), 15),
    "LivingFromBridge": ((7.7, 13.75, FZ + 1.75), (11.4, 17.4, 1.0), 14), "Dining": ((13.5, 13.9, 1.5), (16.6, 17.6, 1.1), 17),
    "Kitchen": ((13.9, 13.1, 1.55), (19.2, 10.3, 1.05), 17), "FamilyLounge": ((6.6, 13.1, FZ + 1.6), (4.0, 9.6, FZ + 0.9), 16),
    "MasterBedroom": ((15.0, 18.5, FZ + 1.55), (19.6, 14.2, FZ + 0.8), 15), "MasterBath": ((22.5, 13.1, FZ + 1.6), (19.2, 9.7, FZ + 0.85), 15), "MasterBathTub": ((18.6, 13.0, FZ + 1.55), (21.9, 9.9, FZ + 0.7), 16),
    "Closet": ((17.3, 13.0, FZ + 1.6), (14.0, 9.0, FZ + 1.0), 15), "Backyard": ((15.5, 33.0, 2.0), (12.6, 19, 3.4), 19),
    "Cabana": ((9.6, 23.6, 1.6), (4.8, 26.6, 0.9), 19), "Studio": ((12.55, 11.7, FZ + 1.6), (9.0, 8.9, FZ + 1.0), 14),
    "StudioDesk": ((10.35, 11.55, FZ + 1.35), (10.0, 8.4, FZ + 1.3), 20), "Cars": ((14.3, 0.7, 1.25), (19.3, 5.5, 0.75), 24),
    "CarsLow": ((23.6, 0.9, 0.75), (19.2, 5.4, 0.8), 22), "SedanInterior": ((17.47, 5.72, 0.93), (17.3, 4.6, 0.68), 12), "SUVInterior": ((20.97, 5.75, 1.3), (20.8, 4.6, 1.05), 12),
    "SedanSeats": ((17.45, 4.95, 1.02), (17.45, 6.6, 0.62), 12), "SUVSeats": ((20.95, 4.98, 1.42), (20.95, 6.9, 0.95), 12), "CarsSide": ((13.9, 5.2, 1.1), (17.45, 5.5, 0.7), 22), "GuestRoom": ((18.45, 18.6, 1.55), (21.9, 15.3, 0.8), 15), "Balcony": ((14.0, 20.4, FZ + 1.6), (20, 26, 0.5), 17),
}
for name, (loc, tgt, lens) in CAMS.items():
    cd = bpy.data.cameras.new("Cam_" + name); cd.lens = lens; cd.sensor_width = 36; cd.clip_start = 0.05; cd.clip_end = 600
    o = bpy.data.objects.new("Cam_" + name, cd); sc.collection.objects.link(o); o.location = loc; o.rotation_euler = (Vector(tgt) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
for name, zz in (("Plan_GF", 3.4), ("Plan_FF", 7.0)):
    cd = bpy.data.cameras.new("Cam_" + name); cd.type = "ORTHO"; cd.ortho_scale = 40; cd.clip_start = 0.05; cd.clip_end = 60
    o = bpy.data.objects.new("Cam_" + name, cd); sc.collection.objects.link(o); o.location = (13, 17.5, zz); o.rotation_euler = (0, 0, 0)
    cd.clip_start = 0.01; CAMS[name] = None
PLAN_HIDE = {"Plan_GF": ("FFSlab", "FF", "Roof"), "Plan_FF": ("Roof",)}

# =================================================================== RENDER
sc.render.engine = "CYCLES"; sc.cycles.device = "CPU"; sc.cycles.samples = a.samples; sc.cycles.use_denoising = True; sc.cycles.use_adaptive_sampling = True; sc.cycles.adaptive_threshold = 0.03
sc.cycles.max_bounces = 6; sc.cycles.diffuse_bounces = 3; sc.cycles.glossy_bounces = 4; sc.cycles.transmission_bounces = 6; sc.cycles.transparent_max_bounces = 10
sc.cycles.sample_clamp_indirect = 6; sc.cycles.caustics_reflective = False; sc.cycles.caustics_refractive = False
sc.render.resolution_x = a.res; sc.render.resolution_y = a.res * 9 // 16; sc.view_settings.view_transform = "AgX"
try: sc.view_settings.look = "AgX - Medium High Contrast"
except Exception: pass
sc.view_settings.exposure = 0.0
INTERIOR = {"Foyer", "Lounge", "Living", "LivingFromBridge", "Dining", "Kitchen", "FamilyLounge", "MasterBedroom", "MasterBath", "MasterBathTub", "Closet", "Studio", "StudioDesk", "GuestRoom"}
if a.save: bpy.ops.wm.save_as_mainfile(filepath=str(OUT / "villa.blend")); print("saved", OUT / "villa.blend")
print("objects", len(bpy.data.objects), "lights", len(bpy.data.lights))
if not a.no_render:
    import time
    sel = a.cams.split(",") if a.cams else list(CAMS)
    for c in sel:
        t0 = time.time(); sc.camera = bpy.data.objects["Cam_" + c]
        hide = PLAN_HIDE.get(c, ())
        for cn, col in COLL.items(): col.hide_render = cn in hide
        if c.startswith("Plan"): sc.render.resolution_x = a.res; sc.render.resolution_y = a.res
        else: sc.render.resolution_x = a.res; sc.render.resolution_y = a.res * 9 // 16
        sc.view_settings.exposure = -0.75 if c in INTERIOR else (0.25 if not c.startswith("Plan") else 0.6)
        if c in ("SedanInterior", "SUVInterior", "SedanSeats", "SUVSeats"): sc.view_settings.exposure = 0.7
        sc.render.filepath = str(OUT / f"{c}.png"); bpy.ops.render.render(write_still=True); print("rendered", c, round(time.time() - t0), "s", flush=True)
