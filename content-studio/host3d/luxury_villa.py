#!/usr/bin/env python3
"""Avir's luxury home v2 — a two-storey modern Indian villa on its own plot inside a gated society
(neighbouring villas, apartment towers, street), for the house-tour video. Design + stills only.

  python3 -I luxury_villa.py <out_dir> [--res 1600] [--samples 96] [--cams Front,Living,...] [--no-render] [--save]

Plot 26 x 36 m (x east, y north, street on the south side, z up).
  Front (y 0-9):   boundary wall + gate, paver driveway, lawn, palms, water feature, car porch
  House (x 3-23, y 9-19; first floor cantilevers to y 8.2):
    GF  foyer + pooja niche + floating stair | formal lounge/library | double-height living | dining | kitchen
    FF  family lounge + bridge over the living void | master bedroom + balcony | master bath | walk-in closet
        (the creator studio set attaches at x 7-13, y 8.2-12 on the first floor)
  Back (y 19-34):  deck, pool, lawn, cabana with fire table, loungers, green boundary
Cameras: Cam_<name> for every stop of the tour + Cam_Plan_GF / Cam_Plan_FF (orthographic floor plans).
"""
import argparse, math, random, sys
from pathlib import Path
import bpy, bmesh
import numpy as np
from mathutils import Matrix, Vector

ap = argparse.ArgumentParser(); ap.add_argument("out"); ap.add_argument("--res", type=int, default=1600); ap.add_argument("--samples", type=int, default=96)
ap.add_argument("--cams", default=""); ap.add_argument("--no-render", action="store_true"); ap.add_argument("--save", action="store_true")
a = ap.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else None); OUT = Path(a.out); OUT.mkdir(parents=True, exist_ok=True)
rng = random.Random(7)
bpy.ops.wm.read_factory_settings(use_empty=True); sc = bpy.context.scene
COLL = {}


def coll(name):
    if name not in COLL:
        c = bpy.data.collections.new(name); sc.collection.children.link(c); COLL[name] = c
    return COLL[name]


CUR = ["Site"]   # current collection name (set per section, used by the plan renders to hide roofs/ceilings)


def link(o, parent=None):
    coll(CUR[0]).objects.link(o)
    if parent: o.parent = parent
    return o


# ------------------------------------------------------------------ materials
def mat(name, col, rough=0.5, emit=0.0, ecol=None, metal=0.0, trans=0.0, sheen=0.0, coat=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True; b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*col, 1); b.inputs["Roughness"].default_value = rough; b.inputs["Metallic"].default_value = metal
    if trans: b.inputs["Transmission Weight"].default_value = trans
    if sheen: b.inputs["Sheen Weight"].default_value = sheen
    if coat: b.inputs["Coat Weight"].default_value = coat
    if emit: b.inputs["Emission Color"].default_value = (*(ecol or col), 1); b.inputs["Emission Strength"].default_value = emit
    return m


