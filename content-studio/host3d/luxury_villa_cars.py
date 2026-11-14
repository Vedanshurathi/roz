# Two cars for the car porch (executed in luxury_villa.py's namespace): a long luxury sedan and a boxy luxury 4x4.
# Bodies are lofted from cross-section stations (smooth subdivision surface, wheel arches cut with booleans); each car
# has glass you can see through and a real cabin: seats, dashboard with screens, steering wheel, console, door cards.
# They resemble a German executive sedan and a British off-roader; badges are generic (no brand logos).
CUR[0] = "Cars"


def paint(name, col, flake=0.0):
    """Car paint with a clear coat; the inside of the shell (back faces) is a dark headliner."""
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; b = nt.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*col, 1); b.inputs["Metallic"].default_value = 0.55 if flake else 0.0; b.inputs["Roughness"].default_value = 0.32
    b.inputs["Coat Weight"].default_value = 1.0; b.inputs["Coat Roughness"].default_value = 0.03
    inner = nt.nodes.new("ShaderNodeBsdfDiffuse"); inner.inputs["Color"].default_value = (0.035, 0.033, 0.03, 1)
    geo = nt.nodes.new("ShaderNodeNewGeometry"); mx = nt.nodes.new("ShaderNodeMixShader"); out = nt.nodes["Material Output"]
    nt.links.new(geo.outputs["Backfacing"], mx.inputs["Fac"]); nt.links.new(b.outputs["BSDF"], mx.inputs[1]); nt.links.new(inner.outputs["BSDF"], mx.inputs[2])
    nt.links.new(mx.outputs["Shader"], out.inputs["Surface"]); return m


CARGLASS = glass_mat("CarGlass", (0.5, 0.56, 0.56), 0.12)
TYRE = noisy("Tyre", (0.012, 0.012, 0.012), (0.03, 0.03, 0.03), 80, 0.85, 0.4); ALLOY = mat("Alloy", (0.75, 0.76, 0.78), 0.22, metal=1.0); ALLOY_D = mat("AlloyDark", (0.08, 0.08, 0.085), 0.3, metal=1.0)
CHROME = mat("Chrome", (0.9, 0.9, 0.9), 0.06, metal=1.0); TRIM = mat("BlackTrim", (0.015, 0.015, 0.016), 0.55); HEAD = mat("HeadLamp", (1.0, 0.97, 0.9), 0.1, emit=9); TAIL = mat("TailLamp", (0.9, 0.03, 0.02), 0.2, emit=5)
PLATE = mat("NumberPlate", (0.92, 0.92, 0.9), 0.5); SCREEN = mat("CarScreen", (0.02, 0.05, 0.12), 0.08, emit=0.9, ecol=(0.12, 0.35, 0.75)); AMB = mat("AmbientStrip", (0.3, 0.6, 1.0), 0.3, emit=1.6)


def add_stations(st, xs):
    """Insert interpolated stations at the given x positions (so pillar spans get their own face loops)."""
    st = sorted(st)
    for x in xs:
        if any(abs(s[0] - x) < 1e-4 for s in st): continue
        for i in range(len(st) - 1):
            if st[i][0] < x < st[i + 1][0]:
                t = (x - st[i][0]) / (st[i + 1][0] - st[i][0]); st.insert(i + 1, tuple(a_ + (b_ - a_) * t for a_, b_ in zip(st[i], st[i + 1]))); break
    return st


