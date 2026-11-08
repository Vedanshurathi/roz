#!/usr/bin/env python3
"""Avir's luxury penthouse (night). Builds home.blend (+ home.glb). Reuses studio.blend as an attached room.
  python3 -I luxury_home.py <out_dir> [--studio studio.blend] [--avir avir.glb] [--preview 432] [--samples 12]
Axes: camera side is -Y; glass wall + balcony at +Y; bedroom on the left (x<-3.4) behind the TV wall;
kitchen/dining on the right; studio wing beyond the right wall (x>8). Cameras: Cam_Living, Cam_Kitchen, Cam_Bedroom,
Cam_Balcony, Cam_Entrance."""
import argparse, math, random
from pathlib import Path
import bpy
import numpy as np
from mathutils import Vector

ap = argparse.ArgumentParser(); ap.add_argument("out"); ap.add_argument("--studio", default=""); ap.add_argument("--avir", default="")
ap.add_argument("--preview", type=int, default=0); ap.add_argument("--samples", type=int, default=12)
a = ap.parse_args(); OUT = Path(a.out); OUT.mkdir(parents=True, exist_ok=True); rng = random.Random(21)
bpy.ops.wm.read_factory_settings(use_empty=True); sc = bpy.context.scene
H = 3.4  # ceiling height
GOLD = (0.83, 0.62, 0.3)


def mat(name, col, rough=0.5, emit=0.0, ecol=None, metal=0.0, trans=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True; b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*col, 1); b.inputs["Roughness"].default_value = rough; b.inputs["Metallic"].default_value = metal
    if trans: b.inputs["Transmission Weight"].default_value = trans
    if emit: b.inputs["Emission Color"].default_value = (*(ecol or col), 1); b.inputs["Emission Strength"].default_value = emit
    return m


def box(name, loc, size, m, bevel=0.0, rotz=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=(0, 0, rotz)); o = bpy.context.active_object; o.name = name; o.scale = size
    bpy.ops.object.transform_apply(scale=True)
    if bevel: bv = o.modifiers.new("bevel", "BEVEL"); bv.width = bevel; bv.segments = 3
    o.data.materials.append(m); return o


def cyl(name, loc, r, h, m, rot=(0, 0, 0), verts=40):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=h, location=loc, rotation=rot, vertices=verts); o = bpy.context.active_object; o.name = name
    o.data.materials.append(m); return o


def marble(name, base=(0.93, 0.92, 0.9), vein=(0.55, 0.53, 0.52), rough=0.12, scale=2.5):
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; b = nt.nodes["Principled BSDF"]
    n = nt.nodes.new("ShaderNodeTexNoise"); n.inputs["Scale"].default_value = scale; n.inputs["Detail"].default_value = 8; n.inputs["Distortion"].default_value = 4
    r = nt.nodes.new("ShaderNodeValToRGB"); r.color_ramp.elements[0].position = 0.48; r.color_ramp.elements[1].position = 0.52
    r.color_ramp.elements[0].color = (*base, 1); r.color_ramp.elements[1].color = (*vein, 1)
    r2 = nt.nodes.new("ShaderNodeValToRGB"); r2.color_ramp.elements[0].color = (*vein, 1); r2.color_ramp.elements[1].color = (*base, 1)
    r2.color_ramp.elements[0].position = 0.5; r2.color_ramp.elements[1].position = 0.56
    mx = nt.nodes.new("ShaderNodeMix"); mx.data_type = "RGBA"; mx.blend_type = "MULTIPLY"; mx.inputs["Factor"].default_value = 1
    nt.links.new(n.outputs["Fac"], r.inputs["Fac"]); nt.links.new(n.outputs["Fac"], r2.inputs["Fac"])
    nt.links.new(r.outputs["Color"], mx.inputs[6]); nt.links.new(r2.outputs["Color"], mx.inputs[7]); nt.links.new(mx.outputs[2], b.inputs["Base Color"])
    b.inputs["Roughness"].default_value = rough; return m