def marble(name, base=(0.9, 0.87, 0.82), vein=(0.6, 0.55, 0.5), rough=0.12, scale=1.4, tile=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; b = nt.nodes["Principled BSDF"]
    tc = nt.nodes.new("ShaderNodeTexCoord")
    n = nt.nodes.new("ShaderNodeTexNoise"); n.inputs["Scale"].default_value = scale; n.inputs["Detail"].default_value = 7; n.inputs["Distortion"].default_value = 1.6
    nt.links.new(tc.outputs["Object"], n.inputs["Vector"])
    r = nt.nodes.new("ShaderNodeValToRGB"); e = r.color_ramp.elements; e[0].position = 0.482; e[0].color = (*base, 1); e[1].position = 0.5; e[1].color = (*vein, 1)
    e2 = r.color_ramp.elements.new(0.518); e2.color = (*base, 1)
    nt.links.new(n.outputs["Fac"], r.inputs["Fac"]); col = r.outputs["Color"]
    if tile:   # thin grout lines for large-format tiles
        bk = nt.nodes.new("ShaderNodeTexBrick"); bk.offset = 0.0; bk.inputs["Scale"].default_value = 1.0
        bk.inputs["Brick Width"].default_value = tile; bk.inputs["Row Height"].default_value = tile; bk.inputs["Mortar Size"].default_value = 0.004
        bk.inputs["Color1"].default_value = (1, 1, 1, 1); bk.inputs["Color2"].default_value = (1, 1, 1, 1); bk.inputs["Mortar"].default_value = (0.55, 0.52, 0.48, 1)
        nt.links.new(tc.outputs["Object"], bk.inputs["Vector"])
        mx = nt.nodes.new("ShaderNodeMix"); mx.data_type = "RGBA"; mx.blend_type = "MULTIPLY"; mx.inputs["Factor"].default_value = 1
        nt.links.new(col, mx.inputs[6]); nt.links.new(bk.outputs["Color"], mx.inputs[7]); col = mx.outputs[2]
    nt.links.new(col, b.inputs["Base Color"]); b.inputs["Roughness"].default_value = rough; return m


def wood(name, c0=(0.16, 0.085, 0.04), c1=(0.34, 0.19, 0.09), scale=3.0, rough=0.4, axis="X"):
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; b = nt.nodes["Principled BSDF"]
    tc = nt.nodes.new("ShaderNodeTexCoord")
    wv = nt.nodes.new("ShaderNodeTexWave"); wv.bands_direction = axis; wv.inputs["Scale"].default_value = scale; wv.inputs["Distortion"].default_value = 5; wv.inputs["Detail"].default_value = 4
    nt.links.new(tc.outputs["Object"], wv.inputs["Vector"])
    r = nt.nodes.new("ShaderNodeValToRGB"); r.color_ramp.elements[0].color = (*c0, 1); r.color_ramp.elements[1].color = (*c1, 1)
    nt.links.new(wv.outputs["Fac"], r.inputs["Fac"]); nt.links.new(r.outputs["Color"], b.inputs["Base Color"]); b.inputs["Roughness"].default_value = rough
    bp = nt.nodes.new("ShaderNodeBump"); bp.inputs["Strength"].default_value = 0.08; nt.links.new(wv.outputs["Fac"], bp.inputs["Height"]); nt.links.new(bp.outputs["Normal"], b.inputs["Normal"])
    return m


def fabric(name, col, rough=0.95, scale=220, bump=0.25, sheen=0.4):
    m = mat(name, col, rough, sheen=sheen); nt = m.node_tree; b = nt.nodes["Principled BSDF"]
    n = nt.nodes.new("ShaderNodeTexNoise"); n.inputs["Scale"].default_value = scale; n.inputs["Detail"].default_value = 2
    bp = nt.nodes.new("ShaderNodeBump"); bp.inputs["Strength"].default_value = bump; bp.inputs["Distance"].default_value = 0.002
    nt.links.new(n.outputs["Fac"], bp.inputs["Height"]); nt.links.new(bp.outputs["Normal"], b.inputs["Normal"]); return m


def noisy(name, c0, c1, scale=30, rough=0.9, bump=0.3):
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; b = nt.nodes["Principled BSDF"]
    tc = nt.nodes.new("ShaderNodeTexCoord"); n = nt.nodes.new("ShaderNodeTexNoise"); n.inputs["Scale"].default_value = scale; n.inputs["Detail"].default_value = 6
    nt.links.new(tc.outputs["Object"], n.inputs["Vector"])
    r = nt.nodes.new("ShaderNodeValToRGB"); r.color_ramp.elements[0].color = (*c0, 1); r.color_ramp.elements[1].color = (*c1, 1)
    r.color_ramp.elements[0].position = 0.35; r.color_ramp.elements[1].position = 0.65
    nt.links.new(n.outputs["Fac"], r.inputs["Fac"]); nt.links.new(r.outputs["Color"], b.inputs["Base Color"]); b.inputs["Roughness"].default_value = rough
    bp = nt.nodes.new("ShaderNodeBump"); bp.inputs["Strength"].default_value = bump; nt.links.new(n.outputs["Fac"], bp.inputs["Height"]); nt.links.new(bp.outputs["Normal"], b.inputs["Normal"])
    return m


def glass_mat(name, tint=(0.82, 0.9, 0.92), refl=0.1):
    """Architectural glass for single panes: mostly transparent + a little mirror (fast and clean in Cycles)."""
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; nt.nodes.clear()
    o = nt.nodes.new("ShaderNodeOutputMaterial"); t = nt.nodes.new("ShaderNodeBsdfTransparent"); t.inputs["Color"].default_value = (*tint, 1)
    g = nt.nodes.new("ShaderNodeBsdfGlossy"); g.inputs["Roughness"].default_value = 0.02
    fr = nt.nodes.new("ShaderNodeFresnel"); fr.inputs["IOR"].default_value = 1.5
    mp = nt.nodes.new("ShaderNodeMath"); mp.operation = "ADD"; mp.inputs[1].default_value = refl
    mx = nt.nodes.new("ShaderNodeMixShader"); nt.links.new(fr.outputs["Fac"], mp.inputs[0]); nt.links.new(mp.outputs[0], mx.inputs["Fac"])
    nt.links.new(t.outputs[0], mx.inputs[1]); nt.links.new(g.outputs[0], mx.inputs[2]); nt.links.new(mx.outputs[0], o.inputs["Surface"]); return m


def img_mat(name, arr, emit=0.0, rough=0.6):
    from PIL import Image
    p = OUT / f"tex_{name}.png"; Image.fromarray((np.clip(arr, 0, 1) * 255).astype(np.uint8)).save(p)
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; b = nt.nodes["Principled BSDF"]
    t = nt.nodes.new("ShaderNodeTexImage"); t.image = bpy.data.images.load(str(p)); t.image.pack(); nt.links.new(t.outputs["Color"], b.inputs["Base Color"])
    b.inputs["Roughness"].default_value = rough
    if emit: nt.links.new(t.outputs["Color"], b.inputs["Emission Color"]); b.inputs["Emission Strength"].default_value = emit
    return m


M = {}
M["plaster"] = mat("PlasterWarmWhite", (0.86, 0.83, 0.78), 0.85)
M["plaster_in"] = mat("InteriorWall", (0.74, 0.7, 0.63), 0.9)
M["ceil"] = mat("Ceiling", (0.8, 0.78, 0.74), 0.9)
M["floor"] = marble("FloorItalianBeige", (0.87, 0.83, 0.76), (0.66, 0.6, 0.53), 0.1, 0.9, tile=1.2)
M["marble_w"] = marble("MarbleStatuario", (0.86, 0.85, 0.83), (0.5, 0.5, 0.52), 0.08, 1.2)
M["marble_b"] = marble("MarbleNeroMarquina", (0.025, 0.025, 0.03), (0.42, 0.4, 0.38), 0.08, 0.8)
M["marble_g"] = marble("MarbleGreenUdaipur", (0.03, 0.1, 0.07), (0.16, 0.3, 0.22), 0.1, 0.9)
M["stone"] = noisy("StoneCladding", (0.2, 0.19, 0.18), (0.36, 0.34, 0.31), 14, 0.85, 0.6)
M["walnut"] = wood("Walnut"); M["walnut_y"] = wood("WalnutY", axis="Y"); M["walnut_z"] = wood("WalnutZ", axis="Z")
M["oak"] = wood("OakFloor", (0.42, 0.29, 0.17), (0.6, 0.44, 0.27), 5.0, 0.35, "Y")
M["teak_deck"] = wood("TeakDeck", (0.3, 0.19, 0.11), (0.46, 0.31, 0.18), 9.0, 0.6, "X")
M["brass"] = mat("BrushedBrass", (0.86, 0.62, 0.27), 0.28, metal=1.0)
M["black"] = mat("BlackMetal", (0.02, 0.02, 0.022), 0.35, metal=0.9)
M["steel"] = mat("Steel", (0.7, 0.7, 0.72), 0.25, metal=1.0)
M["glass"] = glass_mat("Glass"); M["glass_dark"] = glass_mat("GlassTinted", (0.55, 0.62, 0.64), 0.16)
M["mirror"] = mat("Mirror", (0.9, 0.9, 0.9), 0.02, metal=1.0)
M["boucle"] = fabric("BoucleCream", (0.7, 0.66, 0.58), 1.0, 160, 0.5, 0.15)
M["linen"] = fabric("LinenSand", (0.62, 0.56, 0.47), 0.95, 300, 0.2, 0.15)
M["velvet_g"] = fabric("VelvetEmerald", (0.02, 0.11, 0.08), 0.7, 400, 0.08, 0.25)
M["velvet_r"] = fabric("VelvetRust", (0.36, 0.12, 0.05), 0.7, 400, 0.08, 0.25)
M["leather"] = mat("LeatherCognac", (0.2, 0.085, 0.035), 0.5, coat=0.15)
M["rug"] = fabric("RugIvory", (0.62, 0.58, 0.5), 1.0, 90, 0.8, 0.1)
M["rug_d"] = fabric("RugCharcoal", (0.16, 0.16, 0.17), 1.0, 90, 0.8)
M["white"] = mat("WhiteLacquer", (0.8, 0.8, 0.78), 0.3, coat=0.3)
M["cab"] = mat("CabinetCharcoal", (0.07, 0.07, 0.075), 0.4)
M["led"] = mat("LEDWarm", (1.0, 0.74, 0.45), 0.4, emit=9); M["led_soft"] = mat("LEDWarmSoft", (1.0, 0.74, 0.45), 0.4, emit=3.5)
M["bulb"] = mat("BulbGlow", (1.0, 0.8, 0.55), 0.3, emit=14); M["shade"] = mat("LampShade", (0.93, 0.85, 0.72), 0.8, emit=1.4, ecol=(1.0, 0.72, 0.45))
M["flame"] = mat("Flame", (1.0, 0.5, 0.12), 0.3, emit=30, ecol=(1.0, 0.42, 0.08))
M["grass"] = noisy("Lawn", (0.05, 0.16, 0.03), (0.1, 0.27, 0.06), 60, 1.0, 0.8)
M["leaf"] = mat("Leaf", (0.025, 0.1, 0.03), 0.45); M["leaf2"] = mat("LeafLight", (0.05, 0.16, 0.04), 0.45); M["trunk"] = noisy("Trunk", (0.12, 0.08, 0.05), (0.25, 0.18, 0.12), 20, 0.9, 0.9)
M["paver"] = noisy("PaverGranite", (0.2, 0.2, 0.2), (0.3, 0.3, 0.3), 40, 0.8, 0.4)
M["asphalt"] = noisy("Asphalt", (0.03, 0.03, 0.032), (0.07, 0.07, 0.072), 80, 0.85, 0.3)
M["concrete"] = noisy("Concrete", (0.4, 0.4, 0.39), (0.52, 0.51, 0.5), 25, 0.9, 0.3)
M["pool_tile"] = mat("PoolTile", (0.02, 0.3, 0.42), 0.3, emit=0.6, ecol=(0.05, 0.6, 0.8))
M["water"] = glass_mat("Water", (0.55, 0.9, 0.95), 0.06)
M["pot"] = mat("PlanterCharcoal", (0.1, 0.1, 0.105), 0.6); M["pot_w"] = mat("PlanterIvory", (0.82, 0.8, 0.75), 0.6)
M["tv"] = mat("TVScreen", (0.01, 0.01, 0.012), 0.08, coat=1.0)
M["sheer"] = mat("SheerCurtain", (0.95, 0.93, 0.88), 0.9, trans=0.55)


# ------------------------------------------------------------------ mesh helpers
def box(name, loc, size, m, bevel=0.0, rotz=0.0, parent=None):
    me = bpy.data.meshes.new(name); bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1, matrix=Matrix.Diagonal((*size, 1)))
    bm.to_mesh(me); bm.free(); o = bpy.data.objects.new(name, me); o.location = loc; o.rotation_euler = (0, 0, rotz); link(o, parent)
    if bevel: bv = o.modifiers.new("bevel", "BEVEL"); bv.width = bevel; bv.segments = 3
    if m: me.materials.append(m)
    return o