def loft(name, st, par, mats, pillars=(), crease=0.55):
    st = add_stations(st, [x for p in pillars for x in p])
    """st: stations along x = (x, z_floor, z_belt, z_roof, w_floor, w_belt, w_roof); greenhouse where z_roof - z_belt > 0.2.
    pillars: x-ranges whose side window faces stay painted. mats = [paint, glass]."""
    me = bpy.data.meshes.new(name); bm = bmesh.new(); rings = []

    def ring(x, zf, zb, zr, wf, wb, wr):
        half = [(0.0, zf), (wf * 0.8, zf), (wf, zf + 0.09), (wb + 0.012, (zf + zb) / 2 + 0.04), (wb, zb), (wb - (wb - wr) * 0.55, zb + (zr - zb) * 0.62), (wr, zr - 0.035), (wr * 0.5, zr), (0.0, zr)]
        pts = [(x, y, z) for y, z in half] + [(x, -y, z) for y, z in reversed(half[1:-1])]
        return [bm.verts.new(p) for p in pts]
    for s in st: rings.append(ring(*s))
    n = len(rings[0]); cr = bm.edges.layers.float.new("crease_edge")
    for i in range(len(rings) - 1):
        a, b = rings[i], rings[i + 1]; green = (st[i][3] - st[i][2] > 0.2) and (st[i + 1][3] - st[i + 1][2] > 0.2)
        xm = (st[i][0] + st[i + 1][0]) / 2; pill = any(p0 <= xm <= p1 for p0, p1 in pillars)
        slope = (st[i][3] - st[i][2] > 0.2) != (st[i + 1][3] - st[i + 1][2] > 0.2)     # windscreen / rear screen span
        for k in range(n):
            k2 = (k + 1) % n; f = bm.faces.new((a[k], b[k], b[k2], a[k2])); f.smooth = True
            side_win = k in (4, 5, n - 6, n - 5)          # belt -> upper window -> roof edge, both sides
            top = k in (6, 7, n - 8, n - 7)
            f.material_index = 1 if ((green and side_win and not pill) or (slope and (top or side_win))) else (2 if (green and top and len(mats) > 2) else 0)
        for k in (4, n - 4):
            e = bm.edges.get((a[k], b[k]))
            if e: e[cr] = crease
    for end, rev in ((rings[0], False), (rings[-1], True)):
        c = bm.verts.new((sum(v.co.x for v in end) / n, 0, sum(v.co.z for v in end) / n))
        for k in range(n):
            k2 = (k + 1) % n; bm.faces.new((end[k2], end[k], c) if not rev else (end[k], end[k2], c)).smooth = True
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); link(o, par)
    for m in mats: me.materials.append(m)
    ss = o.modifiers.new("subsurf", "SUBSURF"); ss.levels = 2; ss.render_levels = 2
    return o


def wheel(name, par, x, y, r, w, dark=False, spokes=10):
    side = 1 if y > 0 else -1; e = bpy.data.objects.new(name, None); e.location = (x, y, r); link(e, par)
    t = cyl(name + "Tyre", (0, 0, 0), r, w, TYRE, rot=(PI2, 0, 0), verts=48, parent=e); bv = t.modifiers.new("bevel", "BEVEL"); bv.width = 0.05; bv.segments = 4
    cyl(name + "Rim", (0, side * (w / 2 - 0.03), 0), r * 0.7, 0.05, TRIM, rot=(PI2, 0, 0), verts=40, parent=e)
    cyl(name + "RimLip", (0, side * (w / 2 + 0.002), 0), r * 0.72, 0.02, ALLOY, rot=(PI2, 0, 0), verts=40, parent=e)
    cyl(name + "Disc", (0, side * (w / 2 - 0.06), 0), r * 0.5, 0.02, mat(name + "DiscM", (0.4, 0.4, 0.42), 0.4, metal=1.0), rot=(PI2, 0, 0), verts=32, parent=e)
    sp = [((r * 0.36 * math.cos(q), side * (w / 2 + 0.006), r * 0.36 * math.sin(q)), (r * 0.64, 0.03, 0.055), 0) for q in [k * 6.2832 / spokes for k in range(spokes)]]
    me = bpy.data.meshes.new(name + "Spokes"); bm = bmesh.new()
    for (lx, ly, lz), sz, _ in sp:
        ang = math.atan2(lz, lx); bmesh.ops.create_cube(bm, size=1, matrix=Matrix.Translation((lx, ly, lz)) @ Matrix.Rotation(-ang, 4, "Y") @ Matrix.Diagonal((*sz, 1)))
    bm.to_mesh(me); bm.free(); so = bpy.data.objects.new(name + "Spokes", me); link(so, e); me.materials.append(ALLOY if not dark else mat(name + "SpokeM", (0.22, 0.22, 0.23), 0.3, metal=1.0))
    cyl(name + "Hub", (0, side * (w / 2 + 0.014), 0), r * 0.13, 0.03, CHROME, rot=(PI2, 0, 0), verts=24, parent=e)


