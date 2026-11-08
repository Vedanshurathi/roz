#!/usr/bin/env python3
"""Build the recurring host as a rigged glTF character, from CC0 MakeHuman/MPFB2 *data* (no MPFB code is run).

  python3 -I build_host.py --data <mpfb2>/src/mpfb/data --out <dir>

Produces <out>/host.blend (editable source) and <out>/host.glb (exported character) with:
  * Mixamo-compatible 52-bone skeleton (+ LeftEye/RightEye bones for gaze)
  * ARKit-style facial morph targets (eyeBlinkLeft, jawOpen, mouthSmileLeft, ...) from MakeHuman expression units
  * interchangeable outfits as separate meshes named Outfit_<name>_<part>; body/face/hair always on
  * body animation clips (Idle, Talk, Wave, Nod, Explain)
Identity (face shape, hair, beard) is defined ONLY here, so every video reuses the exact same character.
"""
import argparse, gzip, json, math, os, sys
from pathlib import Path

import bpy
import numpy as np
from mathutils import Matrix, Vector, Quaternion

ap = argparse.ArgumentParser()
ap.add_argument("--data", required=True)
ap.add_argument("--out", required=True)
ap.add_argument("--tex", type=int, default=4096)
ap.add_argument("--stage", default="all")
A = ap.parse_args()
DATA = Path(A.data)
OUT = Path(A.out); OUT.mkdir(parents=True, exist_ok=True)
sys.path.insert(0, str(Path(__file__).parent))

# ---------------------------------------------------------------- identity (edit here only)
RACE = {"caucasian": 0.5, "african": 0.2, "asian": 0.3}          # approximates a South Asian face in MakeHuman's space
MACRO = [  # (target relative to targets/, weight)
    ("macrodetails/universal-male-young-averagemuscle-averageweight.target.gz", 0.72),
    ("macrodetails/universal-male-young-averagemuscle-minweight.target.gz", 0.08),
    ("macrodetails/universal-male-young-maxmuscle-averageweight.target.gz", 0.18),
    ("macrodetails/universal-male-young-maxmuscle-minweight.target.gz", 0.02),
    ("macrodetails/height/male-young-averagemuscle-averageweight-maxheight.target.gz", 0.30),
    ("macrodetails/proportions/male-young-averagemuscle-averageweight-idealproportions.target.gz", 0.70),
] + [(f"macrodetails/{r}-male-young.target.gz", w) for r, w in RACE.items()]
FACE = [  # defined but natural jaw, oval face, slightly deep-set eyes
    ("head/head-oval.target.gz", 0.45), ("chin/chin-prominent-incr.target.gz", 0.25), ("chin/chin-bones-incr.target.gz", 0.35),
    ("chin/chin-width-incr.target.gz", 0.15), ("neck/neck-scale-horiz-incr.target.gz", 0.25),
    ("eyebrows/eyebrows-trans-down.target.gz", 0.25),
]
# ARKit-style morph name -> list of (MakeHuman expression unit, side mask)  side: None | 'L' | 'R'
UNITS = {
    "eyeBlinkLeft": [("eye-left-closure", None)], "eyeBlinkRight": [("eye-right-closure", None)],
    "eyeSquintLeft": [("eye-left-slit", None)], "eyeSquintRight": [("eye-right-slit", None)],
    "eyeWideLeft": [("eye-left-opened-up", None)], "eyeWideRight": [("eye-right-opened-up", None)],
    "browDownLeft": [("eyebrows-left-down", None)], "browDownRight": [("eyebrows-right-down", None)],
    "browInnerUp": [("eyebrows-left-inner-up", None), ("eyebrows-right-inner-up", None)],
    "browOuterUpLeft": [("eyebrows-left-extern-up", None)], "browOuterUpRight": [("eyebrows-right-extern-up", None)],
    "jawOpen": [("mouth-open", None)],
    "mouthSmileLeft": [("mouth-corner-puller", "L")], "mouthSmileRight": [("mouth-corner-puller", "R")],
    "mouthFrownLeft": [("mouth-depression", "L")], "mouthFrownRight": [("mouth-depression", "R")],
    "mouthPucker": [("mouth-pursing", None)], "mouthFunnel": [("mouth-protusion", None)],
    "mouthStretch": [("mouth-retraction", None)], "mouthPress": [("mouth-compression", None)],
    "mouthUpperUp": [("mouth-elevation", None)], "mouthShrugLower": [("mouth-eversion", None)],
    "noseSneerLeft": [("nose-left-elevation", None)], "noseSneerRight": [("nose-right-elevation", None)],
}


def mh2bl(a):  # MakeHuman (x, y-up, z-front, decimetres) -> Blender (x, -z, y, metres)
    a = np.asarray(a, dtype=np.float64)
    return np.stack([a[..., 0], -a[..., 2], a[..., 1]], axis=-1) * 0.1