def wood(name, c0=(0.22, 0.12, 0.06), c1=(0.42, 0.25, 0.12), scale=4.0, rough=0.45):
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; b = nt.nodes["Principled BSDF"]
    wv = nt.nodes.new("ShaderNodeTexWave"); wv.inputs["Scale"].default_value = scale; wv.inputs["Distortion"].default_value = 6; wv.inputs["Detail"].default_value = 3
    r = nt.nodes.new("ShaderNodeValToRGB"); r.color_ramp.elements[0].color = (*c0, 1); r.color_ramp.elements[1].color = (*c1, 1)
    nt.links.new(wv.outputs["Fac"], r.inputs["Fac"]); nt.links.new(r.outputs["Color"], b.inputs["Base Color"]); b.inputs["Roughness"].default_value = rough
    return m


def img_mat(name, arr, emit=0.0):
    from PIL import Image
    p = OUT / f"{name}.png"; Image.fromarray((np.clip(arr, 0, 1) * 255).astype(np.uint8)).save(p)
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; b = nt.nodes["Principled BSDF"]
    t = nt.nodes.new("ShaderNodeTexImage"); t.image = bpy.data.images.load(str(p)); nt.links.new(t.outputs["Color"], b.inputs["Base Color"])
    if emit: nt.links.new(t.outputs["Color"], b.inputs["Emission Color"]); b.inputs["Emission Strength"].default_value = emit
    return m


def plight(name, loc, energy, col=(1.0, 0.78, 0.55), r=0.05):
    l = bpy.data.lights.new(name, "POINT"); l.energy = energy; l.color = col; l.shadow_soft_size = r
    o = bpy.data.objects.new(name, l); o.location = loc; sc.collection.objects.link(o); return o


def alight(name, loc, target, energy, col, size):
    l = bpy.data.lights.new(name, "AREA"); l.energy = energy; l.color = col; l.size = size
    o = bpy.data.objects.new(name, l); o.location = loc; sc.collection.objects.link(o)
    o.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler(); return o


# ---------------- shell
floor_marble = marble("FloorMarble", (0.86, 0.84, 0.8), (0.6, 0.57, 0.53), 0.18, 1.2)
box("Floor", (0, 0, -0.02), (16, 12, 0.04), floor_marble)
box("FloorBedroomWood", (-5.7, 0.5, 0.002), (4.6, 9, 0.004), wood("BedroomFloor", (0.25, 0.15, 0.08), (0.4, 0.25, 0.13), 3))
wallm = mat("WallWarm", (0.78, 0.74, 0.68), 0.85); ceil = mat("Ceiling", (0.9, 0.88, 0.85), 0.9)
box("Ceiling", (0, 0, H + 0.02), (16, 12, 0.04), ceil)
box("WallFront", (0, -6, H / 2), (16, 0.15, H), wallm); box("WallLeft", (-8, 0, H / 2), (0.15, 12, H), wallm)
box("WallRightA", (8, -3.5, H / 2), (0.15, 5, H), wallm); box("WallRightB", (8, 3.6, H / 2), (0.15, 4.8, H), wallm)   # doorway to studio
box("WallRightTop", (8, 0.1, H - 0.3), (0.15, 2.2, 0.6), wallm)
# ceiling cove lights (warm LED) around the living area
for x, y, sx, sy in ((0.3, -1.8, 7, 0.06), (0.3, 5.6, 7, 0.06), (-3.2, 1.9, 0.06, 7.4), (3.8, 1.9, 0.06, 7.4)):
    box("CoveLED", (x, y, H - 0.08), (sx, sy, 0.03), mat("CoveLED", (1.0, 0.75, 0.45), emit=6))
# false ceiling recessed spots
for x in (-1.5, 0.5, 2.5):
    for y in (0.0, 2.5, 4.5):
        cyl("Spot", (x, y, H - 0.005), 0.05, 0.01, mat("SpotM", (1, 0.9, 0.75), emit=20)); plight("SpotL", (x, y, H - 0.15), 35)