def arches(body, par, name, xs, hw, r):
    for i, x in enumerate(xs):
        for s in (-1, 1):
            c = cyl(f"{name}ArchCut{i}{s}", (x, s * hw, r - 0.01), r + 0.075, 0.62, None, rot=(PI2, 0, 0), verts=40, parent=par); c.hide_render = True; c.display_type = "WIRE"
            bo = body.modifiers.new(f"arch{i}{s}", "BOOLEAN"); bo.operation = "DIFFERENCE"; bo.object = c; bo.solver = "EXACT"
            cyl(f"{name}WellLiner{i}{s}", (x, s * (hw - 0.33), r - 0.01), r + 0.1, 0.36, TRIM, rot=(PI2, 0, 0), verts=32, parent=par)


def seat(name, par, x, y, z, w=0.52, leather=None, bench=False):
    lm = leather or M["leather"]; d = 0.5
    box(name + "Base", (x, y, z + 0.09), (d, w, 0.16), lm, 0.05, parent=par)
    bk = box(name + "Back", (x - d / 2 - 0.04, y, z + 0.44), (0.13, w, 0.62), lm, 0.05, parent=par); bk.rotation_euler = (0, -0.26, 0)
    n = 3 if bench else 1
    for k in range(n):
        yy = y + (k - (n - 1) / 2) * (w / n) if bench else y
        hr = box(name + f"Head{k}", (x - d / 2 - 0.16, yy, z + 0.86), (0.1, 0.24, 0.18), lm, 0.04, parent=par); hr.rotation_euler = (0, -0.2, 0)
    if not bench:
        for s in (-1, 1): box(name + "Bolster", (x, y + s * (w / 2 - 0.035), z + 0.16), (d * 0.9, 0.07, 0.08), lm, 0.03, parent=par)


