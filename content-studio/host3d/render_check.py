#!/usr/bin/env python3
"""Quick CPU (Cycles) check renders of a host .blend.  python3 -I render_check.py file.blend out_prefix [--keys jawOpen=1,...]"""
import argparse, math
import bpy
from mathutils import Vector

ap = argparse.ArgumentParser(); ap.add_argument("blend"); ap.add_argument("out"); ap.add_argument("--keys", default="")
ap.add_argument("--res", type=int, default=640); ap.add_argument("--samples", type=int, default=24)
ap.add_argument("--outfit", default="casual"); ap.add_argument("--pose", default="")
a = ap.parse_args()
bpy.ops.wm.open_mainfile(filepath=a.blend)
sc = bpy.context.scene
import json
if "Host" in bpy.data.objects and "outfits" in bpy.data.objects["Host"]:
    outs = json.loads(bpy.data.objects["Host"]["outfits"]); allp = {n for v in outs.values() for n in v}
    for n in allp:
        if n in bpy.data.objects: bpy.data.objects[n].hide_render = n not in outs[a.outfit]
if "HostAll" in bpy.data.objects:  # stage-1 file: show only body, eyes, teeth, lashes
    o = bpy.data.objects["HostAll"]
    keep = [g.index for g in o.vertex_groups if g.name in ("body",) or g.name.startswith(("helper-l-eye", "helper-r-eye", "helper-upper", "helper-lower", "helper-tongue"))]
    vis = o.vertex_groups.new(name="_vis")
    for v in o.data.vertices:
        if any(g.group in keep for g in v.groups):
            vis.add([v.index], 1, "REPLACE")
    m = o.modifiers.new("vis", "MASK"); m.vertex_group = "_vis"
for kv in filter(None, a.keys.split(",")):
    k, v = kv.split("=")
    for o in sc.objects:
        if o.type == "MESH" and o.data.shape_keys and k in o.data.shape_keys.key_blocks:
            o.data.shape_keys.key_blocks[k].value = float(v)
if a.pose and a.pose in bpy.data.actions and "Host" in bpy.data.objects:
    arm = bpy.data.objects["Host"]; arm.animation_data_create(); arm.animation_data.action = bpy.data.actions[a.pose]
    sc.frame_set(int(bpy.data.actions[a.pose].frame_range[1] // 2))
sc.render.engine = "CYCLES"; sc.cycles.samples = a.samples; sc.cycles.device = "CPU"; sc.cycles.use_denoising = True
sc.render.resolution_x = a.res; sc.render.resolution_y = int(a.res * 1.25)
w = bpy.data.worlds.new("w"); w.use_nodes = True; w.node_tree.nodes["Background"].inputs[0].default_value = (0.03, 0.035, 0.06, 1); sc.world = w
def light(name, loc, energy, color, size=1.0):
    l = bpy.data.lights.new(name, "AREA"); l.energy = energy; l.color = color; l.size = size
    o = bpy.data.objects.new(name, l); o.location = loc; sc.collection.objects.link(o)
    o.rotation_euler = (Vector((0, 0, 1.55)) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
light("key", (-1.2, -1.8, 2.0), 260, (1.0, 0.85, 0.7), 1.2)
light("rim", (1.3, 1.2, 1.9), 220, (0.4, 0.85, 1.0), 0.8)
light("fill", (1.0, -2.2, 1.2), 70, (0.8, 0.85, 1.0), 2.0)
cam_d = bpy.data.cameras.new("cam"); cam = bpy.data.objects.new("cam", cam_d); sc.collection.objects.link(cam); sc.camera = cam
hz = bpy.data.objects["Host"].data.bones["mixamorig:Head"].head_local.z + 0.08 if "Host" in bpy.data.objects else 1.62
for tag, loc, tgt, lens in (("face", (0.16, -0.75, hz + 0.02), (0, 0, hz), 85), ("body", (0.6, -4.2, 1.0), (0, 0, 0.92), 45)):
    cam.location = loc; cam_d.lens = lens
    cam.rotation_euler = (Vector(tgt) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    sc.render.filepath = f"{a.out}_{tag}.png"; bpy.ops.render.render(write_still=True)
print("rendered", a.out)
