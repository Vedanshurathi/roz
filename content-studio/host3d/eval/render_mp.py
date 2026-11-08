import bpy, sys, math
from mathutils import Vector
glb, out = sys.argv[-2], sys.argv[-1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=glb)
sc = bpy.context.scene
import numpy as np
dg = bpy.context.evaluated_depsgraph_get(); pts = []
for o in sc.objects:
    if o.type == "MESH" and o.name.startswith("Icosphere"): o.hide_render = True
for o in [o for o in sc.objects if o.type == "MESH" and not o.hide_render]:
    e = o.evaluated_get(dg); me = e.to_mesh()
    pts += [tuple(e.matrix_world @ v.co) for v in me.vertices]; e.to_mesh_clear()
pts = np.array(pts); lo, hi = pts.min(0), pts.max(0); print("bbox", lo.round(3), hi.round(3))
H = hi[2] - lo[2]; top = hi[2]
# frame the face: head = top ~13% of height for a full body, whole bbox if it is only a head
headh = 0.25 if H > 1.0 else H
eye = top - headh * 0.45; cx = (lo[0] + hi[0]) / 2; fy = lo[1]
print("H", round(H,3), "eye", round(eye,3))
def area(name, loc, energy, color, size):
    l = bpy.data.lights.new(name, "AREA"); l.energy = energy; l.color = color; l.size = size
    o = bpy.data.objects.new(name, l); o.location = loc; sc.collection.objects.link(o)
    o.rotation_euler = (Vector((0, 0, eye)) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
area("Key", (-1.4, -2.0, eye + 0.9), 520, (1.0, 0.86, 0.72), 1.6)
area("Fill", (1.8, -2.2, eye - 0.2), 120, (0.8, 0.88, 1.0), 2.5)
area("Rim", (1.5, 1.6, eye + 0.7), 300, (0.55, 0.8, 1.0), 0.8)
# glTF is +Y forward-facing after import? detect face direction: Blender import converts glTF +Z forward to -Y
cd = bpy.data.cameras.new("c"); cd.lens = 85; cam = bpy.data.objects.new("c", cd); sc.collection.objects.link(cam); sc.camera = cam
d = headh * 4.2
cam.location = (cx + d * 0.14, fy - d, eye + headh * 0.05)
cam.rotation_euler = (Vector((cx, fy + headh * 0.3, eye - headh * 0.12)) - cam.location).to_track_quat("-Z", "Y").to_euler()
w = bpy.data.worlds.new("w"); w.use_nodes = True; w.node_tree.nodes["Background"].inputs[0].default_value = (0.35, 0.33, 0.36, 1); sc.world = w
sc.render.engine = "CYCLES"; sc.cycles.samples = 24; sc.cycles.use_denoising = True
sc.render.resolution_x, sc.render.resolution_y = 720, 1280; sc.view_settings.view_transform = "AgX"
sc.render.filepath = out; bpy.ops.render.render(write_still=True)