def cabin(name, par, floor_z, front_x, hw, leather, rhd=True, three_rows=False, rear_x=None, dash_w=None):
    """Seats, dashboard with a wide screen, steering wheel, centre console, door cards, mirror."""
    dy = 0.37; sx = front_x - 0.75; drv = -dy if rhd else dy           # India: right-hand drive (driver on the -y side when facing +x)
    box(name + "Floor", (front_x - 1.3, 0, floor_z + 0.02), (3.1, hw * 2 - 0.12, 0.04), M["rug_d"], parent=par)
    seat(name + "SeatD", par, sx, drv, floor_z + 0.2, leather=leather); seat(name + "SeatP", par, sx, -drv, floor_z + 0.2, leather=leather)
    rx = rear_x if rear_x is not None else sx - 0.95
    seat(name + "SeatR", par, rx, 0, floor_z + 0.2, w=hw * 2 - 0.5, leather=leather, bench=True)
    if three_rows: seat(name + "SeatR3", par, rx - 0.85, 0, floor_z + 0.2, w=hw * 2 - 0.6, leather=leather, bench=True)
    dw = dash_w or (hw * 2 - 0.16)
    box(name + "Dash", (front_x - 0.02, 0, floor_z + 0.66), (0.34, dw, 0.3), TRIM, 0.07, parent=par); box(name + "DashPad", (front_x - 0.1, 0, floor_z + 0.83), (0.3, dw - 0.05, 0.05), leather, 0.02, parent=par)
    box(name + "DashWood", (front_x - 0.2, 0, floor_z + 0.7), (0.02, dw - 0.2, 0.07), M["walnut_y"], parent=par)
    sc_ = box(name + "Screen", (front_x - 0.22, 0.0, floor_z + 0.86), (0.02, dw * 0.62, 0.17), SCREEN, 0.006, parent=par); sc_.rotation_euler = (0, 0.18, 0)
    box(name + "ScreenBezel", (front_x - 0.21, 0.0, floor_z + 0.86), (0.02, dw * 0.64, 0.19), TRIM, 0.008, parent=par).rotation_euler = (0, 0.18, 0)
    boxes(name + "Vents", [((front_x - 0.21, s * (dw / 2 - 0.12), floor_z + 0.72), (0.02, 0.14, 0.07), 0) for s in (-1, 1)], [CHROME], parent=par)
    box(name + "Ambient", (front_x - 0.2, 0, floor_z + 0.64), (0.012, dw - 0.1, 0.012), AMB, parent=par)
    # steering wheel on a raked column
    sw = bpy.data.objects.new(name + "Steer", None); sw.location = (front_x - 0.42, drv, floor_z + 0.72); sw.rotation_euler = (0, -1.2, 0); link(sw, par)
    me = bpy.data.meshes.new(name + "SteerRing"); bm = bmesh.new();
    bmesh.ops.create_circle(bm, segments=32, radius=0.185); bm.to_mesh(me); bm.free()
    ring_o = bpy.data.objects.new(name + "SteerRing", me); link(ring_o, sw); sk = ring_o.modifiers.new("skin", "SKIN")
    for v in me.skin_vertices[0].data: v.radius = (0.017, 0.017)
    ring_o.modifiers.new("ss", "SUBSURF").levels = 1; me.materials.append(leather)
    boxes(name + "SteerSpokes", [((0, 0, 0), (0.34, 0.035, 0.02), 0), ((0, -0.09, 0), (0.035, 0.17, 0.02), 0), ((0, 0, 0), (0.1, 0.1, 0.035), 1)], [TRIM, CHROME], bevel=0.008, parent=sw)
    cyl(name + "SteerCol", (front_x - 0.28, drv, floor_z + 0.66), 0.03, 0.3, TRIM, rot=(0, PI2 - 0.37, 0), verts=12, parent=par)
    box(name + "Binnacle", (front_x - 0.2, drv, floor_z + 0.86), (0.03, 0.32, 0.12), SCREEN, 0.006, parent=par)
    # centre console, armrest, gear selector, cup holders
    box(name + "Console", (sx + 0.1, 0, floor_z + 0.3), (1.1, 0.24, 0.3), TRIM, 0.04, parent=par); box(name + "ConsoleWood", (sx + 0.25, 0, floor_z + 0.455), (0.6, 0.2, 0.012), M["walnut"], parent=par)
    box(name + "Armrest", (sx - 0.22, 0, floor_z + 0.5), (0.4, 0.22, 0.08), leather, 0.03, parent=par); cyl(name + "Selector", (sx + 0.3, 0.02, floor_z + 0.5), 0.022, 0.07, CHROME, verts=16, parent=par)
    for s in (-1, 1): cyl(name + f"Cup{s}", (sx + 0.05, s * 0.05, floor_z + 0.46), 0.036, 0.02, CHROME, verts=20, parent=par)
    # door cards with armrests and ambient light
    for s in (-1, 1):
        box(name + f"DoorCard{s}", (front_x - 1.35, s * (hw - 0.085), floor_z + 0.5), (2.5, 0.03, 0.55), leather, 0.01, parent=par)
        box(name + f"DoorArm{s}", (front_x - 1.3, s * (hw - 0.12), floor_z + 0.52), (2.2, 0.07, 0.05), TRIM, 0.02, parent=par); box(name + f"DoorAmb{s}", (front_x - 1.3, s * (hw - 0.103), floor_z + 0.62), (2.2, 0.008, 0.01), AMB, parent=par)
    box(name + "Mirror", (front_x - 0.5, 0, floor_z + 1.12), (0.03, 0.22, 0.06), TRIM, 0.01, parent=par)
    plight(name + "CabinL", (front_x - 1.2, 0, floor_z + 1.0), 6, (1.0, 0.85, 0.7), 0.1).parent = par


