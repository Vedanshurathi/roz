import bpy, sys, numpy as np
from mathutils import Vector
glb, outp = sys.argv[-2], sys.argv[-1]
bpy.ops.wm.read_factory_settings(use_empty=True); bpy.ops.import_scene.gltf(filepath=glb)
sc = bpy.context.scene; dg = bpy.context.evaluated_depsgraph_get(); pts = []
for o in sc.objects:
    if o.type == "MESH" and o.name.startswith("Icosphere"): o.hide_render = True
for o in [o for o in sc.objects if o.type == "MESH" and not o.hide_render]:
    e = o.evaluated_get(dg); me = e.to_mesh(); pts += [tuple(e.matrix_world @ v.co) for v in me.vertices]; e.to_mesh_clear()
pts = np.array(pts); lo, hi = pts.min(0), pts.max(0); H = hi[2] - lo[2]; cx = (lo[0] + hi[0]) / 2
head = pts[pts[:, 2] > hi[2] - 0.26]; fy = head[:, 1].min(); eye = hi[2] - 0.13
def area(name, loc, tgt, energy, color, size):
    l = bpy.data.lights.new(name, "AREA"); l.energy = energy; l.color = color; l.size = size
    o = bpy.data.objects.new(name, l); o.location = loc; sc.collection.objects.link(o)
    o.rotation_euler = (Vector(tgt) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
area("Key", (-1.4, -2.0, eye + 0.9), (0, 0, eye), 520, (1.0, 0.86, 0.72), 1.6)
area("Fill", (1.8, -2.2, eye - 0.4), (0, 0, eye - 0.5), 160, (0.8, 0.88, 1.0), 2.5)
area("Rim", (1.5, 1.6, eye + 0.7), (0, 0, eye), 300, (0.55, 0.8, 1.0), 0.8)
w = bpy.data.worlds.new("w"); w.use_nodes = True; w.node_tree.nodes["Background"].inputs[0].default_value = (0.35, 0.33, 0.36, 1); sc.world = w
cd = bpy.data.cameras.new("c"); cam = bpy.data.objects.new("c", cd); sc.collection.objects.link(cam); sc.camera = cam
sc.render.engine = "CYCLES"; sc.cycles.samples = 24; sc.cycles.use_denoising = True; sc.view_settings.view_transform = "AgX"
sc.render.resolution_x, sc.render.resolution_y = 720, 1280
for tag, lens, d, tgt, camz in (("face", 85, 1.05, (cx, fy + 0.08, eye - 0.03), eye + 0.01), ("body", 35, 4.2, (cx, 0, lo[2] + H * 0.5), lo[2] + H * 0.55)):
    cd.lens = lens; cam.location = (cx + d * 0.14, fy - d, camz)
    cam.rotation_euler = (Vector(tgt) - cam.location).to_track_quat("-Z", "Y").to_euler()
    sc.render.filepath = f"{outp}_{tag}.png"; bpy.ops.render.render(write_still=True)
print("bbox", lo.round(2), hi.round(2))
