#!/usr/bin/env python3
"""Avir's recurring creator studio (Unfiltered Avir set). Builds studio.blend (+ studio.glb for real-time use).
  python3 -I studio_room.py <out_dir> [--avir avir.glb] [--preview 540] [--samples 16]
Layout (metres, Blender axes): Avir stands/sits at the origin facing -Y (camera side); desk in front of him at y≈-0.55;
back wall at y=+1.9; window on the left wall (x=-2.5); shelf wall on the right (x=+2.5). Saved camera presets:
Cam_DeskMedium, Cam_Wide, Cam_Screen."""
import argparse, math, random
from pathlib import Path
import bpy
import numpy as np
from mathutils import Vector

ap = argparse.ArgumentParser(); ap.add_argument("out"); ap.add_argument("--avir", default="")
ap.add_argument("--preview", type=int, default=0); ap.add_argument("--samples", type=int, default=16)
a = ap.parse_args(); OUT = Path(a.out); OUT.mkdir(parents=True, exist_ok=True); rng = random.Random(5)
bpy.ops.wm.read_factory_settings(use_empty=True); sc = bpy.context.scene
FONT = "/home/user/roz/.claude/skills/video-editor/remotion/public/Poppins-ExtraBold.ttf"
CYAN, SAFFRON = (0.15, 0.85, 1.0), (1.0, 0.55, 0.12)


def mat(name, col, rough=0.6, emit=0.0, ecol=None, metal=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True; b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*col, 1); b.inputs["Roughness"].default_value = rough; b.inputs["Metallic"].default_value = metal
    if emit: b.inputs["Emission Color"].default_value = (*(ecol or col), 1); b.inputs["Emission Strength"].default_value = emit
    return m


def box(name, loc, size, m, bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc); o = bpy.context.active_object; o.name = name; o.scale = size
    bpy.ops.object.transform_apply(scale=True)
    if bevel:
        bv = o.modifiers.new("bevel", "BEVEL"); bv.width = bevel; bv.segments = 3
    o.data.materials.append(m); return o


def cyl(name, loc, r, h, m, rot=(0, 0, 0), verts=32):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=h, location=loc, rotation=rot, vertices=verts); o = bpy.context.active_object; o.name = name
    o.data.materials.append(m); return o


def img_mat(name, arr, emit=0.0, rough=0.5):
    from PIL import Image
    p = OUT / f"{name}.png"; Image.fromarray((np.clip(arr, 0, 1) * 255).astype(np.uint8)).save(p)
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; b = nt.nodes["Principled BSDF"]
    t = nt.nodes.new("ShaderNodeTexImage"); t.image = bpy.data.images.load(str(p)); nt.links.new(t.outputs["Color"], b.inputs["Base Color"])
    b.inputs["Roughness"].default_value = rough
    if emit: nt.links.new(t.outputs["Color"], b.inputs["Emission Color"]); b.inputs["Emission Strength"].default_value = emit
    return m


# ---------------- shell: wood floor, charcoal walls, ceiling
wood = bpy.data.materials.new("WoodFloor"); wood.use_nodes = True; nt = wood.node_tree; b = nt.nodes["Principled BSDF"]
wv = nt.nodes.new("ShaderNodeTexWave"); wv.inputs["Scale"].default_value = 3.0; wv.inputs["Distortion"].default_value = 6; wv.inputs["Detail"].default_value = 3
rmp = nt.nodes.new("ShaderNodeValToRGB"); rmp.color_ramp.elements[0].color = (0.16, 0.085, 0.045, 1); rmp.color_ramp.elements[1].color = (0.32, 0.18, 0.09, 1)
nt.links.new(wv.outputs["Fac"], rmp.inputs["Fac"]); nt.links.new(rmp.outputs["Color"], b.inputs["Base Color"]); b.inputs["Roughness"].default_value = 0.42
box("Floor", (0, 0, -0.01), (5, 4.6, 0.02), wood)
wall = mat("Wall", (0.085, 0.09, 0.1), 0.85)
box("BackWall", (0, 1.95, 1.5), (5, 0.1, 3.0), wall); box("LeftWall", (-2.5, 0, 1.5), (0.1, 4.6, 3.0), wall)
box("RightWall", (2.5, 0, 1.5), (0.1, 4.6, 3.0), wall); box("Ceiling", (0, 0, 3.0), (5, 4.6, 0.05), mat("Ceil", (0.05, 0.05, 0.06), 0.9))