def read_target(rel):
    idx, d = [], []
    with gzip.open(DATA / "targets" / rel, "rt") as f:
        for line in f:
            p = line.split()
            if len(p) == 4 and not line.startswith("#"):
                idx.append(int(p[0])); d.append([float(x) for x in p[1:]])
    if not idx:
        return np.zeros(0, dtype=np.int64), np.zeros((0, 3))
    return np.array(idx, dtype=np.int64), mh2bl(d)


# ---------------------------------------------------------------- base mesh
def read_obj(path):
    V, VT, F, FT, FG = [], [], [], [], []
    g = "body"
    for line in open(path, encoding="utf-8"):
        if line.startswith("v "):
            V.append([float(x) for x in line.split()[1:4]])
        elif line.startswith("vt "):
            VT.append([float(x) for x in line.split()[1:3]])
        elif line.startswith("g "):
            g = line.split()[1]
        elif line.startswith("f "):
            vs, ts = [], []
            for tok in line.split()[1:]:
                p = tok.split("/")
                vs.append(int(p[0]) - 1); ts.append(int(p[1]) - 1 if len(p) > 1 and p[1] else 0)
            F.append(vs); FT.append(ts); FG.append(g)
    return np.array(V), np.array(VT), F, FT, FG


V0, VT, F, FT, FG = read_obj(DATA / "3dobjs/base.obj")
P = mh2bl(V0)
for rel, w in MACRO + FACE:
    i, d = read_target(rel); P[i] += w * d
groups = {}
for f, g in zip(F, FG):
    groups.setdefault(g, set()).update(f)
body_idx = np.array(sorted(groups["body"]))
P[:, 2] -= P[body_idx, 2].min()


def unit_delta(name):
    tot = np.zeros_like(P)
    for race, w in RACE.items():
        i, d = read_target(f"expression/units/{race}/{name}.target.gz"); tot[i] += w * d
    return tot


bpy.ops.wm.read_factory_settings(use_empty=True)
me = bpy.data.meshes.new("HostMesh")
me.from_pydata(P.tolist(), [], F)
me.update()
uv = me.uv_layers.new(name="UVMap")
uv.data.foreach_set("uv", np.array([VT[t] for ft in FT for t in ft]).ravel())
host = bpy.data.objects.new("HostAll", me)
bpy.context.scene.collection.objects.link(host)
for g, s in groups.items():
    vg = host.vertex_groups.new(name=g); vg.add(sorted(s), 1.0, "REPLACE")

# shape keys
host.shape_key_add(name="Basis", from_mix=False)
xs = P[:, 0]
for morph, parts in UNITS.items():
    dl = np.zeros_like(P)
    for unit, side in parts:
        d = unit_delta(unit)
        if side == "L": d *= np.clip((xs + 0.004) / 0.008, 0, 1)[:, None]      # character's left = +x
        if side == "R": d *= np.clip((-xs + 0.004) / 0.008, 0, 1)[:, None]
        dl += d
    sk = host.shape_key_add(name=morph, from_mix=False)
    sk.data.foreach_set("co", (P + dl).astype(np.float32).ravel())
    sk.value = 0.0

# ---------------------------------------------------------------- skeleton
rig = json.load(open(DATA / "rigs/standard/rig.mixamo.json"))["bones"]
wts = json.load(open(DATA / "rigs/standard/weights.mixamo.json"))["weights"]


def joint(spec):
    if spec["strategy"] == "CUBE":
        return Vector(P[sorted(groups[spec["cube_name"]])].mean(axis=0))
    return Vector(P[spec["vertex_indices"]].mean(axis=0))


arm_data = bpy.data.armatures.new("HostRig")
arm = bpy.data.objects.new("Host", arm_data)
bpy.context.scene.collection.objects.link(arm)
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode="EDIT")
eb = arm_data.edit_bones
for name, b in rig.items():
    e = eb.new(name); e.head = joint(b["head"]); e.tail = joint(b["tail"]); e.roll = b.get("roll", 0.0)
for name, b in rig.items():
    if b.get("parent"):
        eb[name].parent = eb[b["parent"]]; eb[name].use_connect = bool(b.get("use_connect"))
for side, g in (("Left", "joint-l-eye"), ("Right", "joint-r-eye")):
    c = Vector(P[sorted(groups[g])].mean(axis=0))
    e = eb.new(f"{side}Eye"); e.head = c; e.tail = c + Vector((0, -0.025, 0)); e.parent = eb["mixamorig:Head"]
bpy.ops.object.mode_set(mode="OBJECT")
for name, lst in wts.items():
    vg = host.vertex_groups.get(name) or host.vertex_groups.new(name=name)
    for vi, w in lst:
        vg.add([vi], w, "REPLACE")
for side, g in (("Left", "helper-l-eye"), ("Right", "helper-r-eye")):
    ids = sorted(groups[g])
    for vg in host.vertex_groups:
        if vg.name in wts:
            vg.remove(ids)
    host.vertex_groups.new(name=f"{side}Eye").add(ids, 1.0, "REPLACE")
host.parent = arm
mod = host.modifiers.new("Armature", "ARMATURE"); mod.object = arm

exec(open(Path(__file__).parent / "stage2.py", encoding="utf-8").read())
