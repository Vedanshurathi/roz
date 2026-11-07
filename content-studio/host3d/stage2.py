# Stage 2 of build_host.py (runs in its namespace): split parts, textures, hair, eyes, outfits, animations, export.
import bmesh
from mathutils import kdtree

TEX = A.tex
NV = len(P)

# ---------------------------------------------------------------- helpers
def smooth(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t)


def hash3(i, j, k):
    h = (i * 73856093) ^ (j * 19349663) ^ (k * 83492791)
    h = (h ^ (h >> 13)) * 1274126177
    return ((h & 0xFFFF) / 65535.0)


def vnoise(p, f):
    """smooth value noise, p (N,3) metres, f frequency per metre"""
    q = p * f; i = np.floor(q).astype(np.int64); t = q - i; t = t * t * (3 - 2 * t)
    out = 0
    for dx in (0, 1):
        for dy in (0, 1):
            for dz in (0, 1):
                w = (t[:, 0] if dx else 1 - t[:, 0]) * (t[:, 1] if dy else 1 - t[:, 1]) * (t[:, 2] if dz else 1 - t[:, 2])
                out = out + w * hash3(i[:, 0] + dx, i[:, 1] + dy, i[:, 2] + dz)
    return out


def rasterize(uv_tris, attr_tris, size):
    """uv_tris (N,3,2) in 0..1, attr_tris (N,3,C) -> (size,size,C) image of interpolated attributes + coverage mask"""
    C = attr_tris.shape[2]
    img = np.zeros((size, size, C), np.float32); cov = np.zeros((size, size), bool)
    px = np.stack([uv_tris[..., 0] * size, (1 - uv_tris[..., 1]) * size], -1)
    for t in range(len(px)):
        a, b, c = px[t]
        x0, y0 = np.floor(np.minimum(np.minimum(a, b), c)).astype(int); x1, y1 = np.ceil(np.maximum(np.maximum(a, b), c)).astype(int)
        x0, y0 = max(x0, 0), max(y0, 0); x1, y1 = min(x1, size - 1), min(y1, size - 1)
        if x1 < x0 or y1 < y0: continue
        gx, gy = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
        d = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1])
        if abs(d) < 1e-12: continue
        l1 = ((b[1] - c[1]) * (gx - c[0]) + (c[0] - b[0]) * (gy - c[1])) / d
        l2 = ((c[1] - a[1]) * (gx - c[0]) + (a[0] - c[0]) * (gy - c[1])) / d
        l3 = 1 - l1 - l2
        m = (l1 >= -0.02) & (l2 >= -0.02) & (l3 >= -0.02)
        if not m.any(): continue
        val = l1[..., None] * attr_tris[t, 0] + l2[..., None] * attr_tris[t, 1] + l3[..., None] * attr_tris[t, 2]
        sub = img[y0:y1 + 1, x0:x1 + 1]; sc = cov[y0:y1 + 1, x0:x1 + 1]
        sub[m] = val[m]; sc[m] = True
    return img, cov


def dilate(rgb, cov, n=6):
    for _ in range(n):
        acc = np.zeros_like(rgb); cnt = np.zeros(cov.shape, np.float32)
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            s = np.roll(np.roll(cov, dy, 0), dx, 1); acc += np.roll(np.roll(rgb, dy, 0), dx, 1) * s[..., None]; cnt += s
        new = (~cov) & (cnt > 0)
        rgb[new] = acc[new] / cnt[new][:, None]; cov = cov | new
    return rgb


def tris_of(face_ids, attr):
    """triangulate selected OBJ faces -> uv tris and per-corner attribute tris (attr: per-vertex (NV,C))"""
    U, AT = [], []
    for fi in face_ids:
        f, ft = F[fi], FT[fi]
        for k in range(1, len(f) - 1):
            idx = (0, k, k + 1)
            U.append([VT[ft[j]] for j in idx]); AT.append([attr[f[j]] for j in idx])
    return np.array(U, np.float64), np.array(AT, np.float32)


def save_img(name, rgb):
    from PIL import Image
    im = Image.fromarray((np.clip(rgb, 0, 1) * 255).astype(np.uint8)); path = OUT / f"{name}.png"; im.save(path)
    img = bpy.data.images.load(str(path)); img.pack(); return img


