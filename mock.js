/* ============================================================
   Mock dataset. Shapes mirror the Postgres RPCs exactly, so
   flipping USE_SUPABASE changes nothing above this file.
   ============================================================ */
const iso = d => d.toISOString().slice(0, 10);
const daysAgo = n => { const d = new Date(); d.setDate(d.getDate() - n); return d; };

const areas = [
  { id:'a1', name:'Khandewla',   lat:28.3600, lng:76.8300, radius_km:4, coords_verified:false, is_active:true },
  { id:'a2', name:'Haileymandi', lat:28.3050, lng:76.7900, radius_km:4, coords_verified:false, is_active:true },
  { id:'a3', name:'Pataudi',     lat:28.3216, lng:76.7783, radius_km:4, coords_verified:false, is_active:true },
  { id:'a4', name:'Rampur',      lat:28.3400, lng:76.7500, radius_km:4, coords_verified:false, is_active:true },
  { id:'a5', name:'Todapur',     lat:28.3300, lng:76.8600, radius_km:4, coords_verified:false, is_active:true },
  { id:'a6', name:'Basunda',     lat:28.3500, lng:76.7300, radius_km:4, coords_verified:false, is_active:true },
  { id:'a7', name:'Jatola',      lat:28.2800, lng:76.8200, radius_km:4, coords_verified:false, is_active:true },
  { id:'a8', name:'Tirpari',     lat:28.2900, lng:76.7400, radius_km:4, coords_verified:false, is_active:true },
  { id:'a9', name:'Jatauli',     lat:28.2600, lng:76.8700, radius_km:4, coords_verified:false, is_active:true }
];

const vendors = [
  { id:'v1', name:'Ramesh Kumar', phone:'9812345670', v_type:'vegetable',
    areas_served:['Khandewla','Haileymandi'], status:'approved', is_active:true,
    shop_name:'Ramesh Sabzi', vehicle:'Thela', avg_rating:4.7, total_ratings:12,
    can_log_in:true, applied_at:daysAgo(9).toISOString() },
  { id:'v2', name:'Irfan Khan', phone:'9812345699', v_type:'fruit',
    areas_served:['Haileymandi'], status:'pending', is_active:false,
    shop_name:'Irfan Fruits', vehicle:'Cycle', avg_rating:null, total_ratings:0,
    can_log_in:false, applied_at:daysAgo(1).toISOString() }
];

const products = [
  ['Aloo','1 kg',26],['Tamatar','1 kg',36],['Pyaaz','1 kg',31],['Dhaniya','100 g',10],
  ['Palak','1 gaddi',15],['Gobhi','1 pc',29],['Baingan','500 g',19],['Gajar','500 g',27],
  ['Hari mirch','100 g',12],['Kheera','500 g',18],['Lauki','1 pc',22],['Bhindi','500 g',24]
].map((p,i)=>({ id:'p'+(i+1), vendor_id:'v1', name:p[0], unit:p[1], price:p[2],
                category:'vegetable', in_stock:i!==6, price_is_stale:i>8 }));

const customers = [
  { id:'c1', name:'Sunita Devi',  phone:'9812340001', bookings:6, spent:1240, is_blocked:false, created_at:daysAgo(12).toISOString() },
  { id:'c2', name:'Rajesh Yadav', phone:'9812340002', bookings:3, spent:610,  is_blocked:false, created_at:daysAgo(7).toISOString()  },
  { id:'c3', name:'Kamla Sharma', phone:'9812340003', bookings:9, spent:2180, is_blocked:false, created_at:daysAgo(21).toISOString() },
  { id:'c4', name:'Mohit Kumar',  phone:'9812340004', bookings:1, spent:214,  is_blocked:true,  created_at:daysAgo(3).toISOString()  }
];

const SLOTS  = ['morning','afternoon','evening'];
const STATES = ['completed','completed','completed','paid','placed','on_the_way',
                'bill_final','cancelled','missed','disputed'];
/* Mix of past (14 days back), today, and future (up to 9 days ahead) —
   a real vendor's booking list looks like this: some done, some still
   coming up. daysAgo(-n) is n days in the future. */
const bookings = Array.from({ length: 38 }, (_, i) => {
  const dayOffset = i - 9;                       /* i=0..8 -> future, i=9 -> today, i>9 -> past */
  const isFuture = dayOffset < 0;
  const st = isFuture ? (i % 2 ? 'placed' : 'on_the_way') : STATES[i % STATES.length];
  const est = 90 + ((i * 37) % 220);
  const done = ['completed','paid'].includes(st);
  const cust = customers[i % customers.length];
  return {
    id:'b'+(i+1), code:'RB-'+(104200 + i),
    customer_name:cust.name, customer_phone:cust.phone,
    vendor_name:'Ramesh Kumar', vendor_id:'v1',
    area: i % 3 === 0 ? 'Haileymandi' : 'Khandewla',
    booking_date: iso(daysAgo(dayOffset)), slot: SLOTS[i % 3],
    status: st, est_total: est,
    final_total: done ? est + ((i % 5) - 2) * 6 : null,
    created_at: daysAgo(Math.max(0, dayOffset)).toISOString()
  };
});

const waitlist = [
  { area:'Khandewla', v_type:'vegetable', requests:2, vendors_there:0, latest:daysAgo(0).toISOString() },
  { area:'Jatauli',   v_type:'fruit',     requests:5, vendors_there:0, latest:daysAgo(2).toISOString() },
  { area:'Rampur',    v_type:'vegetable', requests:3, vendors_there:0, latest:daysAgo(4).toISOString() }
];

/* a vendor-submitted item waiting on admin, same shape admin_pending_products() returns */
let pendingProducts = [
  { id:'pp1', name:'Lauki', unit:'1 pc', price:22, category:'vegetable', image_url:null,
    created_at: daysAgo(0).toISOString(), vendor_id:'v1', vendor_name:'Ramesh Kumar', vendor_phone:'9812345670' }
];
let messages = [
  { id:'m1', name:'Sunita Devi', phone:'9812340001', email:null, is_read:false,
    body:'The tomatoes this week were really fresh, thank you!', created_at: daysAgo(0).toISOString() },
  { id:'m2', name:'Rajesh Yadav', phone:'9812340002', email:null, is_read:true,
    body:'Can you add onions in Rampur too? No vendor there yet.', created_at: daysAgo(2).toISOString() }
];

/* lightweight page-view counts, same shape admin_visit_stats() returns */
function visitStats(days = 30) {
  const dailyRows = [];
  let totalC = 0, totalV = 0, today = 0;
  for (let i = days - 1; i >= 0; i--) {
    const d = iso(daysAgo(i));
    const c = 8 + Math.round(Math.random() * 20);
    const v = Math.round(Math.random() * 3);
    dailyRows.push({ d, customer: c, vendor: v });
    totalC += c; totalV += v;
    if (i === 0) today = c + v;
  }
  return { daily: dailyRows, totals: { total: totalC + totalV, customer: totalC, vendor: totalV, today } };
}

module.exports = { areas, vendors, products, customers, bookings, waitlist,
                   pendingProducts, messages, visitStats, iso, daysAgo };
