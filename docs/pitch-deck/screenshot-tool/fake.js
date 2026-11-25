// fake window.supabase for the customer site — real Jatola products (photos left out: storage isn't reachable here)
module.exports = function (opts = {}) {
  const S = '8822d798-f0d0-4325-8f41-45a9f7fe2ba0', V = '0408aa59-755e-4693-b0ed-4ff8c9ae3601';
  const P = (id, name, unit, price, en, hi, cat, stock, key, vid, img) => ({ id, name, unit, price, name_en: en, name_hi: hi, category: cat, in_stock: stock, image_url: null,
    vendor_id: vid || S, vendor_name: vid === V ? 'Vedanshu Rathi' : 'Sanjiv', vendor_rating: vid === V ? 4.6 : 5.0, stock_image_url: img || null, catalog_key: key,
    created_at: '2026-08-26T01:00:00Z', price_updated_at: '2026-10-26T01:00:00Z', sort_order: 0 });
  const I = n => 'img/items/' + n + '.webp';
  const products = [
    P('p-aloo', 'Aloo', '1 kg', 30, 'Potato', 'आलू', 'onion_potato', true, 'p1', null, I('potato')),
    P('p-pyaz', 'Pyaaz', '1 kg', 45, 'Onion', 'प्याज़', 'onion_potato', true, 'p2', null, I('onion')),
    P('p-tam', 'Tamatar', '1 kg', 40, 'Tomato', 'टमाटर', 'vegetable', true, 'p6', null, I('tomato')),
    P('p-mirch', 'Hari Mirch', '250 g', 20, 'Green chilli', 'हरी मिर्च', 'vegetable', true, 'p13', null, I('chilli')),
    P('p-dhan', 'Dhaniya', '100 g', 10, 'Coriander', 'धनिया', 'vegetable', true, 'p12', null, I('herbs')),
    P('p-lehsun', 'Lehsun', '250 g', 60, 'Garlic', 'लहसुन', 'vegetable', true, 'p3', null, I('garlic')),
    P('p-adrak', 'Kachi Adrak', '250 g', 40, 'Fresh ginger', 'कच्ची अदरक', 'vegetable', true, 'p38', null, I('ginger')),
    P('p-gajar', 'Gajar', '1 kg', 40, 'Carrot', 'गाजर', 'vegetable', true, 'p4', null, I('carrot')),
    P('p-matar', 'Matar', '500 g', 40, 'Green peas', 'मटर', 'vegetable', true, 'p16', null, I('peas')),
    P('p-baingan', 'Baingan', '500 g', 20, 'Brinjal', 'बैंगन', 'vegetable', true, 'p8', null, I('brinjal')),
    P('p-gobhi', 'Patta Gobhi', '1 kg', 30, 'Cabbage', 'पत्ता गोभी', 'vegetable', true, 'p36', null, I('cabbage')),
    P('p-kheera', 'Kheera', '500 g', 25, 'Cucumber', 'खीरा', 'vegetable', true, 'p15', null, I('cucumber')),
    P('p-shimla', 'Shimla Mirch', '250 g', 25, 'Capsicum', 'शिमला मिर्च', 'vegetable', true, 'p17', null, I('capsicum')),
    P('p-kaddu', 'Kaddu', '1 kg', 35, 'Pumpkin', 'कद्दू', 'vegetable', true, 'p28', null, I('pumpkin')),
    P('p-palak', 'Palak', '1 bunch', 20, 'Spinach', 'पालक', 'vegetable', true, 'p11', V, I('lettuce')),
    P('p-seb', 'Seb', '1 kg', 160, 'Apple', 'सेब', 'fruit', true, 'p21', null, I('apple')),
    P('p-kela', 'Kela', '1 dozen', 60, 'Banana', 'केला', 'fruit', true, 'p22', null, I('banana')),
  ];
  const home = { ok: true, data: { area: 'Jatola', areas: ['Jatola', 'Khandewla'], served: true, favourites: [], products,
    types: [{ v_type: 'vegetable', avg_rating: 4.8, vendor_count: 2, sample_vendor: 'Sanjiv' }] } };
  const areas = [{ lat: 28.383236, lng: 76.797476, name: 'Jatola', served: true, verified: true, radius_km: 2 },
                 { lat: 28.383408, lng: 76.770726, name: 'Khandewla', served: true, verified: true, radius_km: 2 }];
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  const bookings = [
    { id: 'bk1', code: 'RB-108684', status: opts.way ? 'on_the_way' : 'placed', v_type: 'vegetable', booking_date: today, slot: 'evening', delivery_otp: '4821',
      est_total: 160, vendor_name: 'Sanjiv', vendor_phone: '9812300000', house_no: '12', street: 'Mandir wali gali', area: 'Jatola',
      items: [{ product_id: 'p-aloo', qty: 2 }, { product_id: 'p-tam', qty: 1 }, { product_id: 'p-mirch', qty: 1 }] }];
  const session = opts.loggedIn ? { user: { id: 'u1', email: 'sunita@example.com', user_metadata: { full_name: 'Sunita Devi' }, app_metadata: { provider: 'google' } }, access_token: 'x' } : null;
  return `(function(){
  const ok=d=>({data:{ok:true,data:d}}); const HOME=${JSON.stringify(home)}; const AREAS=${JSON.stringify(areas)};
  const BK=${JSON.stringify(bookings)}; let session=${JSON.stringify(session)}; window.__calls=[];
  const GALI={on:true,min:3,bonus_hi:'मुफ़्त धनिया-मिर्च',bonus_en:'Free coriander & green chillies'};
  window.supabase={createClient(){return{
    auth:{async getSession(){return{data:{session}}},onAuthStateChange(cb){return{data:{subscription:{unsubscribe(){}}}}},
      async signInAnonymously(){session={user:{id:'anon',is_anonymous:true,user_metadata:{},app_metadata:{provider:'anonymous'}}};return{data:{session}}},
      async signOut(){session=null;return{}}},
    async rpc(fn,a){ a=a||{}; window.__calls.push([fn,a]);
      switch(fn){
        case 'customer_home': return {data:HOME};
        case 'public_areas': return {data:AREAS};
        case 'public_app_config': return ok({min_order:50,otp:false,service_km:8,gali:GALI});
        case 'customer_login_config': return ok({otp:false});
        case 'customer_vendors_in_area': return ok([{id:'${S}',name:'Sanjiv',v_type:'vegetable',photo_url:null,avg_rating:5,product_count:18,total_ratings:14,orders_completed:25}]);
        case 'customer_bootstrap': return ok({id:'c1',name:'Sunita Devi',phone:'9812300000',email:'sunita@example.com'});
        case 'customer_my_bookings': return ok(window.__BK||BK);
        case 'customer_my_addresses': return ok([{id:'a1',label:'Ghar',house_no:'12',street:'Mandir wali gali',landmark:'',area:'Jatola',lat:28.3842,lng:76.7991,is_default:true}]);
        case 'customer_notifications': return ok([]);
        case 'customer_cart_get': return ok({items:{},vendor_id:null,rev:0});
        case 'customer_cart_apply': return ok({items:{},rev:1});
        case 'customer_last_order': return ok(null);
        case 'customer_gali_status': return ok(Object.assign({},GALI,{items:[{booking_id:'bk1',code:'RB-108684',slot:'evening',houses:2,complete:false}]}));
        case 'customer_gali_slots': return ok(Object.assign({},GALI,{slots:{morning:0,afternoon:0,evening:2}}));
        case 'customer_slot_status_for': return ok(['morning','afternoon','evening'].map(x=>({slot:x,has_room:true,free:x==='evening'?3:6,is_past:false,vendor_count:1})));
        case 'customer_vendors_for_product': return ok([]);
        case 'customer_track': return ok(window.__TRK||{status:'on_the_way',code:'RB-108684',live:true,vendor_name:'Sanjiv',vendor_photo:null,
          vendor:{lat:28.3871,lng:76.7921,acc:8,heading:120,age_s:6},dest:{lat:28.3842,lng:76.7991,approx:false},dist_km:0.8,eta_min:7,speed_kmh:5});
        default: return ok(null);
      }
    }
  }}};
})();`;
};