def material(name, color=(0.8, 0.8, 0.8), img=None, rough=0.6, double=False, sheen=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*color, 1); bsdf.inputs["Roughness"].default_value = rough
    if img is not None:
        t = m.node_tree.nodes.new("ShaderNodeTexImage"); t.image = img
        m.node_tree.links.new(t.outputs["Color"], bsdf.inputs["Base Color"])
    m.use_backface_culling = not double
    if "Specular IOR Level" in bsdf.inputs: bsdf.inputs["Specular IOR Level"].default_value = 0.25
    return m


# dominant bone per vertex -> body regions
dom = np.full(NV, "", dtype=object); best = np.zeros(NV)
for bname, lst in wts.items():
    for vi, w in lst:
        if w > best[vi]: best[vi] = w; dom[vi] = bname.replace("mixamorig:", "")


def region(b):
    for key, r in (("Head", "head"), ("Neck", "neck"), ("Hips", "hips"), ("Spine", "torso"), ("Shoulder", "torso"),
                   ("ForeArm", "forearm"), ("Arm", "upperarm"), ("Hand", "hand"), ("UpLeg", "thigh"), ("Leg", "shin"),
                   ("Foot", "foot"), ("Toe", "foot")):
        if key in b: return r
    return "other"


reg = np.array([region(b) for b in dom])
face_ids = {g: [i for i, fg in enumerate(FG) if fg == g] for g in set(FG)}
body_faces = face_ids["body"]

# landmarks (rest pose, metres)
def gc(g): return P[sorted(groups[g])].mean(axis=0)
eyeL, eyeR = gc("joint-l-eye"), gc("joint-r-eye")
purse = np.linalg.norm(unit_delta("mouth-pursing"), axis=1)
lips = (purse > 0.55 * purse[body_idx].max()); lips[13380:] = False
mouth = P[lips].mean(axis=0); mouth_w = np.ptp(P[lips, 0])
headv = P[(reg == "head") & (np.arange(NV) < 13380)]
ear_x = np.abs(headv[np.abs(headv[:, 2] - eyeL[2]) < 0.02, 0]).max()
bone_head = {b.name: b.head_local.copy() for b in arm.data.bones}
neck_z = bone_head["mixamorig:Neck"].z
print("landmarks: eye", eyeL.round(3), "mouth", mouth.round(3), "mouth_w", round(mouth_w, 3), "ear_x", round(ear_x, 3), "neck_z", round(neck_z, 3))

# ---------------------------------------------------------------- hair cap (geometry first: skin texture needs its footprint)
# scalp = head-region body faces above a natural hairline (front hairline high, sides above the ear, back to the nape)
def is_scalp(ps):
    c = ps.mean(axis=0); rel = c - eyeL * np.array([0, 1, 1])
    front_line = eyeL[2] + 0.052 + 0.25 * max(0, abs(c[0]) - 0.03)
    if c[1] < eyeL[1] + 0.03:                     # face side of the head
        return c[2] > front_line
    if c[1] < eyeL[1] + 0.085:                    # above the ears
        return c[2] > eyeL[2] + 0.018 - 0.1 * max(0, c[1] - eyeL[1] - 0.06)
    return c[2] > neck_z + 0.035                  # back of the head
