#!/usr/bin/env python3
"""Original chibi "editor buddy" for the motion-graphics reels (no likeness of any existing mascot): big head, anime eyes,
messy brown hair, orange headphones, charcoal hoodie with an orange play-button badge, denim, white sneakers.
Built from primitives (no rig): pivots for root / head / shoulders, a mouth driven by the voice timeline, blinks, and
per-line gestures (point, wave, cheer, shrug-shake, point at viewer).

  python3 -I chibi_char.py <data.json> <morph.json> <gestures.json|-> <out_dir> [--still 2.3] [--res 720] [--samples 16]
            [--frames a:b] [--step 2] [--save]
Renders RGBA PNGs (transparent background) 720x960 per frame: out_dir/c_%04d.png
gestures.json: [[t0, t1, pose], ...] with pose in rest | point_up | wave | cheer | shrug | point_cam | pump_l | pump_r | think
"""
import json, math, sys, time
from pathlib import Path
import bpy
from mathutils import Vector

a = sys.argv[1:]
def opt(k, d): return a[a.index(k) + 1] if k in a else d
DATA, MORPH, GEST, OUT = json.load(open(a[0])), json.load(open(a[1])), (json.load(open(a[2])) if a[2] != '-' else []), Path(a[3])
OUT.mkdir(parents=True, exist_ok=True)
STILL = float(opt('--still', '-1')); RES = int(opt('--res', '720')); SAMPLES = int(opt('--samples', '16'))
FPS = 24; NF = len(MORPH)

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene; col = sc.collection