def boxes(name, items, mats, bevel=0.0, parent=None):
    """One mesh holding many boxes: items = [(loc, size, mat_index[, rotz])]."""
    me = bpy.data.meshes.new(name); bm = bmesh.new()
    for it in items:
        loc, size, mi = it[0], it[1], it[2]; rz = it[3] if len(it) > 3 else 0.0
        r = bmesh.ops.create_cube(bm, size=1, matrix=Matrix.Translation(loc) @ Matrix.Rotation(rz, 4, "Z") @ Matrix.Diagonal((*size, 1)))
        for f in {f for v in r["verts"] for f in v.link_faces}: f.material_index = mi
    bm.to_mesh(me); bm.free(); o = bpy.data.objects.new(name, me); link(o, parent)
    for m in mats: me.materials.append(m)
    if bevel: bv = o.modifiers.new("bevel", "BEVEL"); bv.width = bevel; bv.segments = 2
    return o


def cyl(name, loc, r, h, m, rot=(0, 0, 0), verts=40, r2=None, parent=None, smooth=True):
    me = bpy.data.meshes.new(name); bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=verts, radius1=r, radius2=r if r2 is None else r2, depth=h)
    for f in bm.faces: f.smooth = smooth and len(f.verts) == 4
    bm.to_mesh(me); bm.free(); o = bpy.data.objects.new(name, me); o.location = loc; o.rotation_euler = rot; link(o, parent)
    if m: me.materials.append(m)
    return o