# ---------------- glass wall + balcony + night skyline (+Y)
for i in range(8):
    x = -3.4 + i * 1.6
    box("Mullion", (x, 6, H / 2), (0.05, 0.08, H), mat("BlackFrame", (0.02, 0.02, 0.025), 0.3, metal=0.8))
glass = mat("Glass", (0.9, 0.95, 1.0), 0.02, trans=1.0)
box("GlassWall", (2.2, 6, H / 2), (11.2, 0.02, H), glass)
box("WallBackLeft", (-5.7, 6, H / 2), (4.6, 0.15, H), wallm)
box("BalconyDeck", (2.2, 7.4, -0.05), (11.2, 2.8, 0.1), wood("Deck", (0.2, 0.13, 0.08), (0.33, 0.21, 0.12), 6, 0.6))
box("BalconyRail", (2.2, 8.75, 0.55), (11.2, 0.03, 1.1), glass)
box("RailTop", (2.2, 8.75, 1.1), (11.2, 0.05, 0.04), mat("Steel", (0.7, 0.7, 0.72), 0.25, metal=1))
for x in (-2.5, 0.0, 4.2, 6.8):
    cyl("Planter", (x, 8.2, 0.3), 0.28, 0.6, mat("PlanterM", (0.12, 0.12, 0.13), 0.6))
    for q in range(14):
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.25, location=(x + rng.uniform(-0.2, 0.2), 8.2 + rng.uniform(-0.2, 0.2), 0.9 + rng.uniform(0, 0.6)),
                                             scale=(1, 0.2, 0.5), rotation=(rng.uniform(-1, 1), rng.uniform(0, 1), rng.uniform(0, 6)))
        bpy.context.active_object.data.materials.append(mat(f"Leaf{q}", (0.08, 0.28, 0.1), 0.6))
for x in (1.0, 2.6):                                                        # balcony lounge chairs + side table
    box("Lounger", (x, 7.6, 0.22), (0.75, 1.6, 0.18), mat("LoungerCushion", (0.85, 0.82, 0.76), 0.9), 0.05)
    box("LoungerBack", (x, 8.3, 0.45), (0.75, 0.25, 0.45), mat("LoungerCushion2", (0.85, 0.82, 0.76), 0.9), 0.05, rotz=0)
cyl("BalconyTable", (1.8, 7.4, 0.25), 0.25, 0.5, mat("BalTable", (0.15, 0.15, 0.16), 0.4))
cyl("Lantern", (1.8, 7.4, 0.6), 0.06, 0.2, mat("LanternGlow", (1, 0.7, 0.35), 0.3, emit=6)); plight("BalLantern", (1.8, 7.4, 0.65), 25)
city = np.zeros((768, 2048, 3)); city[:] = np.linspace([0.01, 0.015, 0.05], [0.18, 0.08, 0.16], 768)[:, None, :]
for s in range(400): city[rng.randint(0, 300), rng.randint(0, 2047)] = 0.9
for i in range(70):
    x0 = rng.randint(0, 2000); w = rng.randint(30, 90); h = rng.randint(150, 600)
    city[768 - h:, x0:x0 + w] = [0.01, 0.012, 0.025]
    for yy in range(768 - h + 10, 760, 16):
        for xx in range(x0 + 5, x0 + w - 5, 11):
            if rng.random() < 0.33: city[yy:yy + 7, xx:xx + 6] = rng.choice([[1, .78, .45], [1, .9, .72], [.7, .82, 1]])
cm = img_mat("Skyline", city, emit=1.6)
bpy.ops.mesh.primitive_plane_add(size=1, location=(2.2, 30, 7), rotation=(math.radians(90), 0, 0)); sk = bpy.context.active_object
sk.scale = (90, 34, 1); sk.data.materials.append(cm)
alight("MoonFill", (2.2, 12, 5), (2.2, 0, 1), 400, (0.55, 0.65, 1.0), 6)

