# Build script for luxury_villa.py (executed in its namespace). Sections: site, society, shell, GF rooms, FF rooms,
# backyard, lights, cameras, render.
GH, FZ, FH = 3.6, 3.9, 3.3          # GF ceiling, FF floor level, FF clear height
RZ = FZ + FH                         # FF ceiling / roof underside (7.2)
X0, X1, Y0, Y1, YC = 3.0, 23.0, 9.0, 19.0, 8.2   # house footprint; YC = FF cantilever line at the front
OUTZ = -0.15                         # garden level (house plinth is 150 mm above it)

# =================================================================== SITE
CUR[0] = "Site"
box("Ground", (13, 18, OUTZ - 0.3), (420, 420, 0.1), M["grass"])
box("PlotLawnFront", (7.6, 4.2, OUTZ - 0.02), (14.6, 8.0, 0.08), M["grass"]); box("PlotLawnBack", (13, 31.2, OUTZ - 0.02), (25.4, 8.6, 0.08), M["grass"])
box("LawnSideW", (1.6, 14, OUTZ - 0.02), (2.6, 12, 0.08), M["grass"]); box("LawnSideE", (24.4, 14, OUTZ - 0.02), (2.6, 12, 0.08), M["grass"])
box("Driveway", (19.0, 4.3, OUTZ), (7.6, 8.9, 0.06), M["paver"]); box("EntryPath", (5.3, 4.1, OUTZ), (1.6, 8.3, 0.06), M["paver"])
boxes("PathInlay", [((5.3, 0.6 + k * 1.1, OUTZ + 0.032), (1.6, 0.03, 0.006), 0) for k in range(8)], [M["brass"]])
box("Plinth", (13, 13.6, -0.1), (20.4, 11.2, 0.16), M["stone"]); box("EntryStep", (5.3, 8.4, -0.08), (2.6, 1.3, 0.14), M["marble_b"], 0.01)
# boundary wall with timber-slat inserts, gate posts, gates
bw = noisy("BoundaryPlaster", (0.72, 0.69, 0.64), (0.8, 0.77, 0.72), 6, 0.9, 0.2)
for nm, c, s in (("BW_W", (0, 18, 0.75), (0.25, 36, 2.1)), ("BW_E", (26, 18, 0.75), (0.25, 36, 2.1)), ("BW_N", (13, 36, 0.75), (26, 0.25, 2.1)),
                 ("BW_S1", (2.2, 0, 0.6), (4.4, 0.25, 1.8)), ("BW_S2", (10.6, 0, 0.6), (8.4, 0.25, 1.8)), ("BW_S3", (24.2, 0, 0.6), (3.6, 0.25, 1.8))):
    box(nm, c, s, bw)
slats_x("BWSlats", -0.14, 7.2, 14.0, 0.2, 1.3, M["walnut_z"], 0.06, 0.03, 0.03, back=1)
for x in (4.5, 6.2, 14.9, 22.3): box("GatePost", (x, 0, 0.75), (0.5, 0.5, 2.1), M["stone"]); box("GatePostCap", (x, 0, 1.84), (0.6, 0.6, 0.08), M["marble_b"]); plight("GatePostL", (x, -0.45, 1.5), 12)
slats_x("GateDrive", 0, 15.2, 22.0, -0.05, 1.5, M["black"], 0.05, 0.07, 0.03); slats_x("GateWalk", 0, 4.8, 5.9, -0.05, 1.5, M["black"], 0.05, 0.07, 0.03)
# house name in brass on the front wall
fc = bpy.data.curves.new("NameCurve", "FONT"); fc.body = "AVIR"; fc.extrude = 0.02; fc.size = 0.42; fc.align_x = "CENTER"
no = bpy.data.objects.new("NamePlate", fc); no.location = (10.6, -0.15, 1.25); no.rotation_euler = (math.radians(90), 0, 0); link(no); no.data.materials.append(M["brass"])
fc2 = bpy.data.curves.new("NumCurve", "FONT"); fc2.body = "VILLA 07"; fc2.extrude = 0.01; fc2.size = 0.14; fc2.align_x = "CENTER"
n2 = bpy.data.objects.new("NamePlate2", fc2); n2.location = (10.6, -0.15, 1.02); n2.rotation_euler = (math.radians(90), 0, 0); link(n2); n2.data.materials.append(M["brass"])
alight("NameWash", (10.6, -1.0, 0.2), (10.6, -0.1, 1.2), 25, size=1.2)
# front garden: palms, hedge, feature tree, bollard lights, reflecting pool under the lounge window
for i, (x, y, h) in enumerate(((1.6, 3.2, 5.6), (9.4, 1.9, 6.2), (12.6, 5.6, 5.0), (24.6, 6.5, 5.4))): palm(f"PalmF{i}", x, y, h, OUTZ)
hedge("HedgeFront", 7.0, 0.55, 14.2, 0.55, 0.9); hedge("HedgeW", 0.55, 0.6, 0.55, 8.5, 0.9)
tree("FrangipaniF", 2.2, 7.0, 3.6, 1.5, OUTZ)
for i, (x, y) in enumerate(((4.2, 1.5), (4.2, 4.2), (4.2, 6.8), (6.4, 2.8), (6.4, 5.6), (14.8, 2.2), (14.8, 5.6))):
    cyl(f"Bollard{i}", (x, y, OUTZ + 0.3), 0.045, 0.6, M["black"], verts=12); cyl(f"BollardGlow{i}", (x, y, OUTZ + 0.56), 0.05, 0.08, M["bulb"], verts=12); plight(f"BollardL{i}", (x, y, OUTZ + 0.62), 6)