def mat(name, rgb, rough=0.5, sss=0.0, emit=0.0, alpha=1.0, coat=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True; b = m.node_tree.nodes['Principled BSDF']
    c = tuple(int(rgb[i:i + 2], 16) / 255 for i in (1, 3, 5)); c = tuple(x ** 2.2 for x in c) + (1,)
    b.inputs['Base Color'].default_value = c; b.inputs['Roughness'].default_value = rough
    if sss: b.inputs['Subsurface Weight'].default_value = sss; b.inputs['Subsurface Radius'].default_value = (0.9, 0.35, 0.2); b.inputs['Subsurface Scale'].default_value = 0.05
    if emit: b.inputs['Emission Color'].default_value = c; b.inputs['Emission Strength'].default_value = emit
    if alpha < 1: b.inputs['Alpha'].default_value = alpha
    if coat: b.inputs['Coat Weight'].default_value = coat
    return m


SKIN = mat('skin', '#F6CBA8', 0.45, sss=0.25); HAIR = mat('hair', '#3A2416', 0.55, coat=0.12); EYE = mat('eye', '#24140F', 0.15, coat=1.0)
IRIS = mat('iris', '#9A4A1C', 0.2, coat=1.0); SHINE = mat('shine', '#FFFFFF', 0.1, emit=3.0); MOUTH = mat('mouth', '#6B1F24', 0.6)
TONGUE = mat('tongue', '#E07A7A', 0.5); BLUSH = mat('blush', '#FF8E8E', 0.6, alpha=0.55); HOOD = mat('hood', '#2B2A30', 0.75)
HOOD2 = mat('hood2', '#232227', 0.8); ORANGE = mat('orange', '#FF6A1A', 0.35, coat=0.4); BLACK = mat('black', '#151517', 0.5)
DENIM = mat('denim', '#34476A', 0.8); WHITE = mat('white', '#F2F0EC', 0.5); SOLE = mat('sole', '#FF7A2F', 0.5)


def empty(name, loc, parent=None):
    o = bpy.data.objects.new(name, None); col.objects.link(o); o.location = loc
    if parent: o.parent = parent
    return o


def prim(kind, name, loc, scale=(1, 1, 1), rot=(0, 0, 0), m=None, parent=None, **kw):
    if kind == 'sph': bpy.ops.mesh.primitive_uv_sphere_add(segments=kw.get('seg', 48), ring_count=kw.get('rings', 24), radius=1)
    elif kind == 'cyl': bpy.ops.mesh.primitive_cylinder_add(vertices=kw.get('v', 40), radius=1, depth=2)
    elif kind == 'tor': bpy.ops.mesh.primitive_torus_add(major_radius=kw.get('R', 1), minor_radius=kw.get('r', 0.1), major_segments=64, minor_segments=20)
    elif kind == 'cube': bpy.ops.mesh.primitive_cube_add(size=2)
    o = bpy.context.active_object; o.name = name
    o.scale = scale; o.rotation_euler = rot
    if parent:
        o.parent = parent; o.location = Vector(loc) - parent.matrix_world.translation
    else: o.location = loc
    if m: o.data.materials.append(m)
    if kind != 'cube':
        for p in o.data.polygons: p.use_smooth = True
    return o


ROOT = empty('root', (0, 0, 0))
HP = empty('headpivot', (0, 0, 1.06), ROOT)       # neck pivot
HC = Vector((0, 0, 1.47))                         # head centre
bpy.context.view_layer.update()
# ---- head ----
prim('sph', 'head', HC, (0.45, 0.43, 0.415), m=SKIN, parent=HP)
for s in (1, -1):
    prim('sph', f'ear{s}', HC + Vector((s * 0.43, 0.02, -0.04)), (0.07, 0.05, 0.085), m=SKIN, parent=HP)
# hair: shell with the face cut out, bangs, crown tufts
hair = prim('sph', 'hairshell', HC + Vector((0, 0.035, 0.05)), (0.475, 0.465, 0.445), m=HAIR, parent=HP)
cut = prim('cube', 'haircut', HC + Vector((0, -0.42, -0.13)), (0.36, 0.3, 0.22), rot=(math.radians(-12), 0, 0)); cut.hide_render = True; cut.hide_viewport = True
bm = hair.modifiers.new('cut', 'BOOLEAN'); bm.operation = 'DIFFERENCE'; bm.object = cut; bm.solver = 'EXACT'
cut.parent = HP; cut.matrix_parent_inverse = HP.matrix_world.inverted()
BANGS = [(-0.31, 0.13, -30, 0.9), (-0.22, 0.08, -18, 1.0), (-0.12, 0.05, -8, 0.85), (-0.03, 0.04, -2, 1.05), (0.07, 0.04, 6, 0.8), (0.16, 0.06, 14, 1.0), (0.25, 0.09, 24, 0.9), (0.33, 0.14, 32, 0.8)]
for i, (x, dy, rz, ln) in enumerate(BANGS):
    y = -0.40 + dy
    prim('sph', f'bang{i}', HC + Vector((x, y, 0.2 - 0.06 * (ln - 0.9))), (0.062, 0.06, 0.15 * ln), rot=(math.radians(-18), math.radians(-rz * 0.6), math.radians(rz * 0.3)), m=HAIR, parent=HP)
for i, (x, y, rx, ry, sz) in enumerate([(0.0, 0.05, -30, 0, 0.2), (0.12, 0.12, -45, 25, 0.16), (-0.13, 0.12, -45, -25, 0.16), (0.0, 0.28, -80, 0, 0.17)]):
    prim('sph', f'tuft{i}', HC + Vector((x, y, 0.41)), (0.06, 0.06, sz), rot=(math.radians(rx), math.radians(ry), 0), m=HAIR, parent=HP)
for s in (1, -1):   # side locks over the ears
    prim('sph', f'side{s}', HC + Vector((s * 0.4, -0.1, -0.02)), (0.07, 0.11, 0.19), rot=(0, math.radians(-s * 8), 0), m=HAIR, parent=HP)
# face
EYES = []
for s in (1, -1):
    x = s * 0.158; ez = HC.z - 0.075; rz = math.radians(-s * 21)
    e = prim('sph', f'eye{s}', (x, -0.37, ez), (0.082, 0.03, 0.112), rot=(0, 0, rz), m=EYE, parent=HP)
    prim('sph', f'iris{s}', (x * 1.02, -0.392, ez - 0.025), (0.06, 0.02, 0.068), rot=(0, 0, rz), m=IRIS, parent=HP)
    prim('sph', f'shineA{s}', (x - 0.028, -0.41, ez + 0.04), (0.02, 0.01, 0.024), m=SHINE, parent=HP)
    prim('sph', f'shineB{s}', (x + 0.025, -0.41, ez - 0.05), (0.012, 0.008, 0.012), m=SHINE, parent=HP)
    prim('sph', f'lash{s}', (x, -0.375, ez + 0.105), (0.092, 0.03, 0.016), rot=(0, math.radians(-s * 8), rz), m=EYE, parent=HP)
    prim('sph', f'brow{s}', (x * 1.05, -0.385, ez + 0.17), (0.05, 0.015, 0.012), rot=(0, math.radians(s * 6), rz), m=HAIR, parent=HP)
    prim('sph', f'blush{s}', (s * 0.255, -0.335, ez - 0.12), (0.06, 0.014, 0.032), rot=(0, 0, math.radians(-s * 38)), m=BLUSH, parent=HP)
    EYES.append(e)
EYEPARTS = [o for o in bpy.data.objects if o.name.startswith(('eye', 'iris', 'shine'))]
for o in EYEPARTS: o['sz'] = o.scale.z
prim('sph', 'nose', (0, -0.425, HC.z - 0.14), (0.016, 0.01, 0.012), m=mat('nose', '#EFAE8C', 0.5), parent=HP)
MOUTHO = prim('sph', 'mouth', (0, -0.393, HC.z - 0.225), (0.052, 0.03, 0.02), m=MOUTH, parent=HP)
TONG = prim('sph', 'tongue', (0, -0.4, HC.z - 0.24), (0.03, 0.02, 0.01), m=TONGUE, parent=HP)
# headphones: band over the hair (upper half of a torus), orange cups at the ears
band = prim('tor', 'band', HC + Vector((0, 0.03, 0.02)), (1.1, 1, 1.08), rot=(math.radians(90), 0, 0), m=BLACK, parent=HP, R=0.47, r=0.032)
bc = prim('cube', 'bandcut', HC + Vector((0, 0.03, -0.42)), (0.7, 0.2, 0.42)); bc.hide_render = True; bc.hide_viewport = True
bm = band.modifiers.new('cut', 'BOOLEAN'); bm.operation = 'DIFFERENCE'; bm.object = bc; bm.solver = 'EXACT'
bc.parent = HP; bc.matrix_parent_inverse = HP.matrix_world.inverted()
for s in (1, -1):
    prim('cyl', f'cup{s}', HC + Vector((s * 0.5, 0.03, -0.02)), (0.12, 0.12, 0.055), rot=(0, math.radians(90), 0), m=ORANGE, parent=HP)
    prim('cyl', f'cush{s}', HC + Vector((s * 0.45, 0.03, -0.02)), (0.105, 0.105, 0.03), rot=(0, math.radians(90), 0), m=BLACK, parent=HP)
    prim('cyl', f'cupcap{s}', HC + Vector((s * 0.557, 0.03, -0.02)), (0.07, 0.07, 0.008), rot=(0, math.radians(90), 0), m=BLACK, parent=HP)
# ---- body ----
prim('cyl', 'neck', (0, 0, 1.03), (0.085, 0.085, 0.07), m=SKIN, parent=ROOT)
prim('sph', 'torso', (0, 0, 0.75), (0.32, 0.26, 0.31), m=HOOD, parent=ROOT)
prim('tor', 'hem', (0, 0, 0.5), (1, 0.82, 1.4), m=HOOD2, parent=ROOT, R=0.24, r=0.05)
prim('tor', 'collar', (0, 0.0, 0.99), (1, 0.9, 1), m=HOOD2, parent=ROOT, R=0.16, r=0.065)
for s in (1, -1):
    prim('cyl', f'string{s}', (s * 0.06, -0.255, 0.86), (0.012, 0.012, 0.085), rot=(math.radians(-8), 0, 0), m=ORANGE, parent=ROOT)
    prim('sph', f'tip{s}', (s * 0.06, -0.265, 0.77), (0.02, 0.02, 0.026), m=ORANGE, parent=ROOT)
prim('sph', 'pocket', (0, -0.235, 0.62), (0.17, 0.05, 0.075), m=HOOD2, parent=ROOT)
badge = prim('cyl', 'badge', (0.15, -0.262, 0.83), (0.055, 0.055, 0.008), rot=(math.radians(90), 0, 0), m=ORANGE, parent=ROOT)
prim('cyl', 'play', (0.153, -0.272, 0.83), (0.026, 0.026, 0.006), rot=(math.radians(90), math.radians(0), math.radians(0)), m=WHITE, parent=ROOT, v=3)
bpy.data.objects['play'].rotation_euler = (math.radians(90), math.radians(90), 0)
prim('sph', 'hips', (0, 0, 0.47), (0.23, 0.19, 0.1), m=DENIM, parent=ROOT)
for s in (1, -1):
    prim('cyl', f'leg{s}', (s * 0.12, 0, 0.32), (0.095, 0.095, 0.17), m=DENIM, parent=ROOT)
    prim('sph', f'shoe{s}', (s * 0.13, -0.06, 0.1), (0.115, 0.17, 0.085), m=WHITE, parent=ROOT)
    prim('sph', f'sole{s}', (s * 0.13, -0.06, 0.035), (0.12, 0.175, 0.03), m=SOLE, parent=ROOT)
ARM = {}
for s in (1, -1):
    P = empty(f'shoulder{s}', (s * 0.3, 0, 0.94), ROOT); bpy.context.view_layer.update()
    prim('sph', f'shcap{s}', (s * 0.3, 0, 0.94), (0.09, 0.09, 0.09), m=HOOD, parent=P)
    prim('cyl', f'sleeve{s}', (s * 0.3, 0, 0.94 - 0.18), (0.075, 0.075, 0.18), m=HOOD, parent=P)
    prim('cyl', f'cuff{s}', (s * 0.3, 0, 0.94 - 0.36), (0.078, 0.078, 0.025), m=ORANGE, parent=P)
    prim('sph', f'hand{s}', (s * 0.3, 0, 0.94 - 0.43), (0.08, 0.075, 0.085), m=SKIN, parent=P)
    prim('sph', f'thumb{s}', (s * 0.3 - s * 0.05, -0.05, 0.94 - 0.41), (0.03, 0.03, 0.04), m=SKIN, parent=P)
    ARM[s] = P
# soft contact shadow catcher
gp = prim('cube', 'ground', (0, 0, -0.005), (3, 3, 0.005)); gp.is_shadow_catcher = True

# ---- lights / camera / render ----
def area(name, loc, tgt, power, size, rgb):
    d = bpy.data.lights.new(name, 'AREA'); d.energy = power; d.size = size; d.color = rgb
    o = bpy.data.objects.new(name, d); col.objects.link(o); o.location = loc
    o.rotation_euler = (Vector(tgt) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
area('key', (-2.2, -3.2, 3.0), (0, 0, 1.1), 420, 2.5, (1.0, 0.92, 0.85))
area('fill', (2.6, -2.8, 1.4), (0, 0, 1.0), 120, 3.0, (0.85, 0.88, 1.0))
area('rimL', (-2.0, 2.2, 2.2), (0, 0, 1.2), 520, 1.5, (1.0, 0.55, 0.25))
area('rimR', (2.0, 2.2, 1.8), (0, 0, 1.1), 520, 1.5, (1.0, 0.5, 0.2))
area('under', (0, -1.5, -0.6), (0, 0, 0.6), 60, 2.0, (1.0, 0.5, 0.25))
w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs['Color'].default_value = (0.05, 0.03, 0.025, 1)
w.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.6
cd = bpy.data.cameras.new('cam'); cd.lens = 70; cd.sensor_fit = 'VERTICAL'; cd.sensor_height = 24
cam = bpy.data.objects.new('cam', cd); col.objects.link(cam); cam.location = (0, -7.2, 1.15)
cam.rotation_euler = (Vector((0, 0, 1.0)) - cam.location).to_track_quat('-Z', 'Y').to_euler(); sc.camera = cam
sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = SAMPLES; sc.cycles.use_denoising = True
try: sc.cycles.denoiser = 'OPENIMAGEDENOISE'
except Exception: pass
sc.render.resolution_x = RES; sc.render.resolution_y = RES * 4 // 3; sc.render.film_transparent = True
sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_mode = 'RGBA'
sc.view_settings.view_transform = 'AgX'; sc.view_settings.look = 'AgX - Medium High Contrast'
sc.render.use_persistent_data = True; sc.cycles.max_bounces = 6

# ---- animation ----
def sm(x): x = max(0.0, min(1.0, x)); return x * x * (3 - 2 * x)
R = math.radians
# pose -> (left(+x) arm (side, fwd), right(-x) arm (side, fwd)) in degrees; side raises sideways, fwd raises toward camera
POSES = {'rest': ((14, 4), (14, 4)), 'point_up': ((150, 25), (14, 4)), 'wave': ((118, 28), (14, 4)), 'cheer': ((150, 10), (150, 10)),
         'shrug': ((55, 30), (55, 30)), 'point_cam': ((25, 85), (14, 4)), 'pump_l': ((120, 20), (14, 4)), 'pump_r': ((14, 4), (120, 20)),
         'think': ((14, 4), (35, 120)), 'talk': ((30, 35), (14, 8))}
def pose_at(t):
    cur = POSES['rest']; w = 0.0; name = 'rest'
    for t0, t1, p in GEST:
        k = sm((t - t0) / 0.22) * (1 - sm((t - t1) / 0.25))
        if k > 0.001: cur = tuple(tuple(POSES['rest'][i][j] * (1 - k) + POSES[p][i][j] * k for j in range(2)) for i in range(2)); w = k; name = p
    return cur, name, w
lines = DATA['lines']
def talking(t): return any(l['start'] <= t <= l['start'] + l['dur'] for l in lines)
BLINKS = [1.6, 4.9, 8.3, 11.0, 14.6, 18.9, 21.9, 25.0]

def apply(t, f):
    mo = MORPH[min(f, NF - 1)] if NF else {}
    jaw = min(1.0, mo.get('jawOpen', 0) * 1.6); pucker = mo.get('mouthPucker', 0) + mo.get('mouthFunnel', 0) * 0.6
    st = (mo.get('mouthStretchLeft', 0) + mo.get('mouthStretchRight', 0)) * 0.5; press = mo.get('mouthPressLeft', 0)
    MOUTHO.scale = (0.05 * (1 + 0.5 * st - 0.35 * pucker), 0.03, 0.016 + 0.07 * jaw * (1 - 0.6 * press))
    TONG.scale = (0.03, 0.02, 0.006 + 0.02 * jaw); TONG.location.z = MOUTHO.location.z - 0.012 - 0.03 * jaw
    (al, ar), name, k = pose_at(t)
    wave = math.sin(t * 2 * math.pi * 1.8) * 18 * k if name == 'wave' else 0
    pump = abs(math.sin(t * 2 * math.pi * 1.2)) * 12 * k if name in ('cheer', 'pump_l', 'pump_r') else 0
    tk = 1.0 if talking(t) else 0.3
    gest = 6 * math.sin(t * 2.7) * tk
    ARM[1].rotation_euler = (R(-(al[1] + gest * 0.5)), R(-(al[0] + wave + pump)), 0)
    ARM[-1].rotation_euler = (R(-(ar[1] - gest * 0.4)), R(ar[0] + pump), 0)
    # body: bob, sway, bounce on cheer
    bounce = abs(math.sin(t * math.pi * 2.4)) * 0.06 * k if name == 'cheer' else 0
    ROOT.location = (0, 0, 0.012 * math.sin(t * 2 * math.pi / 1.6) + bounce)
    ROOT.rotation_euler = (0, R(1.5 * math.sin(t * 0.9)), R(4 * math.sin(t * 0.55)))
    shake = 12 * math.sin(t * 2 * math.pi * 2.2) * k if name == 'shrug' else 0
    tilt = 10 * k if name in ('think', 'point_cam') else 0
    HP.rotation_euler = (R(3 * math.sin(t * 2.3) * tk + 2 * jaw), R(5 * math.sin(t * 0.8) + tilt), R(6 * math.sin(t * 0.45) + shake))
    bl = max([1 - min(1, abs(t - b) / 0.07) for b in BLINKS] + [0])
    for o in EYEPARTS: o.scale.z = o['sz'] * (1 - 0.9 * bl)

if '--save' in a: bpy.ops.wm.save_as_mainfile(filepath=str(OUT / 'chibi.blend'))
if STILL >= 0:
    f = int(STILL * FPS); apply(STILL, f); sc.render.filepath = str(OUT / f'still_{STILL:.2f}.png'); t0 = time.time()
    bpy.ops.render.render(write_still=True); print('still', round(time.time() - t0, 1), 's'); sys.exit(0)
fa, fb = (int(x) for x in opt('--frames', f'0:{NF}').split(':'))
STEP = int(opt('--step', '1'))
for f in range(fa, min(fb, NF), STEP):
    p = OUT / f'c_{f:04d}.png'
    if p.exists(): continue
    apply(f / FPS, f); sc.render.filepath = str(p); t0 = time.time(); bpy.ops.render.render(write_still=True)
    print('frame', f, round(time.time() - t0, 1), flush=True)
print('chibi done')