# ---------------- back wall: hex acoustic panels, neon sign, LED strips, floating shelves
felt = [mat("FeltTeal", (0.05, 0.22, 0.24), 0.95), mat("FeltGrey", (0.14, 0.15, 0.16), 0.95), mat("FeltOrange", (0.55, 0.22, 0.06), 0.95)]
for i, (x, z) in enumerate(((-1.75, 1.15), (-1.45, 1.32), (-1.75, 1.5), (-1.15, 1.15), (1.7, 1.75), (1.4, 1.92), (1.7, 2.1), (1.1, 1.75))):
    o = cyl(f"Hex{i}", (x, 1.88, z), 0.17, 0.04, felt[[0, 1, 0, 2, 1, 0, 2, 1][i]], rot=(math.radians(90), 0, 0), verts=6)
bpy.ops.object.text_add(location=(0, 1.86, 2.35), rotation=(math.radians(90), 0, 0)); t = bpy.context.active_object; t.name = "NeonSign"
t.data.body = "UNFILTERED AVIR"; t.data.align_x = "CENTER"; t.data.size = 0.24; t.data.extrude = 0.006; t.data.bevel_depth = 0.004
try: t.data.font = bpy.data.fonts.load(FONT)
except Exception: pass
t.data.materials.append(mat("NeonCyan", CYAN, 0.3, emit=9))
bpy.ops.object.convert(target="MESH")
l = bpy.data.lights.new("NeonGlow", "AREA"); l.energy = 60; l.color = CYAN; l.size = 1.8; lo = bpy.data.objects.new("NeonGlow", l); lo.location = (0, 1.7, 2.35)
lo.rotation_euler = (math.radians(-90), 0, 0); sc.collection.objects.link(lo)
box("Tagline", (0, 1.875, 2.12), (1.5, 0.005, 0.012), mat("NeonOrange", SAFFRON, 0.3, emit=7))
for z in (2.92,):                                              # cove LED along the ceiling line
    box("LEDCove", (0, 1.88, z), (4.9, 0.02, 0.02), mat("LEDCyan", CYAN, 0.3, emit=12))
oak = mat("Oak", (0.36, 0.22, 0.12), 0.5)
book_cols = [(0.6, 0.12, 0.1), (0.1, 0.3, 0.55), (0.85, 0.75, 0.55), (0.15, 0.15, 0.17), (0.2, 0.45, 0.3), (0.85, 0.5, 0.1)]
for side, x0 in ((-1, -1.55), (1, 0.75)):
    for k, z in enumerate((1.0, 1.42) if side < 0 else (1.05, 1.45)):
        box(f"Shelf{side}{k}", (x0 + 0.4, 1.78, z), (0.85, 0.24, 0.035), oak, 0.004)
        box(f"ShelfLED{side}{k}", (x0 + 0.4, 1.86, z - 0.022), (0.83, 0.01, 0.006), mat(f"ShelfLED{side}{k}", (1.0, 0.65, 0.35), emit=10))
        x = x0 + 0.02
        for j in range(rng.randint(5, 8)):
            h = rng.uniform(0.17, 0.27); w = rng.uniform(0.025, 0.045)
            box(f"Book{side}{k}{j}", (x + w / 2, 1.8, z + 0.018 + h / 2), (w, 0.17, h), mat(f"bk{side}{k}{j}", rng.choice(book_cols), 0.7)); x += w + 0.004
        # décor: small plant pot, glowing cube, little robot figure
        cyl(f"Pot{side}{k}", (x0 + 0.62, 1.78, z + 0.07), 0.05, 0.1, mat("Terracotta", (0.55, 0.25, 0.14), 0.8))
        for q in range(7):
            bpy.ops.mesh.primitive_cone_add(radius1=0.022, depth=0.14, location=(x0 + 0.62 + rng.uniform(-0.03, 0.03), 1.78 + rng.uniform(-0.03, 0.03), z + 0.18),
                                            rotation=(rng.uniform(-0.5, 0.5), rng.uniform(-0.5, 0.5), 0))
            bpy.context.active_object.data.materials.append(mat(f"leaf{q}", (0.12, 0.38, 0.15), 0.6))
        if k == 1:
            box(f"GlowCube{side}", (x0 + 0.76, 1.78, z + 0.07), (0.1, 0.1, 0.1), mat(f"Glow{side}", SAFFRON if side < 0 else CYAN, 0.3, emit=6))

