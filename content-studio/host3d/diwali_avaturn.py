#!/usr/bin/env python3
"""10 s Happy Diwali reel with Avir (owner's Avaturn GLB): medium shot waving + wide shot dancing on a decorated
rooftop at night. The Avaturn export has no face blend shapes, so the Hindi wish plays as a voiceover.
  python3 -I diwali_avaturn.py avir_avaturn.glb <out_dir> [--stills 60,190] [--frames 0-239] [--samples 32]"""
import argparse, math, random
from pathlib import Path
import bpy
import numpy as np
from mathutils import Matrix, Vector, Quaternion

ap = argparse.ArgumentParser(); ap.add_argument("glb"); ap.add_argument("out")
ap.add_argument("--frames", default=""); ap.add_argument("--stills", default=""); ap.add_argument("--samples", type=int, default=32)
a = ap.parse_args(); OUT = Path(a.out); OUT.mkdir(parents=True, exist_ok=True); rng = random.Random(11)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=a.glb)
sc = bpy.context.scene; FPS = 24; sc.render.fps = FPS; sc.frame_start, sc.frame_end = 0, 239
arm = [o for o in sc.objects if o.type == "ARMATURE"][0]
for o in list(sc.objects):
    if o.name.startswith("Icosphere"): bpy.data.objects.remove(o, do_unlink=True)
dance = bpy.data.actions.get("DANCE_SHUFFLE")
pbs = arm.pose.bones
for pb in pbs: pb.rotation_mode = "QUATERNION"

# darker, natural black hair (reference) — tint the hair textures
for o in sc.objects:
    if o.type == "MESH" and o.name.startswith("avaturn_hair"):
        for m in o.data.materials:
            nt = m.node_tree; b = nt.nodes.get("Principled BSDF")
            if b and b.inputs["Base Color"].is_linked:
                src = b.inputs["Base Color"].links[0].from_socket
                hsv = nt.nodes.new("ShaderNodeHueSaturation"); hsv.inputs["Value"].default_value = 0.11; hsv.inputs["Saturation"].default_value = 0.45
                nt.links.new(src, hsv.inputs["Color"]); nt.links.new(hsv.outputs["Color"], b.inputs["Base Color"])
            elif b:
                c = b.inputs["Base Color"].default_value; b.inputs["Base Color"].default_value = (c[0] * 0.25, c[1] * 0.25, c[2] * 0.25, 1)


# ---------------- posing helpers (world-space aims, same method as anims.py)
def upd(): bpy.context.view_layer.update()
def reset():
    for pb in pbs: pb.rotation_quaternion = (1, 0, 0, 0); pb.location = (0, 0, 0); pb.scale = (1, 1, 1)
    upd()
def _apply(pb, R):
    M = pb.matrix.copy(); h = M.to_translation(); pb.matrix = Matrix.Translation(h) @ R @ Matrix.Translation(-h) @ M; pb.scale = (1, 1, 1); upd()
def aim(n, d):
    pb = pbs[n]; cur = (pb.matrix.to_3x3() @ Vector((0, 1, 0))).normalized()
    _apply(pb, cur.rotation_difference(Vector(d).normalized()).to_matrix().to_4x4())
def turn(n, axis, deg): _apply(pbs[n], Matrix.Rotation(math.radians(deg), 4, Vector(axis).normalized()))
def curl(deg=18):
    for s in ("Left", "Right"):
        for f in ("Index", "Middle", "Ring", "Pinky"):
            for k in (1, 2, 3): pbs[f"{s}Hand{f}{k}"].rotation_quaternion = Quaternion((1, 0, 0), math.radians(deg))
    upd()
def lerp3(p, q, t): return tuple(p[i] + (q[i] - p[i]) * t for i in range(3))
DOWN = {"Left": ((0.14, 0.02, -1), (0.05, -0.2, -1), (0.02, -0.25, -1)), "Right": ((-0.14, 0.02, -1), (-0.05, -0.2, -1), (-0.02, -0.25, -1))}
UP_R = ((-0.75, -0.15, 0.3), (-0.12, -0.25, 1), (-0.08, -0.25, 1))