box("ReflectPoolRim", (10.0, 7.7, OUTZ + 0.12), (6.4, 1.9, 0.4), M["marble_b"], 0.01); box("ReflectPoolWater", (10.0, 7.7, OUTZ + 0.31), (6.1, 1.6, 0.03), M["water"])
box("ReflectPoolBed", (10.0, 7.7, OUTZ + 0.2), (6.1, 1.6, 0.05), M["pool_tile"])
for k in range(3): cyl("Spout", (8.2 + k * 1.8, 8.75, 0.55), 0.03, 0.3, M["brass"], rot=(math.radians(90), 0, 0), verts=12)
plant("EntryPlantL", 3.7, 8.6, -0.01, 1.7, M["pot_w"]); plant("EntryPlantR", 6.9, 8.6, -0.01, 1.4, M["pot_w"])
# car porch: slim black columns, timber soffit canopy
box("PorchCanopy", (19.2, 5.6, 3.05), (7.6, 6.4, 0.22), M["plaster"]); box("PorchSoffit", (19.2, 5.6, 2.93), (7.3, 6.1, 0.03), M["walnut"])
for x in (15.8, 22.6): box("PorchCol", (x, 2.7, 1.4), (0.14, 0.14, 3.1), M["black"])
boxes("PorchSpots", [((16.6 + i * 1.75, 3.6 + j * 2.0, 2.91), (0.1, 0.1, 0.01), 0) for i in range(4) for j in range(3)], [M["bulb"]])
alight("PorchDown", (19.2, 5.6, 2.85), (19.2, 5.6, 0), 320, size=5.5, size_y=4.5)

# =================================================================== SOCIETY (street, neighbours, towers)
CUR[0] = "Society"
box("Road", (13, -5.6, OUTZ - 0.02), (300, 7.2, 0.06), M["asphalt"]); box("FootpathN", (13, -1.1, OUTZ + 0.02), (300, 1.8, 0.12), M["concrete"]); box("FootpathS", (13, -10.1, OUTZ + 0.02), (300, 1.8, 0.12), M["concrete"])
boxes("RoadDashes", [((x, -5.6, OUTZ + 0.012), (2.2, 0.12, 0.004), 0) for x in range(-130, 160, 6)], [mat("RoadPaint", (0.85, 0.85, 0.8), 0.6)])
box("BackLane", (13, 40.2, OUTZ - 0.02), (300, 5.0, 0.06), M["asphalt"])
for i, x in enumerate(range(-62, 100, 14)):
    cyl(f"StreetLampPole{i}", (x, -1.4, 2.4), 0.06, 5.2, M["black"], verts=10); box(f"StreetLampArm{i}", (x, -2.0, 4.95), (0.08, 1.3, 0.06), M["black"])
    box(f"StreetLampHead{i}", (x, -2.5, 4.9), (0.2, 0.5, 0.05), M["bulb"]); plight(f"StreetLampL{i}", (x, -2.5, 4.75), 260, (1.0, 0.82, 0.6), 0.2)
