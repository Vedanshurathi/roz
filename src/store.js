/* ============================================================
   The only place that knows where data comes from.
   USE_SUPABASE=false -> in-memory mock (default, no network).
   USE_SUPABASE=true  -> the same RPCs, called with the SERVICE
   ROLE key, which is why this runs on the server and not in a
   browser. Every method returns the same shape either way.
   ============================================================ */
const M = require('./mock');

const USE_SUPABASE = String(process.env.USE_SUPABASE || 'false') === 'true';
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

async function rpc(fn, args = {}) {
  if (!USE_SUPABASE) throw new Error('supabase_disabled');
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(args)
  });
  if (!res.ok) throw new Error(`${fn}: ${res.status} ${await res.text()}`);
  const json = await res.json();
  return json && typeof json === 'object' && 'data' in json ? json.data : json;
}

/* ---------- derived helpers (used by both modes) ---------- */
const isDemo = v => (v.areas_served || []).every(a => /demo|test/i.test(a));

function areasWithCounts(areas, vendors) {
  return areas.map(a => ({
    ...a,
    vendor_count: vendors.filter(v =>
      v.status === 'approved' && v.is_active && (v.areas_served || []).includes(a.name)).length
  }));
}

function overview(d) {
  const today = M.iso(new Date());
  const live = d.vendors.filter(v => v.status === 'approved' && v.is_active);
  const cut = new Date(); cut.setDate(cut.getDate() - 30);
  return {
    bookings_today:  d.bookings.filter(b => b.booking_date === today).length,
    needs_attention: d.bookings.filter(b => ['disputed','missed'].includes(b.status)).length,
    vendors_live:    live.length,
    vendors_pending: d.vendors.filter(v => v.status === 'pending').length,
    customers_total: d.customers.length,
    completed_30d:   d.bookings.filter(b => b.status === 'completed' && new Date(b.created_at) >= cut).length,
    waitlist_open:   d.waitlist.reduce((s, w) => s + w.requests, 0),
    sales_30d:       d.bookings.filter(b => ['completed','paid'].includes(b.status))
                       .reduce((s, b) => s + Number(b.final_total || b.est_total || 0), 0)
  };
}

function daily(d, days = 14) {
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = M.iso(M.daysAgo(i));
    const rows = d.bookings.filter(b => b.booking_date === day);
    const done = rows.filter(b => ['completed','paid'].includes(b.status));
    out.push({
      d: day, total: rows.length, completed: done.length,
      cancelled: rows.filter(b => b.status === 'cancelled').length,
      missed:    rows.filter(b => b.status === 'missed').length,
      sales:     done.reduce((s, b) => s + Number(b.final_total || b.est_total || 0), 0)
    });
  }
  return out;
}

function performance(d) {
  return d.vendors.map(v => {
    const rows = d.bookings.filter(b => b.vendor_id === v.id);
    return {
      id: v.id, name: v.name, v_type: v.v_type, areas_served: v.areas_served,
      avg_rating: v.avg_rating, total_ratings: v.total_ratings,
      completed: rows.filter(b => b.status === 'completed').length,
      cancelled: rows.filter(b => b.status === 'cancelled').length,
      missed:    rows.filter(b => b.status === 'missed').length,
      flagged:   rows.filter(b => b.status === 'disputed').length,
      sales:     rows.filter(b => ['completed','paid'].includes(b.status))
                   .reduce((s, b) => s + Number(b.final_total || b.est_total || 0), 0),
      stale_prices: d.products.filter(p => p.vendor_id === v.id && p.price_is_stale).length
    };
  });
}

