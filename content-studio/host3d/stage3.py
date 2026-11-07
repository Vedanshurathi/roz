# Stage 3 (Avir v2): realistic materials, strand hair/beard/brows, cleaner clothing, mocap animation library.
# Runs inside build_host.py when --stage v2 (after stage2.py). Rendering target: Blender Cycles (CPU).
from mathutils.bvhtree import BVHTree

rng = np.random.default_rng(7)
MOCAP = Path(os.environ.get("MOCAP", "/tmp/claude-0/-home-user-roz/e0f1c78f-431b-5d53-ac40-f78dc2fd9d39/scratchpad/cmu/data"))
nt_new = lambda m, t: m.node_tree.nodes.new(t)


def link(m, a, b):
    m.node_tree.links.new(a, b)


def uv_noise_bump(m, bsdf, scale, strength, distance, kind="noise"):
    tc = nt_new(m, "ShaderNodeTexCoord")
    if kind == "noise":
        tx = nt_new(m, "ShaderNodeTexNoise"); tx.inputs["Scale"].default_value = scale; tx.inputs["Detail"].default_value = 3
        out = tx.outputs["Fac"]
    else:
        tx = nt_new(m, "ShaderNodeTexVoronoi"); tx.inputs["Scale"].default_value = scale; out = tx.outputs["Distance"]
    link(m, tc.outputs["UV"], tx.inputs["Vector"])
    bp = nt_new(m, "ShaderNodeBump"); bp.inputs["Strength"].default_value = strength; bp.inputs["Distance"].default_value = distance
    link(m, out, bp.inputs["Height"]); link(m, bp.outputs["Normal"], bsdf.inputs["Normal"])
    return bp


def set_in(bsdf, name, v):
    if name in bsdf.inputs: bsdf.inputs[name].default_value = v


# ---------------------------------------------------------------- 4. mocap animation library (CMU, no usage restrictions)
MAP = {  # our bone: (cmu joint from, cmu joint to)
    "Spine": ("LowerBack", "Spine"), "Spine1": ("Spine", "Spine1"), "Spine2": ("Spine1", "Neck"), "Neck": ("Neck", "Head"),
    "Head": ("Head", "Head@tail"),
}
for s in ("Left", "Right"):
    MAP.update({f"{s}Shoulder": (f"{s}Shoulder", f"{s}Arm"), f"{s}Arm": (f"{s}Arm", f"{s}ForeArm"), f"{s}ForeArm": (f"{s}ForeArm", f"{s}Hand"),
                f"{s}Hand": (f"{s}Hand", f"{s}Hand@tail"), f"{s}UpLeg": (f"{s}UpLeg", f"{s}Leg"), f"{s}Leg": (f"{s}Leg", f"{s}Foot"),
                f"{s}Foot": (f"{s}Foot", f"{s}ToeBase"), f"{s}ToeBase": (f"{s}ToeBase", f"{s}ToeBase@tail")})


def align2(n, d, lat_target, lat_fn):
    """rotate bone n so its direction is d and its lateral axis (lat_fn) matches lat_target"""
    aim(n, d)
    lt = Vector(lat_target); cur = lat_fn(); dd = Vector(d).normalized()
    lt = (lt - dd * lt.dot(dd)).normalized(); cur = (cur - dd * cur.dot(dd)).normalized()
    ang = cur.angle(lt, 0.0); sgn = 1 if cur.cross(lt).dot(dd) > 0 else -1
    turn(n, dd, math.degrees(ang * sgn))


