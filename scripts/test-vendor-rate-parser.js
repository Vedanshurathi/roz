// Unit tests for the vendor app's rates-by-voice parser (VRATE in vendor-site/index.html).
// Run: node scripts/test-vendor-rate-parser.js — it reads the parser straight out of the HTML, so it tests what ships.
const fs=require('fs');
const src=fs.readFileSync(require('path').join(__dirname,'..','vendor-site','index.html'),'utf8');
const m=src.match(/\/\* VENDOR-RATE-PARSER-START \*\/([\s\S]*?)\/\* VENDOR-RATE-PARSER-END \*\//);
const VRATE=new Function(m[1]+'\nreturn VRATE;')();
const P=(id,roman,en,hi,unit,price,stock=true)=>({id,roman,en,hi,unit,price,stock});
const PRODUCTS=[P('aloo','Aloo','Potato','आलू','1 kg',30),P('tam','Tamatar','Tomato','टमाटर','1 kg',70),P('pyaaz','Pyaaz','Onion','प्याज़','1 kg',70,false),
 P('bhindi','Bhindi','Okra (Lady finger)','भिंडी','kg',60),P('baingan','Baingan','Brinjal','बैंगन','500 g',60),P('mirch','Hari Mirch','Green chilli','हरी मिर्च','250 g',30),
 P('moti','Moti Mirch','Large green chilli','मोटी मिर्च','250 g',30),P('shimla','Shimla Mirch','Capsicum','शिमला मिर्च','250 g',40),P('lauki','Lauki','Bottle gourd','लौकी','1 pc',40),
 P('patta','Patta Gobhi','Cabbage','पत्ता गोभी','kg',70),P('matar','Matar','Green peas','मटर','500 g',120,false),P('torai','Torai','Ridge gourd','तोरई','500 g',30,false),
 P('kheera','Kheera','Cucumber','खीरा','500 g',60),P('adrak','Kachi Adrak','Fresh ginger','कच्ची अदरक','250 g',50),P('seb','Seb','Apple','सेब','1 kg',180),
 P('kela','Kela','Banana','केला','dozen',60),P('dhaniya','Dhaniya','Coriander','धनिया','1 bunch',10),P('nimbu','Nimbu','Lemon','नींबू','250 g',40)];
const CATALOG=[{key:'p10',hi:'गोभी',roman:'Gobhi',en:'Cauliflower',unit:'1 pc'},{key:'p14',hi:'गाजर',roman:'Gajar',en:'Carrot',unit:'1 kg'},
 {key:'p1',hi:'आलू',roman:'Aloo',en:'Potato',unit:'1 kg'},{key:'p37',hi:'मूली',roman:'Mooli',en:'Radish',unit:'1 kg'}];
let n=0,fail=0;
const fmt=r=>r.rows.map(x=>`${x.pid||('+'+x.key)}${x.price!=null?'='+x.price:''}${x.stock===false?' OUT':x.stock===true&&x.kind==='own'?' IN':''}`).sort().join(', ')+(r.unknown.length?'  ?['+r.unknown.join('|')+']':'');
function t(text,want){ n++; const r=VRATE.parse(text,PRODUCTS,CATALOG); const got=fmt(r);
  const w=want.split(', ').filter(Boolean).sort().join(', ');
  if(got.replace(/  \?\[.*\]$/,'')!==w){ fail++; console.log('FAIL',text,'\n   got:',got,'\n  want:',w); } else console.log('ok  ',text,' →',got); }
t('टमाटर चालीस, आलू तीस, भिंडी खत्म','tam=40, aloo=25?'.replace('aloo=25?','bhindi OUT'));
t('टमाटर चालीस आलू पच्चीस','aloo=25, tam=40');
t('टमाटर 40 रुपये किलो','tam=40');
t('बैंगन चालीस रुपये किलो','baingan=20');
t('बैंगन चालीस किलो','baingan=20');
t('बैंगन तीस','baingan=30');
t('हरी मिर्च अस्सी रुपये किलो','mirch=20');
t('शिमला मिर्च पाव पैंतीस','shimla=35');
t('लौकी पैंतीस','lauki=35');
t('मटर आ गया साठ रुपये','matar=60 IN');
t('मटर आ गया','matar IN');
t('प्याज़ फिर से आ गया पैंतालीस का किलो','pyaaz=45 IN');
t('भिंडी और तोरई खत्म','bhindi OUT');
t('भिंडी नहीं है','bhindi OUT');
t('टमाटर का रेट पचास कर दो','tam=50');
t('टमाटर सत्तर से पचपन कर दो','tam=55');
t('सेब डेढ़ सौ','seb=150');
t('सेब एक सौ बीस रुपये किलो','seb=120');
t('सेब सवा सौ','seb=125');
t('केला पैंसठ रुपये दर्जन','kela=65');
t('केला पचास','kela=50');
t('धनिया पंद्रह रुपये गड्डी','dhaniya=15');
t('चालीस का टमाटर बत्तीस का आलू','aloo=32, tam=40');
t('tomato 45, potato 28, okra finished','aloo=28, bhindi OUT, tam=45');
t('tamatar 45 aloo 28 bhindi khatam','aloo=28, bhindi OUT, tam=45');
t('पत्ता गोभी पच्चीस','patta=25');
t('गोभी तीस','+p10=30');
t('गाजर चालीस किलो','+p14=40');
t('खीरा पचास रुपये किलो और कच्ची अदरक सौ रुपये किलो','adrak=25, kheera=25');
t('टमाटर ₹45','tam=45');
t('टमाटर 45/- किलो','tam=45');
t('आलू 32, प्याज़ 40, टमाटर 50','aloo=32, pyaaz=40, tam=50');
t('आलू तीस है','');
t('प्याज खत्म हो गया है','');
t('भिंडी खत्म हो गई है','bhindi OUT');
t('बैंगन 250 ग्राम पंद्रह रुपये','baingan=30');
t('बैंगन आधा किलो पैंतीस','baingan=35');
t('टमाटर चालीस मोटी मिर्च बीस','moti=20, tam=40');
t('मिर्च चालीस','mirch=40');
t('टमाटर साढ़े बाईस','tam=22.5');
t('नींबू पाव भर पचास','nimbu=50');
t('नींबू किलो का सौ','nimbu=25');
t('टमाटर चालीस भिंडी पचास आलू पच्चीस मटर खत्म','aloo=25, bhindi=50, tam=40');
t('तमाटर चालीस','tam=40');
t('भिन्डी खतम','bhindi OUT');
t('दो सौ का सेब','seb=200');
t('सेब ढाई सौ रुपये किलो','seb=250');
t('मूली बीस और गाजर तीस किलो','+p14=30, +p37=20');
t('टमाटर','');
t('आज टमाटर पचास, बाकी सब वही','tam=50');
t('Tomato rate 48 per kg','tam=48');
t('baingan 40 per kilo','baingan=20');
console.log(n-fail+'/'+n,'passed');
process.exit(fail?1:0);
