-- 19 Oct 2026 — uploaded photos become files; rows keep only the link.
-- Vendor item photos, vendor profile photos and the photo copied into every booked item were stored as
-- base64 data URLs and sent inside every list: customer_home 873 KB (re-sent every 25 s while a logged-in
-- customer has the app open), customer_my_bookings 557 KB, admin_bookings 2.6 MB (admin refreshes every
-- 60 s). On the free plan's 5 GB/month that runs out with a handful of users.
-- Now the item-photos edge function (mode 'own') stores the photo once in the public bucket
-- item-photos/u/<sha256>.<ext> and photo_link_set() swaps the data URL for that link — only if the row
-- still holds the same photo. tg_photo_to_file starts it for every new upload. Customer profile photos stay
-- data URLs (only vendors see them; a public link would be less private).

-- the swap; service role only (the edge function)
create or replace function public.photo_link_set(p_table text, p_id uuid, p_sig text, p_url text)
 returns boolean language plpgsql security definer set search_path to 'public'
as $function$
declare n int := 0;
begin
  if p_url !~ '^https://srvpfyjmwaruebbkqkdj\.supabase\.co/storage/v1/object/public/item-photos/u/[0-9a-f]{32}\.(jpg|png|webp)$' then
    return false;
  end if;
  if p_table = 'products' then
    update products set image_url = p_url
     where id = p_id and image_url like 'data:%' and encode(sha256(convert_to(image_url, 'UTF8')), 'hex') = p_sig;
  elsif p_table = 'vendors' then
    update vendors set photo_url = p_url
     where id = p_id and photo_url like 'data:%' and encode(sha256(convert_to(photo_url, 'UTF8')), 'hex') = p_sig;
  elsif p_table = 'booking_items' then
    update booking_items set image_url = p_url
     where id = p_id and image_url like 'data:%' and encode(sha256(convert_to(image_url, 'UTF8')), 'hex') = p_sig;
  else
    return false;
  end if;
  get diagnostics n = row_count;
  return n > 0;
end $function$;
revoke execute on function public.photo_link_set(text, uuid, text, text) from public, anon, authenticated;
grant execute on function public.photo_link_set(text, uuid, text, text) to service_role;

-- a stored link is a valid photo too (the vendor app sends the item's current photo back when it is edited)
create or replace function public.rb_valid_photo(p text)
 returns boolean language sql immutable set search_path to 'pg_catalog'
as $function$
  select p is null
      or (length(p) <= 300000 and p ~ '^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$')
      or p ~ '^https://srvpfyjmwaruebbkqkdj\.supabase\.co/storage/v1/object/public/item-photos/u/[0-9a-f]{32}\.(jpg|png|webp)$'
$function$;

-- every new upload → file (async through pg_net; sent after the transaction commits)
create or replace function public.tg_photo_to_file()
 returns trigger language plpgsql security definer set search_path to 'public'
as $function$
declare v text := to_jsonb(new) ->> tg_argv[0]; tok jsonb;
begin
  if v is null or v not like 'data:image/%' then return new; end if;
  select value into tok from app_settings where key = 'item_photos_token';
  if tok is null then return new; end if;
  perform net.http_post(url := 'https://srvpfyjmwaruebbkqkdj.supabase.co/functions/v1/item-photos',
    body := jsonb_build_object('token', tok, 'mode', 'own', 'table', tg_table_name, 'id', new.id),
    headers := '{"Content-Type":"application/json"}'::jsonb, timeout_milliseconds := 30000);
  return new;
exception when others then
  return new;          -- never block a save because the photo could not be moved
end $function$;
revoke execute on function public.tg_photo_to_file() from public, anon, authenticated;

create or replace trigger trg_products_photo_file after insert or update of image_url on public.products
  for each row execute function public.tg_photo_to_file('image_url');
create or replace trigger trg_vendors_photo_file after insert or update of photo_url on public.vendors
  for each row execute function public.tg_photo_to_file('photo_url');
create or replace trigger trg_booking_items_photo_file after insert or update of image_url on public.booking_items
  for each row execute function public.tg_photo_to_file('image_url');
