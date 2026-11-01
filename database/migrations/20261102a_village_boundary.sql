-- 2 Nov 2026 — village boundaries drawn on the map in admin → Villages.
-- areas.boundary = [[lat,lng], …] (3–300 points, closed shape). A GPS point inside a drawn boundary belongs to that
-- village (confident); a village with a boundary no longer claims points outside it by radius. Villages without a
-- boundary keep the old centre + radius rule. Saving a boundary also sets radius_km (centre → farthest point) and keeps
-- the admin's centre pin when it is inside the shape, so everything that still uses centre + radius stays consistent.

alter table public.areas add column if not exists boundary jsonb;

-- point in polygon (ray casting); lat = y, lng = x
create or replace function public.rb_in_poly(p_lat double precision, p_lng double precision, p_poly jsonb)
returns boolean language plpgsql immutable set search_path = public as $$
declare n int; i int; j int; inside boolean := false; yi float8; xi float8; yj float8; xj float8;
begin
  if p_lat is null or p_lng is null or p_poly is null or jsonb_typeof(p_poly) <> 'array' then return false; end if;
  n := jsonb_array_length(p_poly);
  if n < 3 then return false; end if;
  j := n - 1;
  for i in 0..n-1 loop
    yi := (p_poly->i->>0)::float8; xi := (p_poly->i->>1)::float8;
    yj := (p_poly->j->>0)::float8; xj := (p_poly->j->>1)::float8;
    if ((yi > p_lat) <> (yj > p_lat)) and (p_lng < (xj - xi) * (p_lat - yi) / (yj - yi) + xi) then
      inside := not inside;
    end if;
    j := i;
  end loop;
  return inside;
end $$;

