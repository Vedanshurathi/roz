#!/usr/bin/env python3
"""Avir v2 test scene: close-up speech, medium gesture, full-body walk + turn, outfit changes. Cycles (CPU).

  python3 -I render_test.py avir.blend <voice_dir> <out_dir> [--frames 0-329] [--stills 40,160,280] [--res 720] [--samples 20]
voice_dir must contain l1.wav l2.wav l3.wav and ls1.json ls2.json ls3.json (from lipsync.py).
"""
import argparse, json, math
from pathlib import Path
import bpy
from mathutils import Vector

ap = argparse.ArgumentParser(); ap.add_argument("blend"); ap.add_argument("voice"); ap.add_argument("out")
ap.add_argument("--frames", default=""); ap.add_argument("--stills", default=""); ap.add_argument("--res", type=int, default=720)
ap.add_argument("--samples", type=int, default=20)
a = ap.parse_args()
V = Path(a.voice); OUT = Path(a.out); OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=a.blend)
sc = bpy.context.scene; arm = bpy.data.objects["Host"]
FPS = 24; sc.render.fps = FPS
SHOTS = [  # name, start, end, outfit, action, speech (file, offset frames)
    ("close", 0, 110, "casual", "Idle", ("1", 8)),
    ("gesture", 110, 220, "hoodie", "Gesture", ("2", 10)),
    ("walk", 220, 330, "shirt", "WalkTurn", ("3", 84)),
]
sc.frame_start, sc.frame_end = 0, SHOTS[-1][2] - 1

# ---------------- body animation per shot (NLA strips, hard cuts)
ad = arm.animation_data or arm.animation_data_create(); ad.action = None
for t in list(ad.nla_tracks): ad.nla_tracks.remove(t)
tr = ad.nla_tracks.new()
for name, s, e, outfit, act, _ in SHOTS:
    A_ = bpy.data.actions[act]; st = tr.strips.new(f"{name}_{act}", s, A_)
    alen = A_.frame_range[1] - A_.frame_range[0]
    st.action_frame_start, st.action_frame_end = A_.frame_range[0], A_.frame_range[1]
    if act == "Idle": st.repeat = max(1.0, (e - s) / max(alen, 1))
    elif act in ("Gesture", "WalkTurn"):   # mocap clips were keyed at 24 fps, one key per frame
        st.scale = 1.0
    st.frame_end = e; st.extrapolation = "HOLD"; st.blend_type = "REPLACE"
    st.use_auto_blend = False

# ---------------- outfits per shot
outfits = json.loads(arm["outfits"]); allp = sorted({n for v in outfits.values() for n in v})
for name, s, e, outfit, *_ in SHOTS:
    for n in allp:
        o = bpy.data.objects.get(n)
        if not o: continue
        o.hide_render = n not in outfits[outfit]; o.keyframe_insert("hide_render", frame=s)
        o.hide_viewport = o.hide_render; o.keyframe_insert("hide_viewport", frame=s)

# ---------------- face: lip-sync, blinks, mood
FACE_OBJS = [o for o in bpy.data.objects if o.type == "MESH" and o.data.shape_keys]
def setk(f, vals):
    for o in FACE_OBJS:
        kb = o.data.shape_keys.key_blocks
        for k in kb[1:]:
            k.value = vals.get(k.name, 0.0); k.keyframe_insert("value", frame=f)
speech = {}
for name, s, e, outfit, act, (li, off) in SHOTS:
    d = json.load(open(V / f"ls{li}.json")); speech[name] = (s + off, d["frames"])