# ---------------- living room
box("Rug", (0.4, 2.6, 0.006), (4.6, 3.4, 0.012), mat("RugM", (0.72, 0.66, 0.58), 0.95))
cream = mat("SofaCream", (0.82, 0.77, 0.7), 0.9)
box("SofaSeat", (0.9, 4.1, 0.24), (3.4, 1.0, 0.42), cream, 0.06)
box("SofaBack", (0.9, 4.55, 0.62), (3.4, 0.25, 0.5), cream, 0.08)
box("SofaChaise", (2.25, 3.0, 0.24), (1.0, 1.6, 0.42), cream, 0.06)
box("SofaArm", (-0.85, 4.1, 0.45), (0.2, 1.0, 0.5), cream, 0.06)
for i, x in enumerate((-0.1, 0.8, 1.7)):
    box(f"Cushion{i}", (x, 4.3, 0.62), (0.45, 0.14, 0.4), mat(f"Cush{i}", [(0.55, 0.32, 0.12), (0.2, 0.3, 0.32), (0.7, 0.55, 0.3)][i], 0.9), 0.06, rotz=rng.uniform(-0.2, 0.2))
box("CoffeeTable", (0.5, 2.5, 0.38), (1.4, 0.8, 0.06), marble("TableMarble", (0.95, 0.94, 0.92), (0.4, 0.38, 0.37), 0.08, 3), 0.01)
for x in (-0.1, 1.1):
    box("CTLeg", (x, 2.5, 0.18), (0.06, 0.7, 0.36), mat("Gold", GOLD, 0.25, metal=1))
cyl("Vase", (0.2, 2.45, 0.53), 0.07, 0.24, mat("VaseM", (0.1, 0.1, 0.11), 0.2))
box("Books", (0.85, 2.55, 0.43), (0.3, 0.22, 0.05), mat("BookStack", (0.6, 0.2, 0.15), 0.7))
# TV wall: walnut slats + big TV + floating console (living side faces +x)
walnut = wood("Walnut", (0.12, 0.06, 0.03), (0.28, 0.15, 0.07), 5, 0.5)
box("TVWallBase", (-3.4, 1.9, H / 2), (0.15, 7.6, H), wallm)
for i in range(46):
    box(f"Slat{i}", (-3.3, -1.5 + i * 0.15, H / 2), (0.05, 0.07, H - 0.1), walnut)
