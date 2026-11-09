#!/usr/bin/env python3
"""Episode plates for the studio: per camera, a Cycles background plate (room without the desk props) and a foreground
plate (desk props only, alpha). Avir is rendered separately (three.js) and sits between them. Also writes cams.json
(camera position/target/fov in glTF axes) so the three.js camera matches exactly.
  python3 -I ep_plates.py studio.blend out_dir [--check avir_talk.blend] [--res 1920] [--samples 64]"""
import argparse, json, math
from pathlib import Path
import bpy
from mathutils import Vector

ap = argparse.ArgumentParser(); ap.add_argument("studio"); ap.add_argument("out"); ap.add_argument("--check", default="")
ap.add_argument("--res", type=int, default=1920); ap.add_argument("--samples", type=int, default=64); ap.add_argument("--cams", default="")
ap.add_argument("--diwali", action="store_true", help="add Diwali decor (fairy-light curtain, marigolds, diyas, lanterns, rangoli) and a moodier light")
ap.add_argument("--premium", action="store_true", help="calm premium workspace: walnut slat wall, warm practical lamps, toned-down neon")
a = ap.parse_args(); OUT = Path(a.out); OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=a.studio); sc = bpy.context.scene
FG_PREFIX = ("Desk", "Keyboard", "KeyGlow", "Mouse", "Mug", "Mic", "Monitor", "Diya")

# studio.blend has the monitor casing rotated about the world origin (it ends up behind Avir's chair); put it back
# behind its screen, rotated about its own centre.
_mon = bpy.data.objects.get("Monitor")
if _mon and _mon.location.length < 1e-6:
    _mon.rotation_euler = (0, 0, 0); bpy.context.view_layer.update()
    for o in bpy.context.selected_objects: o.select_set(False)
    _mon.select_set(True); bpy.context.view_layer.objects.active = _mon
    bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS"); _mon.rotation_euler = (0, 0, math.radians(205))