blink_frames = {12, 58, 101, 146, 190, 236, 268, 312}
for f in range(sc.frame_start, sc.frame_end + 1):
    vals = {}
    shot = next(x for x in SHOTS if x[1] <= f < x[2])
    st, fr = speech[shot[0]]
    if st <= f < st + len(fr):
        vals.update(fr[f - st])
        if (f - st) < 6: vals["browInnerUp"] = 0.25; vals["browOuterUpLeft"] = vals["browOuterUpRight"] = 0.2
    smile = 0.28 if shot[0] != "walk" or f > 300 else 0.12
    vals["mouthSmileLeft"] = max(vals.get("mouthSmileLeft", 0), smile); vals["mouthSmileRight"] = max(vals.get("mouthSmileRight", 0), smile)
    for b in blink_frames:
        if abs(f - b) <= 2: vals["eyeBlinkLeft"] = vals["eyeBlinkRight"] = [1.0, 0.85, 0.3][abs(f - b)]
    setk(f, vals)

# ---------------- set + lights
def mat(name, col, rough=0.6, emit=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True; b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*col, 1); b.inputs["Roughness"].default_value = rough
    if emit: b.inputs["Emission Color"].default_value = (*col, 1); b.inputs["Emission Strength"].default_value = emit
    return m
bpy.ops.mesh.primitive_plane_add(size=40, location=(0, 0, 0)); fl = bpy.context.active_object; fl.data.materials.append(mat("Floor", (0.16, 0.12, 0.10), 0.45))
bpy.ops.mesh.primitive_plane_add(size=40, location=(0, 3.2, 0), rotation=(math.radians(90), 0, 0)); wl = bpy.context.active_object
wl.data.materials.append(mat("Wall", (0.13, 0.12, 0.14), 0.9))
for i, (x, z, c) in enumerate([(-1.6, 2.3, (1.0, 0.62, 0.3)), (1.9, 1.7, (0.3, 0.7, 1.0)), (-2.4, 1.2, (1.0, 0.5, 0.25)), (2.6, 2.6, (1.0, 0.75, 0.45)), (0.4, 2.9, (0.9, 0.6, 1.0))]):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.07, location=(x, 3.0, z)); bpy.context.active_object.data.materials.append(mat(f"Bulb{i}", c, 0.5, 18))
w = bpy.data.worlds.new("w"); w.use_nodes = True; w.node_tree.nodes["Background"].inputs[0].default_value = (0.012, 0.012, 0.018, 1); sc.world = w
def area(name, loc, target, energy, color, size):
    l = bpy.data.lights.new(name, "AREA"); l.energy = energy; l.color = color; l.size = size
    o = bpy.data.objects.new(name, l); o.location = loc; sc.collection.objects.link(o)
    o.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler(); return o
area("Key", (-1.4, -2.0, 2.6), (0, 0, 1.6), 520, (1.0, 0.86, 0.72), 1.6)
area("Fill", (1.8, -2.2, 1.4), (0, 0, 1.4), 120, (0.8, 0.88, 1.0), 2.5)
area("Rim", (1.5, 1.6, 2.4), (0, 0, 1.6), 300, (0.55, 0.8, 1.0), 0.8)
area("HairTop", (-0.4, 1.0, 3.2), (0, 0, 1.8), 120, (1.0, 0.92, 0.85), 1.0)

# ---------------- cameras (bound with markers, hard cuts)
def camera(name, loc, target, lens, fstop, focus_obj=None):
    cd = bpy.data.cameras.new(name); cd.lens = lens; cd.dof.use_dof = True; cd.dof.aperture_fstop = fstop
    o = bpy.data.objects.new(name, cd); sc.collection.objects.link(o); o.location = loc
    o.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    cd.dof.focus_distance = (Vector(target) - Vector(loc)).length
    return o