tvscr = np.zeros((360, 640, 3)); tvscr[:] = np.linspace([0.05, 0.08, 0.2], [0.6, 0.25, 0.1], 640)[None, :, :] * 0.8
box("TV", (-3.22, 2.2, 1.55), (0.05, 2.2, 1.25), mat("TVFrame", (0.01, 0.01, 0.012), 0.2))
bpy.ops.mesh.primitive_plane_add(size=1, location=(-3.19, 2.2, 1.55), rotation=(math.radians(90), 0, math.radians(90))); tv = bpy.context.active_object
tv.scale = (2.15, 1.2, 1); tv.data.materials.append(img_mat("TVScreen", tvscr, emit=1.2))
box("Console", (-3.0, 2.2, 0.35), (0.42, 3.0, 0.4), walnut, 0.01)
box("ConsoleLED", (-2.78, 2.2, 0.14), (0.01, 2.9, 0.01), mat("ConsoleLED", (1.0, 0.7, 0.4), emit=8))
# floor lamp + art + plants
cyl("LampPole", (-2.2, 4.6, 0.8), 0.015, 1.6, mat("Gold2", GOLD, 0.25, metal=1))
bpy.ops.mesh.primitive_cone_add(radius1=0.25, radius2=0.15, depth=0.3, location=(-2.2, 4.6, 1.7)); bpy.context.active_object.data.materials.append(mat("Shade", (0.95, 0.88, 0.75), 0.8, emit=2))
plight("FloorLampL", (-2.2, 4.6, 1.62), 60)
box("ArtFrame", (-0.2, -5.9, 1.7), (1.6, 0.04, 1.1), mat("ArtGold", GOLD, 0.3, metal=1))
art = np.zeros((300, 440, 3)); yy, xx = np.mgrid[0:300, 0:440]
art[:] = np.stack([0.9 - yy / 600, 0.45 + 0.2 * np.sin(xx / 40), 0.25 + 0.2 * np.cos(yy / 30)], -1)
bpy.ops.mesh.primitive_plane_add(size=1, location=(-0.2, -5.87, 1.7), rotation=(math.radians(90), 0, 0)); ap_ = bpy.context.active_object
ap_.scale = (1.5, 1.0, 1); ap_.rotation_euler[2] = math.radians(180); ap_.data.materials.append(img_mat("ArtCanvas", art))
for x, y in ((-2.7, 5.5), (3.6, 5.5)):
    cyl("BigPot", (x, y, 0.3), 0.25, 0.6, mat("PotWhite", (0.9, 0.88, 0.85), 0.4))
    for q in range(20):
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.3, location=(x + rng.uniform(-0.25, 0.25), y + rng.uniform(-0.25, 0.25), 0.9 + rng.uniform(0, 1.2)),
                                             scale=(1, 0.18, 0.5), rotation=(rng.uniform(-1, 1), rng.uniform(0.2, 0.9), rng.uniform(0, 6)))
        bpy.context.active_object.data.materials.append(mat(f"Plant{q}", (0.06, 0.26 + 0.08 * rng.random(), 0.09), 0.55))
# chandelier over the living area
cyl("ChandRing", (0.6, 2.6, H - 0.7), 0.7, 0.04, mat("GoldRing", GOLD, 0.2, metal=1), verts=64)
for i in range(24):
    ang = i / 24 * 2 * math.pi
    cyl("Crystal", (0.6 + 0.7 * math.cos(ang), 2.6 + 0.7 * math.sin(ang), H - 0.85), 0.02, 0.22, mat("CrystalM", (1, 0.95, 0.85), 0.05, emit=3))
plight("ChandL", (0.6, 2.6, H - 0.85), 180, r=0.4)

# ---------------- kitchen + dining (right)
dark = mat("CabinetDark", (0.06, 0.065, 0.07), 0.35)
box("BackCabinets", (6.6, 5.3, 1.0), (2.6, 0.6, 2.0), dark, 0.01)
box("Backsplash", (6.6, 5.6, 1.65), (2.6, 0.02, 1.3), marble("Splash", (0.15, 0.15, 0.16), (0.7, 0.62, 0.5), 0.15, 2))
box("Counter", (6.6, 5.25, 0.91), (2.62, 0.64, 0.04), marble("CounterM", (0.95, 0.94, 0.92), (0.45, 0.42, 0.4), 0.08, 3))
box("Island", (6.0, 2.2, 0.45), (2.4, 1.0, 0.9), dark, 0.01)
box("IslandTop", (6.0, 2.2, 0.92), (2.6, 1.1, 0.05), marble("IslandM", (0.96, 0.95, 0.93), (0.4, 0.38, 0.36), 0.08, 3), 0.01)
for i in range(3):
    x = 5.2 + i * 0.8; cyl("Stool", (x, 1.45, 0.38), 0.18, 0.06, mat("StoolSeat", (0.55, 0.32, 0.15), 0.6))
    cyl("StoolLeg", (x, 1.45, 0.18), 0.02, 0.36, mat("Gold3", GOLD, 0.25, metal=1))
    cyl("Pendant", (x, 2.2, H - 0.9), 0.12, 0.25, mat("PendantGlass", (1, 0.85, 0.6), 0.1, emit=6)); plight("PendL", (x, 2.2, H - 1.05), 45)
    cyl("PendantCord", (x, 2.2, H - 0.4), 0.004, 0.8, mat("Cord", (0.02, 0.02, 0.02)))