scalp_faces = [fi for fi in body_faces if all(reg[v] in ("head", "neck") for v in F[fi]) and is_scalp(P[F[fi]])]
cap_c = P[sorted({v for fi in scalp_faces for v in F[fi]})].mean(axis=0)
def build_part(name, faces, keep_keys=False, offset=0.0, weights_to=None):
    me2 = host.data.copy(); ob = bpy.data.objects.new(name, me2); bpy.context.scene.collection.objects.link(ob)
    for g in host.vertex_groups: ob.vertex_groups.new(name=g.name)
    if not keep_keys and me2.shape_keys:
        ob.shape_key_clear()
    bm = bmesh.new(); bm.from_mesh(me2); bm.faces.ensure_lookup_table()
    keep = set(faces)
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.index not in keep], context="FACES")
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
    if offset:
        bm.normal_update()
        off = offset if callable(offset) else (lambda co, n: offset)
        for v in bm.verts:
            v.co = v.co + v.normal * off(v.co, v.normal)
    bm.to_mesh(me2); bm.free()
    ob.parent = arm; m = ob.modifiers.new("Armature", "ARMATURE"); m.object = arm
    for p in me2.polygons: p.use_smooth = True
    if weights_to:
        for g in list(ob.vertex_groups): ob.vertex_groups.remove(g)
        ob.vertex_groups.new(name=weights_to).add(list(range(len(me2.vertices))), 1.0, "REPLACE")
    else:  # drop the MakeHuman helper/joint groups, keep bone weights only
        for g in list(ob.vertex_groups):
            if g.name not in wts and not g.name.endswith("Eye"): ob.vertex_groups.remove(g)
    return ob


def hair_offset(co, n):
    p = np.array(co) - cap_c; r = 0.1
    top = p[2] / r; front = -p[1] / r; side = abs(p[0]) / r
    h = 0.007 + 0.045 * smooth(-0.1, 0.9, top) * (0.7 + 0.45 * np.clip(front, -1, 1)) - 0.003 * smooth(0.6, 1.0, side)
    wav = vnoise(np.array([co]), 45)[0] - 0.5
    return float(h * (1 + 0.5 * wav))


hair = build_part("Hair", scalp_faces, offset=0.0, weights_to="mixamorig:Head")
# subdivide + smooth the hair mass, then push the front fringe a little forward/down
bm = bmesh.new(); bm.from_mesh(hair.data)
bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=1, use_grid_fill=True, smooth=0.6)
ring = {v: 0 for v in bm.verts if v.is_boundary}; frontier = list(ring)
while frontier:   # distance (in edge rings) from the hairline, so the hair tapers into the scalp instead of a hard step
    nxt = []
    for v in frontier:
        for e in v.link_edges:
            o = e.other_vert(v)
            if o not in ring: ring[o] = ring[v] + 1; nxt.append(o)
    frontier = nxt
bm.normal_update()
for v in bm.verts:
    t = min(1.0, 0.15 + 0.28 * ring.get(v, 6))
    v.co = v.co + v.normal * hair_offset(v.co, v.normal) * t
for v in bm.verts:
    p = v.co - Vector(cap_c)
    if p.y < -0.05 and p.z > 0.0 and ring.get(v, 9) <= 2 and abs(p.x) < 0.05:
        v.co += Vector((0.004 * math.sin(p.x * 120), -0.010, -0.016 + 0.008 * ring.get(v, 0)))   # soft fringe on the forehead
bmesh.ops.smooth_vert(bm, verts=bm.verts[:], factor=0.5, use_axis_x=True, use_axis_y=True, use_axis_z=True)
bm.to_mesh(hair.data); bm.free()
hair_kd = kdtree.KDTree(len(hair.data.vertices))
for v in hair.data.vertices: hair_kd.insert(v.co, v.index)
hair_kd.balance()

# ---------------------------------------------------------------- skin texture (beard, moustache, brows, lips, scalp)
scalp = np.zeros(NV, np.float32)
for vi in body_idx:
    if P[vi, 2] > eyeL[2] - 0.01:
        co, _, d = hair_kd.find(Vector(P[vi]))
        scalp[vi] = 1.0 - smooth(0.012, 0.02, d)