for i, x in enumerate(range(-55, 100, 14)): tree(f"StreetTree{i}", x, -9.9, 6.5 + (i % 3) * 0.7, 2.2, OUTZ)
for i, x in enumerate((-9, -23, 33, 47)): tree(f"StreetTreeN{i}", x, -1.0, 6.0 + (i % 2), 2.0, OUTZ)
win_warm = mat("NeighbourWindow", (1.0, 0.8, 0.55), 0.2, emit=3.0, ecol=(1.0, 0.72, 0.42)); win_dark = glass_mat("NeighbourGlass", (0.3, 0.36, 0.4), 0.25)
ACC = [M["walnut_z"], M["stone"], noisy("AccTerracotta", (0.42, 0.2, 0.12), (0.52, 0.27, 0.16), 10, 0.9, 0.2), noisy("AccGrey", (0.3, 0.31, 0.33), (0.4, 0.41, 0.43), 10, 0.9, 0.2)]


def villa(name, px, py, w=20.0, d=11.0, style=0, face=1):
    """Neighbouring luxury villa (massing + lit windows) on a 26 m plot whose street edge is at py; face=+1 faces -y (south)."""
    acc = ACC[style % 4]; f = face; hy = py + f * (9 + d / 2); x0 = px + 3
    wallm = M["plaster"] if style % 2 == 0 else bw
    box(name + "GF", (x0 + w / 2, hy, 1.7), (w, d, 3.7), wallm); box(name + "FF", (x0 + w * 0.56 + (1.2 if style % 2 else -0.6), hy - f * 0.7, 5.5), (w * 0.8, d * 0.92, 3.5), wallm)
    box(name + "Acc", (x0 + w * (0.2 if style % 2 else 0.78), hy - f * (d / 2 + 0.06), 3.6), (w * 0.26, 0.14, 7.3), acc)
    box(name + "Roof", (x0 + w * 0.56 + (1.2 if style % 2 else -0.6), hy - f * 0.9, 7.4), (w * 0.86, d + 1.2, 0.25), M["plaster"])
    box(name + "Canopy", (x0 + w * 0.5, hy - f * (d / 2 + 1.2), 3.55), (w * 0.9, 2.6, 0.2), M["plaster"])
    for k, (cx, cz, ww, hh, lit) in enumerate(((0.3, 1.5, 0.3, 2.4, 1), (0.68, 1.5, 0.24, 2.4, style % 3 != 0), (0.42, 5.4, 0.36, 2.5, 1), (0.8, 5.4, 0.2, 2.5, style % 2 == 0))):
        for side in (-1, 1):
            yy = hy + side * (d / 2 + 0.02) if cz < 3.9 else hy - f * 0.7 + side * (d * 0.46 + 0.02)
            box(f"{name}Win{k}{side}", (x0 + w * cx + (0 if cz < 3.9 else (1.2 if style % 2 else -0.6) - w * 0.06), yy, cz), (w * ww, 0.05, hh), win_warm if lit else win_dark)
    box(name + "BWall", (px + 13, py, 0.6), (26, 0.25, 1.8), bw); box(name + "BWallL", (px, py + f * 18, 0.6), (0.25, 36, 1.8), bw); box(name + "BWallR", (px + 26, py + f * 18, 0.6), (0.25, 36, 1.8), bw)
    box(name + "Gate", (px + 19, py - f * 0.02, 0.6), (5.6, 0.3, 1.6), M["black"])
    palm(name + "Palm", px + 2.5, py + f * 4, 5.2 + style % 2, OUTZ); tree(name + "Tree", px + 22, py + f * 5, 5.5, 1.9, OUTZ); tree(name + "TreeB", px + 6, py + f * 30, 6.5, 2.4, OUTZ)
    plight(name + "Up", (x0 + w * 0.5, hy - f * (d / 2 + 2.5), 0.3), 180, (1.0, 0.75, 0.5), 0.3)
    box(name + "Pool", (px + 13, py + f * 25, OUTZ + 0.02), (9, 3.6, 0.05), M["pool_tile"])