box("DiningTable", (5.8, -2.4, 0.75), (2.2, 1.0, 0.05), walnut, 0.01)
box("DTBase", (5.8, -2.4, 0.37), (0.3, 0.6, 0.72), mat("Gold4", GOLD, 0.25, metal=1))
for i in range(3):
    for side in (-1, 1):
        x = 5.0 + i * 0.8; y = -2.4 + side * 0.75
        box("ChairSeat", (x, y, 0.46), (0.45, 0.45, 0.06), mat("Velvet", (0.12, 0.25, 0.22), 0.8), 0.02)
        box("ChairBack", (x, y + side * 0.2, 0.75), (0.45, 0.05, 0.55), mat("Velvet2", (0.12, 0.25, 0.22), 0.8), 0.02)
cyl("DiningLinear", (5.8, -2.4, H - 0.8), 0.03, 1.8, mat("LinearLED", (1, 0.8, 0.55), emit=10), rot=(0, math.radians(90), 0)); plight("DiningL", (5.8, -2.4, H - 0.95), 120, r=0.5)

# ---------------- bedroom (left, behind the TV wall)
box("Headboard", (-7.85, 1.0, 1.0), (0.12, 2.6, 1.6), mat("HeadboardFabric", (0.4, 0.33, 0.27), 0.95), 0.03)
for i in range(6):
    box(f"Channel{i}", (-7.78, 1.0 - 1.05 + i * 0.42, 1.0), (0.04, 0.36, 1.5), mat("Channel", (0.45, 0.37, 0.3), 0.95), 0.05)
box("BedBase", (-6.9, 1.0, 0.25), (2.0, 2.0, 0.5), walnut, 0.02)
box("Mattress", (-6.9, 1.0, 0.6), (1.95, 1.95, 0.22), mat("Linen", (0.95, 0.94, 0.92), 0.95), 0.06)
box("Duvet", (-6.6, 1.0, 0.73), (1.4, 2.0, 0.08), mat("DuvetGrey", (0.55, 0.57, 0.6), 0.95), 0.04)
for y in (0.45, 1.55): box("Pillow", (-7.55, y, 0.8), (0.35, 0.65, 0.16), mat("PillowW", (0.97, 0.96, 0.95), 0.95), 0.07)
for y in (-0.4, 2.4):
    box("SideTable", (-7.6, y, 0.28), (0.5, 0.45, 0.56), walnut, 0.01)
    cyl("BedLamp", (-7.6, y, 0.75), 0.13, 0.3, mat("BedLampShade", (1, 0.9, 0.75), 0.8, emit=3)); plight("BedLampL", (-7.6, y, 0.75), 30)
box("Wardrobe", (-5.7, -5.6, 1.25), (3.6, 0.6, 2.5), wood("WardrobeWood", (0.3, 0.2, 0.12), (0.45, 0.32, 0.2), 3), 0.01)
box("WardrobeLED", (-5.7, -5.28, 2.45), (3.4, 0.01, 0.02), mat("WardLED", (1, 0.75, 0.45), emit=8))
box("BedroomRug", (-6.2, 1.0, 0.006), (2.6, 3.2, 0.012), mat("BedRug", (0.55, 0.5, 0.45), 0.95))
box("BedBench", (-5.65, 1.0, 0.24), (0.4, 1.6, 0.42), mat("BenchVelvet", (0.12, 0.25, 0.22), 0.8), 0.04)
box("BedArtFrame", (-7.9, 1.0, 2.35), (0.03, 1.8, 0.7), mat("BedArtGold", GOLD, 0.3, metal=1))
bart = np.zeros((140, 360, 3)); bx = np.mgrid[0:140, 0:360][1]; bart[:] = np.stack([0.85 - bx / 900, 0.7 - bx / 1200, 0.55 + bx / 1500], -1)
bpy.ops.mesh.primitive_plane_add(size=1, location=(-7.87, 1.0, 2.35), rotation=(math.radians(90), 0, math.radians(90))); ba = bpy.context.active_object
ba.scale = (1.72, 0.64, 1); ba.data.materials.append(img_mat("BedArt", bart))
for y in (-0.15, 2.15):
    cyl("Sconce", (-7.88, y, 1.6), 0.06, 0.16, mat("SconceGlow", (1, 0.85, 0.6), 0.3, emit=5), rot=(0, math.radians(90), 0)); plight("SconceL", (-7.7, y, 1.6), 20)