def diwali_decor():
    import bmesh, random
    import numpy as np
    from mathutils import Matrix
    rng = random.Random(8)

    def mat(name, col, rough=0.6, emit=0.0, ecol=None):
        m = bpy.data.materials.new(name); m.use_nodes = True; p = m.node_tree.nodes["Principled BSDF"]
        p.inputs["Base Color"].default_value = (*col, 1); p.inputs["Roughness"].default_value = rough
        if emit:
            p.inputs["Emission Color"].default_value = (*(ecol or col), 1); p.inputs["Emission Strength"].default_value = emit
        return m

    def spheres(name, pts, mats, seg=8):
        """One mesh holding many small (scaled) spheres; pts = [(loc, scale_xyz, mat_index)]."""
        me = bpy.data.meshes.new(name); bm = bmesh.new()
        for loc, s, mi in pts:
            m4 = Matrix.Translation(loc) @ Matrix.Diagonal((*s, 1))
            r = bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=max(4, seg // 2), radius=1.0, matrix=m4)
            for f in {f for v in r["verts"] for f in v.link_faces}: f.material_index = mi; f.smooth = True
        bm.to_mesh(me); bm.free(); o = bpy.data.objects.new(name, me); sc.collection.objects.link(o)
        for m in mats: me.materials.append(m)
        return o

    def swag(x0, x1, z, sag, y, step):
        n = max(2, int(abs(x1 - x0) / step)); return [(x0 + (x1 - x0) * i / n, y, z - sag * (1 - (2 * i / n - 1) ** 2)) for i in range(n + 1)]

    WARM = (1.0, 0.62, 0.28)
    bulb = mat("FairyBulb", WARM, 0.3, emit=28); bulb2 = mat("FairyBulbGold", (1.0, 0.78, 0.45), 0.3, emit=22)
    wire = mat("FairyWire", (0.02, 0.02, 0.02), 0.5)
    pts = []
    # fairy-light curtain on the back wall behind Avir (soft bokeh behind his head in close shots)
    for k in range(13):
        x = -0.72 + k * 0.12; ln = rng.uniform(0.55, 1.05)
        for j in range(int(ln / 0.07)):
            pts.append(((x + rng.uniform(-0.006, 0.006), 1.87, 2.25 - j * 0.07), (0.009,) * 3, (k + j) % 2))
    for p in swag(-0.76, 0.76, 2.27, 0.05, 1.87, 0.06): pts.append((p, (0.008,) * 3, 1))
    # high swags across the whole back wall, above the neon sign
    for s in range(4):
        for p in swag(-2.4 + s * 1.2, -1.2 + s * 1.2, 2.78, 0.16, 1.88, 0.07): pts.append((p, (0.01,) * 3, s % 2))
    # swags along the left (window) and right walls
    for side in (-1, 1):
        for s in range(3):
            for p in swag(-1.9 + s * 1.2, -0.7 + s * 1.2, 2.75, 0.15, 0, 0.07):
                pts.append(((side * 2.43, p[0], p[2]), (0.01,) * 3, s % 2))
    spheres("FairyLights", pts, [bulb, bulb2])
    # marigold (genda) garlands hanging from the shelf fronts and over the window
    orange = mat("Marigold", (1.0, 0.33, 0.02), 0.8); yellow = mat("MarigoldY", (1.0, 0.66, 0.04), 0.8); leaf = mat("MangoLeaf", (0.06, 0.25, 0.06), 0.6)
    gp = []
    for cx, z in ((-1.15, 1.0), (-1.15, 1.42), (1.15, 1.05), (1.15, 1.45)):
        for i, p in enumerate(swag(cx - 0.4, cx + 0.4, z - 0.03, 0.09, 1.645, 0.028)): gp.append((p, (0.019, 0.019, 0.017), i % 2))
        for ex in (cx - 0.4, cx + 0.4):
            for j in range(5): gp.append(((ex, 1.645, z - 0.06 - j * 0.032), (0.018,) * 3, j % 2))
    for i, p in enumerate(swag(-0.55, 1.15, 2.33, 0.12, 0, 0.03)): gp.append(((-2.38, p[0], p[2]), (0.02, 0.02, 0.018), i % 2))
    for i in range(0, 13, 3):   # little mango-leaf tips on the window toran
        p = swag(-0.55, 1.15, 2.33, 0.12, 0, 0.13)[i // 3 * 2 if i // 3 * 2 < 13 else 12]
        gp.append(((-2.37, p[0], p[2] - 0.05), (0.004, 0.025, 0.045), 2))
    spheres("Marigolds", gp, [orange, yellow, leaf], seg=10)

    # diyas: clay bowl + flame + a tiny warm light
    clay = mat("Clay", (0.42, 0.13, 0.04), 0.75); flame = mat("Flame", (1.0, 0.55, 0.12), 0.3, emit=80, ecol=(1.0, 0.5, 0.1))
    gold = mat("DiyaGold", (0.9, 0.65, 0.2), 0.3)

    def diya(name, x, y, z, s=1.0, light=2.5):
        bpy.ops.mesh.primitive_cone_add(vertices=24, radius1=0.026 * s, radius2=0.042 * s, depth=0.024 * s, location=(x, y, z + 0.012 * s))
        b = bpy.context.active_object; b.name = name; b.data.materials.append(clay)
        bpy.ops.object.shade_smooth()
        bpy.ops.mesh.primitive_torus_add(major_radius=0.041 * s, minor_radius=0.0035 * s, location=(x, y, z + 0.024 * s))
        r = bpy.context.active_object; r.name = name + "Rim"; r.data.materials.append(gold)
        bpy.ops.mesh.primitive_uv_sphere_add(radius=1, location=(x + 0.012 * s, y, z + 0.045 * s), scale=(0.0075 * s, 0.0075 * s, 0.019 * s))
        f = bpy.context.active_object; f.name = name + "Flame"; f.data.materials.append(flame)
        ld = bpy.data.lights.new("Glow_" + name, "POINT"); ld.energy = light; ld.color = (1.0, 0.55, 0.2); ld.shadow_soft_size = 0.01
        lo = bpy.data.objects.new("Glow_" + name, ld); lo.location = (x + 0.012 * s, y, z + 0.075 * s); sc.collection.objects.link(lo)

    for i, (x, y) in enumerate(((-0.66, -0.86), (-0.56, -0.9), (0.66, -0.86), (0.2, -0.88), (0.72, -0.48), (0.64, -0.36), (-0.72, -0.5))): diya(f"Diya{i}", x, y, 0.77)
    RX, RY = -1.45, -0.35   # rangoli on the open floor left of the desk (visible in the wide shot)
    for i in range(8):
        ang = i * math.pi / 4; diya(f"FloorDiya{i}", RX + 0.56 * math.cos(ang), RY + 0.56 * math.sin(ang), 0.008, 1.2, 3.0)

    # rangoli on the floor in front of the desk (procedural texture)
    N = 1024; yy, xx = np.mgrid[-1:1:N * 1j, -1:1:N * 1j]; r = np.hypot(xx, yy); th = np.arctan2(yy, xx)
    img = np.zeros((N, N, 4)); img[..., 3] = 1
    pal = [(0.85, 0.05, 0.35), (1.0, 0.45, 0.02), (1.0, 0.8, 0.05), (0.95, 0.95, 0.9), (0.02, 0.55, 0.55), (0.45, 0.1, 0.6)]

    def paint(mask, c):
        img[mask, :3] = c
    paint(r < 1.0, (0.12, 0.08, 0.06))
    paint((r < 0.98) & (r > 0.9), pal[3])
    petal = r < 0.88 * (0.62 + 0.38 * np.abs(np.cos(4 * th)))
    paint(petal, pal[0]); paint(r < 0.72 * (0.6 + 0.4 * np.abs(np.cos(4 * th + math.pi / 4))), pal[1])
    paint(r < 0.55 * (0.7 + 0.3 * np.abs(np.cos(6 * th))), pal[2]); paint(r < 0.36 * (0.75 + 0.25 * np.abs(np.cos(8 * th))), pal[4])
    paint(r < 0.2, pal[5]); paint(r < 0.09, pal[3])
    for k in range(16):
        a_ = k * math.pi / 8; d = np.hypot(xx - 0.8 * math.cos(a_), yy - 0.8 * math.sin(a_)); paint(d < 0.035, pal[3 if k % 2 else 2])
    paint(r >= 1.0, (0, 0, 0)); img[r >= 1.0, 3] = 0
    im = bpy.data.images.new("RangoliTex", N, N, alpha=True); im.pixels.foreach_set(img[::-1].astype(np.float32).ravel()); im.pack()
    m = bpy.data.materials.new("Rangoli"); m.use_nodes = True; nt = m.node_tree; p = nt.nodes["Principled BSDF"]
    tx = nt.nodes.new("ShaderNodeTexImage"); tx.image = im
    nt.links.new(tx.outputs["Color"], p.inputs["Base Color"]); nt.links.new(tx.outputs["Alpha"], p.inputs["Alpha"]); p.inputs["Roughness"].default_value = 0.95
    bpy.ops.mesh.primitive_plane_add(size=1.0, location=(RX, RY, 0.009)); rg = bpy.context.active_object; rg.name = "Rangoli"; rg.data.materials.append(m)

    # paper lanterns (kandil) hanging in the back corners
    for nm, (x, y) in (("KandilL", (-1.95, 1.35)), ("KandilR", (1.98, 0.9))):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=8, ring_count=6, radius=1, location=(x, y, 2.3), scale=(0.13, 0.13, 0.17))
        o = bpy.context.active_object; o.name = nm; o.data.materials.append(mat(nm + "Paper", (0.9, 0.12, 0.03), 0.6, emit=0.9, ecol=(1.0, 0.2, 0.02)))
        for t_ in range(6):
            ang = t_ * math.pi / 3
            bpy.ops.mesh.primitive_cylinder_add(radius=0.004, depth=0.28, location=(x + 0.05 * math.cos(ang), y + 0.05 * math.sin(ang), 2.0))
            bpy.context.active_object.data.materials.append(mat("Tassel", (1.0, 0.75, 0.1), 0.5, emit=1.5))
        bpy.ops.mesh.primitive_cylinder_add(radius=0.003, depth=0.6, location=(x, y, 2.7)); bpy.context.active_object.data.materials.append(wire)
        ld = bpy.data.lights.new("Glow_" + nm, "POINT"); ld.energy = 18; ld.color = (1.0, 0.45, 0.12); ld.shadow_soft_size = 0.1
        lo = bpy.data.objects.new("Glow_" + nm, ld); lo.location = (x, y, 2.3); sc.collection.objects.link(lo)
        o.visible_shadow = False

    # moodier light: the room keys only light the set (Avir is lit separately), so drop them and let the practicals glow
    for n_, e in (("Key", 55), ("Fill", 10), ("RimWarm", 60), ("NeonGlow", 45)):
        if n_ in bpy.data.lights: bpy.data.lights[n_].energy = e
    wl = bpy.data.lights.new("WallWash", "AREA"); wl.energy = 35; wl.color = (1.0, 0.6, 0.3); wl.size = 2.5
    wo = bpy.data.objects.new("WallWash", wl); wo.location = (0, 0.9, 0.2); sc.collection.objects.link(wo)
    wo.rotation_euler = (Vector((0, 1.95, 1.7)) - Vector(wo.location)).to_track_quat("-Z", "Y").to_euler()
    sb = bpy.data.materials.get("SoftboxFace")
    if sb: sb.node_tree.nodes["Principled BSDF"].inputs["Emission Strength"].default_value = 0.3
    sc.view_settings.exposure = -0.3
    for o in sc.objects:
        if o.type == "LIGHT": o.visible_camera = False


def premium_decor():
    """Calmer, premium creator workspace: warm walnut slat wall behind Avir, warm practicals, no random graphics,
    neon toned down to a soft warm-white sign."""
    import bmesh

    def mat(name, col, rough=0.6, emit=0.0, ecol=None):
        m = bpy.data.materials.new(name); m.use_nodes = True; p = m.node_tree.nodes["Principled BSDF"]
        p.inputs["Base Color"].default_value = (*col, 1); p.inputs["Roughness"].default_value = rough
        if emit:
            p.inputs["Emission Color"].default_value = (*(ecol or col), 1); p.inputs["Emission Strength"].default_value = emit
        return m

    def set_mat(name, col=None, emit=None, ecol=None, rough=None):
        m = bpy.data.materials.get(name)
        if not m or not m.use_nodes: return
        p = m.node_tree.nodes.get("Principled BSDF")
        if not p: return
        if col: p.inputs["Base Color"].default_value = (*col, 1)
        if rough is not None: p.inputs["Roughness"].default_value = rough
        if emit is not None: p.inputs["Emission Strength"].default_value = emit
        if ecol: p.inputs["Emission Color"].default_value = (*ecol, 1)

    for o in sc.objects:   # random wall graphics and the orange tagline bar go
        if o.name.startswith(("Hex", "Tagline")): o.hide_render = True
    set_mat("Wall", col=(0.115, 0.095, 0.08), rough=0.92)
    WARM = (1.0, 0.72, 0.46)
    set_mat("LEDCyan", emit=1.2, ecol=WARM); set_mat("NeonCyan", emit=2.2, ecol=(1.0, 0.9, 0.78))
    set_mat("KeyRGB", emit=0.25, ecol=WARM)
    for n in ("Glow1", "Glow-1"): set_mat(n, emit=1.2, ecol=WARM)
    for n in ("ShelfLED-10", "ShelfLED-11", "ShelfLED10", "ShelfLED11"): set_mat(n, emit=1.5, ecol=WARM)
    # walnut slat panel behind Avir with a hidden warm LED strip above it
    walnut = mat("Walnut", (0.17, 0.085, 0.04), 0.5); me = bpy.data.meshes.new("SlatWall"); bm = bmesh.new()
    x = -0.86
    while x < 0.86:
        bmesh.ops.create_cube(bm, size=1, matrix=Matrix.Translation((x, 1.855, 1.5)) @ Matrix.Diagonal((0.034, 0.03, 1.5, 1)))
        x += 0.056
    bmesh.ops.create_cube(bm, size=1, matrix=Matrix.Translation((0, 1.88, 1.5)) @ Matrix.Diagonal((1.76, 0.01, 1.5, 1)))
    bm.to_mesh(me); bm.free(); so = bpy.data.objects.new("SlatWall", me); sc.collection.objects.link(so); me.materials.append(walnut)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 1.82, 2.27), scale=(1.74, 0.02, 0.012))
    led = bpy.context.active_object; led.name = "SlatLED"; led.data.materials.append(mat("SlatLEDm", WARM, 0.4, emit=6))
    up = bpy.data.lights.new("SlatGraze", "AREA"); up.energy = 30; up.color = WARM; up.size = 1.6; up.shape = "RECTANGLE"; up.size_y = 0.05
    uo = bpy.data.objects.new("SlatGraze", up); uo.location = (0, 1.74, 2.24); sc.collection.objects.link(uo)
    uo.rotation_euler = (Vector((0, 1.86, 1.0)) - Vector(uo.location)).to_track_quat("-Z", "Y").to_euler()
    # floor lamp (fabric shade) in the back-left corner and a small warm table lamp on the right shelf
    black = bpy.data.materials.get("BlackMetal") or mat("BlackM", (0.02, 0.02, 0.02), 0.4)
    shade = mat("LampShade", (0.9, 0.78, 0.62), 0.85, emit=0.7, ecol=(1.0, 0.7, 0.42))
    for nm, (lx, ly, h, r) in (("FloorLamp", (-1.3, 1.45, 1.55, 0.2)), ("ShelfLamp", (1.05, 1.74, 1.37, 0.07))):
        bpy.ops.mesh.primitive_cylinder_add(radius=0.012 if r > 0.1 else 0.006, depth=h - (0 if r > 0.1 else 1.18), location=(lx, ly, (h + (0 if r > 0.1 else 1.18)) / 2))
        bpy.context.active_object.name = nm + "Pole"; bpy.context.active_object.data.materials.append(black)
        bpy.ops.mesh.primitive_cone_add(vertices=40, radius1=r, radius2=r * 0.72, depth=r * 1.3, location=(lx, ly, h), end_fill_type="NOTHING")
        o = bpy.context.active_object; o.name = nm + "Shade"; o.data.materials.append(shade); bpy.ops.object.shade_smooth()
        ld = bpy.data.lights.new(nm + "Bulb", "POINT"); ld.energy = 45 if r > 0.1 else 8; ld.color = (1.0, 0.68, 0.42); ld.shadow_soft_size = r * 0.6
        lo = bpy.data.objects.new(nm + "Bulb", ld); lo.location = (lx, ly, h); sc.collection.objects.link(lo)
    for n_, e in (("Key", 45), ("Fill", 12), ("RimWarm", 55), ("RimCyan", 8), ("NeonGlow", 12), ("Moonlight", 6)):
        if n_ in bpy.data.lights: bpy.data.lights[n_].energy = e
    if "RimCyan" in bpy.data.lights: bpy.data.lights["RimCyan"].color = (0.75, 0.85, 1.0)
    sb = bpy.data.materials.get("SoftboxFace")
    if sb: sb.node_tree.nodes["Principled BSDF"].inputs["Emission Strength"].default_value = 0.25
    sc.view_settings.exposure = -0.15
    for o in sc.objects:
        if o.type == "LIGHT": o.visible_camera = False