for i, px in enumerate((-56, -28, 28, 56, 84)): villa(f"VillaRow{i}", px, 0, style=i + 1)
for i, px in enumerate((-56, -28, 0, 28, 56, 84)): villa(f"VillaOpp{i}", px, -11.2, style=i + 2, face=-1)
for i, px in enumerate((-56, -28, 0, 28, 56)): villa(f"VillaBack{i}", px, 79.4, style=i, face=-1)


def tower(name, x, y, w, d, floors, tone=0):
    """Apartment tower: lit-window grid (brick texture picks lit / dark flats at random), balconies, crown."""
    h = floors * 3.1; m = bpy.data.materials.new(name + "Facade"); m.use_nodes = True; nt = m.node_tree; b = nt.nodes["Principled BSDF"]
    tc = nt.nodes.new("ShaderNodeTexCoord"); sp = nt.nodes.new("ShaderNodeSeparateXYZ"); ad = nt.nodes.new("ShaderNodeMath"); ad.operation = "ADD"
    cb = nt.nodes.new("ShaderNodeCombineXYZ"); nt.links.new(tc.outputs["Object"], sp.inputs[0]); nt.links.new(sp.outputs["X"], ad.inputs[0]); nt.links.new(sp.outputs["Y"], ad.inputs[1])
    nt.links.new(ad.outputs[0], cb.inputs["X"]); nt.links.new(sp.outputs["Z"], cb.inputs["Y"])
    bk = nt.nodes.new("ShaderNodeTexBrick"); bk.offset = 0.0; bk.inputs["Scale"].default_value = 1.0; bk.inputs["Brick Width"].default_value = 1.7; bk.inputs["Row Height"].default_value = 3.1
    bk.inputs["Mortar Size"].default_value = 0.42; bk.inputs["Bias"].default_value = 0.5; bk.inputs["Color1"].default_value = (1.0, 0.72, 0.4, 1); bk.inputs["Color2"].default_value = (0.02, 0.03, 0.05, 1)
    base = ((0.62, 0.6, 0.57), (0.5, 0.52, 0.55), (0.66, 0.6, 0.52))[tone % 3]; bk.inputs["Mortar"].default_value = (*base, 1)
    nt.links.new(cb.outputs[0], bk.inputs["Vector"]); nt.links.new(bk.outputs["Color"], b.inputs["Base Color"])
    em = nt.nodes.new("ShaderNodeMix"); em.data_type = "RGBA"; em.inputs[6].default_value = (0, 0, 0, 1); em.inputs[7].default_value = (1.0, 0.66, 0.36, 1)
    gt = nt.nodes.new("ShaderNodeMath"); gt.operation = "GREATER_THAN"; gt.inputs[1].default_value = 0.6; sr = nt.nodes.new("ShaderNodeSeparateColor")
    nt.links.new(bk.outputs["Color"], sr.inputs[0]); nt.links.new(sr.outputs[0], gt.inputs[0]); mu = nt.nodes.new("ShaderNodeMath"); mu.operation = "MULTIPLY"
    inv = nt.nodes.new("ShaderNodeMath"); inv.operation = "SUBTRACT"; inv.inputs[0].default_value = 1.0; nt.links.new(bk.outputs["Fac"], inv.inputs[1])
    nt.links.new(gt.outputs[0], mu.inputs[0]); nt.links.new(inv.outputs[0], mu.inputs[1]); nt.links.new(mu.outputs[0], em.inputs["Factor"])
    nt.links.new(em.outputs[2], b.inputs["Emission Color"]); b.inputs["Emission Strength"].default_value = 1.4; b.inputs["Roughness"].default_value = 0.6
    box(name, (x, y, h / 2 + OUTZ), (w, d, h), m); box(name + "Crown", (x, y, h + 1.2), (w * 0.6, d * 0.6, 2.4), M["plaster"]); box(name + "Podium", (x, y, 3.0), (w + 6, d + 6, 6.0), M["concrete"])
    boxes(name + "Fins", [((x + sx * (w / 2 + 0.15), y + sy * (d / 2 + 0.15), h / 2), (0.5, 0.5, h + 2), 0) for sx in (-1, 1) for sy in (-1, 1)], [M["plaster"]])