def retarget(fname, name, t0, t1, final_facing=None, root_motion=True, keep_xy=False):
    try:
        bpy.ops.preferences.addon_enable(module="io_anim_bvh")
    except Exception:
        pass
    bpy.ops.import_anim.bvh(filepath=str(MOCAP / fname), global_scale=1.0, frame_start=0, use_fps_scale=False,
                            update_scene_fps=False, update_scene_duration=False, rotate_mode="NATIVE", axis_forward="-Z", axis_up="Y")
    src = bpy.context.active_object; sp = src.pose.bones
    def J(nm):
        if nm.endswith("@tail"): return src.matrix_world @ sp[nm[:-5]].tail
        return src.matrix_world @ sp[nm].head
    sc = bpy.context.scene
    sc.frame_set(int(t0 * 120))
    leg_src = (J("LeftUpLeg") - J("LeftFoot")).length
    leg_dst = (Vector(bh["LeftUpLeg"]) - Vector(bh["LeftFoot"])).length
    ratio = leg_dst / leg_src
    hips0 = J("Hips").copy()
    zs = []
    for f in range(int(t0 * 120), int(t1 * 120), 5):
        sc.frame_set(f); zs.append(J("Hips").z)
    zbase = float(np.median(zs))
    rot = Matrix.Identity(3)
    if final_facing is not None:      # rotate the whole motion so the final facing direction == final_facing
        sc.frame_set(int(t1 * 120) - 1)
        lat = J("RightUpLeg") - J("LeftUpLeg"); fwd = Vector((0, 0, 1)).cross(lat); fwd.z = 0; fwd.normalize()
        a_ = math.atan2(final_facing[1], final_facing[0]) - math.atan2(fwd.y, fwd.x)
        rot = Matrix.Rotation(a_, 3, "Z")
    act = bpy.data.actions.new(name); act.use_fake_user = True; arm.animation_data.action = act
    for k, f in enumerate(range(int(t0 * 120), int(t1 * 120), 5)):
        sc.frame_set(f)
        reset()
        hips_lat = rot @ (J("RightUpLeg") - J("LeftUpLeg"))
        up = rot @ (J("Spine") - J("Hips"))
        align2("Hips", up, hips_lat, lambda: pbn("RightUpLeg").head - pbn("LeftUpLeg").head)   # +x = character's left
        if root_motion:
            d = rot @ (J("Hips") - hips0)
            tgt = Vector(bh["Hips"]) + Vector((d.x * ratio, d.y * ratio, (J("Hips").z - zbase) * ratio))
            pb = pbn("Hips"); M = pb.matrix.copy(); M.translation = tgt; pb.matrix = M; upd()
        for b in ORDER:
            n = b.name.replace("mixamorig:", "")
            if n in MAP:
                a0, a1 = MAP[n]; dv = rot @ (J(a1) - J(a0))
                if dv.length > 1e-6:
                    if n == "Spine2":
                        align2(n, dv, rot @ (J("RightArm") - J("LeftArm")), lambda: pbn("RightArm").head - pbn("LeftArm").head)
                    else:
                        aim(b.name.replace("mixamorig:", ""), dv)
        curl(16, 10)
        key(k)
    bpy.data.objects.remove(src, do_unlink=True)
    print("mocap clip", name, "frames", k + 1)
    return act


_unlinked = [o for o in list(bpy.context.scene.collection.objects) if o.type != "ARMATURE"]
for o in _unlinked: bpy.context.scene.collection.objects.unlink(o)
retarget("016/16_17.bvh", "WalkTurn", 0.2, 4.2, final_facing=(0, -1))                 # walk, 90-degree left turn, ends facing camera
retarget("018/18_08.bvh", "Gesture", 6.0, 10.0, root_motion=False)
retarget("013/13_04.bvh", "Sit", 4.0, 7.0, root_motion=True)
arm.animation_data.action = None
reset()
for o in _unlinked: bpy.context.scene.collection.objects.link(o)

