# Body animation clips for the host (runs inside build_host.py). Facial motion (blink, lip-sync, expressions) is NOT
# keyed here: it is driven live from morph targets by character-controller.js so speech can follow any voice track.
# Directions are in Blender armature space: +x = character's left, -y = forward, +z = up.
pbs = arm.pose.bones
arm.animation_data_create()
for pb in pbs:
    pb.rotation_mode = "QUATERNION"
depth = lambda b: 0 if b.parent is None else 1 + depth(b.parent)
ORDER = sorted(arm.data.bones, key=depth)


def pbn(n):
    return pbs["mixamorig:" + n] if ("mixamorig:" + n) in pbs else pbs[n]


def upd():
    bpy.context.view_layer.update()


def reset():
    for pb in pbs:
        pb.rotation_quaternion = (1, 0, 0, 0); pb.location = (0, 0, 0)
    upd()


def _apply(pb, R):
    M = pb.matrix.copy(); h = M.to_translation()
    pb.matrix = Matrix.Translation(h) @ R @ Matrix.Translation(-h) @ M; upd()


def turn(n, axis, deg):
    _apply(pbn(n), Matrix.Rotation(math.radians(deg), 4, Vector(axis).normalized()))


def aim(n, d):
    pb = pbn(n); cur = (pb.matrix.to_3x3() @ Vector((0, 1, 0))).normalized()
    _apply(pb, cur.rotation_difference(Vector(d).normalized()).to_matrix().to_4x4())


def curl(deg=14, thumb=8):
    for s in ("Left", "Right"):
        for f in ("Index", "Middle", "Ring", "Pinky"):
            for k in (1, 2, 3):
                pbn(f"{s}Hand{f}{k}").rotation_quaternion = Quaternion((1, 0, 0), math.radians(deg * (0.7 if k == 1 else 1)))
        for k in (1, 2, 3):
            pbn(f"{s}HandThumb{k}").rotation_quaternion = Quaternion((1, 0, 0), math.radians(thumb))
    upd()


def lerp(a, b, t):
    return [a[i] + (b[i] - a[i]) * t for i in range(3)]


ARM_DOWN = {"L": ((0.13, 0.03, -1), (0.05, -0.22, -1), (0.02, -0.25, -1)),
            "R": ((-0.13, 0.03, -1), (-0.05, -0.22, -1), (-0.02, -0.25, -1))}


def base_pose(t, breathe=1.0, sway=1.0):
    """relaxed standing pose with breathing at time t (seconds)"""
    reset()
    b = math.sin(t * 2 * math.pi / 4.0)
    pbn("Hips").location = (0, 0, 0)
    turn("Hips", (0, 0, 1), 1.5 * sway * math.sin(t * 2 * math.pi / 8))
    turn("Spine1", (1, 0, 0), -1.0 * breathe * b)
    turn("Spine2", (1, 0, 0), -0.8 * breathe * b)
    turn("Neck", (1, 0, 0), 0.6 * breathe * b)
    turn("Head", (0, 0, 1), 2.5 * sway * math.sin(t * 2 * math.pi / 6.5))
    turn("Head", (1, 0, 0), 1.2 * sway * math.sin(t * 2 * math.pi / 5.0))


def arms(left=None, right=None):
    for s, spec in (("L", left), ("R", right)):
        side = "Left" if s == "L" else "Right"
        up, fore, hand = spec or ARM_DOWN[s]
        aim(f"{side}Arm", up); aim(f"{side}ForeArm", fore); aim(f"{side}Hand", hand)
    curl()


def key(f):
    for pb in pbs:
        pb.keyframe_insert("rotation_quaternion", frame=f)
    pbn("Hips").keyframe_insert("location", frame=f)


def clip(name, frames, pose_fn):
    act = bpy.data.actions.new(name); act.use_fake_user = True
    arm.animation_data.action = act
    for f in frames:
        pose_fn(f / 30.0, f); key(f)
    print("clip", name, len(frames), "keys")


G_R = ((-0.32, -0.28, -0.9), (-0.18, -0.95, 0.12), (-0.15, -0.9, 0.35))     # right hand forward, palm-up "explaining"
G_L = ((0.32, -0.28, -0.9), (0.18, -0.95, 0.12), (0.15, -0.9, 0.35))


def blend(a, b, t):
    return tuple(tuple(lerp(a[i], b[i], t)) for i in range(3))


def talk_pose(t, f):
    base_pose(t, sway=0.7)
    ph = (t % 4.0) / 4.0
    r = 0.5 - 0.5 * math.cos(2 * math.pi * min(1, ph * 1.6)) if ph < 0.62 else 0
    l = 0.5 - 0.5 * math.cos(2 * math.pi * max(0, (ph - 0.35) * 2.2)) if 0.35 < ph < 0.8 else 0
    arms(blend(ARM_DOWN["L"], G_L, 0.85 * l), blend(ARM_DOWN["R"], G_R, 0.9 * r))
    turn("Head", (1, 0, 0), 3.0 * math.sin(t * 2 * math.pi / 1.3))


def idle_pose(t, f):
    base_pose(t); arms()


def wave_pose(t, f):
    base_pose(t, sway=0.4)
    k = min(1, t / 0.5) if t < 2.0 else max(0, 1 - (t - 2.0) / 0.5)
    k = 0.5 - 0.5 * math.cos(math.pi * k)
    w = math.sin(t * 2 * math.pi * 1.6) * k
    up = ((-0.75, -0.15, 0.25), (-0.15 + 0.35 * w, -0.25, 1), (-0.1 + 0.5 * w, -0.25, 1))
    arms(None, blend(ARM_DOWN["R"], up, k))
    turn("Head", (0, 0, 1), -4 * k)


def nod_pose(t, f):
    base_pose(t, sway=0.3); arms()
    turn("Head", (1, 0, 0), 9 * math.sin(t * 2 * math.pi / 0.6) * max(0, 1 - t / 1.2))


def explain_pose(t, f):
    base_pose(t, sway=0.5)
    k = 0.5 - 0.5 * math.cos(math.pi * min(1, t / 0.6)) if t < 2.4 else 0.5 + 0.5 * math.cos(math.pi * min(1, (t - 2.4) / 0.6))
    spread = 0.25 * math.sin(t * 2 * math.pi / 1.2)
    gl = ((0.32, -0.28, -0.9), (0.25 + spread, -0.95, 0.15), (0.3 + spread, -0.85, 0.3))
    gr = ((-0.32, -0.28, -0.9), (-0.25 - spread, -0.95, 0.15), (-0.3 - spread, -0.85, 0.3))
    arms(blend(ARM_DOWN["L"], gl, k), blend(ARM_DOWN["R"], gr, k))


clip("Idle", range(0, 241, 15), idle_pose)
clip("Talk", range(0, 121, 6), talk_pose)
clip("Wave", range(0, 76, 3), wave_pose)
clip("Nod", range(0, 37, 3), nod_pose)
clip("Explain", range(0, 91, 5), explain_pose)
arm.animation_data.action = None
reset()
