-- 1. Proper Hindi / proper English in messages the apps show (toasts), same rule as the UI:
--    tr(hi, en) used Roman-Hindi text ("Order cancel ho gaya"), and many customer functions returned
--    Roman Hindi even in English mode. msg_i18n maps each Roman text → Devanagari + English; tr()
--    looks it up; plain customer messages are wrapped in tr().
-- 2. vendor_finalize_bill also works after the customer disputed the bill — the vendor re-weighs at
--    the door and sends a corrected bill. It used to be stuck ("Cannot finalize yet") until an admin acted.
create table if not exists public.msg_i18n (roman text primary key, hi text not null, en text not null);
alter table public.msg_i18n enable row level security;

insert into public.msg_i18n (roman, hi, en) values
 ('1 se 5 star chuno','1 से 5 स्टार चुनें','Pick 1 to 5 stars'),
 ('Ab cancel nahi ho sakta','अब कैंसल नहीं हो सकता','This can no longer be cancelled'),
 ('Bill abhi final nahi hua','बिल अभी फ़ाइनल नहीं हुआ','The bill is not final yet'),
 ('Bill approve ho gaya — ab payment karo','बिल मंज़ूर — अब भुगतान करें','Bill approved — now pay the vendor'),
 ('Booking nahi mili','बुकिंग नहीं मिली','Booking not found'),
 ('Delivery ke baad hi rating de sakte ho','डिलीवरी के बाद ही रेटिंग दे सकते हैं','You can rate only after delivery'),
 ('Hum ise dekh rahe hain, jaldi batayenge','हम इसे देख रहे हैं, जल्दी बताएँगे','We are looking into it and will update you soon'),
 ('Is din ka order cancel — baaki din chalu rahenge','इस दिन का ऑर्डर कैंसल — बाकी दिन चालू रहेंगे','Order for this day cancelled — other days continue'),
 ('Jab vendor aayega hum aapko batayenge','जब वेंडर आएगा हम आपको बताएँगे','We will tell you when a vendor starts here'),
 ('Kam se kam ek din chuno','कम से कम एक दिन चुनें','Pick at least one day'),
 ('Message thoda lamba likhiye','संदेश थोड़ा लंबा लिखें','Please write a slightly longer message'),
 ('Naam daalo','नाम डालें','Enter your name'),
 ('Naam likhiye','नाम लिखें','Write your name'),
 ('Order cancel ho gaya','ऑर्डर कैंसल हो गया','Order cancelled'),
 ('Pehle login karo','पहले लॉगिन करें','Please log in first'),
 ('Profile nahi mila','प्रोफ़ाइल नहीं मिली','Profile not found'),
 ('Sahi 10-digit number daalo','सही 10 अंकों का नंबर डालें','Enter a valid 10-digit number'),
 ('Save ho gaya','सेव हो गया','Saved'),
 ('Schedule band ho gaya','शेड्यूल बंद हो गया','Schedule stopped'),
 ('Schedule nahi mila','शेड्यूल नहीं मिला','Schedule not found'),
 ('Session nahi mila — dubara try karo','सेशन नहीं मिला — दोबारा कोशिश करें','Session not found — please try again'),
 ('Shukriya rating ke liye!','रेटिंग के लिए धन्यवाद!','Thanks for rating!'),
 ('Vendor pahunch chuka hai, ab cancel nahi hoga','वेंडर पहुँच चुका है, अब कैंसल नहीं होगा','The vendor has arrived — it can no longer be cancelled'),
 ('Aapka account block hai','आपका अकाउंट ब्लॉक है','Your account is blocked'),
 ('Aapka chuna hua vendor is slot me free nahi hai. Dusra slot ya din chuno.','आपका चुना हुआ वेंडर इस स्लॉट में खाली नहीं है। दूसरा स्लॉट या दिन चुनें।','The vendor you picked is not free in this slot. Please pick another slot or day.'),
 ('Address hata diya','पता हटा दिया','Address removed'),
 ('Address nahi mila','पता नहीं मिला','Address not found'),
 ('Address save ho gaya','पता सेव हो गया','Address saved'),
 ('Alerts chalu','सूचनाएँ चालू','Alerts on'),
 ('Booking pakki ho gayi','बुकिंग पक्की हो गई','Booking confirmed'),
 ('Gaon chuno','गाँव चुनें','Choose your village'),
 ('Hata diya','हटा दिया','Removed'),
 ('Is slot me koi vendor free nahi hai. Dusra slot ya din chuno.','इस स्लॉट में कोई वेंडर खाली नहीं है। दूसरा स्लॉट या दिन चुनें।','No vendor is free in this slot. Please pick another slot or day.'),
 ('Kam se kam ek saman chuno','कम से कम एक सामान चुनें','Pick at least one item'),
 ('Location save ho gayi','लोकेशन सेव हो गई','Location saved'),
 ('Purani date nahi chun sakte','पुरानी तारीख़ नहीं चुन सकते','Cannot pick a past date'),
 ('Ye saman abhi stock me nahi hai: ','ये सामान अभी स्टॉक में नहीं है: ','Out of stock right now: '),
 ('Bill customer ko bhej diya','बिल ग्राहक को भेज दिया','Bill sent to customer'),
 ('Abhi bill final nahi kar sakte','अभी बिल फ़ाइनल नहीं कर सकते','Cannot finalize the bill yet'),
 ('Order nahi mila','ऑर्डर नहीं मिला','Order not found'),
 ('Vendor account nahi mila','वेंडर अकाउंट नहीं मिला','Vendor account not found'),
 ('Vendor nahi mila','वेंडर नहीं मिला','Vendor not found'),
 ('Product nahi mila','सामान नहीं मिला','Product not found'),
 ('Stock me daal diya','स्टॉक में डाल दिया','Marked in stock'),
 ('Out of stock kar diya','स्टॉक ख़त्म कर दिया','Marked out of stock'),
 ('Date range sahi nahi hai','तारीख़ें सही नहीं हैं','Date range is not valid')
on conflict (roman) do update set hi = excluded.hi, en = excluded.en;

create or replace function public.tr(p_hi text, p_en text)
returns text language sql stable set search_path to 'public' as $$
  select case when my_lang() = 'en'
              then coalesce((select en from msg_i18n where roman = p_hi), p_en)
              else coalesce((select hi from msg_i18n where roman = p_hi), p_hi) end;
$$;

-- plain Roman-Hindi messages in customer functions → tr()
do $$
declare f record; d text; n int := 0;
begin
  for f in select p.oid from pg_proc p
            where p.pronamespace = 'public'::regnamespace and p.prokind = 'f'
              and p.proname like 'customer\_%' and p.prosrc ~ '''msg'',\s*''' loop
    d := pg_get_functiondef(f.oid);
    d := regexp_replace(d, '''msg'',\s*''([^'']*)''', '''msg'', tr(''\1'', ''\1'')', 'g');
    execute d; n := n + 1;
  end loop;
  raise notice 'customer functions wrapped: %', n;
end $$;

-- vendor can re-send the bill after a dispute
do $$ declare d text; begin
  d := pg_get_functiondef('public.vendor_finalize_bill(uuid, jsonb)'::regprocedure);
  d := replace(d, $x$if bk.status not in ('reached','bill_final','on_the_way') then$x$,
                  $x$if bk.status not in ('reached','bill_final','on_the_way','disputed') then$x$);
  execute d;
end $$;