attr = np.concatenate([P, scalp[:, None]], axis=1).astype(np.float32)
U, AT = tris_of(body_faces, attr)
print("rasterizing skin", len(U), "tris at", TEX)
img, cov = rasterize(U, AT, TEX)
pos = img[..., :3].reshape(-1, 3); sc = img[..., 3].reshape(-1)
x, y, z = pos[:, 0], pos[:, 1], pos[:, 2]; nx = np.abs(x)
skin = np.array([0.60, 0.40, 0.29]); n1 = vnoise(pos, 400)
rgb = np.tile(skin, (len(pos), 1)) * (0.96 + 0.08 * vnoise(pos, 90))[:, None]
rgb += np.array([0.05, -0.01, -0.02]) * (np.exp(-((nx - 0.045) ** 2 + (z - (mouth[2] + 0.04)) ** 2) / 0.0004) * (y < eyeL[1]))[:, None]
# lips
le = (x / (mouth_w * 0.36)) ** 2 + ((z - mouth[2]) / 0.0078) ** 2
lipm = (1 - smooth(0.8, 1.05, le)) * (y < mouth[1] + 0.012)
rgb = rgb * (1 - lipm[:, None]) + np.array([0.47, 0.29, 0.25]) * lipm[:, None]
# groomed short beard + moustache + sideburns
front = y < eyeL[1] + 0.055
top_line = mouth[2] + 0.017 + 0.42 * np.maximum(0, nx - 0.024)
side_burn = (nx > ear_x - 0.022) & (z < eyeL[2] + 0.02)
low_line = mouth[2] - 0.058 + 0.45 * nx
beard = smooth(-0.003, 0.002, top_line - z) * smooth(-0.004, 0.006, z - low_line)
beard = np.maximum(beard, side_burn * smooth(-0.004, 0.004, z - (mouth[2] + 0.0)) * (z < eyeL[2] + 0.025))
beard *= front * (1 - smooth(0.85, 1.25, le) * 0 - (le < 1.15)) * (z < eyeL[2] + 0.03)
beard = np.clip(beard, 0, 1) * (0.72 + 0.28 * n1)
rgb = rgb * (1 - 0.85 * beard[:, None]) + np.array([0.075, 0.055, 0.045]) * (0.85 * beard[:, None])
# brows
for c, s in ((eyeL, 1), (eyeR, -1)):
    dx = (x - c[0]) * s; dz = z - c[2]
    zc = 0.021 + 0.004 * (1 - ((dx - 0.006) / 0.03) ** 2)
    th = 0.0058 - 0.0028 * np.clip((dx + 0.026) / 0.058, 0, 1)
    bm_ = (1 - smooth(th * 0.7, th, np.abs(dz - zc))) * smooth(-0.028, -0.024, dx) * (1 - smooth(0.03, 0.034, dx)) * (y < c[1] + 0.01)
    rgb = rgb * (1 - 0.9 * bm_[:, None]) + np.array([0.04, 0.03, 0.03]) * 0.9 * bm_[:, None]
# scalp under hair
rgb = rgb * (1 - sc[:, None]) + np.array([0.05, 0.04, 0.035]) * sc[:, None]
rgb = dilate(rgb.reshape(TEX, TEX, 3), cov)
skin_img = save_img("tex_skin", rgb)

body = build_part("Body", body_faces, keep_keys=True)
body.data.materials.append(material("Skin", img=skin_img, rough=0.55))

# hair texture: streaks running front-to-back
hU, hAT = [], []
for p in hair.data.polygons:
    vs = list(p.vertices); ls = list(p.loop_indices)
    for k in range(1, len(vs) - 1):
        idx = (0, k, k + 1)
        hU.append([hair.data.uv_layers[0].data[ls[j]].uv[:] for j in idx]); hAT.append([hair.data.vertices[vs[j]].co[:] for j in idx])
himg, hcov = rasterize(np.array(hU), np.array(hAT, np.float32), 1024)
hp = himg.reshape(-1, 3) - cap_c
ang = np.arctan2(hp[:, 0], hp[:, 2] + 0.02)
streak = 0.5 + 0.5 * np.sin(ang * 90 + 6 * vnoise(himg.reshape(-1, 3), 60))
hrgb = np.array([0.045, 0.035, 0.032]) * (0.75 + 0.6 * streak[:, None] ** 3)
hair.data.materials.append(material("Hair", img=save_img("tex_hair", dilate(hrgb.reshape(1024, 1024, 3), hcov)), rough=0.62, double=True))