# ---------------- left wall: night-city window with blinds
city = np.zeros((512, 512, 3)); city[:] = np.linspace([0.02, 0.03, 0.09], [0.12, 0.06, 0.14], 512)[:, None, :]
for i in range(22):
    x0 = rng.randint(0, 500); w = rng.randint(18, 45); h = rng.randint(120, 330)
    city[512 - h:, x0:x0 + w] = [0.01, 0.01, 0.02]
    for yy in range(512 - h + 8, 505, 14):
        for xx in range(x0 + 4, x0 + w - 4, 10):
            if rng.random() < 0.35: city[yy:yy + 6, xx:xx + 5] = rng.choice([[1, .78, .45], [1, .9, .7], [.7, .8, 1]])
win = img_mat("CityView", city, emit=2.2)
bpy.ops.mesh.primitive_plane_add(size=1, location=(-2.44, 0.3, 1.55), rotation=(math.radians(90), 0, math.radians(90))); w_ = bpy.context.active_object
w_.scale = (1.6, 1.4, 1); w_.data.materials.append(win)
frame = mat("Frame", (0.03, 0.03, 0.035), 0.4)
for dy, dz, sy, sz in ((0, 0.72, 1.7, 0.05), (0, -0.72, 1.7, 0.05), (0.82, 0, 0.05, 1.5), (-0.82, 0, 0.05, 1.5), (0, 0, 0.03, 1.45)):
    box("WinFrame", (-2.43, 0.3 + dy, 1.55 + dz), (0.04, sy, sz), frame)
for i in range(7):
    box(f"Blind{i}", (-2.4, 0.3, 2.2 - i * 0.025), (0.02, 1.62, 0.018), mat("Blind", (0.75, 0.72, 0.68), 0.6))
l = bpy.data.lights.new("Moonlight", "AREA"); l.energy = 120; l.color = (0.55, 0.65, 1.0); l.size = 1.5
mo = bpy.data.objects.new("Moonlight", l); mo.location = (-2.2, 0.3, 1.6); mo.rotation_euler = (0, math.radians(-90), 0); sc.collection.objects.link(mo)

# ---------------- right side: tall plant, softbox light on stand
cyl("PlantPot", (2.1, 1.35, 0.25), 0.2, 0.5, mat("PotBlack", (0.04, 0.04, 0.045), 0.5))
for q in range(26):
    ang = rng.uniform(0, 2 * math.pi); tilt = rng.uniform(0.2, 0.9)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.22, location=(2.1 + 0.25 * math.cos(ang) * tilt, 1.35 + 0.25 * math.sin(ang) * tilt, 0.8 + rng.uniform(0, 1.0)),
                                         scale=(1, 0.18, 0.45), rotation=(rng.uniform(-1, 1), tilt, ang))
    bpy.context.active_object.data.materials.append(mat(f"MonsteraLeaf{q}", (0.07, 0.3 + 0.08 * rng.random(), 0.1), 0.55))
cyl("SoftboxPole", (1.9, -1.6, 0.9), 0.015, 1.8, mat("Metal", (0.2, 0.2, 0.22), 0.3, metal=1))
box("Softbox", (1.9, -1.55, 1.85), (0.55, 0.12, 0.55), mat("SoftboxFace", (1, 1, 1), 0.5, emit=1.2, ecol=(1.0, 0.95, 0.9)))

# ---------------- desk setup in front of Avir
box("DeskTop", (0, -0.6, 0.75), (1.5, 0.7, 0.04), oak, 0.006)
blk = mat("BlackMetal", (0.025, 0.025, 0.03), 0.35, metal=0.8)
for x in (-0.68, 0.68):
    for y in (-0.88, -0.32):
        box("DeskLeg", (x, y, 0.365), (0.045, 0.045, 0.73), blk)