wave = bpy.data.actions.new("WaveIdle"); arm.animation_data_create(); arm.animation_data.action = wave
for f in range(0, 121, 3):
    t = f / FPS; reset()
    br = math.sin(t * 2 * math.pi / 4)
    turn("Spine1", (1, 0, 0), -1.0 * br); turn("Neck", (1, 0, 0), 0.6 * br)
    turn("Head", (0, 0, 1), 3 * math.sin(t * 1.4)); turn("Head", (1, 0, 0), -2 + 1.5 * math.sin(t * 2.1))
    k = min(1.0, max(0.0, (t - 0.3) / 0.5)) if t < 4.2 else max(0.0, 1 - (t - 4.2) / 0.6)
    k = 0.5 - 0.5 * math.cos(math.pi * k); w = math.sin(t * 2 * math.pi * 1.5) * k
    for s in ("Left", "Right"):
        up, fore, hand = DOWN[s]
        if s == "Right":
            up = lerp3(up, UP_R[0], k); fore = lerp3(fore, (UP_R[1][0] + 0.35 * w, UP_R[1][1], UP_R[1][2]), k)
            hand = lerp3(hand, (UP_R[2][0] + 0.5 * w, UP_R[2][1], UP_R[2][2]), k)
        aim(f"{s}Arm", up); aim(f"{s}ForeArm", fore); aim(f"{s}Hand", hand)
    curl(16 * (1 - k) + 4)
    for pb in pbs: pb.keyframe_insert("rotation_quaternion", frame=f)
arm.animation_data.action = None; reset()

nam = bpy.data.actions.new("Namaste"); arm.animation_data.action = nam
for f in range(0, 121, 3):
    t = f / FPS; reset()
    br = math.sin(t * 2 * math.pi / 4); turn("Spine1", (1, 0, 0), -1.0 * br)
    k = min(1.0, t / 0.7); k = 0.5 - 0.5 * math.cos(math.pi * k)
    bow = max(0.0, math.sin(math.pi * min(1.0, max(0.0, (t - 1.2) / 1.6))))      # one gentle bow
    turn("Spine2", (1, 0, 0), 6 * bow); turn("Neck", (1, 0, 0), 5 * bow); turn("Head", (1, 0, 0), 8 * bow)
    for s_, sg in (("Left", 1), ("Right", -1)):
        up, fore, hand = DOWN[s_]
        up = lerp3(up, (sg * 0.32, -0.22, -1.0), k); fore = lerp3(fore, (-sg * 0.78, -0.55, 0.32), k); hand = lerp3(hand, (-sg * 0.08, -0.3, 1.0), k)
        aim(f"{s_}Arm", up); aim(f"{s_}ForeArm", fore); aim(f"{s_}Hand", hand)
    curl(5)
    for pb in pbs: pb.keyframe_insert("rotation_quaternion", frame=f)
arm.animation_data.action = None; reset()
ad = arm.animation_data
for t_ in list(ad.nla_tracks): ad.nla_tracks.remove(t_)
tr = ad.nla_tracks.new()
s1 = tr.strips.new("wave", 0, wave); s1.frame_end = 120; s1.extrapolation = "HOLD"; s1.use_auto_blend = False
s2 = tr.strips.new("namaste", 120, nam); s2.frame_end = 240; s2.extrapolation = "HOLD"; s2.use_auto_blend = False


# ---------------- set dressing: rooftop terrace, Diwali night
def mat(name, col, rough=0.6, emit=0.0, ecol=None):
    m = bpy.data.materials.new(name); m.use_nodes = True; b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*col, 1); b.inputs["Roughness"].default_value = rough
    if emit: b.inputs["Emission Color"].default_value = (*(ecol or col), 1); b.inputs["Emission Strength"].default_value = emit
    return m, b

w = bpy.data.worlds.new("night"); w.use_nodes = True; w.node_tree.nodes["Background"].inputs[0].default_value = (0.004, 0.006, 0.016, 1); sc.world = w
bpy.ops.mesh.primitive_plane_add(size=40); bpy.context.active_object.data.materials.append(mat("Terrace", (0.13, 0.1, 0.085), 0.55)[0])
# sky gradient backdrop with stars
bpy.ops.mesh.primitive_plane_add(size=80, location=(0, 30, 10), rotation=(math.radians(90), 0, 0)); skyo = bpy.context.active_object
skm = bpy.data.materials.new("Sky"); skm.use_nodes = True; nt = skm.node_tree
for n in list(nt.nodes):
    if n.type != "OUTPUT_MATERIAL": nt.nodes.remove(n)
