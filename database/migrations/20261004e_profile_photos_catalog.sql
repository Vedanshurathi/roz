-- 4 Oct 2026 — profile photos (customer ↔ vendor) + catalog: 20 new items and fresh photos.
-- Applied to production via the Supabase MCP on 4 Oct 2026; this file records what was run.

-- ── 1. Catalog: 20 new items (p108–p127) ─────────────────────────────────────
insert into catalog_items (key, art_key, name_en, name_hi, english_name, desc_en, desc_hi, category, default_unit, sort_order, is_active) values
  ('p108','p108','Aam','आम','Mango','Ripe mango','पका हुआ आम','fruit','1 kg',107,true),
  ('p109','p109','Mosambi','मौसमी','Sweet lime (Mosambi)','Sweet lime','मौसमी','fruit','1 kg',108,true),
  ('p110','p110','Kinnow','किन्नू','Kinnow','Juicy kinnow','रसीला किन्नू','fruit','1 kg',109,true),
  ('p111','p111','Sitaphal','सीताफल','Custard apple (Sitaphal)','Custard apple','शरीफ़ा / सीताफल','fruit','1 kg',110,true),
  ('p112','p112','Aloo Bukhara','आलू बुख़ारा','Plum','Plum','आलू बुख़ारा','fruit','500 g',111,true),
  ('p113','p113','Aadu','आड़ू','Peach','Peach','आड़ू','fruit','500 g',112,true),
  ('p114','p114','Anjeer','अंजीर','Fig','Fresh fig','ताज़ा अंजीर','fruit','250 g',113,true),
  ('p115','p115','Kiwi','कीवी','Kiwi','Kiwi fruit','कीवी','fruit','3 pc',114,true),
  ('p116','p116','Dragon Fruit','ड्रैगन फ्रूट','Dragon fruit','Dragon fruit','ड्रैगन फ्रूट','fruit','1 pc',115,true),
  ('p117','p117','Amla','आंवला','Indian gooseberry (Amla)','Indian gooseberry','आंवला','fruit','500 g',116,true),
  ('p118','p118','Shahtoot','शहतूत','Mulberry','Mulberry','शहतूत','fruit','250 g',117,true),
  ('p119','p119','Kairi','कच्चा आम','Raw mango','Raw green mango','कच्चा आम (कैरी)','vegetable','500 g',118,true),
  ('p120','p120','Nimbu','नींबू','Lemon','Lemon','नींबू','vegetable','250 g',119,true),
  ('p121','p121','Kacha Kela','कच्चा केला','Raw banana','Raw banana','कच्चा केला','vegetable','500 g',120,true),
  ('p122','p122','Kacha Papita','कच्चा पपीता','Raw papaya','Raw papaya','कच्चा पपीता','vegetable','1 pc',121,true),
  ('p123','p123','Hara Lehsun','हरा लहसुन','Green garlic','Green garlic','हरा लहसुन','vegetable','250 g',122,true),
  ('p124','p124','Salad Patta','सलाद पत्ता','Lettuce','Lettuce','सलाद पत्ता','vegetable','250 g',123,true),
  ('p125','p125','Cherry Tamatar','चेरी टमाटर','Cherry tomato','Cherry tomato','चेरी टमाटर','vegetable','250 g',124,true),
  ('p126','p126','Chhota Aloo','छोटा आलू','Baby potato','Baby potato','छोटा आलू','onion_potato','1 kg',125,true),
  ('p127','p127','Lal Pyaaz','लाल प्याज़','Red onion','Red onion','लाल प्याज़','onion_potato','1 kg',126,true)
on conflict (key) do update set name_en=excluded.name_en, name_hi=excluded.name_hi, english_name=excluded.english_name,
  desc_en=excluded.desc_en, desc_hi=excluded.desc_hi, category=excluded.category, default_unit=excluded.default_unit,
  sort_order=excluded.sort_order, is_active=true;

-- Photos: 46 items were (re)picked by eye from Wikipedia-article + Commons candidates (edge function item-photos,
-- mode 'compare'), then stored with mode 'catalog' items [{key, file:'File:…'}] → Storage item-photos/catalog/<key>.jpg,
-- catalog_items.image_url and products.stock_image_url updated by the function. 121/124 items now have a real photo;
-- p123 (green garlic), p54 (lotus stem), p89 (sangri) keep the drawing.
-- Scratch tables used for the async pg_net calls (safe to drop):
create table if not exists rb_photo_jobs (batch int primary key, req_id bigint, keys text[], created_at timestamptz default now());
create table if not exists rb_photo_titles (key text primary key, title text, q text);
alter table rb_photo_jobs enable row level security;
alter table rb_photo_titles enable row level security;
revoke all on rb_photo_jobs, rb_photo_titles from anon, authenticated;