for i, (x, y, w, d, fl) in enumerate(((-46, 132, 22, 18, 22), (-8, 150, 24, 18, 28), (34, 138, 22, 18, 24), (76, 126, 24, 20, 19), (118, 150, 22, 18, 26), (-92, 150, 22, 18, 20),
                                      (-70, -70, 22, 18, 18), (60, -78, 24, 18, 22), (140, -40, 22, 18, 16))): tower(f"Tower{i}", x, y, w, d, fl, i)
for i in range(26): tree(f"SocTree{i}", rng.uniform(-110, 140), rng.choice((rng.uniform(86, 118), rng.uniform(-60, -36))), rng.uniform(6, 9), rng.uniform(2.2, 3.2), OUTZ)

# =================================================================== HOUSE SHELL
CUR[0] = "GF"
box("GF_Floor", (13, 14, -0.01), (20, 10, 0.02), M["floor"])
P, PI = M["plaster"], M["plaster_in"]
wall_x("GF_South", Y0, X0, X1, 0, GH, P, openings=[(4.6, 6.6, 3.0), (8.0, 12.0, GH), (15.0, 21.0, GH)])
box("GF_SouthLoungeSill", (10, Y0, 0.4), (4.0, 0.2, 0.8), P); box("GF_SouthLoungeHead", (10, Y0, 3.15), (4.0, 0.2, 0.9), P)
box("GF_SouthKitSill", (18, Y0, 0.55), (6.0, 0.2, 1.1), P); box("GF_SouthKitHead", (18, Y0, 2.95), (6.0, 0.2, 1.3), P)
box("GF_WinLounge", (10, Y0, 1.75), (4.0, 0.012, 1.9), M["glass_dark"]); box("GF_WinKitchen", (18, Y0, 1.7), (6.0, 0.012, 1.2), M["glass_dark"])
slats_x("GF_LoungeLouvres", Y0 - 0.16, 8.0, 12.0, 0.8, 2.7, M["walnut_z"], 0.05, 0.16, 0.12)
wall_y("GF_West", X0, Y0, Y1, 0, GH, P, openings=[(15.0, 17.2, GH)]); box("GF_WestSill", (X0, 16.1, 0.5), (0.2, 2.2, 1.0), P)
wall_y("GF_East", X1, Y0, Y1, 0, GH, P)
box("GF_StoneFrontE", (20.6, Y0 - 0.13, 1.8), (4.8, 0.08, 3.6), M["stone"]); box("GF_StoneW", (X0 - 0.13, 12.0, 3.6), (0.08, 6.0, 7.2), M["stone"])
# entrance: walnut pivot door (slightly open), glass sidelight, portal frame
door = box("EntryDoor", (5.3, Y0 + 0.02, 1.5), (1.4, 0.07, 3.0), M["walnut_z"], 0.004); cyl("EntryDoorPull", (5.85, Y0 - 0.07, 1.4), 0.018, 1.2, M["brass"], verts=12)
box("EntrySidelight", (6.3, Y0, 1.5), (0.6, 0.012, 3.0), M["glass"]); boxes("EntryPortal", [((4.52, Y0 - 0.25, 1.55), (0.16, 0.7, 3.1), 0), ((6.68, Y0 - 0.25, 1.55), (0.16, 0.7, 3.1), 0), ((5.6, Y0 - 0.25, 3.14), (2.32, 0.7, 0.14), 0)], [M["walnut_z"]])
# north facade: double-height living glazing, dining glazing, guest wall
glazing_x("GF_GlassLiving", Y1, 7.0, 13.0, 0, RZ - 0.15, 5); boxes("LivingTransom", [((10, Y1, 3.75), (6.0, 0.1, 0.1), 0)], [M["black"]])
glazing_x("GF_GlassDining", Y1, 13.2, 18.0, 0, GH, 4); wall_x("GF_NorthStair", Y1, X0, 7.0, 0, GH, P, openings=[(4.9, 6.8, 2.9)]); box("GF_StairHallGlass", (5.85, Y1, 1.45), (1.9, 0.012, 2.9), M["glass"])
wall_x("GF_NorthGuest", Y1, 18.0, X1, 0, GH, P, openings=[(19.2, 21.8, 2.6)]); box("GF_GuestSill", (20.5, Y1, 0.25), (2.6, 0.2, 0.5), P); box("GF_GuestGlass", (20.5, Y1, 1.55), (2.6, 0.012, 2.1), M["glass_dark"])
box("GF_GuestCurtain", (20.5, Y1 - 0.2, 1.6), (2.7, 0.03, 2.4), mat("GuestCurtainGlow", (0.95, 0.85, 0.7), 0.9, emit=0.9, ecol=(1.0, 0.75, 0.5)))
# interior partitions (GF)
wall_y("GF_FoyerEast", 7.0, Y0, 13.5, 0, GH, PI, openings=[(10.2, 12.8, 3.0)], t=0.16)
wall_y("GF_LoungeKitchen", 13.0, Y0, 11.5, 0, GH, PI, t=0.16)
wall_y("GF_FeatureWall", 13.0, 14.6, Y1, 0, GH, PI, t=0.3)
wall_y("GF_GuestWest", 18.0, 13.5, Y1, 0, GH, PI, openings=[(14.0, 15.0, 2.4)], t=0.16); box("GF_GuestDoor", (18.0, 14.5, 1.2), (0.05, 1.0, 2.4), M["walnut_z"])
wall_x("GF_GuestSouth", 13.5, 18.0, X1, 0, GH, PI, t=0.16)

