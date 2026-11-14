#!/usr/bin/env python3
"""Plates for Avir *inside the villa*: per camera a background plate (scene without the foreground props) and a
foreground plate (only the props between camera and Avir, alpha), plus cams.json in Avir's own frame.

Avir (three.js) always sits at the studio pose: hips at S0 = (0, 0.33, 0.62), facing -Y (Blender axes). A seat anchor in
the villa is (hips position, facing angle). Each villa camera is converted into Avir's frame
(P = S0 + R(-theta) (W - A)), so the same AvirLayer code renders him sitting on that sofa with matching perspective.

  python3 -I villa_plates.py <out_dir> [--res 1920] [--samples 48] [--cams jho_wide,jho_close,liv_wide,liv_close]
"""
import json, math, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
args = sys.argv[1:]; OUTP = Path(args[0]); OUTP.mkdir(parents=True, exist_ok=True)
def opt(k, d):
    return args[args.index(k) + 1] if k in args else d
RES = int(opt("--res", "1920")); SAMPLES = int(opt("--samples", "48")); SEL = opt("--cams", "")

# build the villa without rendering (luxury_villa.py reads its options after "--")
sys.argv = ["luxury_villa.py", "--", str(OUTP / "_build"), "--no-render"]
ns = {"__file__": str(HERE / "luxury_villa.py"), "__name__": "__villa__"}
exec(open(HERE / "luxury_villa.py").read(), ns)
bpy = ns["bpy"]; Vector = ns["Vector"]; sc = bpy.context.scene

S0 = Vector((0.0, 0.33, 0.62))
ANCHORS = {   # name: (hips position in the villa, facing angle: +pi/2 = facing +x)
    "jho": (Vector((15.6, 20.32, 0.70)), math.pi),           # on the jhoola (deck swing), facing the pool; the lit house is behind him
    "liv": (Vector((8.33, 16.77, 0.52)), math.pi / 2),       # living-room L-sofa, facing the fireplace wall
}
CAMS = {   # name: (anchor, location, target, lens, fg name prefixes, exposure)
    "jho_wide": ("jho", (15.95, 23.75, 1.32), (15.6, 20.3, 1.2), 26, (), 0.3),
    "jho_close": ("jho", (15.78, 22.05, 1.36), (15.6, 20.34, 1.32), 42, (), 0.3),
    "liv_wide": ("liv", (11.25, 14.15, 1.4), (8.45, 16.95, 1.05), 22, ("CoffeeA", "CoffeeB", "CoffeeVase", "CoffeeBowl", "CoffeeBooks"), -0.6),
    "liv_close": ("liv", (10.05, 16.05, 1.32), (8.38, 16.8, 1.22), 40, (), -0.6),
}


def to_avir(w, anchor):
    a, th = ANCHORS[anchor]; d = Vector(w) - a; c, s = math.cos(-th), math.sin(-th)
    p = S0 + Vector((c * d.x - s * d.y, s * d.x + c * d.y, d.z)); return p


out = {}
for name, (anc, loc, tgt, lens, fgp, expo) in CAMS.items():
    cd = bpy.data.cameras.new("VP_" + name); cd.lens = lens; cd.sensor_width = 36; cd.sensor_fit = "HORIZONTAL"; cd.clip_start = 0.05
    cd.dof.use_dof = True; cd.dof.aperture_fstop = 2.8 if "close" in name else 4.0; cd.dof.focus_distance = (Vector(loc) - (ANCHORS[anc][0] + Vector((0, 0, 0.7)))).length
    o = bpy.data.objects.new("VP_" + name, cd); sc.collection.objects.link(o); o.location = loc
    o.rotation_euler = (Vector(tgt) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    hfov = 2 * math.atan(18 / lens); vfov = 2 * math.atan(math.tan(hfov / 2) * 9 / 16)
    p, t = to_avir(loc, anc), to_avir(tgt, anc)
    out[name] = {"pos": [p.x, p.z, -p.y], "target": [t.x, t.z, -t.y], "vfov_deg": math.degrees(vfov), "anchor": anc, "exposure": expo}
json.dump(out, open(OUTP / "cams.json", "w"), indent=1)

sc.render.engine = "CYCLES"; sc.cycles.samples = SAMPLES; sc.render.resolution_x = RES; sc.render.resolution_y = RES * 9 // 16
for c in ns["COLL"].values(): c.hide_render = False
sel = SEL.split(",") if SEL else list(CAMS)
import time
for name in sel:
    anc, loc, tgt, lens, fgp, expo = CAMS[name]; t0 = time.time()
    sc.camera = bpy.data.objects["VP_" + name]; sc.view_settings.exposure = expo
    fg = [o for o in sc.objects if o.type == "MESH" and o.name.startswith(fgp)] if fgp else []
    for o in fg: o.hide_render = True
    sc.render.film_transparent = False; sc.render.image_settings.color_mode = "RGB"; sc.render.filepath = str(OUTP / f"bg_{name}.png"); bpy.ops.render.render(write_still=True)
    if fg:
        for o in sc.objects:
            if o.type == "MESH": o.is_holdout = o not in fg
        for o in fg: o.hide_render = False
        sc.render.film_transparent = True; sc.render.image_settings.color_mode = "RGBA"; sc.render.filepath = str(OUTP / f"fg_{name}.png"); bpy.ops.render.render(write_still=True)
        for o in sc.objects:
            if o.type == "MESH": o.is_holdout = False
    else:
        from PIL import Image
        Image.new("RGBA", (RES, RES * 9 // 16), (0, 0, 0, 0)).save(OUTP / f"fg_{name}.png")
    print("plate", name, round(time.time() - t0), "s", flush=True)
print("villa plates ok")
