-- Vendor app: also return the real English name and the catalog photo (same ones customers see),
-- so the vendor's Stock / order screens stop showing guessed drawings. Same signature → no overload.
create or replace function public.vendor_my_products()
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $function$
declare res jsonb;
begin
  select coalesce(jsonb_agg(to_jsonb(p) order by p.sort_order, p.name), '[]'::jsonb) into res
    from (select id,name,name_hi,name_en,image_url,stock_image_url,unit,price,price_updated_at,in_stock,category,sort_order,
                 review_status, review_note, catalog_key,
                 (now() - price_updated_at > interval '24 hours') as price_is_stale
            from products where vendor_id = my_vendor_id()) p;
  return jsonb_build_object('ok', true, 'data', res);
end $function$;