cyl("BedPlantPot", (-4.0, 4.9, 0.3), 0.22, 0.6, mat("PotBeige", (0.8, 0.74, 0.65), 0.6))
for q in range(16):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.25, location=(-4.0 + rng.uniform(-0.2, 0.2), 4.9 + rng.uniform(-0.2, 0.2), 0.9 + rng.uniform(0, 1.0)),
                                         scale=(1, 0.18, 0.5), rotation=(rng.uniform(-1, 1), rng.uniform(0.2, 0.9), rng.uniform(0, 6)))
    bpy.context.active_object.data.materials.append(mat(f"BPlant{q}", (0.07, 0.3, 0.1), 0.55))
bpy.ops.mesh.primitive_plane_add(size=1, location=(-5.7, 5.9, 1.6), rotation=(math.radians(90), 0, 0)); bw = bpy.context.active_object
bw.scale = (3.6, 2.6, 1); bw.data.materials.append(cm)                       # bedroom window with the same skyline
for i in range(14):                                                           # sheer curtain folds
    box(f"Sheer{i}", (-7.4 + i * 0.26, 5.82, 1.65), (0.2, 0.03, 3.1), mat("Sheer", (0.95, 0.93, 0.9), 0.9, trans=0.6), rotz=0.35 * (1 if i % 2 else -1))
alight("BedroomCeil", (-5.8, 0.5, H - 0.1), (-5.8, 0.5, 0), 180, (1.0, 0.82, 0.62), 2.5)

# ---------------- entrance: door + console + mirror (front wall)
box("FrontDoor", (3.8, -5.9, 1.1), (1.1, 0.08, 2.2), walnut, 0.01)
box("DoorHandle", (4.2, -5.84, 1.05), (0.03, 0.04, 0.4), mat("Gold5", GOLD, 0.2, metal=1))
box("EntryConsole", (1.6, -5.7, 0.8), (1.4, 0.35, 0.06), marble("EntryM"), 0.01)
cyl("Mirror", (1.6, -5.9, 1.65), 0.5, 0.03, mat("MirrorM", (0.95, 0.95, 0.95), 0.02, metal=1), rot=(math.radians(90), 0, 0), verts=64)
alight("LivingFill", (0.5, -3.0, 2.8), (0.5, 3.0, 0.8), 260, (1.0, 0.86, 0.7), 4)

# ---------------- studio wing (reuse the studio set, shifted beyond the right wall)
if a.studio:
    with bpy.data.libraries.load(a.studio, link=False) as (src, dst):
        dst.objects = [n for n in src.objects if not n.startswith("Cam_")]
    coll = bpy.data.collections.new("StudioWing"); sc.collection.children.link(coll)
    for o in dst.objects:
        if o is None: continue
        coll.objects.link(o)
        if o.parent is None:
            o.location.x += 10.5; o.location.y += 0.3

# ---------------- cameras
def camera(name, loc, target, lens, fstop=8):
    cd = bpy.data.cameras.new(name); cd.lens = lens; cd.dof.use_dof = False
    o = bpy.data.objects.new(name, cd); sc.collection.objects.link(o); o.location = loc
    o.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler(); return o