create or replace function public.admin_set_area_boundary(p_name text, p_points jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare a record; n int; i int; la float8; ln float8; clat float8 := 0; clng float8 := 0; r float8 := 0; pts jsonb := '[]'::jsonb;
begin
  perform admin_guard();
  select * into a from areas where name = p_name;
  if a.name is null then return jsonb_build_object('ok', false, 'msg', 'Gaon nahi mila'); end if;
  if p_points is null or jsonb_typeof(p_points) <> 'array' or jsonb_array_length(p_points) = 0 then
    update areas set boundary = null where name = p_name;
    return jsonb_build_object('ok', true, 'msg', p_name || ' ki boundary hata di — ab radius se kaam chalega', 'data', jsonb_build_object('points', 0));
  end if;
  n := jsonb_array_length(p_points);
  if n < 3 or n > 300 then return jsonb_build_object('ok', false, 'msg', 'Boundary ke liye 3 se 300 point chahiye'); end if;
  for i in 0..n-1 loop
    begin
      la := (p_points->i->>0)::float8; ln := (p_points->i->>1)::float8;
    exception when others then
      return jsonb_build_object('ok', false, 'msg', 'Point ' || (i+1) || ' sahi nahi hai');
    end;
    if la is null or ln is null or la < 6 or la > 37 or ln < 68 or ln > 98 then
      return jsonb_build_object('ok', false, 'msg', 'Point ' || (i+1) || ' India ke bahar hai');
    end if;
    pts := pts || jsonb_build_array(jsonb_build_array(round(la::numeric, 6), round(ln::numeric, 6)));
    clat := clat + la; clng := clng + ln;
  end loop;
  clat := clat / n; clng := clng / n;
  if a.lat is not null and rb_in_poly(a.lat::float8, a.lng::float8, pts) then clat := a.lat; clng := a.lng; end if;
  for i in 0..n-1 loop
    r := greatest(r, km_between(clat, clng, (pts->i->>0)::float8, (pts->i->>1)::float8));
  end loop;
  r := round(greatest(r, 0.3)::numeric, 2);
  update areas set boundary = pts, lat = clat, lng = clng, radius_km = r, coords_verified = true where name = p_name;
  return jsonb_build_object('ok', true, 'msg', p_name || ' ki boundary save ho gayi ✓', 'data', jsonb_build_object('points', n, 'radius_km', r));
end $$;
revoke all on function public.admin_set_area_boundary(text, jsonb) from public, anon;
grant execute on function public.admin_set_area_boundary(text, jsonb) to authenticated;

-- GPS → village: a drawn boundary decides first; otherwise nearest centre + radius (as before)
create or replace function public.area_from_point(p_lat double precision, p_lng double precision)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare best record; second record; inb record; res jsonb; confident boolean; in_rng boolean;
begin
  select coalesce(jsonb_agg(jsonb_build_object('area', x.name, 'distance', round(x.dist::numeric, 2), 'served', x.served)
           order by x.dist), '[]'::jsonb) into res
  from (
    select a.name, km_between(p_lat, p_lng, a.lat, a.lng) as dist,
           exists (select 1 from vendors v where v.status = 'approved' and v.is_active and a.name = any(v.areas_served)) as served
    from areas a where a.is_active and a.lat is not null
    order by km_between(p_lat, p_lng, a.lat, a.lng) limit 3
  ) x;

  select a.name, km_between(p_lat, p_lng, a.lat, a.lng) as dist,
         exists (select 1 from vendors v where v.status = 'approved' and v.is_active and a.name = any(v.areas_served)) as served
    into inb
  from areas a
  where a.is_active and a.boundary is not null and rb_in_poly(p_lat, p_lng, a.boundary)
  order by km_between(p_lat, p_lng, a.lat, a.lng) limit 1;
  if inb.name is not null then
    return jsonb_build_object('ok', true, 'data', jsonb_build_object(
      'area', inb.name, 'distance', round(coalesce(inb.dist, 0)::numeric, 2), 'in_range', true, 'served', inb.served,
      'verified', true, 'confident', true, 'inside_boundary', true, 'alternatives', res));
  end if;

  select a.name, a.radius_km, a.coords_verified, (a.boundary is not null) as has_shape,
         km_between(p_lat, p_lng, a.lat, a.lng) as dist,
         exists (select 1 from vendors v where v.status = 'approved' and v.is_active and a.name = any(v.areas_served)) as served
    into best
  from areas a where a.is_active and a.lat is not null
  order by km_between(p_lat, p_lng, a.lat, a.lng) asc limit 1;

  if best.name is null then
    return jsonb_build_object('ok', true, 'data', jsonb_build_object('in_range', false, 'confident', false));
  end if;

  select a.name, km_between(p_lat, p_lng, a.lat, a.lng) as dist into second
  from areas a where a.is_active and a.lat is not null and a.name <> best.name
  order by km_between(p_lat, p_lng, a.lat, a.lng) asc limit 1;

  -- a village with a drawn boundary only claims points inside it (checked above)
  in_rng := (not best.has_shape) and best.dist <= best.radius_km;
  confident := in_rng and best.coords_verified
               and best.dist <= best.radius_km * 0.75
               and (second.name is null or second.dist - best.dist >= 1.5);

  return jsonb_build_object('ok', true, 'data', jsonb_build_object(
    'area', best.name, 'distance', round(best.dist::numeric, 2), 'in_range', in_rng, 'served', best.served,
    'verified', best.coords_verified, 'confident', confident, 'alternatives', res));
end $$;

-- the customer site may draw the village outline
create or replace function public.public_areas()
returns jsonb language sql security definer set search_path = public as $$
  select coalesce(jsonb_agg(x order by x->>'name'), '[]'::jsonb) from (
    select jsonb_build_object(
      'name', a.name, 'lat', a.lat, 'lng', a.lng,
      'radius_km', a.radius_km, 'verified', a.coords_verified, 'boundary', a.boundary,
      'served', exists (
        select 1 from vendors v
        where v.status = 'approved' and v.is_active and a.name = any(v.areas_served))
    ) as x
    from areas a where a.is_active
  ) s;
$$;