hz = arm.data.bones["mixamorig:Head"].head_local.z
_ev = [v.co for v in bpy.data.objects["EyeLeft"].data.vertices]
eye_z = sum(c.z for c in _ev) / len(_ev)
eye_y = min(c.y for c in _ev)
print("eye", round(eye_z, 3), round(eye_y, 3))
foc = bpy.data.objects.new("EyeFocus", None); sc.collection.objects.link(foc)
foc.parent = arm; foc.parent_type = "BONE"; foc.parent_bone = "mixamorig:Head"
bpy.context.view_layer.update(); foc.matrix_world = __import__("mathutils").Matrix.Translation((0, eye_y, eye_z))
c1 = camera("CamClose", (0.16, -1.15, eye_z + 0.02), (0, eye_y, eye_z - 0.04), 85, 5.6)
c2 = camera("CamMedium", (0.35, -2.35, hz - 0.15), (0, 0, hz - 0.3), 50, 4.0)
c3 = camera("CamWalk", (0.0, -4.3, 1.2), (0, 0, 1.0), 40, 5.6)
cl = c3.constraints.new("COPY_LOCATION"); cl.target = arm; cl.subtarget = "mixamorig:Hips"; cl.use_z = False; cl.use_offset = True
_eye = Vector((0, eye_y, eye_z))
for cam in (c1, c2):
    cam.data.dof.focus_distance = (cam.location - _eye).length - 0.01   # focus exactly on the eyes
c3.data.dof.focus_object = arm; c3.data.dof.focus_subtarget = "mixamorig:Spine2"
# strand colour: explicit dark brown-black (direct colouring is predictable across Blender versions)
for mn, col in (("Hair_Strands", (0.018, 0.012, 0.009)), ("Beard_Strands", (0.014, 0.010, 0.008))):
    m = bpy.data.materials.get(mn)
    if m:
        for n in m.node_tree.nodes:
            if n.type == "BSDF_HAIR_PRINCIPLED":
                n.parametrization = "COLOR"; n.inputs["Color"].default_value = (*col, 1)
for (name, s, *_), cam in zip(SHOTS, (c1, c2, c3)):
    m = sc.timeline_markers.new(name, frame=s); m.camera = cam
sc.camera = c1

# ---------------- render settings
sc.render.engine = "CYCLES"; sc.cycles.device = "CPU"; sc.cycles.samples = a.samples; sc.cycles.use_denoising = True
sc.cycles.max_bounces = 6; sc.cycles.diffuse_bounces = 2; sc.cycles.glossy_bounces = 2; sc.cycles.transparent_max_bounces = 8
if hasattr(sc, "cycles_curves"): sc.cycles_curves.shape = "RIBBONS"
sc.render.resolution_x = a.res; sc.render.resolution_y = int(a.res * 16 / 9); sc.render.film_transparent = False
sc.view_settings.view_transform = "AgX"; sc.view_settings.look = "AgX - Medium High Contrast" if "AgX - Medium High Contrast" in [i.identifier for i in sc.view_settings.bl_rna.properties["look"].enum_items] else "None"
sc.render.use_persistent_data = True
sc.render.image_settings.file_format = "PNG"

# foot contacts for footstep sounds (walk shot)
steps = []
lowest = {}
for f in range(220, 330):
    sc.frame_set(f)
    for s_ in ("Left", "Right"):
        z = (arm.matrix_world @ arm.pose.bones[f"mixamorig:{s_}Foot"].head).z
        lowest.setdefault(s_, []).append((f, z))
for s_, arr in lowest.items():
    zs = [z for _, z in arr]; zmin = min(zs)
    for i in range(1, len(arr) - 1):
        if arr[i][1] < zmin + 0.025 and arr[i - 1][1] >= zmin + 0.025: steps.append(arr[i][0])
json.dump({"fps": FPS, "frames": sc.frame_end + 1, "speech": {k: v[0] for k, v in speech.items()}, "steps": sorted(steps)}, open(OUT / "timing.json", "w"))
bpy.ops.wm.save_as_mainfile(filepath=str(OUT / "avir_test_scene.blend"), compress=True)

if a.stills:
    for f in map(int, a.stills.split(",")):
        sc.frame_set(f); sc.render.filepath = str(OUT / f"still_{f:04d}.png"); bpy.ops.render.render(write_still=True)
if a.frames:
    f0, f1 = map(int, a.frames.split("-")); sc.frame_start, sc.frame_end = f0, f1
    sc.render.filepath = str(OUT / "frames" / "f_"); bpy.ops.render.render(animation=True)
print("done", OUT)
