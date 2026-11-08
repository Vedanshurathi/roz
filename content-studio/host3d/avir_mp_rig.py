#!/usr/bin/env python3
"""Avir (MetaPerson-style GLB from the owner, 51 ARKit face shapes, 73-joint rig): seated studio gesture clips + black
hair, exported as avir_mp_talk.glb/.blend. Face shapes are the model's own (jawOpen, eyeBlink*, mouth*...).
  python3 -I avir_mp_rig.py model.glb out_dir"""
import argparse, math, json
from pathlib import Path
import bpy
from mathutils import Matrix, Vector, Quaternion

ap = argparse.ArgumentParser(); ap.add_argument("glb"); ap.add_argument("out")
a = ap.parse_args(); OUT = Path(a.out); OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True); bpy.ops.import_scene.gltf(filepath=a.glb)
sc = bpy.context.scene
for o in list(sc.objects):
    if o.name.startswith("Icosphere"): bpy.data.objects.remove(o, do_unlink=True)
arm = [o for o in sc.objects if o.type == "ARMATURE"][0]
if arm.animation_data: arm.animation_data.action = None
for act in list(bpy.data.actions): bpy.data.actions.remove(act)
hm = bpy.data.materials.get("haircut")          # natural black hair (reference)
if hm:
    nt = hm.node_tree; b = nt.nodes.get("Principled BSDF")
    if b and b.inputs["Base Color"].is_linked:
        src = b.inputs["Base Color"].links[0].from_socket; hv = nt.nodes.new("ShaderNodeHueSaturation")
        hv.inputs["Value"].default_value = 0.16; hv.inputs["Saturation"].default_value = 0.5
        nt.links.new(src, hv.inputs["Color"]); nt.links.new(hv.outputs["Color"], b.inputs["Base Color"])
    elif b:
        b.inputs["Base Color"].default_value = (0.02, 0.016, 0.014, 1)

# ---------------- seated gesture library (Mixamo-named bones, world-space aims)
pbs = arm.pose.bones
for pb in pbs: pb.rotation_mode = "QUATERNION"
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
def fingers(curl, spread=0.0, point=False):
    for s in ("Left", "Right"):
        for f in ("Index", "Middle", "Ring", "Pinky"):
            c = 4 if (point and f == "Index" and s == "Right") else curl
            for k in (1, 2, 3): pbs[f"{s}Hand{f}{k}"].rotation_quaternion = Quaternion((1, 0, 0), math.radians(c))
    upd()
def L3(p, q, t): return tuple(p[i] + (q[i] - p[i]) * t for i in range(3))
def ease(t): t = max(0.0, min(1.0, t)); return 0.5 - 0.5 * math.cos(math.pi * t)

# rest arms on the desk; legs bent at 90 degrees for the chair
REST = {"Left": ((0.16, -0.45, -1), (-0.15, -1, 0.02), (-0.05, -1, -0.12)), "Right": ((-0.16, -0.45, -1), (0.15, -1, 0.02), (0.05, -1, -0.12))}
def seated(t, lean=0.0, talk=0.0):
    reset()
    for s, sg in (("Left", 1), ("Right", -1)):
        aim(f"{s}UpLeg", (sg * 0.08, -1, -0.12)); aim(f"{s}Leg", (sg * 0.02, 0.12, -1)); aim(f"{s}Foot", (0, -1, -0.35))
    br = math.sin(t * 2 * math.pi / 4.2)
    turn("Spine", (1, 0, 0), -4 - 6 * lean); turn("Spine1", (1, 0, 0), -1.2 * br - 3 * lean)
    turn("Spine2", (1, 0, 0), -0.8 * br)
    turn("Neck", (1, 0, 0), 4 * lean + 1.5 * math.sin(t * 2.3) * talk)
    turn("Head", (0, 0, 1), 4 * math.sin(t * 0.9) * (0.6 + talk)); turn("Head", (1, 0, 0), 2.5 * math.sin(t * 1.7) * talk + 2 * lean)
    turn("Head", (0, 1, 0), 2 * math.sin(t * 0.7))
def arms(L=None, R=None):
    for s, spec in (("Left", L), ("Right", R)):
        u, f, h = spec or REST[s]; aim(f"{s}Arm", u); aim(f"{s}ForeArm", f); aim(f"{s}Hand", h)
def key_all(f):
    for pb in pbs: pb.keyframe_insert("rotation_quaternion", frame=f)
def clip(name, n, fn, step=3):
    act = bpy.data.actions.new(name); act.use_fake_user = True; arm.animation_data_create(); arm.animation_data.action = act
    for f in range(0, n + 1, step): fn(f / 24.0); key_all(f)
    print("clip", name, n)

