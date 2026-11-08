#!/usr/bin/env python3
"""Make the owner's Avaturn Avir talk: adds face shape keys (jawOpen, mouthSmile, eyeBlinkLeft/Right) located from the
skin texture (lips = redder pixels, eyes = bright sclera), plus seated gesture clips for the studio chair. Exports
avir_talk.glb. The Avaturn mesh has sealed lips, so jawOpen drops the jaw and lower lip but there is no inner mouth.
  python3 -I avir_talk_rig.py avaturn.glb out_dir [--test]"""
import argparse, io, math, struct, json
from pathlib import Path
import bpy, bmesh
import numpy as np
from mathutils import Matrix, Vector, Quaternion

ap = argparse.ArgumentParser(); ap.add_argument("glb"); ap.add_argument("out"); ap.add_argument("--test", action="store_true")
a = ap.parse_args(); OUT = Path(a.out); OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True); bpy.ops.import_scene.gltf(filepath=a.glb)
sc = bpy.context.scene
for o in list(sc.objects):
    if o.name.startswith("Icosphere"): bpy.data.objects.remove(o, do_unlink=True)
arm = [o for o in sc.objects if o.type == "ARMATURE"][0]; body = bpy.data.objects["avaturn_body"]
if arm.animation_data: arm.animation_data.action = None
for act in list(bpy.data.actions): bpy.data.actions.remove(act)

# near-black hair (matches the reel/studio look)
for o in sc.objects:
    if o.type == "MESH" and o.name.startswith("avaturn_hair"):
        for m in o.data.materials:
            nt = m.node_tree; b = nt.nodes.get("Principled BSDF")
            if b and b.inputs["Base Color"].is_linked:
                src = b.inputs["Base Color"].links[0].from_socket; hv = nt.nodes.new("ShaderNodeHueSaturation")
                hv.inputs["Value"].default_value = 0.11; hv.inputs["Saturation"].default_value = 0.45
                nt.links.new(src, hv.inputs["Color"]); nt.links.new(hv.outputs["Color"], b.inputs["Base Color"])

# ---------------- locate lips and eyes from the body texture
me = body.data; V = np.array([v.co[:] for v in me.vertices]); W = np.array(body.matrix_world)[:3, :3]; Vw = V @ W.T + np.array(body.matrix_world)[:3, 3]
img = [n for n in body.active_material.node_tree.nodes if n.type == "TEX_IMAGE" and n.image and
       any(l.to_socket.name == "Base Color" for l in n.outputs["Color"].links)][0].image
iw, ih = img.size; px = np.array(img.pixels[:]).reshape(ih, iw, 4)[..., :3]
uv = np.zeros((len(V), 2)); cnt = np.zeros(len(V))
uvl = me.uv_layers.active.data
for li, l in enumerate(me.loops): uv[l.vertex_index] += uvl[li].uv; cnt[l.vertex_index] += 1
uv /= np.maximum(cnt, 1)[:, None]
col = px[np.clip((uv[:, 1] * (ih - 1)).astype(int), 0, ih - 1), np.clip((uv[:, 0] * (iw - 1)).astype(int), 0, iw - 1)]
head_b = arm.data.bones["Head"]; hz = (arm.matrix_world @ head_b.head_local).z
top = Vw[:, 2].max()
face = (Vw[:, 2] > hz - 0.02) & (Vw[:, 2] < top) & (np.abs(Vw[:, 0]) < 0.08)
fy = Vw[face, 1].min()
front = face & (Vw[:, 1] < fy + 0.035)
red = col[:, 0] - 0.5 * (col[:, 1] + col[:, 2])
lowface = front & (Vw[:, 2] < hz + 0.07) & (np.abs(Vw[:, 0]) < 0.04)
thr = np.percentile(red[lowface], 88); lips = lowface & (red > thr)
mouth = Vw[lips].mean(0); mw = np.ptp(Vw[lips, 0])
mouth[2] -= 0.006                       # red pixels sit on the upper lip/moustache edge; the lip seam is a little lower
bright = col.mean(1)
band = face & (Vw[:, 1] < fy + 0.05) & (Vw[:, 2] > mouth[2] + 0.045) & (Vw[:, 2] < mouth[2] + 0.068)   # below the brows
eyes = {}
for s, sgn in (("Left", 1), ("Right", -1)):
    z = band & (np.sign(Vw[:, 0]) == sgn) & (np.abs(Vw[:, 0]) > 0.018) & (np.abs(Vw[:, 0]) < 0.055)
    t = np.percentile(bright[z], 6); e = z & (bright < t); eyes[s] = Vw[e].mean(0)      # dark iris/pupil