/* ---------- launch readiness ---------- */
function readiness(d) {
  const areas = areasWithCounts(d.areas, d.vendors);
  const real  = d.vendors.filter(v => v.status === 'approved' && v.is_active && !isDemo(v));
  const linked = real.filter(v => v.can_log_in);
  const verified = areas.filter(a => a.coords_verified).length;
  const covered  = areas.filter(a => a.vendor_count > 0).length;
  const o = overview(d);
  const mk = (k, state, t, dsc, act) => ({ k, state, t, d: dsc, act });
  return [
    mk('vendor', real.length ? 'ok' : 'no', 'A real vendor is live',
       real.length ? `${real.length} approved and active`
                   : 'Only demo/test vendors exist. Every real village shows "no vendor yet".', 'vendors'),
    mk('login', !real.length ? 'wa' : (linked.length ? 'ok' : 'no'), 'Vendor can log in',
       linked.length ? `${linked.length} vendor login(s) linked`
                     : 'No vendor is linked to a login, so nobody can open the vendor app.', 'vendors'),
    mk('area', covered ? 'ok' : 'no', 'A real village is covered',
       covered ? `${covered} of ${areas.length} areas have a vendor`
               : 'No real area has a vendor assigned.', 'areas'),
    mk('coords', verified ? 'ok' : 'wa', 'Village coordinates verified',
       verified ? `${verified} of ${areas.length} verified`
                : `${areas.length} areas use approximate coordinates. Detection asks the customer to confirm, so this is safe — just not automatic.`, 'areas'),
    mk('cust', o.customers_total > 0 ? 'ok' : 'wa', 'First customer signed up',
       o.customers_total > 0 ? `${o.customers_total} registered`
         : 'Nobody has registered. If sign-in is disabled in Supabase, registration fails silently.', 'customers'),
    mk('order', o.completed_30d > 0 ? 'ok' : 'wa', 'One order completed end to end',
       o.completed_30d > 0 ? `${o.completed_30d} completed in 30 days`
         : 'Do a dry run: order from your own house and pay the vendor.', 'bookings')
  ];
}

/* ---------- public API ---------- */
async function snapshot() {
  if (USE_SUPABASE) {
    const [ov, vendors, areas, day, gaps, perf, bookings, customers, pending, visits] = await Promise.all([
      rpc('admin_overview_stats'), rpc('admin_vendors'), rpc('admin_areas'),
      rpc('admin_daily_report', { p_days: 14 }), rpc('admin_demand_gaps'),
      rpc('admin_vendor_performance', { p_days: 30 }),
      rpc('admin_bookings', { p_limit: 100 }), rpc('admin_customers', { p_limit: 100 }),
      rpc('admin_pending_products'), rpc('admin_visit_stats', { p_days: 30 })
    ]);
    const d = { vendors, areas, bookings, customers, waitlist: gaps, products: [] };
    return { source:'supabase', ov, vendors, areas, daily: day, gaps,
             perf, bookings, customers, pending, visits, readiness: readiness(d) };
  }
  const d = M;
  return {
    source: 'mock',
    ov: overview(d),
    vendors: d.vendors,
    areas: areasWithCounts(d.areas, d.vendors),
    daily: daily(d, 14),
    gaps: d.waitlist,
    perf: performance(d),
    bookings: [...d.bookings].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
    customers: d.customers,
    pending: M.pendingProducts || [],
    visits: M.visitStats ? M.visitStats() : { daily: [], totals: { total:0, customer:0, vendor:0, today:0 } },
    readiness: readiness(d)
  };
}

