-- 1. customer_vendors_for_product: match the item by the vendor's name, the English name or the
--    catalog item, not only the exact typed name. The customer app sent the English name
--    ("Tomato") while products.name is "Tamatar", so every item sold by 2+ vendors showed
--    "No one sells this here yet". In-stock vendors first.
-- 2. customer_create_booking: refuse items that went out of stock (or were removed) since the
--    customer's page loaded, naming them, instead of booking something the vendor doesn't have.
--    And when the customer's items are from a chosen vendor who is full / closed in that slot,
--    say so — it used to hand the order to another vendor (match_vendor) with the first
--    vendor's items and prices.
create or replace function public.customer_vendors_for_product(p_area text, p_product_name text)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare res jsonb; q text := lower(trim(p_product_name)); keys text[];
begin
  select array_agg(distinct catalog_key) into keys from products
   where catalog_key is not null and (lower(trim(name)) = q or lower(trim(coalesce(name_en,''))) = q);
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', v.id, 'name', v.name, 'v_type', v.v_type,
           'photo_url', v.photo_url,
           'avg_rating', coalesce(v.avg_rating, 0),
           'total_ratings', coalesce(v.total_ratings, 0),
           'orders_completed', coalesce(oc.n, 0),
           'product_id', p.id, 'price', p.price, 'unit', p.unit, 'in_stock', p.in_stock
         ) order by p.in_stock desc, coalesce(v.avg_rating,0) desc, coalesce(oc.n,0) desc), '[]'::jsonb)
    into res
    from vendors v
    join products p on p.vendor_id = v.id
    left join (select vendor_id, count(*) n from bookings
                where status in ('delivered','completed') group by vendor_id) oc on oc.vendor_id = v.id
   where v.status = 'approved' and v.is_active and p_area = any(v.areas_served)
     and p.review_status = 'approved'
     and (lower(trim(p.name)) = q or lower(trim(coalesce(p.name_en,''))) = q
          or (p.catalog_key is not null and p.catalog_key = any(coalesce(keys, '{}'))));
  return jsonb_build_object('ok', true, 'data', res);
end $$;

do $$ declare d text; begin
  d := pg_get_functiondef('public.customer_create_booking(vendor_type, uuid, date, time_slot, jsonb, text, uuid)'::regprocedure);
  if position('OUT_OF_STOCK' in d) = 0 then
    d := replace(d, $x$  if p_vendor_id is not null then$x$,
$x$  -- items that are out of stock / removed since the page loaded
  select string_agg(coalesce(pr.name, '?'), ', ') into oos
    from jsonb_array_elements(p_items) e
    left join products pr on pr.id = (e->>'product_id')::uuid
   where pr.id is null or not pr.in_stock or pr.review_status <> 'approved';
  if oos is not null then
    return jsonb_build_object('ok', false, 'code', 'OUT_OF_STOCK',
      'msg', tr('Ye saman abhi stock me nahi hai: ', 'Out of stock right now: ') || oos);
  end if;

  if p_vendor_id is not null then$x$);
    d := replace(d, $x$  if vid is null then
    vid := match_vendor(p_type, addr.area, p_date, p_slot);
  end if;$x$, $x$  if vid is null and p_vendor_id is not null then
    return jsonb_build_object('ok', false, 'code', 'VENDOR_FULL',
      'msg', tr('Aapka chuna hua vendor is slot me free nahi hai. Dusra slot ya din chuno.',
                'The vendor you picked is not free in this slot. Please pick another slot or day.'));
  end if;
  if vid is null then
    vid := match_vendor(p_type, addr.area, p_date, p_slot);
  end if;$x$);
    d := replace(d, 'it jsonb; prod products; total numeric := 0;', 'it jsonb; prod products; total numeric := 0; oos text;');
    execute d;
  end if;
end $$;
