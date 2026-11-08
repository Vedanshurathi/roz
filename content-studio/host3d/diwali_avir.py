#!/usr/bin/env python3
"""10 s Happy Diwali reel with Avir (v2 model): close-up wish with lip-sync, then a medium shot waving.
  python3 -I diwali_avir.py avir.blend <dir with d1.wav + lsd.json> <out_dir> [--frames 0-239] [--stills 60,190]"""
import argparse, json, math, random
from pathlib import Path
import bpy
from mathutils import Vector

ap = argparse.ArgumentParser(); ap.add_argument("blend"); ap.add_argument("voice"); ap.add_argument("out")
ap.add_argument("--frames", default=""); ap.add_argument("--stills", default=""); ap.add_argument("--samples", type=int, default=24)
a = ap.parse_args(); V = Path(a.voice); OUT = Path(a.out); OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=a.blend)
sc = bpy.context.scene; arm = bpy.data.objects["Host"]; FPS = 24; sc.render.fps = FPS
SHOTS = [("close", 0, 132, "Idle"), ("wave", 132, 240, "Wave")]
SPEECH_AT = 10
sc.frame_start, sc.frame_end = 0, 239
rng = random.Random(8)

# body animation
ad = arm.animation_data or arm.animation_data_create(); ad.action = None
for t in list(ad.nla_tracks): ad.nla_tracks.remove(t)
tr = ad.nla_tracks.new()
for name, s, e, act in SHOTS:
    A_ = bpy.data.actions[act]; st = tr.strips.new(f"{name}_{act}", s, A_)
    alen = max(1, A_.frame_range[1] - A_.frame_range[0])
    if act == "Idle": st.repeat = max(1.0, (e - s) / alen)
    st.frame_end = e; st.extrapolation = "HOLD"; st.blend_type = "REPLACE"; st.use_auto_blend = False

# outfit: casual (charcoal overshirt + cream tee), matching the approved reference
outfits = json.loads(arm["outfits"])
for n in {x for v in outfits.values() for x in v}:
    o = bpy.data.objects.get(n)
    if o: o.hide_render = o.hide_viewport = n not in outfits["casual"]

# face: lip-sync + warm smile + blinks
FACE = [o for o in bpy.data.objects if o.type == "MESH" and o.data.shape_keys]
ls = json.load(open(V / "lsd.json"))["frames"]
blinks = {6, 70, 121, 168, 214}
for f in range(240):
    vals = {}
    if SPEECH_AT <= f < SPEECH_AT + len(ls): vals.update(ls[f - SPEECH_AT])
    sm = 0.45 if f >= 132 else 0.3
    vals["mouthSmileLeft"] = max(vals.get("mouthSmileLeft", 0), sm); vals["mouthSmileRight"] = max(vals.get("mouthSmileRight", 0), sm)
    if SPEECH_AT <= f < SPEECH_AT + 8: vals["browInnerUp"] = 0.3; vals["browOuterUpLeft"] = vals["browOuterUpRight"] = 0.25
    if f >= 132: vals["eyeSquintLeft"] = vals["eyeSquintRight"] = 0.2           # smiling eyes while waving
    for b in blinks:
        if abs(f - b) <= 2: vals["eyeBlinkLeft"] = vals["eyeBlinkRight"] = [1.0, 0.85, 0.3][abs(f - b)]
    for o in FACE:
        for k in o.data.shape_keys.key_blocks[1:]:
            k.value = vals.get(k.name, 0.0); k.keyframe_insert("value", frame=f)

# look tweaks from the v2 tests
sb = bpy.data.materials["Skin"].node_tree.nodes["Principled BSDF"]; sb.inputs["Roughness"].default_value = 0.56; sb.inputs["Specular IOR Level"].default_value = 0.3


def emit_mat(name, col, strength):
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree
    for n in list(nt.nodes):
        if n.type != "OUTPUT_MATERIAL": nt.nodes.remove(n)
    e = nt.nodes.new("ShaderNodeEmission"); e.inputs["Color"].default_value = (*col, 1); e.inputs["Strength"].default_value = strength
    nt.links.new(e.outputs[0], nt.nodes["Material Output"].inputs["Surface"]); return m, e


