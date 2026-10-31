-- 2026-10-04 · Devanagari / English text for the messages added in 20261004a_security_lockdown.sql
-- (tr() looks the Roman-Hindi key up here; without a row a Hindi user saw Roman Hindi).
insert into msg_i18n (roman, hi, en)
select v.roman, v.hi, v.en from (values
 ('Pehle hi ho chuka hai', 'यह पहले ही हो चुका है', 'Already done'),
 ('Is order ka status ab ye nahi ho sakta', 'इस ऑर्डर का स्टेटस अब यह नहीं हो सकता', 'This order can no longer move to that status'),
 ('Bill ke baad order cancel nahi hota — admin se baat karo', 'बिल के बाद ऑर्डर कैंसल नहीं होता — एडमिन से बात करें', 'An order cannot be cancelled after the bill — please contact admin'),
 ('Ye sirf bill ke baad hota hai', 'यह सिर्फ़ बिल के बाद होता है', 'This is only possible after the bill'),
 ('Bill aane ke baad hi shikayat kar sakte ho', 'बिल आने के बाद ही शिकायत कर सकते हैं', 'You can only report a problem once the bill is ready'),
 ('Sahi rakam daalo', 'सही रकम डालें', 'Enter a valid amount'),
 ('Matra ya rate galat hai', 'मात्रा या रेट गलत है', 'A quantity or rate is not valid'),
 ('Naam daalo', 'नाम डालें', 'Enter your name'),
 ('Ye number kisi aur account se juda hai', 'यह नंबर किसी और अकाउंट से जुड़ा है', 'This number belongs to another account'),
 ('Profile nahi mila', 'प्रोफ़ाइल नहीं मिली', 'Profile not found'),
 ('Save ho gaya', 'सेव हो गया', 'Saved')
) as v(roman, hi, en)
where not exists (select 1 from msg_i18n m where m.roman = v.roman);