def car_common(name, par, L2, hw, nose_z, lamp_y, lamp_w, grille=None, tail_strip=True, plate_z=0.42):
    xf, xr = L2, -L2
    for s in (-1, 1):
        box(name + f"Head{s}", (xf - 0.07, s * lamp_y, nose_z), (0.08, lamp_w, 0.07), HEAD, 0.015, parent=par); box(name + f"DRL{s}", (xf - 0.05, s * lamp_y, nose_z - 0.06), (0.05, lamp_w, 0.012), HEAD, parent=par)
        box(name + f"Tail{s}", (xr + 0.06, s * lamp_y, nose_z + 0.08), (0.08, lamp_w, 0.06), TAIL, 0.012, parent=par)
        sl = bpy.data.lights.new(name + f"HeadL{s}", "SPOT"); sl.energy = 60; sl.spot_size = 1.0; sl.color = (1.0, 0.96, 0.88); so_ = bpy.data.objects.new(name + f"HeadL{s}", sl); so_.location = (xf + 0.02, s * lamp_y, nose_z)
        so_.rotation_euler = (0, -PI2 + 0.14, 0); link(so_, par)
    if tail_strip: box(name + "TailStrip", (xr + 0.045, 0, nose_z + 0.08), (0.05, lamp_y * 2, 0.02), TAIL, parent=par)
    for x, nm in ((xf - 0.015, "PlateF"), (xr + 0.015, "PlateR")):
        box(name + nm, (x, 0, plate_z), (0.02, 0.5, 0.12), PLATE, 0.004, parent=par)
        fc_ = bpy.data.curves.new(name + nm + "T", "FONT"); fc_.body = "UA 07 AV 0007"; fc_.size = 0.062; fc_.extrude = 0.002; fc_.align_x = "CENTER"; fc_.align_y = "CENTER"
        to = bpy.data.objects.new(name + nm + "T", fc_); to.location = (x + (0.012 if x > 0 else -0.012), 0, plate_z); to.rotation_euler = (PI2, 0, PI2 if x > 0 else -PI2); link(to, par); to.data.materials.append(TRIM)
    for s in (-1, 1):
        blobs(name + f"Mirror{s}", [((0.75, s * (hw + 0.1), nose_z + 0.3), (0.1, 0.055, 0.06), 0, (0, 0, s * 0.3))], [TRIM], seg=12, parent=par)
        boxes(name + f"Handles{s}", [((x, s * (hw + 0.012), nose_z + 0.14), (0.16, 0.02, 0.025), 0) for x in (0.05, -0.95)], [CHROME], bevel=0.006, parent=par)
        boxes(name + f"Seams{s}", [((x, s * (hw + 0.008), nose_z - 0.1), (0.006, 0.008, 0.62), 0) for x in (0.72, -0.32, -1.3)], [TRIM], parent=par)
    box(name + "Underbody", (0, 0, 0.2), (L2 * 2 - 1.5, hw * 2 - 0.5, 0.04), TRIM, parent=par)