def solid(name, col, rough=0.6):
    m = bpy.data.materials.new(name); m.use_nodes = True; b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*col, 1); b.inputs["Roughness"].default_value = rough; return m


# night set: sky backdrop, terrace floor, low parapet with diyas, string lights
w = bpy.data.worlds.new("night"); w.use_nodes = True; w.node_tree.nodes["Background"].inputs[0].default_value = (0.006, 0.008, 0.02, 1)
w.node_tree.nodes["Background"].inputs[1].default_value = 1.0; sc.world = w
bpy.ops.mesh.primitive_plane_add(size=30, location=(0, 0, 0)); bpy.context.active_object.data.materials.append(solid("Terrace", (0.09, 0.07, 0.06), 0.7))
bpy.ops.mesh.primitive_plane_add(size=60, location=(0, 14, 6), rotation=(math.radians(90), 0, 0))
sky, _ = emit_mat("Sky", (0.02, 0.03, 0.09), 1.0); bpy.context.active_object.data.materials.append(sky)
clay = solid("Clay", (0.42, 0.16, 0.07), 0.8)
flame_m, _ = emit_mat("Flame", (1.0, 0.55, 0.15), 45)


def diya(x, y, z, s=1.0):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.045 * s, location=(x, y, z + 0.02 * s), scale=(1, 1, 0.45)); bpy.context.active_object.data.materials.append(clay)
    bpy.ops.mesh.primitive_cone_add(radius1=0.009 * s, depth=0.035 * s, location=(x, y, z + 0.055 * s)); fl = bpy.context.active_object
    fl.data.materials.append(flame_m)
    for f in range(0, 241, 4):                          # flicker
        fl.scale = (1, 1, 0.85 + 0.3 * rng.random()); fl.keyframe_insert("scale", frame=f)
    l = bpy.data.lights.new("diya", "POINT"); l.energy = 6 * s; l.color = (1.0, 0.6, 0.25); l.shadow_soft_size = 0.02
    o = bpy.data.objects.new("diyaL", l); o.location = (x, y, z + 0.07 * s); sc.collection.objects.link(o)


# parapet in front-left of Avir and behind him, lined with diyas
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 1.6, 0.45), scale=(5, 0.25, 0.9)); bpy.context.active_object.data.materials.append(solid("Parapet", (0.55, 0.47, 0.4), 0.85))
for i in range(13): diya(-2.4 + i * 0.4, 1.6, 0.9, 1.1)
for x, y in ((-0.55, -0.55), (0.6, -0.5), (-0.35, -0.95), (0.4, -1.0)): diya(x, y, 0.0, 1.6)
# string lights (bokeh) across the back
bulb_cols = [(1.0, 0.7, 0.3), (1.0, 0.45, 0.2), (1.0, 0.85, 0.5), (0.9, 0.35, 0.6)]
for k in range(3):
    for i in range(26):
        u = i / 25; x = -4 + 8 * u; z = 2.9 + 0.6 * k - 0.5 * math.sin(math.pi * u); y = 3.5 + k * 1.2
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.035, location=(x, y, z)); m, _ = emit_mat(f"bulb{k}{i}", bulb_cols[(i + k) % 4], 25)
        bpy.context.active_object.data.materials.append(m)


# fireworks: bursts of glowing sparks that expand and fade in the night sky
def burst(cx, cz, t0, col, n=70, r=1.6):
    m, e = emit_mat(f"fw{t0}", col, 0.0)
    for f, sv in ((t0 - 1, 0.0), (t0, 60.0), (t0 + 10, 30.0), (t0 + 26, 0.0)):
        e.inputs["Strength"].default_value = sv; e.inputs["Strength"].keyframe_insert("default_value", frame=f)
    for i in range(n):
        th = rng.uniform(0, 2 * math.pi); ph = math.acos(rng.uniform(-1, 1)); d = Vector((math.sin(ph) * math.cos(th), math.sin(ph) * math.sin(th) * 0.3, math.cos(ph)))
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.05, segments=8, ring_count=4, location=(cx, 12, cz)); s = bpy.context.active_object; s.data.materials.append(m)
        for f, k in ((t0, 0.05), (t0 + 8, 0.75), (t0 + 26, 1.0)):
            s.location = Vector((cx, 12, cz)) + d * r * k + Vector((0, 0, -0.6 * (k ** 2))); s.keyframe_insert("location", frame=f)