camera("Cam_Living", (3.2, -3.6, 1.6), (0.0, 3.0, 1.2), 18)
camera("Cam_Kitchen", (3.0, -0.6, 1.65), (6.4, 3.6, 1.0), 20)
camera("Cam_Bedroom", (-4.2, -3.8, 1.7), (-7.2, 1.2, 0.8), 18)
camera("Cam_Balcony", (-1.6, 6.3, 1.55), (3.0, 12, 1.4), 20)
camera("Cam_Entrance", (2.8, -5.2, 1.6), (0.2, 4.0, 1.3), 16)
sc.camera = bpy.data.objects["Cam_Living"]

# optional: Avir standing in the living room
if a.avir:
    bpy.ops.import_scene.gltf(filepath=a.avir)
    for o in list(sc.objects):
        if o.name.startswith("Icosphere"): bpy.data.objects.remove(o, do_unlink=True)
    arm = [o for o in sc.objects if o.type == "ARMATURE"][0]
    if arm.animation_data: arm.animation_data.action = None
    arm.location = (1.4, 1.5, 0); arm.rotation_euler[2] = math.radians(15)
    from mathutils import Matrix
    for o in sc.objects:
        if o.type == "MESH" and o.name.startswith("avaturn_hair"):
            for m in o.data.materials:
                nt_ = m.node_tree; b_ = nt_.nodes.get("Principled BSDF")
                if b_ and b_.inputs["Base Color"].is_linked:
                    src = b_.inputs["Base Color"].links[0].from_socket; hv = nt_.nodes.new("ShaderNodeHueSaturation")
                    hv.inputs["Value"].default_value = 0.11; hv.inputs["Saturation"].default_value = 0.45
                    nt_.links.new(src, hv.inputs["Color"]); nt_.links.new(hv.outputs["Color"], b_.inputs["Base Color"])
    pbs = arm.pose.bones
    for pb in pbs: pb.rotation_mode = "QUATERNION"
    bpy.context.view_layer.update()
    for s_, d in (("Left", (0.14, 0.03, -1)), ("Right", (-0.14, 0.03, -1))):
        for bn, dd in ((f"{s_}Arm", d), (f"{s_}ForeArm", (d[0] * 0.4, -0.2, -1)), (f"{s_}Hand", (d[0] * 0.2, -0.25, -1))):
            pb = pbs[bn]; M = pb.matrix.copy(); h = M.to_translation()
            cur = (M.to_3x3() @ Vector((0, 1, 0))).normalized()
            dw = arm.matrix_world.to_3x3().inverted() @ Vector(dd)
            R = cur.rotation_difference(dw.normalized()).to_matrix().to_4x4()
            pb.matrix = Matrix.Translation(h) @ R @ Matrix.Translation(-h) @ M; pb.scale = (1, 1, 1); bpy.context.view_layer.update()

w = bpy.data.worlds.new("night"); w.use_nodes = True; w.node_tree.nodes["Background"].inputs[0].default_value = (0.01, 0.012, 0.025, 1); sc.world = w
sc.render.engine = "CYCLES"; sc.cycles.device = "CPU"; sc.cycles.samples = a.samples; sc.cycles.use_denoising = True
sc.cycles.max_bounces = 6; sc.cycles.diffuse_bounces = 3; sc.cycles.glossy_bounces = 2; sc.cycles.transmission_bounces = 4
sc.view_settings.view_transform = "AgX"
bpy.ops.file.pack_all()   # embed generated textures so the .blend works anywhere
bpy.ops.wm.save_as_mainfile(filepath=str(OUT / "home.blend"), compress=True)
if not a.avir:
    bpy.ops.export_scene.gltf(filepath=str(OUT / "home.glb"), export_format="GLB", export_cameras=True, export_lights=True, export_image_format="JPEG")
if a.preview:
    for cam in (__import__("os").environ.get("CAMS") or "Cam_Living,Cam_Kitchen,Cam_Bedroom,Cam_Balcony").split(","):
        sc.camera = bpy.data.objects[cam]; sc.render.resolution_x = int(a.preview * 16 / 9); sc.render.resolution_y = a.preview
        sc.render.filepath = str(OUT / f"preview_{cam}.png"); bpy.ops.render.render(write_still=True)
print("home ok")