EXPLAIN_R = ((-0.3, -0.55, -0.85), (-0.05, -1, 0.45), (-0.05, -0.8, 0.6))
EXPLAIN_L = ((0.3, -0.55, -0.85), (0.05, -1, 0.45), (0.05, -0.8, 0.6))
def sit_idle(t): seated(t, talk=0.3); arms(); fingers(22)
def sit_talk_right(t):
    seated(t, talk=1.0); k = ease(t / 0.5) * (1 - ease((t - 5.3) / 0.6)); g = math.sin(t * 2 * math.pi / 1.4)
    R = tuple(L3(REST["Right"][i], tuple(EXPLAIN_R[i][j] + (0.18 * g if j == 0 and i > 0 else 0) for j in range(3)), k) for i in range(3))
    arms(None, R); fingers(10)
def sit_talk_both(t):
    seated(t, talk=1.0, lean=0.2); k = ease(t / 0.5) * (1 - ease((t - 5.3) / 0.6)); g = 0.22 * math.sin(t * 2 * math.pi / 1.6)
    Lh = tuple(L3(REST["Left"][i], tuple(EXPLAIN_L[i][j] + (g if j == 0 and i > 0 else 0) for j in range(3)), k) for i in range(3))
    Rh = tuple(L3(REST["Right"][i], tuple(EXPLAIN_R[i][j] - (g if j == 0 and i > 0 else 0) for j in range(3)), k) for i in range(3))
    arms(Lh, Rh); fingers(6)
def sit_point(t):     # points at the camera (viewer) — for "subscribe" / "guess karo"
    seated(t, talk=0.8, lean=0.4); k = ease((t - 0.2) / 0.5) * (1 - ease((t - 3.4) / 0.5))
    P = ((-0.25, -0.75, -0.6), (-0.05, -1, 0.15), (-0.02, -1, 0.1))
    arms(None, tuple(L3(REST["Right"][i], P[i], k) for i in range(3))); fingers(70 * k + 20 * (1 - k), point=True)
def sit_lean_secret(t):   # leans in close, finger toward lips — the "classified" moment
    seated(t, talk=0.4, lean=1.0 * ease(t / 0.8)); k = ease((t - 0.5) / 0.6) * (1 - ease((t - 4.4) / 0.5))
    S = ((-0.2, -0.6, -0.75), (0.55, -0.55, 0.62), (0.15, -0.3, 1.0))
    arms(None, tuple(L3(REST["Right"][i], S[i], k) for i in range(3))); fingers(70 * k + 20 * (1 - k), point=True)
def sit_wave(t):
    seated(t, talk=0.6); k = ease(t / 0.5) * (1 - ease((t - 3.2) / 0.5)); w = math.sin(t * 2 * math.pi * 1.5) * k
    U = ((-0.75, -0.2, 0.15), (-0.12 + 0.35 * w, -0.25, 1), (-0.08 + 0.5 * w, -0.25, 1))
    arms(None, tuple(L3(REST["Right"][i], U[i], k) for i in range(3))); fingers(8)
def sit_namaste(t):
    seated(t, talk=0.3, lean=0.3 * ease((t - 1.0) / 0.8) * (1 - ease((t - 2.8) / 0.6))); k = ease(t / 0.6) * (1 - ease((t - 3.4) / 0.5))
    for s, sg in (("Left", 1), ("Right", -1)):
        N = ((sg * 0.3, -0.3, -1.0), (-sg * 0.78, -0.55, 0.32), (-sg * 0.08, -0.3, 1.0))
        u, f, h = (L3(REST[s][i], N[i], k) for i in range(3)); aim(f"{s}Arm", u); aim(f"{s}ForeArm", f); aim(f"{s}Hand", h)
    fingers(5)

clip("SitIdle", 192, sit_idle); clip("SitTalkRight", 144, sit_talk_right); clip("SitTalkBoth", 144, sit_talk_both)
clip("SitPoint", 96, sit_point); clip("SitSecret", 120, sit_lean_secret); clip("SitWave", 96, sit_wave); clip("SitNamaste", 96, sit_namaste)
arm.animation_data.action = None; reset()
hips_z = (arm.matrix_world @ arm.data.bones["Hips"].head_local).z
arm.location = (0, 0.33, 0.62 - hips_z)      # seated on the studio chair (seat top z≈0.54)
bpy.ops.wm.save_as_mainfile(filepath=str(OUT / "avir_mp_talk.blend"), compress=True)
bpy.ops.export_scene.gltf(filepath=str(OUT / "avir_mp_talk.glb"), export_format="GLB", export_skins=True, export_morph=True, export_morph_normal=False,
                          export_animations=True, export_animation_mode="ACTIONS", export_image_format="AUTO", export_extras=True)
print("exported avir_mp_talk.glb")