tc = nt.nodes.new("ShaderNodeTexCoord"); sep = nt.nodes.new("ShaderNodeSeparateXYZ"); ramp = nt.nodes.new("ShaderNodeValToRGB"); em = nt.nodes.new("ShaderNodeEmission")
nt.links.new(tc.outputs["Generated"], sep.inputs[0]); nt.links.new(sep.outputs["Y"], ramp.inputs["Fac"])
ramp.color_ramp.elements[0].color = (0.10, 0.05, 0.12, 1); ramp.color_ramp.elements[1].color = (0.005, 0.01, 0.04, 1)
ramp.color_ramp.elements[0].position = 0.35; ramp.color_ramp.elements[1].position = 0.75
nt.links.new(ramp.outputs["Color"], em.inputs["Color"]); em.inputs["Strength"].default_value = 1.0
nt.links.new(em.outputs[0], nt.nodes["Material Output"].inputs["Surface"]); skyo.data.materials.append(skm)
starm = mat("Star", (1, 1, 1), emit=6)[0]
for i in range(140):
    bpy.ops.mesh.primitive_plane_add(size=0.06 + 0.06 * rng.random(), location=(rng.uniform(-35, 35), 29.8, rng.uniform(6, 30)), rotation=(math.radians(90), 0, 0))
    bpy.context.active_object.data.materials.append(starm)
# distant city skyline with lit windows
bldg = mat("Bldg", (0.012, 0.012, 0.02), 0.9)[0]; wins = [mat(f"Win{k}", c, emit=e)[0] for k, (c, e) in enumerate((((1.0, 0.72, 0.38), 2.5), ((1.0, 0.85, 0.6), 1.2), ((0.7, 0.8, 1.0), 1.5), ((1.0, 0.6, 0.3), 3.5)))]
for i in range(26):
    x = -26 + i * 2.1 + rng.uniform(-0.4, 0.4); h = rng.uniform(2.5, 9); wdt = rng.uniform(1.2, 2.0)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x, 22, h / 2), scale=(wdt, 1.5, h)); bpy.context.active_object.data.materials.append(bldg)
    for j in range(int(h * 2)):
        for c in range(3):
            if rng.random() < 0.3:
                bpy.ops.mesh.primitive_plane_add(size=0.12, location=(x - wdt / 3 + c * wdt / 3, 21.24, 0.6 + j * 0.45), rotation=(math.radians(90), 0, 0))
                bpy.context.active_object.data.materials.append(rng.choice(wins))
# parapet with diyas and a marigold garland
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 2.2, 0.5), scale=(9, 0.3, 1.0)); bpy.context.active_object.data.materials.append(mat("Parapet", (0.32, 0.2, 0.15), 0.85)[0])
clay = mat("Clay", (0.45, 0.17, 0.07), 0.75)[0]; flame = mat("Flame", (1.0, 0.55, 0.15), 0.4, emit=60)[0]
def diya(x, y, z, s=1.0):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.05 * s, location=(x, y, z + 0.022 * s), scale=(1, 1, 0.45), segments=16, ring_count=8)
    bpy.context.active_object.data.materials.append(clay)
    bpy.ops.mesh.primitive_cone_add(radius1=0.01 * s, depth=0.04 * s, location=(x, y, z + 0.06 * s), vertices=10); fl = bpy.context.active_object; fl.data.materials.append(flame)
    for f in range(0, 241, 4): fl.scale = (1, 1, 0.8 + 0.35 * rng.random()); fl.keyframe_insert("scale", frame=f)
    l = bpy.data.lights.new("dl", "POINT"); l.energy = 5 * s; l.color = (1.0, 0.58, 0.25); l.shadow_soft_size = 0.02
    o = bpy.data.objects.new("dl", l); o.location = (x, y, z + 0.08 * s); sc.collection.objects.link(o)
for i in range(21): diya(-4 + i * 0.4, 2.1, 1.0, 1.1)
mari = [mat("Marigold", (1.0, 0.45, 0.02), 0.7)[0], mat("Marigold2", (1.0, 0.72, 0.05), 0.7)[0]]
for k in range(3):
    for i in range(60):
        u = i / 59; x = -4.4 + 8.8 * u; sag = 0.18 * math.sin(math.pi * ((u * 3) % 1))
        bpy.ops.mesh.primitive_ico_sphere_add(radius=0.035, subdivisions=1, location=(x, 2.02, 0.93 - sag - 0.01 * k))
        bpy.context.active_object.data.materials.append(mari[(i + k) % 2])