from mathutils import Matrix
if a.diwali:
    diwali_decor()
if a.premium:
    premium_decor()
CAMS = {   # name: (location, target, lens)  — Avir's head is at about (0, 0.33, 1.38) when seated
    "close": ((0.08, -1.45, 1.42), (0.0, 0.3, 1.36), 62),
    "medium": ((0.15, -2.45, 1.45), (0.0, 0.3, 1.2), 38),
    "side": ((1.35, -1.75, 1.42), (-0.05, 0.3, 1.24), 45),
    "wide": ((1.25, -3.45, 1.7), (-0.05, 0.6, 1.15), 24),
}
cams = {}
for name, (loc, tgt, lens) in CAMS.items():
    cd = bpy.data.cameras.new(f"EP_{name}"); cd.lens = lens; cd.sensor_width = 36; cd.sensor_fit = "HORIZONTAL"
    cd.dof.use_dof = True; cd.dof.aperture_fstop = 2.8 if name in ("close", "side") else 4.0; cd.dof.focus_distance = (Vector(loc) - Vector((0, 0.25, 1.38))).length
    o = bpy.data.objects.new(f"EP_{name}", cd); sc.collection.objects.link(o); o.location = loc
    o.rotation_euler = (Vector(tgt) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    hfov = 2 * math.atan(18 / lens); vfov = 2 * math.atan(math.tan(hfov / 2) * 9 / 16)
    cams[name] = {"pos": [loc[0], loc[2], -loc[1]], "target": [tgt[0], tgt[2], -tgt[1]], "vfov_deg": math.degrees(vfov)}
json.dump(cams, open(OUT / "cams.json", "w"), indent=1)

sc.render.engine = "CYCLES"; sc.cycles.device = "CPU"; sc.cycles.samples = a.samples; sc.cycles.use_denoising = True
sc.render.resolution_x = a.res; sc.render.resolution_y = a.res * 9 // 16; sc.view_settings.view_transform = "AgX"
sel = [c for c in (a.cams.split(",") if a.cams else CAMS)]
fg = [o for o in sc.objects if o.name.startswith(FG_PREFIX)]

def bloom(path, rgba=False):
    """Soft glow around the bright practicals (fairy lights, diyas, neon): blurred highlights added back on top."""
    import numpy as np
    from PIL import Image, ImageFilter
    im = Image.open(path); x = np.asarray(im.convert("RGBA" if rgba else "RGB")).astype(np.float32) / 255
    rgb = x[..., :3] * (x[..., 3:] if rgba else 1)
    hi = np.clip((rgb.max(-1, keepdims=True) - 0.72) / 0.28, 0, 1) * rgb
    glow = np.zeros_like(rgb)
    for rad, w in ((6, 0.45), (18, 0.35), (45, 0.25)):
        g = Image.fromarray((hi * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(rad * x.shape[1] / 1920))
        glow += np.asarray(g).astype(np.float32) / 255 * w
    out = 1 - (1 - rgb) * (1 - np.clip(glow, 0, 1))          # screen blend
    if rgba:
        al = np.clip(np.maximum(x[..., 3], glow.max(-1)), 0, 1); col = np.where(al[..., None] > 1e-4, out / np.maximum(al[..., None], 1e-4), 0)
        Image.fromarray((np.dstack([np.clip(col, 0, 1), al]) * 255).astype(np.uint8), "RGBA").save(path)
    else:
        Image.fromarray((np.clip(out, 0, 1) * 255).astype(np.uint8)).save(path)


if a.check:   # reference: Avir seated in the room (Cycles), to tune cameras and pose
    with bpy.data.libraries.load(a.check, link=False) as (src, dst):
        dst.objects = list(src.objects); dst.actions = list(src.actions)
    for o in dst.objects:
        if o is not None and o.type != "CAMERA" and o.type != "LIGHT": sc.collection.objects.link(o)
    arm = [o for o in dst.objects if o is not None and o.type == "ARMATURE"][0]
    arm.animation_data_create(); arm.animation_data.action = bpy.data.actions["SitTalkBoth"]; sc.frame_set(60)
    for c in sel:
        sc.camera = bpy.data.objects[f"EP_{c}"]; sc.render.filepath = str(OUT / f"check_{c}.png"); bpy.ops.render.render(write_still=True)
        if a.diwali or a.premium: bloom(OUT / f"check_{c}.png")
    raise SystemExit

for c in sel:
    sc.camera = bpy.data.objects[f"EP_{c}"]
    for o in fg: o.hide_render = True; o.is_holdout = False
    sc.render.film_transparent = False; sc.render.filepath = str(OUT / f"bg_{c}.png"); bpy.ops.render.render(write_still=True)
    for o in sc.objects:
        if o.type == "MESH": o.is_holdout = o not in fg
    for o in fg: o.hide_render = False
    sc.render.film_transparent = True; sc.render.image_settings.color_mode = "RGBA"
    sc.render.filepath = str(OUT / f"fg_{c}.png"); bpy.ops.render.render(write_still=True)
    if a.diwali or a.premium: bloom(OUT / f"bg_{c}.png"); bloom(OUT / f"fg_{c}.png", rgba=True)
    for o in sc.objects:
        if o.type == "MESH": o.is_holdout = False
    sc.render.image_settings.color_mode = "RGB"
print("plates ok")
