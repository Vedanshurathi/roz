#!/usr/bin/env python3
"""Vertical (1080x1920) villa plates for "Avir ka ek din": Avir seated in the bedroom (bed edge), the creator studio
(behind the desk), the living-room sofa and the jhoola. Same method as villa_plates.py (each villa camera converted into
Avir's studio frame), but portrait framing: sensor_fit VERTICAL with a 36 mm sensor height, so vfov = 2 atan(18 / lens).
Writes bg_<name>.png, fg_<name>.png (props between camera and Avir, alpha) and cams.json.

  python3 -I day_plates.py <out_dir> [--w 1080] [--samples 48] [--cams bed_close,studio_med,...]
"""
import json, math, sys, time
from pathlib import Path

HERE = Path(__file__).resolve().parent
args = sys.argv[1:]; OUTP = Path(args[0]); OUTP.mkdir(parents=True, exist_ok=True)
def opt(k, d): return args[args.index(k) + 1] if k in args else d
WID = int(opt("--w", "1080")); HGT = WID * 16 // 9; SAMPLES = int(opt("--samples", "48")); SEL = opt("--cams", "")

sys.argv = ["luxury_villa.py", "--", str(OUTP / "_build"), "--no-render"]
ns = {"__file__": str(HERE / "luxury_villa.py"), "__name__": "__villa__"}
exec(open(HERE / "luxury_villa.py").read(), ns)
bpy = ns["bpy"]; Vector = ns["Vector"]; sc = bpy.context.scene

S0 = Vector((0.0, 0.33, 0.62))
ANCHORS = {   # hips position in the villa, facing angle (0 = facing -y, pi = facing +y, +pi/2 = facing +x)
    "bed": (Vector((18.0, 15.72, 4.72)), math.pi),        # sitting on the foot of the master bed, facing the room
    "studio": (Vector((10.0, 9.17, 4.53)), math.pi),      # presenter chair behind the studio desk, facing the camera
    "liv": (Vector((8.33, 16.77, 0.52)), math.pi / 2),    # living-room L-sofa
    "jho": (Vector((15.6, 20.32, 0.70)), math.pi),        # jhoola on the pool deck
}
STUDIO_FG = ("StudioDesk", "StudioKeyboard", "StudioMouse", "StudioMug", "StudioMonitor")
LIV_FG = ("CoffeeA", "CoffeeB", "CoffeeVase", "CoffeeBowl", "CoffeeBooks")
CAMS = {   # name: (anchor, location, target, lens (vertical 36 mm), fg prefixes, exposure)
    "bed_close": ("bed", (18.25, 17.35, 5.42), (18.0, 15.7, 5.3), 52, (), -0.75),
    "bed_night": ("bed", (18.25, 17.35, 5.42), (18.0, 15.7, 5.3), 52, (), -2.1),
    "studio_close": ("studio", (10.2, 10.95, 5.22), (10.0, 9.15, 5.12), 52, STUDIO_FG, -0.75),
    "studio_med": ("studio", (10.3, 10.9, 5.3), (10.0, 9.2, 4.95), 34, STUDIO_FG, -0.75),
    "liv_close": ("liv", (10.0, 17.0, 1.27), (8.38, 16.8, 1.17), 52, LIV_FG, -0.6),
    "liv_med": ("liv", (10.9, 17.35, 1.32), (8.4, 16.85, 1.08), 32, LIV_FG, -0.6),
    "jho_close": ("jho", (15.75, 21.95, 1.42), (15.6, 20.32, 1.32), 52, (), 0.3),
    "jho_med": ("jho", (16.0, 23.0, 1.36), (15.6, 20.3, 1.2), 32, (), 0.3),
}
HIDE = ("BedBench", "StudioMic")   # Avir's legs go where the bed bench stands; the boom mic floats in the portrait crop


def to_avir(w, anchor):
    a, th = ANCHORS[anchor]; d = Vector(w) - a; c, s = math.cos(-th), math.sin(-th)
    return S0 + Vector((c * d.x - s * d.y, s * d.x + c * d.y, d.z))


out = {}
for name, (anc, loc, tgt, lens, fgp, expo) in CAMS.items():
    cd = bpy.data.cameras.new("DP_" + name); cd.lens = lens; cd.sensor_fit = "VERTICAL"; cd.sensor_height = 36; cd.clip_start = 0.05
    cd.dof.use_dof = True; cd.dof.aperture_fstop = 2.8 if "close" in name or "night" in name else 4.0
    cd.dof.focus_distance = (Vector(loc) - (ANCHORS[anc][0] + Vector((0, 0, 0.7)))).length
    o = bpy.data.objects.new("DP_" + name, cd); sc.collection.objects.link(o); o.location = loc
    o.rotation_euler = (Vector(tgt) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    vfov = 2 * math.atan(18 / lens); p, t = to_avir(loc, anc), to_avir(tgt, anc)
    out[name] = {"pos": [p.x, p.z, -p.y], "target": [t.x, t.z, -t.y], "vfov_deg": math.degrees(vfov), "anchor": anc, "exposure": expo}
json.dump(out, open(OUTP / "cams.json", "w"), indent=1)

sc.render.engine = "CYCLES"; sc.cycles.samples = SAMPLES; sc.render.resolution_x = WID; sc.render.resolution_y = HGT
try: sc.cycles.use_denoising = True
except Exception: pass
for c in ns["COLL"].values(): c.hide_render = False
for o in sc.objects:
    if o.name.startswith(HIDE): o.hide_render = True
for name in (SEL.split(",") if SEL else list(CAMS)):
    if (OUTP / f"bg_{name}.png").exists(): continue
    anc, loc, tgt, lens, fgp, expo = CAMS[name]; t0 = time.time()
    sc.camera = bpy.data.objects["DP_" + name]; sc.view_settings.exposure = expo
    fg = [o for o in sc.objects if o.type == "MESH" and o.name.startswith(fgp)] if fgp else []
    if fg:   # foreground first, so a finished bg_ means the pair is complete
        for o in sc.objects:
            if o.type == "MESH": o.is_holdout = o not in fg
        sc.render.film_transparent = True; sc.render.image_settings.color_mode = "RGBA"; sc.render.filepath = str(OUTP / f"fg_{name}.png"); bpy.ops.render.render(write_still=True)
        for o in sc.objects:
            if o.type == "MESH": o.is_holdout = False
    else:
        from PIL import Image
        Image.new("RGBA", (WID, HGT), (0, 0, 0, 0)).save(OUTP / f"fg_{name}.png")
    for o in fg: o.hide_render = True
    sc.render.film_transparent = False; sc.render.image_settings.color_mode = "RGB"; sc.render.filepath = str(OUTP / f"bg_{name}.png"); bpy.ops.render.render(write_still=True)
    for o in fg: o.hide_render = False
    print("plate", name, round(time.time() - t0), "s", flush=True)
print("day plates ok")