for cx, cz, t0, col in ((-2.5, 6.5, 14, (1.0, 0.75, 0.3)), (2.8, 7.2, 52, (1.0, 0.35, 0.55)), (-0.8, 7.8, 96, (0.4, 0.8, 1.0)),
                        (2.0, 6.0, 140, (1.0, 0.85, 0.4)), (-2.6, 7.0, 176, (0.6, 1.0, 0.5)), (0.6, 8.0, 205, (1.0, 0.5, 0.25))):
    burst(cx, cz, t0, col)


# lights: warm diya key from low front, soft cool moon rim, gentle fill
def area(name, loc, target, energy, color, size):
    l = bpy.data.lights.new(name, "AREA"); l.energy = energy; l.color = color; l.size = size
    o = bpy.data.objects.new(name, l); o.location = loc; sc.collection.objects.link(o)
    o.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
area("WarmKey", (-0.9, -1.6, 1.3), (0, 0, 1.65), 260, (1.0, 0.62, 0.32), 1.0)
area("Fill", (1.4, -2.0, 1.8), (0, 0, 1.5), 70, (0.95, 0.8, 0.7), 2.0)
area("MoonRim", (1.4, 1.4, 2.6), (0, 0, 1.7), 260, (0.55, 0.7, 1.0), 0.8)


# cameras (hard cut at frame 132), focus exactly on the eyes
_ev = [v.co for v in bpy.data.objects["EyeLeft"].data.vertices]; ez = sum(c.z for c in _ev) / len(_ev); ey = min(c.y for c in _ev)
hz = arm.data.bones["mixamorig:Head"].head_local.z


def camera(name, loc, target, lens, fstop, focus_pt):
    cd = bpy.data.cameras.new(name); cd.lens = lens; cd.dof.use_dof = True; cd.dof.aperture_fstop = fstop
    o = bpy.data.objects.new(name, cd); sc.collection.objects.link(o); o.location = loc
    o.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    cd.dof.focus_distance = (Vector(loc) - Vector(focus_pt)).length; return o
c1 = camera("Close", (0.2, -1.2, ez + 0.03), (0, ey, ez - 0.05), 85, 4.0, (0, ey, ez))
c2 = camera("Medium", (0.45, -2.9, hz - 0.05), (0, 0, hz - 0.25), 45, 4.0, (0, ey, ez))
for (name, s, *_), cam in zip(SHOTS, (c1, c2)):
    mk = sc.timeline_markers.new(name, frame=s); mk.camera = cam
sc.camera = c1

sc.render.engine = "CYCLES"; sc.cycles.device = "CPU"; sc.cycles.samples = a.samples; sc.cycles.use_denoising = True
sc.cycles.max_bounces = 6; sc.cycles.diffuse_bounces = 2; sc.cycles.glossy_bounces = 2
if hasattr(sc, "cycles_curves"): sc.cycles_curves.shape = "RIBBONS"
sc.render.resolution_x, sc.render.resolution_y = 720, 1280; sc.view_settings.view_transform = "AgX"
sc.render.use_persistent_data = True; sc.render.image_settings.file_format = "PNG"
for mn, col in (("Hair_Strands", (0.016, 0.012, 0.009)), ("Beard_Strands", (0.014, 0.010, 0.008))):
    m = bpy.data.materials.get(mn)
    if m and "Principled BSDF" in m.node_tree.nodes: m.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (*col, 1)
bpy.ops.wm.save_as_mainfile(filepath=str(OUT / "diwali_avir_scene.blend"), compress=True)
if a.stills:
    for f in map(int, a.stills.split(",")):
        sc.frame_set(f); sc.render.filepath = str(OUT / f"still_{f:04d}.png"); bpy.ops.render.render(write_still=True)
if a.frames:
    f0, f1 = map(int, a.frames.split("-")); sc.frame_start, sc.frame_end = f0, f1
    sc.render.filepath = str(OUT / "frames" / "f_"); bpy.ops.render.render(animation=True)
print("done")