/* mutations — mock mutates memory, real mode calls the same RPCs */
async function addVendor({ name, phone, type, areas, capacity }) {
  if (USE_SUPABASE) return rpc('admin_add_vendor',
    { p_name:name, p_phone:phone, p_type:type, p_areas:areas, p_capacity:capacity });
  M.vendors.push({ id:'v'+(M.vendors.length+1), name, phone, v_type:type,
    areas_served:areas, status:'approved', is_active:true, shop_name:null, vehicle:null,
    avg_rating:null, total_ratings:0, can_log_in:false, applied_at:new Date().toISOString() });
  return { added:true };
}
async function reviewVendor(id, decision) {
  if (USE_SUPABASE) return rpc('admin_review_vendor', { p_vendor:id, p_decision:decision });
  const v = M.vendors.find(x => x.id === id);
  if (!v) throw new Error('vendor_not_found');
  v.status = decision; v.is_active = decision === 'approved';
  return { status: decision };
}
async function blockCustomer(id, blocked) {
  if (USE_SUPABASE) return rpc('admin_block_customer', { p_customer:id, p_blocked:blocked });
  const c = M.customers.find(x => x.id === id);
  if (!c) throw new Error('customer_not_found');
  c.is_blocked = blocked;
  return { is_blocked: blocked };
}
async function resolveBooking(id) {
  if (USE_SUPABASE) return rpc('admin_resolve', { p_booking:id, p_status:'completed', p_note:'admin' });
  const b = M.bookings.find(x => x.id === id);
  if (!b) throw new Error('booking_not_found');
  b.status = 'completed'; b.final_total = b.final_total ?? b.est_total;
  return { status:'completed' };
}
async function setAreaPoint(name, lat, lng) {
  if (USE_SUPABASE) return rpc('admin_set_area_point',
    { p_name:name, p_lat:lat, p_lng:lng, p_radius:4, p_verified:true });
  const a = M.areas.find(x => x.name === name);
  if (!a) throw new Error('area_not_found');
  a.lat = lat; a.lng = lng; a.coords_verified = true;
  return { verified:true };
}

async function reviewProduct(id, decision, note) {
  if (USE_SUPABASE) return rpc('admin_review_product',
    { p_product:id, p_decision:decision, p_note:note || null });
  const p = (M.pendingProducts || []).find(x => x.id === id);
  if (!p) throw new Error('product_not_found');
  M.pendingProducts = M.pendingProducts.filter(x => x.id !== id);
  return { review_status: decision };
}
async function allProducts() {
  if (USE_SUPABASE) return rpc('admin_products', {});
  const byVendor = {}; M.vendors.forEach(v => byVendor[v.id] = v.name);
  return M.products.map(p => ({ ...p, vendor_name: byVendor[p.vendor_id] || 'Unknown',
    review_status: 'approved', price_updated_at: null }));
}
async function updateProduct(id, price, in_stock) {
  if (USE_SUPABASE) return rpc('admin_update_product',
    { p_product:id, p_price: price ?? null, p_in_stock: in_stock ?? null });
  const p = M.products.find(x => x.id === id);
  if (!p) throw new Error('product_not_found');
  if (price != null) { if (price <= 0) throw new Error('bad_price'); p.price = price; }
  if (in_stock != null) p.in_stock = in_stock;
  return { ...p };
}
async function allMessages() {
  if (USE_SUPABASE) return rpc('admin_messages', {});
  return M.messages || [];
}
async function markMessageRead(id, read) {
  if (USE_SUPABASE) return rpc('admin_mark_message_read', { p_message:id, p_read: read !== false });
  const m = (M.messages || []).find(x => x.id === id);
  if (!m) throw new Error('message_not_found');
  m.is_read = read !== false;
  return { ...m };
}
async function addArea(name, active) {
  if (USE_SUPABASE) return rpc('admin_upsert_area', { p_name:name, p_active: active !== false });
  if (!name || !name.trim()) throw new Error('name_required');
  const exists = M.areas.find(a => a.name.toLowerCase() === name.trim().toLowerCase());
  if (exists) { exists.is_active = active !== false; }
  else M.areas.push({ id:'a'+(M.areas.length+1), name:name.trim(), lat:null, lng:null,
    radius_km:4, coords_verified:false, is_active: active !== false });
  return { added:true };
}

module.exports = { USE_SUPABASE, snapshot, addVendor, reviewVendor,
                   blockCustomer, resolveBooking, setAreaPoint,
                   reviewProduct, allProducts, updateProduct, addArea,
                   allMessages, markMessageRead };