# ---------------------------------------------------------------- eyes (new spheres with painted iris), teeth, tongue, lashes
def make_eye(side, c, gname):
    r = float(np.linalg.norm(P[sorted(groups[gname])] - c, axis=1).max()) * 0.98
    me3 = bpy.data.meshes.new(f"Eye{side}"); bm = bmesh.new()
    bm.loops.layers.uv.new("UVMap")
    bmesh.ops.create_uvsphere(bm, u_segments=32, v_segments=16, radius=r, calc_uvs=True)
    bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(math.radians(90), 3, "X"))   # +Z pole -> -Y (front)
    bmesh.ops.translate(bm, verts=bm.verts, vec=Vector(c)); bm.to_mesh(me3); bm.free()
    ob = bpy.data.objects.new(f"Eye{side}", me3); bpy.context.scene.collection.objects.link(ob)
    ob.parent = arm; m = ob.modifiers.new("Armature", "ARMATURE"); m.object = arm
    ob.vertex_groups.new(name=f"{side}Eye").add(list(range(len(me3.vertices))), 1.0, "REPLACE")
    for p in me3.polygons: p.use_smooth = True
    return ob


eyes = [make_eye("Left", eyeL, "helper-l-eye"), make_eye("Right", eyeR, "helper-r-eye")]
for e, c in zip(eyes, (eyeL, eyeR)):
    me3 = e.data; uvl = me3.uv_layers[0].data; eU, eA = [], []
    for p in me3.polygons:
        vs = list(p.vertices); ls = list(p.loop_indices)
        for k in range(1, len(vs) - 1):
            idx = (0, k, k + 1); eU.append([uvl[ls[j]].uv[:] for j in idx]); eA.append([me3.vertices[vs[j]].co[:] for j in idx])
    S = 512; im, cv = rasterize(np.array(eU), np.array(eA, np.float32), S)
    d = im.reshape(-1, 3) - c; d /= np.linalg.norm(d, axis=1, keepdims=True) + 1e-9
    th = np.arccos(np.clip(-d[:, 1], -1, 1))                      # angle from the forward axis
    az = np.arctan2(d[:, 2], d[:, 0])
    col = np.tile(np.array([0.84, 0.81, 0.77]), (len(d), 1))
    irm = 1 - smooth(0.50, 0.55, th); pup = 1 - smooth(0.20, 0.23, th)
    tone = np.array([0.30, 0.17, 0.08])[None] * (0.7 + 0.6 * (th / 0.55))[:, None] * (0.9 + 0.2 * np.sin(az * 30))[:, None]
    col = col * (1 - irm[:, None]) + tone * irm[:, None]
    col = col * (1 - pup[:, None]) + np.array([0.02, 0.015, 0.012]) * pup[:, None]
    col *= (1 - 0.5 * np.exp(-((th - 0.53) ** 2) / 0.0008))[:, None]
    hl = np.exp(-(((d[:, 0] + 0.25) ** 2 + (d[:, 2] - 0.28) ** 2) / 0.004)); col = col * (1 - hl[:, None]) + hl[:, None]
    e.data.materials.append(material(f"Eye_{e.name}", img=save_img(f"tex_{e.name}", dilate(col.reshape(S, S, 3), cv)), rough=0.12))

teeth = build_part("Teeth", face_ids["helper-upper-teeth"] + face_ids["helper-lower-teeth"], keep_keys=True)
teeth.data.materials.append(material("Teeth", (0.9, 0.87, 0.8), rough=0.3))
tongue = build_part("Tongue", face_ids["helper-tongue"], keep_keys=True)
tongue.data.materials.append(material("Tongue", (0.55, 0.25, 0.25), rough=0.4))
lash_faces = [i for g, ids in face_ids.items() if "eyelashes" in g for i in ids]
lashes = build_part("Lashes", lash_faces, keep_keys=True)
lashes.data.materials.append(material("Lashes", (0.02, 0.015, 0.015), rough=0.8, double=True))

# ---------------------------------------------------------------- outfits (offset copies of body regions: same skin weights)
def faces_where(pred):
    out = []
    for fi in body_faces:
        f = F[fi]; rs = [reg[v] for v in f]; ps = P[f]
        if pred(rs, ps): out.append(fi)
    return out


def frac_along(ps, a, b):
    a, b = np.array(a), np.array(b); d = b - a
    return float((((ps - a) @ d) / (d @ d)).mean())