# ---------------------------------------------------------------- 1. realistic skin, eyes, teeth
skin = body.data.materials[0]; sb = skin.node_tree.nodes["Principled BSDF"]
set_in(sb, "Subsurface Weight", 0.18); set_in(sb, "Subsurface Radius", (0.9, 0.38, 0.22)); set_in(sb, "Subsurface Scale", 0.006)
set_in(sb, "Roughness", 0.46); set_in(sb, "Specular IOR Level", 0.42)
pores = uv_noise_bump(skin, sb, 2600, 0.06, 0.0004, "voronoi")
tc = nt_new(skin, "ShaderNodeTexCoord"); nz = nt_new(skin, "ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = 420
link(skin, tc.outputs["UV"], nz.inputs["Vector"]); bp2 = nt_new(skin, "ShaderNodeBump"); bp2.inputs["Strength"].default_value = 0.05
link(skin, nz.outputs["Fac"], bp2.inputs["Height"]); link(skin, bp2.outputs["Normal"], pores.inputs["Normal"])
for e in eyes:
    eb_ = e.data.materials[0].node_tree.nodes["Principled BSDF"]; set_in(eb_, "Roughness", 0.05); set_in(eb_, "Coat Weight", 1.0); set_in(eb_, "Coat Roughness", 0.02)
tb = teeth.data.materials[0].node_tree.nodes["Principled BSDF"]; set_in(tb, "Subsurface Weight", 0.1); set_in(tb, "Roughness", 0.22)
hair.hide_render = True          # the sculpted shell stays only as the real-time (glTF) fallback
hair.name = "HairShell_Realtime"

# ---------------------------------------------------------------- 2. strand hair, beard, brows (curves deformed on the skin surface)
body.add_rest_position_attribute = True


def tri_list(face_ids):
    T = []
    for fi in face_ids:
        f, ft = F[fi], FT[fi]
        for k in range(1, len(f) - 1):
            T.append((f[0], f[k], f[k + 1], ft[0], ft[k], ft[k + 1]))
    return np.array(T)


def sample_roots(face_ids, n, mask=None, oversample=4):
    T = tri_list(face_ids)
    a, b, c = P[T[:, 0]], P[T[:, 1]], P[T[:, 2]]
    cr = np.cross(b - a, c - a); area = np.linalg.norm(cr, axis=1); nrm = cr / (area[:, None] + 1e-12)
    m = n * oversample if mask is not None else n
    ti = rng.choice(len(T), size=m, p=area / area.sum())
    u, v = rng.random(m), rng.random(m); fl = u + v > 1; u[fl], v[fl] = 1 - u[fl], 1 - v[fl]; w = 1 - u - v
    pos = a[ti] * w[:, None] + b[ti] * u[:, None] + c[ti] * v[:, None]
    uv = VT[T[ti, 3]] * w[:, None] + VT[T[ti, 4]] * u[:, None] + VT[T[ti, 5]] * v[:, None]
    nn = nrm[ti]
    # body faces are wound so the cross product points outward for MakeHuman; enforce outward from head/body centre
    if mask is not None:
        keep = rng.random(m) < mask(pos)
        pos, uv, nn = pos[keep][:n], uv[keep][:n], nn[keep][:n]
    return pos, nn, uv


def grow(pos, nrm, flow, length, lift, K, wave_amp, wave_freq, clump=0.0, droop=0.0):
    N = len(pos); f = flow - nrm * (flow * nrm).sum(1, keepdims=True); f /= np.linalg.norm(f, axis=1, keepdims=True) + 1e-9
    bino = np.cross(nrm, f); phase = rng.random(N) * 6.28
    pts = np.zeros((N, K, 3)); pts[:, 0] = pos + nrm * 0.0004
    seg = (length / (K - 1))[:, None]
    for k in range(1, K):
        t = k / (K - 1)
        d = nrm * (lift[:, None] * (1 - t) ** 2) + f * (0.35 + t) + np.array([0, 0, -1.0]) * droop * t
        d /= np.linalg.norm(d, axis=1, keepdims=True)
        pts[:, k] = pts[:, k - 1] + d * seg
    t = np.linspace(0, 1, K)[None, :, None]
    wa = np.broadcast_to(np.asarray(wave_amp, dtype=float), (N,))[:, None, None]
    pts += bino[:, None, :] * wa * np.sin(6.283 * wave_freq * t + phase[:, None, None]) * t
    if clump > 0:
        G = max(1, N // 40); gi = rng.choice(N, G, replace=False)
        kd = kdtree.KDTree(G)
        for j, g in enumerate(gi): kd.insert(pos[g], j)
        kd.balance()
        near = np.array([gi[kd.find(p)[1]] for p in pos])
        off_s = pts - pts[:, :1]; off_g = off_s[near]
        pts = pts[:, :1] + off_s + clump * (t ** 1.4) * (off_g - off_s)
    return pts


def make_curves(name, pts, uv, r_root, r_tip, mat):
    N, K, _ = pts.shape
    cv = bpy.data.hair_curves.new(name); cv.add_curves([K] * N)
    cv.attributes["position"].data.foreach_set("vector", pts.astype(np.float32).ravel())
    ra = cv.attributes.get("radius") or cv.attributes.new("radius", "FLOAT", "POINT")
    ra.data.foreach_set("value", np.tile(np.linspace(r_root, r_tip, K), N).astype(np.float32))
    su = cv.attributes.get("surface_uv_coordinate") or cv.attributes.new("surface_uv_coordinate", "FLOAT2", "CURVE")
    su.data.foreach_set("vector", uv.astype(np.float32).ravel())
    ob = bpy.data.objects.new(name, cv); bpy.context.scene.collection.objects.link(ob)
    cv.surface = body; cv.surface_uv_map = "UVMap"; ob.parent = body
    cv.materials.append(mat)
    ng = bpy.data.node_groups.get("AvirDeformOnSkin")
    if ng is None:
        ng = bpy.data.node_groups.new("AvirDeformOnSkin", "GeometryNodeTree")
        ng.interface.new_socket("Geometry", in_out="INPUT", socket_type="NodeSocketGeometry")
        ng.interface.new_socket("Geometry", in_out="OUTPUT", socket_type="NodeSocketGeometry")
        gi_, go_ = ng.nodes.new("NodeGroupInput"), ng.nodes.new("NodeGroupOutput")
        dn = ng.nodes.new("GeometryNodeDeformCurvesOnSurface")
        ng.links.new(gi_.outputs[0], dn.inputs[0]); ng.links.new(dn.outputs[0], go_.inputs[0])
    md = ob.modifiers.new("DeformOnSkin", "NODES"); md.node_group = ng
    print("curves", name, N, "strands")
    return ob


def hair_mat(name, melanin, redness, rough, radial=0.3):
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree
    for n in list(nt.nodes):
        if n.type == "BSDF_PRINCIPLED": nt.nodes.remove(n)
    h = nt.nodes.new("ShaderNodeBsdfHairPrincipled")
    if hasattr(h, "parametrization"): h.parametrization = "MELANIN"
    for k, v in (("Melanin", melanin), ("Melanin Redness", redness), ("Roughness", rough), ("Radial Roughness", radial),
                 ("Random Roughness", 0.2), ("Random Color", 0.12), ("Coat", 0.0)):
        if k in h.inputs: h.inputs[k].default_value = v
    nt.links.new(h.outputs[0], nt.nodes["Material Output"].inputs["Surface"])
    return m


HAIR_M = hair_mat("Hair_Strands", 0.93, 0.35, 0.30)
BEARD_M = hair_mat("Beard_Strands", 0.95, 0.3, 0.38)

# scalp hair: swept up and back with volume on top, short neat sides (approved reference)
hp, hn, huv = sample_roots(scalp_faces, 52000)
rel = (hp - cap_c) / 0.1
top = smooth(0.15, 0.65, rel[:, 2]); front = smooth(0.0, 0.6, -rel[:, 1]); side = smooth(0.55, 0.85, np.abs(rel[:, 0])) * (1 - top)
back = smooth(0.1, 0.6, rel[:, 1]) * (1 - top)
flow = (top[:, None] * np.array([0, 1.0, 0.25]) + side[:, None] * np.array([0, 0.45, -1.0]) + back[:, None] * np.array([0, 0.15, -1.0])
        + (1 - top - side - back).clip(0)[:, None] * np.array([0, 0.8, -0.4]))
flow[:, 0] += np.sign(rel[:, 0]) * 0.15 * (1 - top)
L = 0.024 + 0.040 * top + 0.016 * top * front + 0.008 * back
lift = 0.25 + 1.05 * top * (0.6 + 0.6 * front)
hpts = grow(hp, hn, flow, L * (0.85 + 0.3 * rng.random(len(hp))), lift, 9, 0.0045 * (0.4 + top), 1.2, clump=0.55, droop=0.1)
make_curves("Hair", hpts, huv, 0.00011, 0.00003, HAIR_M)

# beard + moustache (short, groomed) and brows: roots inside the same masks the skin texture uses
def beard_mask(p):
    x, y, z = p[:, 0], p[:, 1], p[:, 2]; nx = np.abs(x)
    le_ = (x / (mouth_w * 0.36)) ** 2 + ((z - mouth[2]) / 0.0078) ** 2
    topl = mouth[2] + 0.017 + 0.42 * np.maximum(0, nx - 0.024)
    sideb = (nx > ear_x - 0.022) & (z < eyeL[2] + 0.02)
    lowl = mouth[2] - 0.058 + 0.45 * nx
    b = smooth(-0.003, 0.002, topl - z) * smooth(-0.004, 0.006, z - lowl)
    b = np.maximum(b, sideb * smooth(-0.004, 0.004, z - mouth[2]) * (z < eyeL[2] + 0.025))
    return b * (y < eyeL[1] + 0.055) * (le_ > 1.2) * (z < eyeL[2] + 0.03)


head_faces = [fi for fi in body_faces if all(reg[v] in ("head", "neck") for v in F[fi])]
bp_, bn_, buv = sample_roots(head_faces, 30000, beard_mask, oversample=12)
must = (bp_[:, 2] > mouth[2] + 0.004) & (np.abs(bp_[:, 0]) < 0.035)               # moustache hairs
bflow = np.tile(np.array([0, 0, -1.0]), (len(bp_), 1)); bflow[:, 0] += np.sign(bp_[:, 0]) * np.where(must, 0.7, 0.15)
bflow[:, 1] += np.where(bp_[:, 2] < mouth[2] - 0.04, 0.5, 0)
bL = np.where(must, 0.0085, 0.0065) * (0.8 + 0.4 * rng.random(len(bp_)))
bpts = grow(bp_, bn_, bflow, bL, np.full(len(bp_), 0.55), 5, 0.0012, 1.5, clump=0.2)
make_curves("Beard", bpts, buv, 0.00009, 0.00003, BEARD_M)


def brow_mask(p):
    out = np.zeros(len(p))
    for c, s in ((eyeL, 1), (eyeR, -1)):
        dx = (p[:, 0] - c[0]) * s; dz = p[:, 2] - c[2]
        zc = 0.021 + 0.004 * (1 - ((dx - 0.006) / 0.03) ** 2); th = 0.0058 - 0.0028 * np.clip((dx + 0.026) / 0.058, 0, 1)
        out = np.maximum(out, (np.abs(dz - zc) < th * 1.15) * (dx > -0.027) * (dx < 0.033) * (p[:, 1] < c[1] + 0.01))
    return out


wp, wn, wuv = sample_roots(head_faces, 3200, brow_mask, oversample=160)
wflow = np.stack([np.sign(wp[:, 0]), np.zeros(len(wp)), np.full(len(wp), 0.3)], 1)
wpts = grow(wp, wn, wflow, np.full(len(wp), 0.0075), np.full(len(wp), 0.12), 4, 0.0004, 1.0)
make_curves("Brows", wpts, wuv, 0.00007, 0.00003, BEARD_M)

# ---------------------------------------------------------------- 3. clothing: clean edges, collars, thickness, fabric
bvh_body = BVHTree.FromPolygons([tuple(map(float, p)) for p in P], [F[fi] for fi in body_faces])
_top = Vector((0, float(cap_c[1]), float(P[body_idx, 2].max()) + 0.2))
NSIGN = 1.0 if bvh_body.find_nearest(_top)[1].z > 0 else -1.0
print("body normal sign", NSIGN)


def relax_and_fit(ob, clear, collar=None):
    bm = bmesh.new(); bm.from_mesh(ob.data); bm.verts.ensure_lookup_table()
    for _ in range(14):                                   # smooth jagged hems/necklines along the boundary
        new = {}
        for v in bm.verts:
            if v.is_boundary:
                nb = [e.other_vert(v) for e in v.link_edges if e.is_boundary]
                if len(nb) == 2: new[v] = v.co * 0.5 + (nb[0].co + nb[1].co) * 0.25
        for v, co in new.items(): v.co = co
    bmesh.ops.smooth_laplacian_vert(bm, verts=bm.verts[:], lambda_factor=0.6, lambda_border=0.0, use_x=True, use_y=True, use_z=True, preserve_volume=True)
    for v in bm.verts:                                   # keep cloth outside the skin
        loc, nrm_, _, d = bvh_body.find_nearest(v.co)
        if loc is None: continue
        out_n = nrm_.normalized() * NSIGN
        if (v.co - loc).dot(out_n) < clear:            # inside the skin or closer than the clearance
            v.co = loc + out_n * clear
    if collar:
        up, out1, out2, down = collar
        ring = [v for v in bm.verts if v.is_boundary and v.co.z > neck_z - 0.06 and abs(v.co.x) < 0.13]
        edges = [e for e in bm.edges if e.is_boundary and all(x in ring for x in e.verts)]
        if edges:
            ext = bmesh.ops.extrude_edge_only(bm, edges=edges)
            nv = [g for g in ext["geom"] if isinstance(g, bmesh.types.BMVert)]
            for v in nv:
                r = Vector((v.co.x, v.co.y - bh["Neck"][1], 0)).normalized()
                v.co += Vector((0, 0, up)) + r * out1
            if out2:
                e2 = [g for g in ext["geom"] if isinstance(g, bmesh.types.BMEdge) and all(x in nv for x in g.verts)]
                ext2 = bmesh.ops.extrude_edge_only(bm, edges=e2)
                for v in [g for g in ext2["geom"] if isinstance(g, bmesh.types.BMVert)]:
                    r = Vector((v.co.x, v.co.y - bh["Neck"][1], 0)).normalized()
                    v.co += r * out2 + Vector((0, 0, -down))
    bm.to_mesh(ob.data); bm.free()
    for p in ob.data.polygons: p.use_smooth = True
    so = ob.modifiers.new("Thickness", "SOLIDIFY"); so.thickness = 0.0025; so.offset = -1; so.use_even_offset = True
    ss = ob.modifiers.new("Smooth", "SUBSURF"); ss.levels = 1; ss.render_levels = 2


def fabric(ob, sheen=0.35, fold=0.22, weave=3200):
    m = ob.data.materials[0]; b = m.node_tree.nodes["Principled BSDF"]
    set_in(b, "Sheen Weight", sheen); set_in(b, "Sheen Roughness", 0.5); set_in(b, "Roughness", 0.82); set_in(b, "Specular IOR Level", 0.2)
    w = uv_noise_bump(m, b, 38, fold, 0.006, "noise")
    tc = nt_new(m, "ShaderNodeTexCoord"); wv = nt_new(m, "ShaderNodeTexWave"); wv.inputs["Scale"].default_value = weave
    link(m, tc.outputs["UV"], wv.inputs["Vector"]); b2 = nt_new(m, "ShaderNodeBump"); b2.inputs["Strength"].default_value = 0.06
    link(m, wv.outputs["Fac"], b2.inputs["Height"]); link(m, b2.outputs["Normal"], w.inputs["Normal"])


def shirt_fn(p, c):
    plk = (np.abs(p[:, 0]) < 0.014) & (p[:, 1] < 0) & (p[:, 2] < neck_z); c[plk] *= 0.93
    for k in range(7):
        bz = neck_z - 0.04 - k * 0.075
        c[(np.hypot(p[:, 0], p[:, 2] - bz) < 0.0048) & (p[:, 1] < 0)] = np.array([0.92, 0.92, 0.9])
    pk = box(p, 0.085, chest_z - 0.04, 0.10, 0.11) * (np.abs(np.abs(p[:, 0] - 0.085) - 0.05) < 0.002); c[pk > 0] *= 0.85
    return c


shirt = build_part("Top_Shirt_SkyBlue", top_faces(("fore", 0.72)), offset=0.013)
shirt.data.materials.append(material("Top_Shirt_SkyBlue", img=cloth_tex("tex_Top_Shirt_SkyBlue", (0.55, 0.68, 0.82), shirt_fn), rough=0.8, double=True))
pieces[shirt.name] = shirt
OUTFITS = {
    "casual": ["Top_Tee_Cream", "Top_Overshirt_Charcoal", "Bottom_Chinos_Black", "Shoes_Sneakers_White"],
    "hoodie": ["Top_Hoodie_Navy", "Bottom_Chinos_Black", "Shoes_Sneakers_White"],
    "shirt": ["Top_Shirt_SkyBlue", "Bottom_Jeans_Blue", "Shoes_Sneakers_White"],
    "tee": ["Top_Tee_Black", "Bottom_Jeans_Blue", "Shoes_Sneakers_White"],
}
arm["outfits"] = json.dumps(OUTFITS)
bpy.data.objects.remove(host, do_unlink=True)
CLEAR = {"Top_Tee_Cream": (0.004, None), "Top_Tee_Black": (0.004, None),
         "Top_Overshirt_Charcoal": (0.016, (0.022, 0.006, 0.03, 0.022)), "Top_Shirt_SkyBlue": (0.009, (0.02, 0.004, 0.028, 0.02)),
         "Top_Hoodie_Navy": (0.018, (0.018, 0.014, 0.0, 0.0)), "Bottom_Chinos_Black": (0.012, None), "Bottom_Jeans_Blue": (0.012, None)}
for n, (clear, collar) in CLEAR.items():
    relax_and_fit(pieces[n], clear, collar); fabric(pieces[n], sheen=0.5 if "Hoodie" in n else 0.3, fold=0.3 if "Bottom" in n else 0.22)
sh = pieces["Shoes_Sneakers_White"]; ss = sh.modifiers.new("Smooth", "SUBSURF"); ss.levels = 1; ss.render_levels = 2
for p in sh.data.polygons: p.use_smooth = True

# ---------------------------------------------------------------- 5. save + export
bpy.ops.wm.save_as_mainfile(filepath=str(OUT / "avir.blend"), compress=True)
for o in bpy.data.objects:
    if o.type == "CURVES": o.hide_set(True); o.hide_render = True
bpy.ops.export_scene.gltf(filepath=str(OUT / "avir.glb"), export_format="GLB", export_skins=True, export_morph=True,
                          export_morph_normal=False, export_animations=True, export_animation_mode="ACTIONS", use_visible=True,
                          export_image_format="JPEG", export_jpeg_quality=88, export_extras=True, export_yup=True)
print("v2 export ok", (OUT / "avir.glb").stat().st_size // 1024, "KB")