box("Rug", (0, -0.2, 0.004), (2.4, 1.8, 0.008), mat("Rug", (0.18, 0.2, 0.24), 0.95))
# monitor (angled toward Avir; screen readable in the screen insert shot)
scr = np.zeros((540, 960, 3)); scr[:] = (0.07, 0.08, 0.1); scr[:, :36] = (0.05, 0.05, 0.07); scr[:30] = (0.11, 0.12, 0.15)
for i in range(22):
    y = 50 + i * 21; x = 60 + (i % 5) * 18; ln = rng.randint(120, 420)
    scr[y:y + 9, x:x + ln] = rng.choice([(0.55, 0.75, 1.0), (0.85, 0.6, 0.95), (0.6, 0.9, 0.6), (0.9, 0.85, 0.6), (0.75, 0.75, 0.78)])
scr[40:520, 600:940] = (0.11, 0.12, 0.15)
for i in range(6):
    y = 70 + i * 72; c = (0.15, 0.55, 0.85) if i % 2 else (0.25, 0.27, 0.32); scr[y:y + 50, 620 + (40 if i % 2 else 0):900 + (40 if i % 2 else 0) - 40] = c
monitor = img_mat("MonitorScreen", scr, emit=3.0, rough=0.25)
mon = box("Monitor", (-0.42, -0.42, 1.08), (0.62, 0.025, 0.36), blk)
bpy.ops.mesh.primitive_plane_add(size=1, location=(-0.42, -0.405, 1.08), rotation=(math.radians(90), 0, 0)); sp = bpy.context.active_object
sp.scale = (0.6, 0.34, 1); sp.data.materials.append(monitor); sp.name = "MonitorScreen"; sp.rotation_euler[2] = math.radians(180)
mon.rotation_euler[2] = sp.rotation_euler[2] = math.radians(180 + 25)
box("MonitorStand", (-0.42, -0.4, 0.86), (0.06, 0.06, 0.2), blk)
box("Keyboard", (0.0, -0.78, 0.78), (0.42, 0.14, 0.018), mat("KB", (0.08, 0.08, 0.09), 0.5), 0.003)
box("KeyGlow", (0.0, -0.78, 0.79), (0.4, 0.12, 0.002), mat("KeyRGB", CYAN, emit=1.2))
box("Mouse", (0.32, -0.8, 0.78), (0.06, 0.1, 0.025), mat("MouseM", (0.08, 0.08, 0.09), 0.4), 0.01)
cyl("Mug", (0.55, -0.55, 0.82), 0.04, 0.1, mat("MugM", (0.92, 0.9, 0.86), 0.3))
# podcast mic on a short desk stand, off to Avir's left so it never covers his face or chest
cyl("MicBase", (0.42, -0.42, 0.785), 0.06, 0.02, blk)
cyl("MicPole", (0.42, -0.42, 0.9), 0.01, 0.22, blk)
cyl("Mic", (0.4, -0.38, 1.06), 0.032, 0.16, mat("MicGrille", (0.12, 0.12, 0.13), 0.35, metal=0.6), rot=(math.radians(-25), math.radians(15), 0))
# chair behind Avir
box("ChairSeat", (0, 0.45, 0.5), (0.55, 0.5, 0.08), mat("ChairFabric", (0.06, 0.06, 0.07), 0.8), 0.02)
box("ChairBack", (0, 0.72, 0.95), (0.52, 0.08, 0.75), mat("ChairFabric2", (0.06, 0.06, 0.07), 0.8), 0.03)
box("ChairAccent", (0, 0.68, 1.15), (0.06, 0.01, 0.4), mat("ChairOrange", SAFFRON, 0.6))
cyl("ChairPost", (0, 0.45, 0.25), 0.03, 0.45, blk)

# ---------------- key lighting for Avir (front softbox + fill + cyan rim)
def area(name, loc, target, energy, color, size):
    l = bpy.data.lights.new(name, "AREA"); l.energy = energy; l.color = color; l.size = size
    o = bpy.data.objects.new(name, l); o.location = loc; sc.collection.objects.link(o)
    o.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler(); return o
area("Key", (1.5, -1.9, 2.0), (0, 0, 1.5), 260, (1.0, 0.93, 0.85), 1.2)
area("Fill", (-1.4, -2.0, 1.6), (0, 0, 1.4), 70, (0.9, 0.9, 1.0), 2.0)
area("RimCyan", (-1.2, 1.5, 2.3), (0, 0, 1.6), 160, CYAN, 0.8)
area("RimWarm", (1.3, 1.5, 2.2), (0, 0, 1.6), 110, (1.0, 0.7, 0.4), 0.8)
w = bpy.data.worlds.new("w"); w.use_nodes = True; w.node_tree.nodes["Background"].inputs[0].default_value = (0.01, 0.01, 0.015, 1); sc.world = w