-- ── 2. Profile photos ────────────────────────────────────────────────────────
-- Customer photo is shown only to the customer's vendor (vendor app), vendor photo only to customers.
alter table customers add column if not exists photo_url text;

CREATE OR REPLACE FUNCTION public.rb_valid_photo(p text)
 RETURNS boolean LANGUAGE sql IMMUTABLE
AS $function$
  select p is null or (length(p) <= 300000 and p ~ '^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$')
$function$;

CREATE OR REPLACE FUNCTION public.customer_set_profile(p_name text, p_photo text DEFAULT NULL::text, p_remove_photo boolean DEFAULT false)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
declare c customers;
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'msg', tr('Pehle login karo','Please log in first')); end if;
  if p_name is not null and (length(trim(p_name)) < 1 or length(p_name) > 80) then
    return jsonb_build_object('ok', false, 'msg', tr('Naam daalo','Enter your name'));
  end if;
  if not rb_valid_photo(p_photo) then return jsonb_build_object('ok', false, 'msg', tr('Ye photo nahi chalegi','This photo cannot be used')); end if;
  update customers set name = coalesce(nullif(trim(p_name),''), name),
         photo_url = case when p_remove_photo then null else coalesce(p_photo, photo_url) end
   where auth_user_id = auth.uid() returning * into c;
  if c.id is null then return jsonb_build_object('ok', false, 'msg', tr('Profile nahi mila','Profile not found')); end if;
  return jsonb_build_object('ok', true, 'msg', tr('Save ho gaya','Saved'),
    'data', jsonb_build_object('id', c.id, 'name', c.name, 'phone', c.phone, 'photo_url', c.photo_url));
end $function$;

CREATE OR REPLACE FUNCTION public.vendor_set_photo(p_photo text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
declare vid uuid := my_vendor_id();
begin
  if vid is null then return jsonb_build_object('ok', false, 'msg', tr('Vendor nahi mila','Vendor not found')); end if;
  if not rb_valid_photo(p_photo) then return jsonb_build_object('ok', false, 'msg', tr('Ye photo nahi chalegi','This photo cannot be used')); end if;
  update vendors set photo_url = p_photo where id = vid;
  return jsonb_build_object('ok', true, 'msg', tr('Photo save ho gayi','Photo saved'));
end $function$;

revoke execute on function customer_set_profile(text,text,boolean), vendor_set_photo(text) from public, anon;
grant execute on function customer_set_profile(text,text,boolean), vendor_set_photo(text) to authenticated;

insert into msg_i18n (roman, hi, en) select * from (values
  ('Ye photo nahi chalegi','यह फ़ोटो नहीं चलेगी','This photo cannot be used'),
  ('Photo save ho gayi','फ़ोटो सेव हो गई','Photo saved')) v(roman, hi, en)
where not exists (select 1 from msg_i18n m where m.roman = v.roman);

-- ── 3. booking_full: same columns + customer_photo, vendor_photo at the end ──
create or replace view booking_full as
 SELECT b.id, b.code, b.customer_id, b.vendor_id, b.schedule_id, b.address_id, b.v_type, b.booking_date, b.slot, b.status,
    b.delivery_otp, b.otp_verified_at, b.otp_attempts, b.otp_issue_note, b.bill_final_at, b.bill_approved_at,
    b.est_total, b.final_total, b.note, b.cancel_reason, b.dispute_reason, b.admin_note, b.created_at, b.updated_at,
    c.name AS customer_name, c.phone AS customer_phone, v.name AS vendor_name, v.phone AS vendor_phone, v.shop_name,
    a.label AS addr_label, a.house_no, a.street, a.landmark, a.area, a.lat, a.lng,
    ( SELECT count(*) FROM booking_items bi WHERE bi.booking_id = b.id) AS item_count,
    ( SELECT COALESCE(jsonb_agg(to_jsonb(bi.*) ORDER BY bi.id), '[]'::jsonb) FROM booking_items bi WHERE bi.booking_id = b.id) AS items,
    p.method AS pay_method, p.amount AS pay_amount, r.stars AS rating_stars, r.comment AS rating_comment,
    c.photo_url AS customer_photo, v.photo_url AS vendor_photo
   FROM bookings b
     JOIN customers c ON c.id = b.customer_id
     JOIN addresses a ON a.id = b.address_id
     LEFT JOIN vendors v ON v.id = b.vendor_id
     LEFT JOIN payments p ON p.booking_id = b.id
     LEFT JOIN ratings r ON r.booking_id = b.id;
revoke all on booking_full from anon, authenticated;