def sedan(name, loc, rotz, col):
    """Executive sedan (about 5.2 x 1.92 x 1.47 m): long bonnet, flowing roof, chrome grille with a round badge."""
    par = empty(name, loc, rotz); P_ = paint(name + "Paint", col, flake=1.0); L2, hw, r = 2.6, 0.96, 0.345
    st = [(-2.6, 0.42, 0.62, 0.7, 0.55, 0.62, 0.55), (-2.45, 0.24, 0.84, 0.96, 0.82, 0.9, 0.8), (-1.9, 0.19, 0.92, 1.02, 0.92, 0.955, 0.86), (-1.45, 0.19, 0.94, 1.06, 0.93, 0.96, 0.86),
          (-1.0, 0.19, 0.95, 1.4, 0.94, 0.96, 0.68), (-0.4, 0.19, 0.95, 1.465, 0.94, 0.96, 0.7), (0.2, 0.19, 0.95, 1.46, 0.94, 0.96, 0.7), (0.62, 0.19, 0.95, 1.4, 0.94, 0.96, 0.68),
          (1.12, 0.19, 0.94, 1.05, 0.93, 0.955, 0.84), (1.7, 0.19, 0.9, 0.98, 0.92, 0.95, 0.82), (2.3, 0.21, 0.8, 0.88, 0.86, 0.9, 0.74), (2.56, 0.3, 0.62, 0.7, 0.62, 0.68, 0.56), (2.6, 0.4, 0.56, 0.62, 0.5, 0.55, 0.45)]
    body = loft(name + "Body", st, par, [P_, CARGLASS], pillars=((-0.42, -0.3),))
    arches(body, par, name, (1.62, -1.6), hw, r)
    for i, x in enumerate((1.62, -1.6)):
        for s in (-1, 1): wheel(f"{name}Wheel{i}{s}", par, x, s * (hw - 0.14), r, 0.25, spokes=10)
    car_common(name, par, L2, hw, 0.72, 0.62, 0.36)
    box(name + "Grille", (2.585, 0, 0.6), (0.05, 0.86, 0.26), TRIM, 0.03, parent=par); boxes(name + "GrilleBars", [((2.612, 0, 0.5 + k * 0.05), (0.012, 0.8, 0.012), 0) for k in range(5)], [CHROME], parent=par)
    boxes(name + "GrilleFrame", [((2.61, 0, 0.735), (0.014, 0.9, 0.02), 0), ((2.61, 0, 0.465), (0.014, 0.9, 0.02), 0)], [CHROME], parent=par)
    cyl(name + "Badge", (2.625, 0, 0.6), 0.075, 0.012, CHROME, rot=(0, PI2, 0), verts=40, parent=par); cyl(name + "BadgeIn", (2.63, 0, 0.6), 0.06, 0.012, TRIM, rot=(0, PI2, 0), verts=40, parent=par)
    boxes(name + "Brightwork", [((-0.2, s * (hw + 0.006), 0.955), (2.1, 0.008, 0.016), 0) for s in (-1, 1)] + [((0, s * (hw - 0.01), 0.27), (2.3, 0.02, 0.02), 0) for s in (-1, 1)], [CHROME], parent=par)
    boxes(name + "Exhausts", [((-2.6, s * 0.55, 0.3), (0.04, 0.2, 0.06), 0) for s in (-1, 1)], [CHROME], bevel=0.01, parent=par)
    cabin(name, par, 0.2, 0.98, hw, mat(name + "Leather", (0.52, 0.4, 0.28), 0.45, coat=0.1), rear_x=-0.72)
    return par


