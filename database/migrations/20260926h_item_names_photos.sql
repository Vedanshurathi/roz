-- Proper English + Hindi names and real photos for every item.
--  * catalog_items.english_name  — real English ("Potato"); name_en stays the Roman-Hindi name ("Aloo")
--  * catalog_items.image_url     — a real photo (Wikipedia/Wikimedia Commons lead image, 480 px),
--                                  stored in the public Storage bucket item-photos by the
--                                  edge function item-photos
--  * products.name_en            — English name (auto from the catalog item, or set by hand)
--  * products.stock_image_url    — fallback photo when the vendor did not upload one
--                                  (products.image_url = the vendor's own photo, always shown first)
--  * trigger tg_product_fill: on insert / name change fills name_hi, name_en, stock_image_url from
--    the matching catalog item (by catalog_key, or by name); when nothing matches it asks the
--    item-photos function to find a photo for that name.

alter table public.catalog_items add column if not exists english_name text;
alter table public.catalog_items add column if not exists image_url text;
alter table public.products add column if not exists name_en text;
alter table public.products add column if not exists stock_image_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('item-photos', 'item-photos', true, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true;

update public.catalog_items c set english_name = v.en from (values
 ('p1','Potato'),('p2','Onion'),('p3','Garlic'),('p6','Tomato'),('p7','Okra (Lady finger)'),('p8','Brinjal'),
 ('p9','Bottle gourd'),('p10','Cauliflower'),('p11','Spinach'),('p12','Coriander leaves'),('p13','Green chilli'),
 ('p14','Carrot'),('p15','Cucumber'),('p16','Green peas'),('p17','Capsicum'),('p18','Bitter gourd'),('p19','Ridge gourd'),
 ('p20','Banana'),('p21','Apple'),('p22','Orange'),('p23','Papaya'),('p24','Grapes'),('p25','Watermelon'),('p26','Guava'),
 ('p27','Pomegranate'),('p28','Pumpkin'),('p29','Sweet potato'),('p30','Colocasia (Taro root)'),('p31','Elephant foot yam'),
 ('p32','Pointed gourd'),('p33','Round gourd'),('p34','Beetroot'),('p35','Radish'),('p36','Cabbage'),('p37','Spring onion'),
 ('p38','Ginger'),('p39','Broad beans'),('p40','Corn (Bhutta)'),('p41','Jackfruit'),('p42','Mint leaves'),('p43','Sapota (Chikoo)'),
 ('p44','Litchi'),('p45','Pineapple'),('p46','Pear'),('p47','Muskmelon'),('p48','Coconut'),('p49','Dates'),('p50','Java plum (Jamun)'),
 ('p51','Indian jujube (Ber)'),('p52','Strawberry'),('p54','Lotus stem'),('p55','Turnip'),('p56','Taro (Kachalu)'),('p57','Purple yam'),
 ('p58','Curry leaves'),('p59','Fenugreek leaves'),('p60','Mustard greens'),('p61','Bathua greens'),('p62','Amaranth leaves'),
 ('p63','Cowpea leaves'),('p64','Gongura (Sorrel leaves)'),('p65','Water spinach'),('p66','Malabar spinach'),('p67','Dill leaves'),
 ('p68','Carom leaves'),('p69','Collard greens'),('p70','Ivy gourd'),('p71','Chayote'),('p72','Snake cucumber'),('p73','Snake gourd'),
 ('p74','Ash gourd'),('p75','Zucchini'),('p76','Baby corn'),('p77','Mushroom'),('p78','Broccoli'),('p79','Red cabbage'),
 ('p80','Red capsicum'),('p81','Yellow capsicum'),('p82','Celery'),('p83','Leek'),('p84','Drumstick (Moringa)'),('p85','Cluster beans'),
 ('p86','French beans'),('p87','Yardlong beans'),('p88','Flat beans (Val papdi)'),('p89','Sangri beans'),('p90','Desert caper (Kair)'),
 ('p91','Elephant foot yam'),('p92','Fresh kidney beans'),('p93','Chickpea greens'),('p94','Amaranth stem'),('p95','Large bitter gourd'),
 ('p96','Sponge gourd'),('p97','Bhavnagri chilli'),('p98','Wild melon (Kachri)'),('p99','Mango ginger'),('p100','Water chestnut'),
 ('p101','Radish greens'),('p102','Pumpkin leaves'),('p103','Black carrot'),('p104','Green chickpeas'),('p105','Glue berry (Lasoda)'),
 ('p106','Karonda (Bengal currant)'),('p107','Pumpkin flower')
) as v(k, en) where c.key = v.k;

-- catalog match for a product name (English, Roman Hindi or Devanagari)
create or replace function public.catalog_match(p_name text)
returns text language sql stable security definer set search_path = public, pg_temp as $$
  select key from catalog_items
   where lower(trim(p_name)) in (lower(name_en), lower(coalesce(english_name, '')), lower(coalesce(name_hi, '')),
                                 lower(regexp_replace(coalesce(english_name, ''), '\s*\(.*\)$', '')))
   order by sort_order limit 1;
$$;

create or replace function public.tg_product_fill()
returns trigger language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare c catalog_items; k text; tok text;
begin
  k := coalesce(new.catalog_key, catalog_match(new.name), catalog_match(new.name_hi));
  if k is not null then
    select * into c from catalog_items where key = k;
    if new.name_en is null or (tg_op = 'UPDATE' and new.name is distinct from old.name) then new.name_en := coalesce(c.english_name, new.name_en); end if;
    if new.name_hi is null or new.name_hi = new.name or new.name_hi !~ '[ऀ-ॿ]' then new.name_hi := coalesce(c.name_hi, new.name_hi); end if;
    if c.image_url is not null and (new.stock_image_url is null or (tg_op = 'UPDATE' and new.name is distinct from old.name)) then
      new.stock_image_url := c.image_url;
    end if;
  elsif new.stock_image_url is null and new.image_url is null then
    -- unknown item: ask the item-photos function to look for a photo by name (async)
    select value #>> '{}' into tok from app_settings where key = 'item_photos_token';
    if tok is not null then
      perform net.http_post(url := 'https://srvpfyjmwaruebbkqkdj.supabase.co/functions/v1/item-photos',
        headers := '{"Content-Type":"application/json"}'::jsonb,
        body := jsonb_build_object('token', tok, 'mode', 'product', 'id', new.id, 'query', new.name));
    end if;
  end if;
  return new;
exception when others then
  raise warning 'tg_product_fill: %', sqlerrm; return new;
end $$;
drop trigger if exists trg_product_fill on public.products;
create trigger trg_product_fill before insert or update of name, name_hi, catalog_key on public.products
  for each row execute function public.tg_product_fill();

revoke all on function public.catalog_match(text) from public, anon, authenticated;
revoke all on function public.tg_product_fill() from public, anon, authenticated;