bh = {k.replace("mixamorig:", ""): np.array(v) for k, v in bone_head.items()}
waist_z = bh["Spine"][2] + 0.03
crotch_z = bh["LeftUpLeg"][2] - 0.06


def arm_frac(ps, seg):
    s = "Left" if ps[:, 0].mean() > 0 else "Right"
    if seg == "upper": return frac_along(ps, bh[f"{s}Arm"], bh[f"{s}ForeArm"])
    return frac_along(ps, bh[f"{s}ForeArm"], bh[f"{s}Hand"])


def top_faces(sleeve):  # sleeve: ("upper", 0.45) | ("fore", 0.7) | ("fore", 0.97)
    seg, lim = sleeve
    def pred(rs, ps):
        if any(r in ("head", "neck", "hand", "thigh", "shin", "foot") for r in rs): return False
        if ps[:, 2].max() > neck_z - 0.005 and ps[:, 1].mean() < 0.02: return False
        if ps[:, 2].max() > neck_z + 0.01: return False
        if all(r == "hips" for r in rs) and ps[:, 2].mean() < crotch_z + 0.07: return False
        if any(r == "upperarm" for r in rs) and seg == "upper": return arm_frac(ps, "upper") < lim
        if any(r == "forearm" for r in rs): return seg == "fore" and arm_frac(ps, "fore") < lim
        return True
    return faces_where(pred)


def leg_faces():
    def pred(rs, ps):
        if any(r in ("foot", "torso", "upperarm", "forearm", "hand", "head", "neck") for r in rs): return False
        if ps[:, 2].min() < bh["LeftFoot"][2] + 0.035: return False
        if any(r == "hips" for r in rs): return ps[:, 2].max() < waist_z
        return True
    return faces_where(pred)


def shoe_faces():
    return faces_where(lambda rs, ps: any(r == "foot" for r in rs) or ps[:, 2].max() < bh["LeftFoot"][2] + 0.045)


def cloth_tex(name, base, fn=None, size=2048):
    """paint a garment texture from 3D position (pockets, plackets, cuffs) over the body UV layout"""
    U2, AT2 = tris_of(body_faces, P.astype(np.float32))
    im, cv = rasterize(U2, AT2, size)
    p = im.reshape(-1, 3); c = np.tile(np.array(base, float), (len(p), 1)) * (0.92 + 0.12 * vnoise(p, 700))[:, None]
    if fn: c = fn(p, c)
    return save_img(name, dilate(c.reshape(size, size, 3), cv))


def box(p, cx, cz, w, h, front=True):
    return ((np.abs(p[:, 0] - cx) < w / 2) & (np.abs(p[:, 2] - cz) < h / 2) & ((p[:, 1] < 0) if front else True)).astype(float)


chest_z = bh["Spine2"][2] + 0.05


def overshirt_fn(p, c):
    dark = np.array([0.11, 0.11, 0.12])
    for s in (1, -1):
        c = c * (1 - 0.5 * box(p, s * 0.085, chest_z, 0.105, 0.004)[:, None])                     # pocket flap seam
        c = c * (1 - 0.3 * box(p, s * 0.085, chest_z - 0.04, 0.105, 0.085)[:, None] * (np.abs(np.abs(p[:, 0] - s * 0.085) - 0.051) < 0.0025)[:, None])
        btn = (np.hypot(p[:, 0] - s * 0.085, p[:, 2] - (chest_z - 0.012)) < 0.0055) & (p[:, 1] < 0)
        c[btn] = dark
    plk = (np.abs(np.abs(p[:, 0]) - 0.045) < 0.012) & (p[:, 1] < 0) & (p[:, 2] < neck_z)
    c[plk] *= 0.88
    for k in range(6):
        bz = neck_z - 0.06 - k * 0.085
        c[(np.hypot(np.abs(p[:, 0]) - 0.045, p[:, 2] - bz) < 0.005) & (p[:, 1] < 0)] = dark
    return c


