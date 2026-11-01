// Unit tests for the customer site's voice-order parser (VORDER in customer/index.html).
// Run: node scripts/test-voice-parser.js   — it reads the parser straight out of the HTML, so it tests what ships.
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'customer', 'index.html'), 'utf8');
const m = html.match(/\/\* VOICE-PARSER-START \*\/([\s\S]*?)\/\* VOICE-PARSER-END \*\//);
if (!m) { console.error('parser block not found'); process.exit(1); }
const VORDER = new Function(m[1] + '\nreturn VORDER;')();
const S = 'sanjiv', V = 'vedanshu';
const P = (id, roman, en, hi, unit, price, vendorId, ckey, fresh = true) => ({ id, roman, en, hi, unit, price, vendorId, ckey, fresh });
const PRODUCTS = [
  P('aloo', 'Aloo', 'Potato', 'आलू', '1 kg', 30, S, 'p1'),
  P('arbi', 'Arbi', 'Colocasia (Taro root)', 'अरबी', 'kg', 60, S, 'p30'),
  P('baingan', 'Baingan', 'Brinjal', 'बैंगन', '500 g', 60, S, 'p8'),
  P('bhindi', 'Bhindi', 'Okra (Lady finger)', 'भिंडी', 'kg', 60, S, 'p7'),
  P('chuchu', 'Chu Chu Baingan', 'Small brinjal', 'चू-चू बैंगन', 'kg', 80, S, null, false),
  P('gobhi', 'Gobhi', 'Cauliflower', 'गोभी', '1 pc', 120, S, 'p10', false),
  P('mirch', 'Hari Mirch', 'Green chilli', 'हरी मिर्च', '250 g', 30, S, 'p13'),
  P('adrak', 'Kachi Adrak', 'Fresh ginger', 'कच्ची अदरक', '250 g', 50, S, 'p38'),
  P('kaddu', 'Kaddu', 'Pumpkin', 'कद्दू', '1 kg', 50, S, 'p28'),
  P('karela', 'Karela', 'Bitter gourd', 'करेला', '500 g', 60, S, 'p18'),
  P('kheera', 'Kheera', 'Cucumber', 'खीरा', '500 g', 60, S, 'p15'),
  P('lauki', 'Lauki', 'Bottle gourd', 'लौकी', '1 pc', 40, S, 'p9'),
  P('lehsun', 'Lehsun', 'Garlic', 'लहसुन', '250 g', 100, S, 'p3'),
  P('moti', 'Moti Mirch', 'Large green chilli', 'मोटी मिर्च', '250 g', 30, S, null),
  P('nimbu', 'Nimbu', 'Lemon', 'नींबू', '250 g', 40, S, null),
  P('palak', 'Palak', 'Spinach', 'पालक', '1 bunch', 100, V, 'p11'),
  P('patta', 'Patta Gobhi', 'Cabbage', 'पत्ता गोभी', 'kg', 70, S, 'p36'),
  P('pyaaz', 'Pyaaz', 'Onion', 'प्याज़', '1 kg', 70, S, 'p2', false),
  P('seb', 'Seb', 'Apple', 'सेब', '1 kg', 180, S, 'p21'),
  P('shimla', 'Shimla Mirch', 'Capsicum', 'शिमला मिर्च', '250 g', 40, S, 'p17'),
  P('tamS', 'Tamatar', 'Tomato', 'टमाटर', '1 kg', 70, S, 'p6'),
  P('tamV', 'Tamatar', 'Tomato', 'टमाटर', '1 kg', 55, V, 'p6'),
  P('dhaniya', 'Dhaniya', 'Coriander leaves', 'धनिया', 'gaddi', 10, V, 'p12'),
  P('kela', 'Kela', 'Banana', 'केला', 'dozen', 60, V, 'p20'),
];
let fail = 0, n = 0;
const show = r => JSON.stringify({ items: r.items.map(i => `${i.pid}×${i.q}${i.approx ? '~' : ''}${i.noQty ? '?' : ''}`), oos: r.oos, notSold: r.notSold, unknown: r.unknown });
function t(text, want, opt = {}) {
  n++;
  const r = VORDER.parse(text, PRODUCTS, opt.prefer || []);
  const got = r.items.map(i => `${i.pid}×${i.q}`).sort().join(' ');
  const exp = want.slice().sort().join(' ');
  let ok = got === exp;
  if (ok && opt.oos) ok = opt.oos.every(o => r.oos.some(x => x.startsWith(o)));
  if (ok && opt.notSold) ok = opt.notSold.every(o => r.notSold.some(x => x.startsWith(o)));
  if (ok && opt.unknown != null) ok = r.unknown.length === opt.unknown;
  if (ok && opt.approx) ok = opt.approx.every(id => (r.items.find(i => i.pid === id) || {}).approx);
  if (!ok) { fail++; console.log('FAIL', JSON.stringify(text), '\n   want', exp, JSON.stringify(opt), '\n   got ', show(r)); }
  else if (process.env.V) console.log('ok  ', text, '→', show(r));
}
// Hindi, quantity before the item (how the phone writes it)
t('दो किलो टमाटर और एक किलो आलू', ['tamS×2', 'aloo×1']);
t('2 किलो टमाटर, 1 किलो आलू', ['tamS×2', 'aloo×1']);
t('दो किलो टमाटर एक किलो आलू आधा किलो लहसुन', ['tamS×2', 'aloo×1', 'lehsun×2']);
t('एक किलो भिंडी दे दो', ['bhindi×1'], { unknown: 0 });
t('मुझे एक किलो टमाटर चाहिए', ['tamV×1'], { unknown: 0 });
t('डेढ़ किलो आलू', ['aloo×2'], { approx: ['aloo'] });
t('ढाई सौ ग्राम लहसुन', ['lehsun×1']);
t('पांच सौ ग्राम हरी मिर्च', ['mirch×2']);
t('आधा किलो बैंगन', ['baingan×1']);
t('एक किलो बैंगन', ['baingan×2']);
t('एक पाव अदरक', ['adrak×1']);
t('दो पाव अदरक', ['adrak×2']);
t('सवा किलो कद्दू', ['kaddu×1'], { approx: ['kaddu'] });
t('दो गड्डी धनिया', ['dhaniya×2']);
t('बीस का धनिया', ['dhaniya×2']);
t('धनिया दस रुपये का', ['dhaniya×1']);
t('पचास रुपये की मिर्च', ['mirch×2'], { approx: ['mirch'] });
t('₹100 के सेब', ['seb×1'], { approx: ['seb'] });
t('दो दर्जन केले', ['kela×2']);
t('छह केले', ['kela×1'], { approx: ['kela'] });
t('दो लौकी', ['lauki×2']);
t('एक एक किलो टमाटर और आलू', ['tamS×1', 'aloo×1']);
// quantity after the item
t('टमाटर दो किलो, आलू एक किलो', ['tamS×2', 'aloo×1']);
t('टमाटर दो किलो आलू एक किलो', ['tamS×2', 'aloo×1']);
t('टमाटर, आलू दो किलो', ['tamS×1', 'aloo×2']);
// no quantity = one pack
t('टमाटर आलू धनिया', ['tamV×1', 'aloo×1', 'dhaniya×1']);
t('किलो टमाटर', ['tamV×1']);
// Haryanvi / local names
t('दो किलो गंठा', [], { oos: ['प्याज'] });
t('घीया एक और बताऊं एक किलो', ['lauki×1', 'baingan×2']);
t('मिरच पाव भर', ['mirch×1']);
t('शिमला मिर्च आधा किलो', ['shimla×2']);
t('नीम्बू एक पाव', ['nimbu×1']);
t('बंद गोभी एक किलो', ['patta×1']);
t('फूलगोभी', [], { oos: ['गोभी'] });
// Roman Hindi and English
t('do kilo tamatar aur ek kilo aloo', ['tamS×2', 'aloo×1']);
t('2 kg tomatoes and 1 kg potatoes', ['tamS×2', 'aloo×1']);
t('half kg garlic, 1 kg okra', ['lehsun×2', 'bhindi×1']);
t('one dozen bananas and two bunch coriander', ['kela×1', 'dhaniya×2']);
t('500g green chilli', ['mirch×2']);
t('1.5 kg cucumber', ['kheera×3']);
// typos / speech slips
t('टमाटार दो किलो', ['tamV×2']);
t('2 kg tamater', ['tamV×2']);
// devanagari digits + nukta variants
t('२ किलो प्याज़ और १ किलो आलू', ['aloo×1'], { oos: ['प्याज'] });
// not sold here / not understood
t('एक किलो मटर और दो किलो आलू', ['aloo×2'], { notSold: ['मटर'] });
t('एक किलो कबाड़ी और दो किलो आलू', ['aloo×2'], { unknown: 1 });
// same item twice adds up
t('एक किलो टमाटर और एक किलो टमाटर', ['tamV×2']);
// vendor preference: basket already has Sanjiv → his tomatoes, not the cheaper one
t('दो किलो टमाटर', ['tamS×2'], { prefer: [S] });
// one vendor covering more items wins over a cheaper single item
t('टमाटर और भिंडी', ['tamS×1', 'bhindi×1']);
// "दो" = give at the end
t('एक किलो टमाटर दो', ['tamV×1']);
t('टमाटर भेज दो', ['tamV×1'], { unknown: 0 });
// empty / rubbish
t('', []);
t('नमस्ते भैया', [], { unknown: 1 });
console.log(`${n - fail}/${n} passed`);
process.exit(fail ? 1 : 0);