# rangoli on the floor in front of Avir (procedural mandala texture)
from PIL import Image
R = 1024; yy, xx = np.mgrid[-1:1:R * 1j, -1:1:R * 1j]; r = np.hypot(xx, yy); th = np.arctan2(yy, xx)
cols = np.array([[0.95, 0.2, 0.35], [1.0, 0.65, 0.05], [0.1, 0.55, 0.95], [0.2, 0.75, 0.3], [0.85, 0.3, 0.9], [1.0, 0.95, 0.85]])
band = np.clip((r * 7).astype(int), 0, 6); petal = (np.cos(th * (8 + 4 * (band % 3))) * 0.5 + 0.5) > (0.35 + 0.1 * (band % 2))
img = cols[(band + petal) % len(cols)] * (r < 0.98)[..., None]; img[r >= 0.98] = 0.13
Image.fromarray((img * 255).astype(np.uint8)).save(OUT / "rangoli.png")
rm = bpy.data.materials.new("Rangoli"); rm.use_nodes = True; tx = rm.node_tree.nodes.new("ShaderNodeTexImage"); tx.image = bpy.data.images.load(str(OUT / "rangoli.png"))
rm.node_tree.links.new(tx.outputs["Color"], rm.node_tree.nodes["Principled BSDF"].inputs["Base Color"]); rm.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.9
bpy.ops.mesh.primitive_plane_add(size=1.5, location=(0.15, -0.95, 0.003)); bpy.context.active_object.data.materials.append(rm)
for k in range(8):
    ang = k / 8 * 2 * math.pi; diya(0.15 + 0.82 * math.cos(ang), -0.95 + 0.82 * math.sin(ang), 0.0, 1.3)
# hanging star lanterns (kandil) and string lights
lant = [mat("Lan1", (1.0, 0.3, 0.05), 0.5, emit=3, ecol=(1.0, 0.25, 0.03))[0], mat("Lan2", (1.0, 0.6, 0.05), 0.5, emit=3, ecol=(1.0, 0.5, 0.02))[0], mat("Lan3", (0.95, 0.15, 0.4), 0.5, emit=3, ecol=(0.95, 0.1, 0.35))[0]]
for i, (x, z) in enumerate(((-2.3, 2.6), (2.4, 2.75), (-3.6, 2.9), (3.5, 2.5))):
    bpy.ops.mesh.primitive_ico_sphere_add(radius=0.22, subdivisions=1, location=(x, 2.6, z)); bpy.context.active_object.data.materials.append(lant[i % 3])
    l = bpy.data.lights.new("lan", "POINT"); l.energy = 40; l.color = (1.0, 0.6, 0.3); o = bpy.data.objects.new("lan", l); o.location = (x, 2.4, z); sc.collection.objects.link(o)
for k in range(2):
    for i in range(34):
        u = i / 33; x = -5 + 10 * u; z = 3.4 + 0.5 * k - 0.6 * math.sin(math.pi * u)
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.03, location=(x, 3.4 + k, z), segments=8, ring_count=6)
        bpy.context.active_object.data.materials.append(mat(f"b{k}{i}", [(1, .75, .35), (1, .5, .25), (1, .9, .6)][(i + k) % 3], emit=30)[0])