CUR[0] = "FFSlab"
SL = M["ceil"]
for nm, cx, cy, sx, sy in (("A", 13, (YC + 13.5) / 2, 20, 13.5 - YC), ("B", 18, 16.25, 10, 5.5), ("C", 5.75, 16.25, 2.5, 5.5), ("D", 3.75, 18.7, 1.5, 0.6), ("E", 3.75, 13.7, 1.5, 0.4)):
    box("FF_Slab" + nm, (cx, cy, (GH + FZ) / 2), (sx, sy, FZ - GH), SL)
box("FF_SlabEdgeN", (13.2, 19.02, 3.75), (19.7, 0.05, 0.34), P); box("FF_CantSoffit", (13, 8.6, GH - 0.02), (20, 0.82, 0.03), M["walnut"])
box("Balcony", (18, 19.9, 3.78), (10, 1.8, 0.24), SL); box("BalconyDeck", (18, 19.9, 3.91), (9.9, 1.75, 0.02), M["teak_deck"])
box("BalconyGlass", (18, 20.76, 4.45), (10, 0.012, 1.05), M["glass"]); box("BalconyRail", (18, 20.76, 4.99), (10, 0.05, 0.04), M["steel"])
for x in (13.03, 22.97): box("BalconyGlassSide", (x, 19.9, 4.45), (0.012, 1.75, 1.05), M["glass"])