def hoodie_fn(p, c):
    pocket = box(p, 0, waist_z + 0.03, 0.26, 0.15) * (np.abs(np.abs(p[:, 0]) - 0.13) < 0.004 + 0 * p[:, 0] + 0.0)
    c = c * (1 - 0.35 * pocket[:, None])
    top = box(p, 0, waist_z + 0.105, 0.24, 0.004); c = c * (1 - 0.35 * top[:, None])
    for s in (1, -1):
        st = (np.abs(p[:, 0] - s * 0.035) < 0.004) & (p[:, 2] > chest_z - 0.02) & (p[:, 2] < neck_z) & (p[:, 1] < 0)
        c[st] = np.array([0.85, 0.85, 0.85])
    return c


def jeans_fn(p, c):
    seam = (np.abs(np.abs(p[:, 0]) - (np.abs(bh["LeftUpLeg"][0]) + 0.06)) < 0.003)
    c[seam] *= 1.25; return c


def shoe_fn(p, c):
    sole = p[:, 2] < 0.028; c[sole] = np.array([0.55, 0.55, 0.57]); return c


tops = {
    "Top_Tee_Cream": (("upper", 0.42), 0.005, (0.91, 0.87, 0.79), None),
    "Top_Overshirt_Charcoal": (("fore", 0.62), 0.024, (0.17, 0.17, 0.19), overshirt_fn),
    "Top_Hoodie_Navy": (("fore", 0.98), 0.026, (0.13, 0.17, 0.27), hoodie_fn),
    "Top_Tee_Black": (("upper", 0.45), 0.005, (0.08, 0.08, 0.09), None),
}
pieces = {}
for name, (sleeve, off, colr, fn) in tops.items():
    fs = top_faces(sleeve)
    if "Overshirt" in name:  # open front
        fs = [fi for fi in fs if not (np.abs(P[F[fi], 0]).mean() < 0.03 and P[F[fi], 1].mean() < 0)]
    ob = build_part(name, fs, offset=off)
    ob.data.materials.append(material(name, img=cloth_tex("tex_" + name, colr, fn), rough=0.8, double=True)); pieces[name] = ob
for name, colr, fn in (("Bottom_Chinos_Black", (0.08, 0.08, 0.09), None), ("Bottom_Jeans_Blue", (0.17, 0.24, 0.38), jeans_fn)):
    ob = build_part(name, leg_faces(), offset=lambda co, n: 0.012 + 0.014 * smooth(0.25, 0.75, 1 - co[2] / 0.9))
    ob.data.materials.append(material(name, img=cloth_tex("tex_" + name, colr, fn), rough=0.85, double=True)); pieces[name] = ob
ob = build_part("Shoes_Sneakers_White", shoe_faces(), offset=0.009)
ob.data.materials.append(material("Shoes", img=cloth_tex("tex_shoes", (0.93, 0.93, 0.92), shoe_fn, 1024), rough=0.5)); pieces[ob.name] = ob

OUTFITS = {
    "casual": ["Top_Tee_Cream", "Top_Overshirt_Charcoal", "Bottom_Chinos_Black", "Shoes_Sneakers_White"],
    "hoodie": ["Top_Hoodie_Navy", "Bottom_Chinos_Black", "Shoes_Sneakers_White"],
    "tee": ["Top_Tee_Black", "Bottom_Jeans_Blue", "Shoes_Sneakers_White"],
}
bpy.data.objects.remove(host, do_unlink=True)
arm["outfits"] = json.dumps(OUTFITS)
arm["face_controls"] = json.dumps(list(UNITS))
arm["identity"] = "recurring host v1 — face/hair/beard fixed; outfits interchangeable"

# ---------------------------------------------------------------- animations (world-space rotations, keyed per pose bone)
exec(open(Path(__file__).parent / "anims.py", encoding="utf-8").read())

# ---------------------------------------------------------------- save + export
bpy.ops.wm.save_as_mainfile(filepath=str(OUT / "host.blend"), compress=True)
bpy.ops.export_scene.gltf(filepath=str(OUT / "host.glb"), export_format="GLB", export_skins=True, export_morph=True,
                          export_morph_normal=False, export_animations=True, export_animation_mode="ACTIONS",
                          export_image_format="JPEG", export_jpeg_quality=88, export_extras=True, export_yup=True)
print("export ok", (OUT / "host.glb").stat().st_size // 1024, "KB")