print("mouth", mouth.round(3), "width", round(mw, 3), "eyes", {k: v.round(3) for k, v in eyes.items()}, "head z", round(hz, 3))

def smooth(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t)

# ---------------- shape keys (built in world space, written back in local space)
Winv = np.linalg.inv(np.array(body.matrix_world))
def to_local(P): return (np.c_[P, np.ones(len(P))] @ Winv.T)[:, :3]
body.shape_key_add(name="Basis", from_mix=False)
def add_key(name, Pw):
    k = body.shape_key_add(name=name, from_mix=False); k.data.foreach_set("co", to_local(Pw).astype(np.float32).ravel()); k.value = 0.0
# jawOpen: rotate the lower face about a pivot near the ear line
piv = np.array([0, mouth[1] + 0.085, mouth[2] + 0.03]); ang = math.radians(13)
wz = 1 - smooth(mouth[2] - 0.010, mouth[2] - 0.001, Vw[:, 2])             # below the lip line
wz *= smooth(mouth[2] - 0.095, mouth[2] - 0.06, Vw[:, 2])                  # fade out down the neck
wx = 1 - smooth(0.055, 0.085, np.abs(Vw[:, 0])); wy = 1 - smooth(piv[1] - 0.01, piv[1] + 0.03, Vw[:, 1])
w = wz * wx * wy * (Vw[:, 2] > hz - 0.15)
rel = Vw - piv; c, s_ = math.cos(ang), math.sin(ang)
rot = np.stack([rel[:, 0], rel[:, 1] * c - rel[:, 2] * s_, rel[:, 1] * s_ + rel[:, 2] * c], 1) + piv
add_key("jawOpen", Vw + (rot - Vw) * w[:, None])
# mouthSmile: lift and widen the corners
cw = mw / 2
for side, sg in (("", 0),):
    d = np.hypot((np.abs(Vw[:, 0]) - cw) / 0.018, (Vw[:, 2] - mouth[2]) / 0.014)
    ws = np.exp(-d ** 2) * front.astype(float) * (np.abs(Vw[:, 0]) > 0.006) * (Vw[:, 2] < mouth[2] + 0.004)
    off = np.stack([np.sign(Vw[:, 0]) * 0.004, np.full(len(Vw), 0.001), np.full(len(Vw), 0.005)], 1)
    add_key("mouthSmile", Vw + off * ws[:, None])
# blinks: collapse each eye opening toward a lid line just below the eye centre
for s, e in eyes.items():
    dx = (Vw[:, 0] - e[0]) / 0.019; dz = (Vw[:, 2] - e[2]) / 0.0125
    wb = np.exp(-(dx ** 2 + dz ** 2) ** 2) * (Vw[:, 1] < e[1] + 0.02)
    tgt = e[2] - 0.0015; P = Vw.copy()
    P[:, 2] = Vw[:, 2] + (tgt - Vw[:, 2]) * wb * np.where(Vw[:, 2] > tgt, 0.95, 0.5)
    P[:, 1] = Vw[:, 1] - 0.0012 * wb
    add_key(f"eyeBlink{s}", P)

if a.test:
    json.dump({"mouth": mouth.tolist(), "eyes": {k: v.tolist() for k, v in eyes.items()}}, open(OUT / "face_landmarks.json", "w"))

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
arm.location = (0, 0.33, -0.36)       # seated on the studio chair (seat top z≈0.54, back at y≈0.7)
arm["face_controls"] = json.dumps(["jawOpen", "mouthSmile", "eyeBlinkLeft", "eyeBlinkRight"])
bpy.ops.wm.save_as_mainfile(filepath=str(OUT / "avir_talk.blend"), compress=True)
bpy.ops.export_scene.gltf(filepath=str(OUT / "avir_talk.glb"), export_format="GLB", export_skins=True, export_morph=True, export_morph_normal=False,
                          export_animations=True, export_animation_mode="ACTIONS", export_image_format="AUTO", export_extras=True)
print("exported avir_talk.glb")