# ---------------- cameras (presets)
def camera(name, loc, target, lens, fstop):
    cd = bpy.data.cameras.new(name); cd.lens = lens; cd.dof.use_dof = True; cd.dof.aperture_fstop = fstop
    o = bpy.data.objects.new(name, cd); sc.collection.objects.link(o); o.location = loc
    o.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    cd.dof.focus_distance = (Vector(loc) - Vector((0, -0.05, 1.55))).length; return o
camera("Cam_DeskMedium", (0.15, -2.4, 1.5), (0, 0.3, 1.38), 40, 2.8)
cw = camera("Cam_Wide", (1.2, -3.4, 1.7), (-0.1, 0.5, 1.15), 22, 5.6)
cs = camera("Cam_Screen", (-0.12, -0.05, 1.12), (-0.42, -0.42, 1.08), 35, 2.0); cs.data.dof.focus_distance = 0.48
sc.camera = cw

# optional: place Avir (Avaturn GLB) at the origin, arms down, for previews
if a.avir:
    bpy.ops.import_scene.gltf(filepath=a.avir)
    for o in list(sc.objects):
        if o.name.startswith("Icosphere"): bpy.data.objects.remove(o, do_unlink=True)
    arm = [o for o in sc.objects if o.type == "ARMATURE"][0]
    if arm.animation_data: arm.animation_data.action = None
    for o in sc.objects:                                   # same near-black hair tint as the Diwali reel
        if o.type == "MESH" and o.name.startswith("avaturn_hair"):
            for m in o.data.materials:
                nt_ = m.node_tree; b_ = nt_.nodes.get("Principled BSDF")
                if b_ and b_.inputs["Base Color"].is_linked:
                    src = b_.inputs["Base Color"].links[0].from_socket; hv = nt_.nodes.new("ShaderNodeHueSaturation")
                    hv.inputs["Value"].default_value = 0.11; hv.inputs["Saturation"].default_value = 0.45
                    nt_.links.new(src, hv.inputs["Color"]); nt_.links.new(hv.outputs["Color"], b_.inputs["Base Color"])
    from mathutils import Matrix
    pbs = arm.pose.bones
    for pb in pbs: pb.rotation_mode = "QUATERNION"
    bpy.context.view_layer.update()
    for s_, d in (("Left", (0.14, 0.03, -1)), ("Right", (-0.14, 0.03, -1))):
        for bn, dd in ((f"{s_}Arm", d), (f"{s_}ForeArm", (d[0] * 0.4, -0.2, -1)), (f"{s_}Hand", (d[0] * 0.2, -0.25, -1))):
            pb = pbs[bn]; cur = (pb.matrix.to_3x3() @ Vector((0, 1, 0))).normalized(); M = pb.matrix.copy(); h = M.to_translation()
            R = cur.rotation_difference(Vector(dd).normalized()).to_matrix().to_4x4()
            pb.matrix = Matrix.Translation(h) @ R @ Matrix.Translation(-h) @ M; pb.scale = (1, 1, 1); bpy.context.view_layer.update()

sc.render.engine = "CYCLES"; sc.cycles.device = "CPU"; sc.cycles.samples = a.samples; sc.cycles.use_denoising = True
sc.cycles.max_bounces = 6; sc.cycles.diffuse_bounces = 2; sc.view_settings.view_transform = "AgX"
bpy.ops.file.pack_all()   # embed generated textures so the .blend works anywhere
bpy.ops.wm.save_as_mainfile(filepath=str(OUT / "studio.blend"), compress=True)
if not a.avir:
    bpy.ops.export_scene.gltf(filepath=str(OUT / "studio.glb"), export_format="GLB", export_lights=True, export_cameras=True, export_image_format="JPEG")
if a.preview:
    for cam in ("Cam_Wide", "Cam_DeskMedium", "Cam_Screen"):
        sc.camera = bpy.data.objects[cam]; sc.render.resolution_x = a.preview; sc.render.resolution_y = int(a.preview * 16 / 9)
        sc.render.filepath = str(OUT / f"preview_{cam}.png"); bpy.ops.render.render(write_still=True)
print("studio ok")