def blobs(name, pts, mats, seg=10, parent=None):
    """One mesh of many scaled/rotated spheres: pts = [(loc, scale_xyz, mat_index, (rx, ry, rz))]."""
    me = bpy.data.meshes.new(name); bm = bmesh.new()
    for loc, s, mi, rot in pts:
        m4 = Matrix.Translation(loc) @ Matrix.Rotation(rot[2], 4, "Z") @ Matrix.Rotation(rot[1], 4, "Y") @ Matrix.Rotation(rot[0], 4, "X") @ Matrix.Diagonal((*s, 1))
        r = bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=max(4, seg // 2), radius=1.0, matrix=m4)
        for f in {f for v in r["verts"] for f in v.link_faces}: f.material_index = mi; f.smooth = True
    bm.to_mesh(me); bm.free(); o = bpy.data.objects.new(name, me); link(o, parent)
    for m in mats: me.materials.append(m)
    return o


def empty(name, loc, rotz=0.0):
    o = bpy.data.objects.new(name, None); o.location = loc; o.rotation_euler = (0, 0, rotz); link(o); return o


def plight(name, loc, energy, col=(1.0, 0.76, 0.52), r=0.06):
    l = bpy.data.lights.new(name, "POINT"); l.energy = energy * 0.55; l.color = col; l.shadow_soft_size = r
    o = bpy.data.objects.new(name, l); o.location = loc; link(o); return o


def alight(name, loc, target, energy, col=(1.0, 0.8, 0.6), size=1.0, size_y=None):
    l = bpy.data.lights.new(name, "AREA"); l.energy = energy * 0.5; l.color = col; l.size = size
    if size_y: l.shape = "RECTANGLE"; l.size_y = size_y
    o = bpy.data.objects.new(name, l); o.location = loc; link(o)
    o.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler(); o.visible_camera = False; return o


def wall_x(name, y, x0, x1, z0, z1, m, openings=(), t=0.2):
    """Wall running along x at fixed y, with openings [(a, b, ztop)] (door / pass-through)."""
    xs = [x0]
    for (oa, ob, zt) in sorted(openings):
        if oa > xs[-1]: box(name, ((xs[-1] + oa) / 2, y, (z0 + z1) / 2), (oa - xs[-1], t, z1 - z0), m)
        if zt < z1: box(name + "Lintel", ((oa + ob) / 2, y, (zt + z1) / 2), (ob - oa, t, z1 - zt), m)
        xs.append(ob)
    if x1 > xs[-1]: box(name, ((xs[-1] + x1) / 2, y, (z0 + z1) / 2), (x1 - xs[-1], t, z1 - z0), m)


def wall_y(name, x, y0, y1, z0, z1, m, openings=(), t=0.2):
    ys = [y0]
    for (oa, ob, zt) in sorted(openings):
        if oa > ys[-1]: box(name, (x, (ys[-1] + oa) / 2, (z0 + z1) / 2), (t, oa - ys[-1], z1 - z0), m)
        if zt < z1: box(name + "Lintel", (x, (oa + ob) / 2, (zt + z1) / 2), (t, ob - oa, z1 - zt), m)
        ys.append(ob)
    if y1 > ys[-1]: box(name, (x, (ys[-1] + y1) / 2, (z0 + z1) / 2), (t, y1 - ys[-1], z1 - z0), m)


def glazing_x(name, y, x0, x1, z0, z1, n, m=None, frame=0.05):
    box(name, ((x0 + x1) / 2, y, (z0 + z1) / 2), (x1 - x0, 0.012, z1 - z0), m or M["glass"])
    it = [(((x0 + (x1 - x0) * i / n), y, (z0 + z1) / 2), (frame, 0.09, z1 - z0), 0) for i in range(n + 1)]
    it += [(((x0 + x1) / 2, y, z), (x1 - x0, 0.09, frame), 0) for z in (z0 + frame / 2, z1 - frame / 2)]
    boxes(name + "Frame", it, [M["black"]])


def glazing_y(name, x, y0, y1, z0, z1, n, m=None, frame=0.05):
    box(name, (x, (y0 + y1) / 2, (z0 + z1) / 2), (0.012, y1 - y0, z1 - z0), m or M["glass"])
    it = [((x, (y0 + (y1 - y0) * i / n), (z0 + z1) / 2), (0.09, frame, z1 - z0), 0) for i in range(n + 1)]
    it += [((x, (y0 + y1) / 2, z), (0.09, y1 - y0, frame), 0) for z in (z0 + frame / 2, z1 - frame / 2)]
    boxes(name + "Frame", it, [M["black"]])


def slats_x(name, y, x0, x1, z0, z1, m, w=0.035, gap=0.03, depth=0.03, back=None):
    """Vertical timber slats on a wall running along x."""
    it = []; x = x0 + w / 2
    while x < x1: it.append(((x, y, (z0 + z1) / 2), (w, depth, z1 - z0), 0)); x += w + gap
    if back: it.append((((x0 + x1) / 2, y + (depth / 2 + 0.006) * (1 if back > 0 else -1), (z0 + z1) / 2), (x1 - x0, 0.012, z1 - z0), 1))
    return boxes(name, it, [m, M["black"]])


def slats_y(name, x, y0, y1, z0, z1, m, w=0.035, gap=0.03, depth=0.03, back=None):
    it = []; y = y0 + w / 2
    while y < y1: it.append(((x, y, (z0 + z1) / 2), (depth, w, z1 - z0), 0)); y += w + gap
    if back: it.append(((x + (depth / 2 + 0.006) * (1 if back > 0 else -1), (y0 + y1) / 2, (z0 + z1) / 2), (0.012, y1 - y0, z1 - z0), 1))
    return boxes(name, it, [m, M["black"]])


# ------------------------------------------------------------------ plants
def plant(name, x, y, z=0.0, h=1.6, pot=M["pot"], spread=0.45, n=16, potr=0.24, poth=0.5):
    cyl(name + "Pot", (x, y, z + poth / 2), potr, poth, pot, r2=potr * 0.78); cyl(name + "Stem", (x, y, z + poth + (h - poth) * 0.35), 0.018, (h - poth) * 0.7, M["trunk"], verts=8)
    pts = []
    for i in range(int(n * 2.2)):
        ang = rng.uniform(0, 6.28); r = rng.uniform(0.05, spread); zz = z + poth + rng.uniform(0.25, 1.0) * (h - poth)
        pts.append(((x + r * math.cos(ang), y + r * math.sin(ang), zz), (0.11, 0.012, 0.19), i % 2, (rng.uniform(-0.9, 0.3), 0, ang + 1.57)))
    blobs(name + "Leaves", pts, [M["leaf"], M["leaf2"]])


def palm(name, x, y, h=5.0, z=0.0):
    it = [((x + 0.05 * math.sin(k * 0.8), y, z + h * (k + 0.5) / 8), (0.2 - 0.008 * k, 0.2 - 0.008 * k, h / 8 + 0.02), 0) for k in range(8)]
    boxes(name + "Trunk", it, [M["trunk"]], bevel=0.05)
    pts = []
    for i in range(15):
        ang = i * 6.283 / 15 + rng.uniform(-0.2, 0.2); L = rng.uniform(2.0, 2.7); up = rng.uniform(0.25, 0.9)
        dx, dy = math.cos(ang), math.sin(ang)
        for s_ in range(13):
            t = (s_ + 0.5) / 13; rr = L * t; zz = z + h + 0.2 + up * L * t - 1.15 * L * t * t          # arch up, then droop
            slope = up - 2.3 * t; pts.append(((x + rr * dx, y + rr * dy, zz), (L / 24, 0.022, 0.016), 0, (0, -math.atan(slope), ang)))
            ll = 0.5 * math.sin(math.pi * min(1, t * 1.1 + 0.08)) + 0.08
            for sd in (-1, 1):
                a2 = ang + sd * 1.05; pts.append(((x + rr * dx + 0.5 * ll * math.cos(a2), y + rr * dy + 0.5 * ll * math.sin(a2), zz - 0.1 * ll), (ll / 2, 0.035, 0.008), (i + s_) % 2, (0, 0.25, a2)))
    blobs(name + "Fronds", pts, [M["leaf"], M["leaf2"]], seg=6)


def tree(name, x, y, h=6.0, r=2.0, z=0.0):
    cyl(name + "Trunk", (x, y, z + h * 0.3), 0.16, h * 0.6, M["trunk"], verts=10, r2=0.1)
    pts = [((x + rng.uniform(-r, r) * 0.55, y + rng.uniform(-r, r) * 0.55, z + h * 0.62 + rng.uniform(0, h * 0.38)), (rng.uniform(0.6, 1.0) * r * 0.6,) * 2 + (rng.uniform(0.5, 0.8) * r * 0.5,), i % 2, (0, 0, rng.uniform(0, 6))) for i in range(11)]
    blobs(name + "Crown", pts, [M["leaf"], M["leaf2"]], seg=8)


def hedge(name, x0, y0, x1, y1, h=1.0, w=0.5):
    box(name, ((x0 + x1) / 2, (y0 + y1) / 2, h / 2), (abs(x1 - x0) + w if abs(x1 - x0) > abs(y1 - y0) else w, abs(y1 - y0) + w if abs(y1 - y0) >= abs(x1 - x0) else w, h), M["grass"], 0.08)


# ------------------------------------------------------------------ furniture
def sofa(name, loc, rotz, w=2.6, d=0.95, fab=None, legs=None):
    fab = fab or M["boucle"]; e = empty(name, loc, rotz); n = max(2, round(w / 0.85)); sw = (w - 0.36) / n
    box(name + "Base", (0, 0, 0.2), (w, d, 0.22), fab, 0.04, parent=e)
    for i in range(n): box(name + "Seat", (-w / 2 + 0.18 + sw * (i + 0.5), -0.05, 0.4), (sw - 0.02, d - 0.25, 0.2), fab, 0.06, parent=e)
    for i in range(n): box(name + "Back", (-w / 2 + 0.18 + sw * (i + 0.5), d / 2 - 0.16, 0.66), (sw - 0.03, 0.24, 0.42), fab, 0.07, parent=e)
    for sx in (-1, 1): box(name + "Arm", (sx * (w / 2 - 0.09), 0, 0.42), (0.18, d, 0.5), fab, 0.06, parent=e)
    boxes(name + "Legs", [((sx * (w / 2 - 0.1), sy * (d / 2 - 0.1), 0.045), (0.04, 0.04, 0.09), 0) for sx in (-1, 1) for sy in (-1, 1)], [legs or M["brass"]], parent=e)
    return e


def armchair(name, loc, rotz, fab=None):
    fab = fab or M["velvet_g"]; e = empty(name, loc, rotz)
    box(name + "Seat", (0, 0, 0.36), (0.72, 0.72, 0.16), fab, 0.06, parent=e); box(name + "Back", (0, 0.31, 0.66), (0.72, 0.16, 0.6), fab, 0.07, parent=e)
    for sx in (-1, 1): box(name + "Arm", (sx * 0.33, 0, 0.5), (0.1, 0.72, 0.34), fab, 0.045, parent=e)
    boxes(name + "Legs", [((sx * 0.3, sy * 0.3, 0.14), (0.03, 0.03, 0.28), 0) for sx in (-1, 1) for sy in (-1, 1)], [M["brass"]], parent=e); return e


def dchair(name, loc, rotz, fab=None):
    fab = fab or M["velvet_g"]; e = empty(name, loc, rotz)
    box(name + "Seat", (0, 0, 0.46), (0.5, 0.5, 0.09), fab, 0.035, parent=e); box(name + "Back", (0, 0.22, 0.78), (0.48, 0.07, 0.56), fab, 0.03, parent=e)
    boxes(name + "Legs", [((sx * 0.21, sy * 0.21, 0.21), (0.03, 0.03, 0.42), 0) for sx in (-1, 1) for sy in (-1, 1)], [M["brass"]], parent=e); return e


def stool(name, loc, fab=None):
    cyl(name + "Seat", (loc[0], loc[1], loc[2] + 0.74), 0.19, 0.08, fab or M["leather"]); cyl(name + "Post", (loc[0], loc[1], loc[2] + 0.37), 0.02, 0.7, M["brass"], verts=12)
    cyl(name + "Foot", (loc[0], loc[1], loc[2] + 0.015), 0.17, 0.03, M["brass"]); cyl(name + "Ring", (loc[0], loc[1], loc[2] + 0.3), 0.13, 0.015, M["brass"])


def round_table(name, loc, r=0.5, h=0.38, top=None, base=None):
    cyl(name + "Top", (loc[0], loc[1], loc[2] + h - 0.02), r, 0.04, top or M["marble_w"]); cyl(name + "Base", (loc[0], loc[1], loc[2] + (h - 0.04) / 2), r * 0.3, h - 0.04, base or M["brass"], r2=r * 0.45)


def pendant(name, x, y, ztop, drop, r=0.12, energy=45, globe=True):
    cyl(name + "Cord", (x, y, ztop - drop / 2), 0.004, drop, M["black"], verts=6)
    if globe: blobs(name + "Globe", [((x, y, ztop - drop - r), (r, r, r), 0, (0, 0, 0))], [M["bulb"]], seg=16)
    else: cyl(name + "Shade", (x, y, ztop - drop - r), r, r * 2.2, M["shade"], r2=r * 0.7)
    cyl(name + "Cap", (x, y, ztop - drop + 0.02), 0.03, 0.05, M["brass"], verts=12)
    if energy: plight(name + "L", (x, y, ztop - drop - r), energy, r=r)


def table_lamp(name, x, y, z, energy=25):
    cyl(name + "Base", (x, y, z + 0.14), 0.05, 0.28, M["brass"], r2=0.03); cyl(name + "Shade", (x, y, z + 0.4), 0.15, 0.24, M["shade"], r2=0.11)
    plight(name + "L", (x, y, z + 0.4), energy, r=0.1)


def floor_lamp(name, x, y, z=0.0, energy=60):
    cyl(name + "Base", (x, y, z + 0.015), 0.16, 0.03, M["brass"]); cyl(name + "Pole", (x, y, z + 0.78), 0.012, 1.55, M["brass"], verts=10)
    cyl(name + "Shade", (x, y, z + 1.6), 0.22, 0.3, M["shade"], r2=0.17); plight(name + "L", (x, y, z + 1.6), energy, r=0.14)


def rug(name, loc, size, m=None, rotz=0.0): return box(name, (loc[0], loc[1], loc[2] + 0.008), (size[0], size[1], 0.016), m or M["rug"], 0.006, rotz)


def art(name, loc, size, axis, seed=1, frame=None):
    """Abstract canvas (procedural painting). axis: 'x' = hangs on a wall running along x (faces +-y), 'y' = faces +-x."""
    r = np.random.default_rng(seed); n = 256; yy, xx = np.mgrid[0:1:n * 1j, 0:1:n * 1j]
    pal = np.array([[0.86, 0.8, 0.7], [0.72, 0.5, 0.25], [0.08, 0.2, 0.17], [0.12, 0.12, 0.14], [0.6, 0.25, 0.12], [0.9, 0.88, 0.84]])
    img = np.ones((n, n, 3)) * pal[5]
    for k in range(9):
        cx, cy, rad = r.uniform(0, 1), r.uniform(0, 1), r.uniform(0.12, 0.45); ang = r.uniform(0, 3.14)
        d = ((xx - cx) * math.cos(ang) + (yy - cy) * math.sin(ang)) ** 2 / (rad ** 2) + ((yy - cy) * math.cos(ang) - (xx - cx) * math.sin(ang)) ** 2 / ((rad * r.uniform(0.2, 0.8)) ** 2)
        w = np.clip(1.2 - d, 0, 1)[..., None] * r.uniform(0.5, 0.95); img = img * (1 - w) + pal[r.integers(0, 5)] * w
    m = img_mat(name + "Canvas", img, rough=0.8); sz = (size[0], 0.03, size[1]) if axis == "x" else (0.03, size[0], size[1])
    fz = (size[0] + 0.06, 0.022, size[1] + 0.06) if axis == "x" else (0.022, size[0] + 0.06, size[1] + 0.06)
    box(name + "Frame", loc, fz, frame or M["brass"]); o = box(name, loc, sz, m)
    # box-project UVs so the canvas shows the painting
    bpy.context.view_layer.objects.active = o
    me = o.data; uv = me.uv_layers.new(name="UV")
    for poly in me.polygons:
        for li in poly.loop_indices:
            v = me.vertices[me.loops[li].vertex_index].co
            u = (v.x / size[0] + 0.5) if axis == "x" else (v.y / size[0] + 0.5); uv.data[li].uv = (u, v.z / size[1] + 0.5)
    return o


def books(name, x0, x1, y, z, depth=0.2, axis="x", fill=0.75):
    pal = [mat(name + f"B{i}", c, 0.7) for i, c in enumerate(((0.75, 0.7, 0.6), (0.12, 0.2, 0.18), (0.5, 0.2, 0.1), (0.1, 0.1, 0.12), (0.8, 0.62, 0.3), (0.3, 0.32, 0.36)))]
    it = []; x = x0
    while x < x0 + (x1 - x0) * fill:
        w = rng.uniform(0.025, 0.055); h = rng.uniform(0.2, 0.3)
        it.append((((x + w / 2, y, z + h / 2) if axis == "x" else (y, x + w / 2, z + h / 2)), ((w, depth * rng.uniform(0.7, 0.95), h) if axis == "x" else (depth * rng.uniform(0.7, 0.95), w, h)), rng.randrange(6))); x += w + 0.003
    boxes(name, it, pal)


def vase(name, x, y, z, h=0.3, m=None):
    cyl(name, (x, y, z + h / 2), h * 0.22, h, m or M["brass"], r2=h * 0.12, verts=24)


exec(open(Path(__file__).with_name("luxury_villa_build.py")).read())