# fireworks with falling trails
def burst(cx, cz, t0, col, n=80, rad=2.6, y=18):
    m, b = mat(f"fw{t0}", col, emit=0.0)
    for f, s in ((t0 - 1, 0.0), (t0, 90.0), (t0 + 12, 40.0), (t0 + 30, 0.0)):
        b.inputs["Emission Strength"].default_value = s; b.inputs["Emission Strength"].keyframe_insert("default_value", frame=f)
    for i in range(n):
        th_ = rng.uniform(0, 2 * math.pi); ph = math.acos(rng.uniform(-1, 1))
        d = Vector((math.sin(ph) * math.cos(th_), 0.25 * math.sin(ph) * math.sin(th_), math.cos(ph)))
        bpy.ops.mesh.primitive_cylinder_add(radius=0.022, depth=0.5, vertices=6, location=(cx, y, cz)); s_ = bpy.context.active_object; s_.data.materials.append(m)
        s_.rotation_euler = d.to_track_quat("Z", "Y").to_euler()
        for f, k in ((t0, 0.05), (t0 + 10, 0.75), (t0 + 30, 1.0)):
            s_.location = Vector((cx, y, cz)) + d * rad * k + Vector((0, 0, -0.9 * k * k)); s_.keyframe_insert("location", frame=f)
        s_.scale = (1, 1, 0.1); s_.keyframe_insert("scale", frame=t0); s_.scale = (1, 1, 1.4); s_.keyframe_insert("scale", frame=t0 + 12)
        s_.scale = (1, 1, 0.3); s_.keyframe_insert("scale", frame=t0 + 30)
for cx, cz, t0, col in ((-4, 9, 10, (1, .75, .3)), (4.5, 10.5, 40, (1, .35, .55)), (-1, 12, 72, (.4, .8, 1)), (3, 8.5, 104, (1, .85, .4)),
                        (-4.5, 11, 130, (.6, 1, .5)), (1.5, 11.5, 150, (1, .5, .25)), (-2, 9.5, 172, (1, .3, .4)), (4, 12, 192, (.8, .6, 1)),
                        (0, 10, 212, (1, .8, .35))):
    burst(cx, cz, t0, col)

# lights: warm diya glow from below-front, soft moon rim, fill
def area(name, loc, target, energy, color, size):
    l = bpy.data.lights.new(name, "AREA"); l.energy = energy; l.color = color; l.size = size
    o = bpy.data.objects.new(name, l); o.location = loc; sc.collection.objects.link(o)
    o.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
area("WarmKey", (-1.1, -1.8, 1.2), (0, 0, 1.55), 300, (1.0, 0.62, 0.33), 1.2)
area("Fill", (1.5, -2.4, 1.9), (0, 0, 1.4), 90, (0.95, 0.82, 0.72), 2.2)
area("MoonRim", (1.6, 1.5, 2.8), (0, 0, 1.6), 330, (0.55, 0.72, 1.0), 0.9)

# cameras: medium (wave), wide (dance); hard cut at frame 120
def camera(name, loc, target, lens, fstop):
    cd = bpy.data.cameras.new(name); cd.lens = lens; cd.dof.use_dof = True; cd.dof.aperture_fstop = fstop
    o = bpy.data.objects.new(name, cd); sc.collection.objects.link(o); o.location = loc
    o.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    cd.dof.focus_distance = (Vector(loc) - Vector((0, -0.1, 1.6))).length; return o
c1 = camera("Medium", (0.35, -2.5, 1.62), (0, 0, 1.45), 45, 2.8)
c2 = camera("Wide", (0.5, -4.1, 1.4), (0, 0, 1.2), 32, 5.6)
for (nm, s_), cam in zip((("medium", 0), ("wide", 120)), (c1, c2)):
    mk = sc.timeline_markers.new(nm, frame=s_); mk.camera = cam
for f, x in ((120, 0.5), (239, 0.15)): c2.location.x = x; c2.keyframe_insert("location", frame=f)   # slow lateral drift
sc.camera = c1

sc.render.engine = "CYCLES"; sc.cycles.device = "CPU"; sc.cycles.samples = a.samples; sc.cycles.use_denoising = True
sc.cycles.max_bounces = 6; sc.cycles.diffuse_bounces = 2; sc.cycles.glossy_bounces = 2
sc.render.resolution_x, sc.render.resolution_y = 720, 1280; sc.view_settings.view_transform = "AgX"
sc.render.use_persistent_data = True; sc.render.image_settings.file_format = "PNG"
bpy.ops.wm.save_as_mainfile(filepath=str(OUT / "diwali_avaturn_scene.blend"), compress=True)
if a.stills:
    for f in map(int, a.stills.split(",")):
        sc.frame_set(f); sc.render.filepath = str(OUT / f"still_{f:04d}.png"); bpy.ops.render.render(write_still=True)
if a.frames:
    f0, f1 = map(int, a.frames.split("-")); sc.frame_start, sc.frame_end = f0, f1
    sc.render.filepath = str(OUT / "frames" / "f_"); bpy.ops.render.render(animation=True)
print("done")