def suv(name, loc, rotz, col, roof_col=(0.86, 0.86, 0.84)):
    """Boxy luxury 4x4 (about 5.0 x 2.0 x 1.97 m): upright screen, flat contrast roof, clad arches, spare wheel on the tail."""
    par = empty(name, loc, rotz); P_ = paint(name + "Paint", col); L2, hw, r = 2.45, 1.0, 0.41
    st = [(-2.45, 0.5, 1.05, 1.9, 0.9, 0.95, 0.9), (-2.4, 0.42, 1.08, 1.95, 0.97, 0.99, 0.95), (-1.5, 0.4, 1.1, 1.97, 0.99, 1.0, 0.96), (-0.5, 0.4, 1.1, 1.97, 0.99, 1.0, 0.96),
          (0.45, 0.4, 1.1, 1.96, 0.99, 1.0, 0.96), (0.8, 0.4, 1.1, 1.9, 0.99, 1.0, 0.94), (1.12, 0.4, 1.09, 1.19, 0.99, 1.0, 0.93), (1.9, 0.42, 1.06, 1.15, 0.98, 0.99, 0.92),
          (2.36, 0.45, 1.0, 1.08, 0.94, 0.96, 0.88), (2.45, 0.55, 0.9, 0.96, 0.84, 0.86, 0.78)]
    body = loft(name + "Body", st, par, [P_, CARGLASS, mat(name + "RoofPaint", roof_col, 0.3, coat=1.0)], pillars=((-0.55, -0.42), (-1.55, -1.42), (-2.45, -2.3), (0.42, 0.5)), crease=0.85)
    arches(body, par, name, (1.52, -1.5), hw, r)
    for i, x in enumerate((1.52, -1.5)):
        for s in (-1, 1):
            wheel(f"{name}Wheel{i}{s}", par, x, s * (hw - 0.13), r, 0.29, dark=True, spokes=6)
            fl = cyl(f"{name}Flare{i}{s}", (x, s * (hw + 0.005), r - 0.01), r + 0.13, 0.07, TRIM, rot=(PI2, 0, 0), verts=40, parent=par)   # arch cladding ring
            cut = cyl(f"{name}FlareCut{i}{s}", (x, s * (hw + 0.005), r - 0.01), r + 0.07, 0.2, None, rot=(PI2, 0, 0), verts=40, parent=par); cut.hide_render = True; cut.display_type = "WIRE"
            bo = fl.modifiers.new("hole", "BOOLEAN"); bo.operation = "DIFFERENCE"; bo.object = cut; bo.solver = "EXACT"
            cb = box(f"{name}FlareBase{i}{s}", (x, s * (hw + 0.005), 0.18), (1.3, 0.09, 0.4), None, parent=par); cb.hide_render = True; cb.display_type = "WIRE"
            b2 = fl.modifiers.new("flat", "BOOLEAN"); b2.operation = "DIFFERENCE"; b2.object = cb; b2.solver = "EXACT"
    car_common(name, par, L2, hw, 0.98, 0.72, 0.2, tail_strip=False, plate_z=0.62)
    boxes(name + "RoofRails", [((-0.8, s * 0.8, 1.965), (2.6, 0.04, 0.035), 0) for s in (-1, 1)] + [((-0.8 + k * 0.9, 0, 1.975), (0.05, 1.64, 0.03), 0) for k in (-1, 0, 1)], [TRIM], bevel=0.008, parent=par)
    boxes(name + "Cladding", [((0, s * (hw + 0.004), 0.5), (2.1, 0.03, 0.22), 0) for s in (-1, 1)] + [((2.42, 0, 0.52), (0.1, 1.8, 0.26), 0), ((-2.42, 0, 0.52), (0.1, 1.8, 0.24), 0)], [TRIM], bevel=0.012, parent=par)
    box(name + "Grille", (2.44, 0, 0.84), (0.05, 1.1, 0.16), TRIM, 0.02, parent=par); boxes(name + "GrilleBars", [((2.468, 0, 0.8 + k * 0.04), (0.01, 1.0, 0.014), 0) for k in range(3)], [ALLOY], parent=par)
    box(name + "SkidPlate", (2.44, 0, 0.42), (0.06, 1.0, 0.1), ALLOY, 0.015, parent=par); box(name + "BonnetPlateL", (1.6, 0.55, 1.16), (0.5, 0.3, 0.012), TRIM, 0.004, parent=par); box(name + "BonnetPlateR", (1.6, -0.55, 1.16), (0.5, 0.3, 0.012), TRIM, 0.004, parent=par)
    for s in (-1, 1): cyl(name + f"RoundLamp{s}", (2.445, s * 0.72, 0.98), 0.085, 0.03, HEAD, rot=(0, PI2, 0), verts=32, parent=par); box(name + f"AlpineWin{s}", (-1.9, s * 0.74, 1.945), (0.5, 0.12, 0.01), CARGLASS, parent=par)
    sp = bpy.data.objects.new(name + "Spare", None); sp.location = (-2.62, 0.1, 1.12 - r); sp.rotation_euler = (0, 0, PI2); link(sp, par); wheel(name + "SpareW", sp, 0, 0.001, r, 0.27, dark=True, spokes=6)
    box(name + "SideLadderBox", (-1.95, hw + 0.06, 1.5), (0.6, 0.1, 0.5), TRIM, 0.02, parent=par)     # side-mounted gear carrier
    cabin(name, par, 0.42, 1.02, hw, mat(name + "Leather", (0.2, 0.17, 0.13), 0.5, coat=0.1), rear_x=-0.55, three_rows=True)
    return par


# parked in the car porch, noses toward the street (-y)
sedan("Sedan", (17.45, 5.65, OUTZ + 0.03), -PI2, (0.045, 0.047, 0.052))
suv("SUV4x4", (20.95, 5.7, OUTZ + 0.03), -PI2, (0.16, 0.2, 0.15))
