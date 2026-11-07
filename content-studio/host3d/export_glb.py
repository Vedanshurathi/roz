#!/usr/bin/env python3
"""Export the real-time (glTF) version of Avir from avir.blend.  python3 -I export_glb.py avir.blend avir.glb
Strand hair/beard/brows (Cycles curves) cannot go into glTF, so the real-time version uses the sculpted hair shell and
the beard/brow shading painted in the skin texture. Raw imported BVH actions are removed first (only retargeted clips export)."""
import sys
import bpy

src, dst = sys.argv[1], sys.argv[2]
bpy.ops.wm.open_mainfile(filepath=src)
keep = {"Idle", "Talk", "Wave", "Nod", "Explain", "WalkTurn", "Gesture", "Sit"}
for a in list(bpy.data.actions):
    if a.name not in keep:
        bpy.data.actions.remove(a)
for o in bpy.data.objects:
    if o.type == "CURVES":
        o.hide_set(True)
    if o.name.startswith("HairShell"):
        o.hide_set(False)
bpy.ops.export_scene.gltf(filepath=dst, export_format="GLB", export_skins=True, export_morph=True, export_morph_normal=False,
                          export_animations=True, export_animation_mode="ACTIONS", use_visible=True, export_image_format="JPEG",
                          export_jpeg_quality=88, export_extras=True, export_yup=True)
print("exported", dst, sorted(a.name for a in bpy.data.actions))