CUR[0] = "FF"
box("FF_FloorOak", (13, (YC + 13.5) / 2, FZ + 0.006), (19.8, 13.5 - YC - 0.1, 0.012), M["oak"]); box("FF_FloorOakB", (18, 16.25, FZ + 0.006), (9.9, 5.5, 0.012), M["oak"]); box("FF_FloorOakC", (5.75, 16.25, FZ + 0.006), (2.5, 5.5, 0.012), M["oak"])
wall_x("FF_South", YC, X0, X1, FZ, RZ, P, openings=[(3.6, 6.6, RZ), (19.5, 22.5, RZ)])
box("FF_LoungeGlassS", (5.1, YC, 5.55), (3.0, 0.012, 3.3), M["glass_dark"]); boxes("FF_LoungeGlassFrame", [((3.6 + k * 1.0, YC, 5.55), (0.05, 0.09, 3.3), 0) for k in range(4)], [M["black"]])
box("FF_BathSill", (21, YC, 4.6), (3.0, 0.2, 1.4), P); box("FF_BathHead", (21, YC, 6.9), (3.0, 0.2, 0.6), P); box("FF_BathGlass", (21, YC, 5.95), (3.0, 0.012, 1.3), mat("FrostedGlass", (0.9, 0.93, 0.95), 0.5, trans=0.9, emit=0.5, ecol=(1.0, 0.8, 0.6)))
slats_x("FF_FrontCladding", YC - 0.13, 7.0, 19.2, FZ - 0.3, RZ + 0.3, M["walnut_z"], 0.09, 0.03, 0.05, back=1)
box("FF_SideFrontW", (X0, 8.6, 5.55), (0.2, 0.8, 3.3), P); box("FF_SideFrontE", (X1, 8.6, 5.55), (0.2, 0.8, 3.3), P)
wall_y("FF_West", X0, Y0, Y1, FZ, RZ, P, openings=[(15.0, 17.2, 6.6)]); box("FF_WestGlass", (X0, 16.1, 3.8), (0.012, 2.2, 5.6), M["glass_dark"]); boxes("WestGlassFrame", [((X0, 15.0 + k * 1.1, 3.8), (0.09, 0.05, 5.6), 0) for k in range(3)], [M["black"]])
wall_y("FF_East", X1, Y0, Y1, FZ, RZ, P)
wall_x("FF_NorthLounge", Y1, X0, 7.0, FZ, RZ, P, openings=[(3.8, 6.4, 6.6)]); box("FF_LoungeGlassN", (5.1, Y1, 5.3), (2.6, 0.012, 2.6), M["glass"])
glazing_x("FF_GlassMaster", Y1, 13.2, X1 - 0.1, FZ, RZ - 0.15, 6)
wall_y("FF_MasterWest", 13.0, YC, 14.6, FZ, RZ, PI, openings=[(12.3, 13.3, FZ + 2.4)], t=0.16); box("FF_FeatureUpper", (13.0, 16.8, (GH + RZ) / 2), (0.3, 4.4, RZ - GH), PI)
wall_x("FF_MasterSouth", 13.5, 13.0, X1, FZ, RZ, PI, openings=[(13.7, 14.7, FZ + 2.4), (21.3, 22.3, FZ + 2.4)], t=0.16)
wall_y("FF_ClosetBath", 18.0, YC, 13.5, FZ, RZ, PI, t=0.14)
# creator studio box (the existing studio set attaches here) + "ON AIR" door
wall_x("FF_StudioNorth", 12.0, 7.0, 13.0, FZ, RZ, PI, openings=[(9.4, 10.4, FZ + 2.4)], t=0.16); wall_y("FF_StudioWest", 7.0, YC, 12.0, FZ, RZ, PI, t=0.16)
box("StudioDoor", (9.9, 12.0, FZ + 1.2), (1.0, 0.05, 2.4), M["walnut_z"]); box("OnAirSign", (9.9, 12.12, FZ + 2.62), (0.7, 0.04, 0.2), mat("OnAir", (1.0, 0.15, 0.1), 0.4, emit=6))
# glass railings around the living void and the stair opening
for nm, c, s in (("RailBridge", (10, 13.5, FZ + 0.55), (6.0, 0.012, 1.1)), ("RailVoidW", (7.0, 16.25, FZ + 0.55), (0.012, 5.5, 1.1)), ("RailStair", (4.5, 16.15, FZ + 0.55), (0.012, 4.5, 1.1)), ("RailStairS", (3.85, 13.9, FZ + 0.55), (1.3, 0.012, 1.1))):
    box(nm, c, s, M["glass"]); box(nm + "Cap", (c[0], c[1], FZ + 1.11), (max(s[0], 0.05), max(s[1], 0.05), 0.03), M["brass"])

CUR[0] = "Roof"
box("RoofSlab", (13, 13.9, RZ + 0.15), (20.8, 12.0, 0.3), M["ceil"]); box("RoofCanopyN", (13, 20.2, RZ + 0.2), (20.8, 1.8, 0.2), M["plaster"]); box("RoofCanopySoffit", (13, 20.2, RZ + 0.09), (20.6, 1.7, 0.02), M["walnut"])
boxes("RoofParapet", [((13, 7.95, RZ + 0.55), (20.8, 0.15, 0.5), 0), ((13, 19.85, RZ + 0.55), (20.8, 0.15, 0.5), 0), ((2.65, 13.9, RZ + 0.55), (0.15, 12, 0.5), 0), ((23.35, 13.9, RZ + 0.55), (0.15, 12, 0.5), 0)], [M["plaster"]])
boxes("RoofSolar", [((16 + i * 1.9, 11 + j * 2.4, RZ + 0.5), (1.7, 1.0, 0.04), 0) for i in range(3) for j in range(3)], [mat("SolarPanel", (0.02, 0.03, 0.08), 0.15, metal=0.5)])

exec(open(Path(__file__).with_name("luxury_villa_rooms.py")).read())
