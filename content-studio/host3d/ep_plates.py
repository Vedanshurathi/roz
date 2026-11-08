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
a = ap.parse_args(); OUT = Path(a.out); OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=a.studio); sc = bpy.context.scene
FG_PREFIX = ("Desk", "Keyboard", "KeyGlow", "Mouse", "Mug", "Mic", "Monitor")
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

if a.check:   # reference: Avir seated in the room (Cycles), to tune cameras and pose
    with bpy.data.libraries.load(a.check, link=False) as (src, dst):
        dst.objects = list(src.objects); dst.actions = list(src.actions)
    for o in dst.objects:
        if o is not None and o.type != "CAMERA" and o.type != "LIGHT": sc.collection.objects.link(o)
    arm = [o for o in dst.objects if o is not None and o.type == "ARMATURE"][0]
    arm.animation_data_create(); arm.animation_data.action = bpy.data.actions["SitTalkBoth"]; sc.frame_set(60)
    for c in sel:
        sc.camera = bpy.data.objects[f"EP_{c}"]; sc.render.filepath = str(OUT / f"check_{c}.png"); bpy.ops.render.render(write_still=True)
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
    for o in sc.objects:
        if o.type == "MESH": o.is_holdout = False
    sc.render.image_settings.color_mode = "RGB"
print("plates ok")
