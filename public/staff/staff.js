/* ============================================================
   RozBazaar Staff — read-only app for employees.
   Orders (what's coming in), Vendors, Sale (sabzi / pyaaz-aloo /
   fruit totals and item-wise sale). One data call: /api/staff/snapshot.
   No inline handlers (CSP) — one delegated click listener, data-act.
   ============================================================ */
'use strict';

let D = null;              /* snapshot */
let TAB = 'orders';
const F = { day: 'today', status: 'all', q: '' };   /* order filters */
const S = { period: 'today', cat: 'vegetable' };    /* sale filters */
const OPEN = new Set();    /* expanded order cards */
let busy = false, timer = null;

/* ---------- helpers ---------- */
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rs = n => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN');
const num = n => Number(n) || 0;
const fmtQty = n => { const v = Math.round(num(n) * 100) / 100; return String(v); };

function addDays(iso, n) {
  const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const DAYS = ['Ravivaar', 'Somvaar', 'Mangalvaar', 'Budhvaar', 'Guruvaar', 'Shukravaar', 'Shanivaar'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function dayLabel(iso) {
  if (!D) return iso;
  if (iso === D.today) return 'Aaj';
  if (iso === addDays(D.today, 1)) return 'Kal';
  if (iso === addDays(D.today, -1)) return 'Kal (beeta)';
  const d = new Date(iso + 'T00:00:00Z');
  return `${d.getUTCDate()} ${MON[d.getUTCMonth()]}`;
}
function longDay(iso) {
  const d = new Date(iso + 'T00:00:00Z');
  return `${DAYS[d.getUTCDay()]}, ${d.getUTCDate()} ${MON[d.getUTCMonth()]}`;
}

const SLOT = { morning: ['🌅', 'Subah 7–11', 0], afternoon: ['☀️', 'Dopahar 12–4', 1], evening: ['🌇', 'Shaam 5–8', 2] };
const TYPE = {
  vegetable:    { e: '🥬', l: 'Sabzi',      cls: 'vc-veg' },
  onion_potato: { e: '🧅', l: 'Pyaaz–Aloo', cls: 'vc-onion' },
  fruit:        { e: '🍎', l: 'Fruits',     cls: 'vc-fruit' }
};
const STATUS = {
  placed:         ['Naya order', 'st-new'],
  on_the_way:     ['Raaste me', 'st-go'],
  reached:        ['Pahunch gaya', 'st-go'],
  bill_final:     ['Bill bheja', 'st-go'],
  bill_approved:  ['Bill approved', 'st-go'],
  paid:           ['Paid', 'st-ok'],
  delivered:      ['Delivered', 'st-ok'],
  completed:      ['Complete', 'st-ok'],
  cancelled:      ['Cancel', 'st-mut'],
  missed:         ['Miss hua', 'st-bad'],
  disputed:       ['Dispute', 'st-bad'],
  pending_review: ['Review baaki', 'st-bad']
};
const GROUP = {
  all: null,
  new: ['placed'],
  going: ['on_the_way', 'reached', 'bill_final', 'bill_approved'],
  done: ['paid', 'delivered', 'completed'],
  problem: ['cancelled', 'missed', 'disputed', 'pending_review']
};
const GROUP_LBL = { all: 'Sab', new: 'Naye', going: 'Chal rahe', done: 'Complete', problem: 'Cancel / problem' };

/* A booking counts as a sale once money moved: a payment row exists,
   or the vendor marked it paid / delivered / completed. */
const isSold = b => b.pay_amount != null || ['paid', 'delivered', 'completed'].includes(b.status);
const saleAmt = b => num(b.pay_amount ?? b.final_total ?? b.est_total);
const itemQty = it => num(it.final_qty ?? it.qty);
const itemPrice = it => num(it.final_price ?? it.price_at_booking);

function stPill(s) { const [l, c] = STATUS[s] || [s, 'st-mut']; return `<span class="st ${c}">${esc(l)}</span>`; }

let tT;
function toast(m) {
  const t = $('toast'); t.textContent = m; t.classList.add('show');
  clearTimeout(tT); tT = setTimeout(() => t.classList.remove('show'), 1800);
}

async function api(path, body) {
  try {
    const r = await fetch('../api/staff' + path, {
      method: body ? 'POST' : 'GET', credentials: 'same-origin',
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined
    });
    const j = await r.json().catch(() => ({ ok: false, error: 'Server se jawab nahi aaya' }));
    if (r.status === 401 && path === '/snapshot') { showLogin(); }
    return j;
  } catch (e) { return { ok: false, error: 'Internet check karo' }; }
}

/* ---------- auth ---------- */
function showLogin(msg) {
  clearInterval(timer); timer = null;
  $('s-app').classList.remove('on'); $('s-login').classList.add('on');
  $('loginMsg').textContent = msg || '';
  setTimeout(() => $('pw').focus(), 50);
}
function showApp() {
  $('s-login').classList.remove('on'); $('s-app').classList.add('on');
  render(); refresh();
  clearInterval(timer);
  timer = setInterval(() => { if (!document.hidden) refresh(true); }, 60_000);
}
async function login() {
  const pw = $('pw').value;
  if (!pw) { $('loginMsg').textContent = 'Password daalo'; return; }
  $('loginBtn').disabled = true;
  const r = await api('/login', { password: pw });
  $('loginBtn').disabled = false;
  if (!r.ok) { $('loginMsg').textContent = r.error || 'Login nahi hua'; return; }
  $('pw').value = '';
  showApp();
}
async function logout() {
  await api('/logout', {});
  D = null; showLogin('Logout ho gaye');
}

/* ---------- data ---------- */
async function refresh(silent) {
  if (busy) return;
  busy = true;
  const btn = document.querySelector('[data-act="refresh"]');
  btn && btn.classList.add('spin');
  const r = await api('/snapshot');
  btn && btn.classList.remove('spin');
  busy = false;
  if (!r.ok) {
    if (!$('s-app').classList.contains('on')) return;
    if (!silent) toast(r.error === 'unauthorised' ? 'Dubara login karo' : 'Data load nahi hua');
    if (!D) $('v-' + TAB).innerHTML = `<div class="empty"><div class="e">⚠️</div><b>Data load nahi hua</b>
      <p>${esc(r.error || '')}</p><button class="btn" data-act="refresh">Dubara try karo</button></div>`;
    return;
  }
  const first = !D;
  D = r.data;
  $('hdrDay').textContent = 'Aaj, ' + longDay(D.today);
  const pill = $('srcPill');
  pill.textContent = D.source === 'supabase' ? 'LIVE' : 'DEMO DATA';
  pill.classList.toggle('live', D.source === 'supabase');
  $('stamp').textContent = 'Update: ' + new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  render(first);
  if (!silent && !first) toast('Naya data aa gaya ✓');
}

/* ---------- views ---------- */
function render(animate) {
  const el = $('v-' + TAB);
  if (!D) { el.innerHTML = '<div class="sk"></div><div class="sk"></div><div class="sk"></div>'; return; }
  ({ orders: vOrders, vendors: vVendors, sale: vSale })[TAB](el, animate);
}
function tab(t) {
  TAB = t;
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('on', v.id === 'v-' + t));
  document.querySelectorAll('.bni').forEach(b => b.classList.toggle('on', b.dataset.arg === t));
  window.scrollTo(0, 0);
  render(true);
}

/* Orders ------------------------------------------------------ */
function inDay(b) {
  const t = D.today;
  switch (F.day) {
    case 'today': return b.booking_date === t;
    case 'tomorrow': return b.booking_date === addDays(t, 1);
    case 'week': return b.booking_date >= addDays(t, -6) && b.booking_date <= t;
    case 'upcoming': return b.booking_date > t;
    default: return true;
  }
}
function vOrders(el, animate) {
  const dayRows = D.bookings.filter(inDay);
  const q = F.q.trim().toLowerCase();
  const rows = dayRows
    .filter(b => !GROUP[F.status] || GROUP[F.status].includes(b.status))
    .filter(b => !q || [b.code, b.customer_name, b.customer_phone, b.area, b.vendor_name]
      .some(x => String(x || '').toLowerCase().includes(q)))
    .sort((a, b) => F.day === 'week' || F.day === 'all'
      ? (b.booking_date.localeCompare(a.booking_date) || (SLOT[a.slot]?.[2] ?? 9) - (SLOT[b.slot]?.[2] ?? 9))
      : (a.booking_date.localeCompare(b.booking_date) || (SLOT[a.slot]?.[2] ?? 9) - (SLOT[b.slot]?.[2] ?? 9)));

  const cnt = g => dayRows.filter(b => !GROUP[g] || GROUP[g].includes(b.status)).length;
  const today = D.bookings.filter(b => b.booking_date === D.today);
  const tCnt = g => today.filter(b => GROUP[g].includes(b.status)).length;
  const rv = animate ? 'rv' : '';

  const dayChips = [['today', 'Aaj'], ['tomorrow', 'Kal'], ['upcoming', 'Aane wale'], ['week', 'Pichhle 7 din'], ['all', 'Sab']];
  el.innerHTML = `
    <div class="tiles ${rv} d1">
      <div class="tile"><div class="n">${today.length}</div><div class="l">Aaj ke orders</div></div>
      <div class="tile o"><div class="n">${tCnt('new') + tCnt('going')}</div><div class="l">Abhi baaki / chal rahe</div></div>
      <div class="tile g"><div class="n">${tCnt('done')}</div><div class="l">Aaj complete</div></div>
      <div class="tile r"><div class="n">${tCnt('problem')}</div><div class="l">Cancel / problem</div></div>
    </div>

    <div class="sec ${rv} d2">Orders <small>${rows.length} dikh rahe</small></div>
    <div class="chips ${rv} d2">${dayChips.map(([k, l]) =>
      `<button class="chip ${F.day === k ? 'on' : ''}" data-act="day" data-arg="${k}">${l}</button>`).join('')}</div>
    <div class="row-gap"></div>
    <div class="chips ${rv} d3">${Object.keys(GROUP).map(k =>
      `<button class="chip ${F.status === k ? 'on' : ''}" data-act="status" data-arg="${k}">${GROUP_LBL[k]}<span class="c">${cnt(k)}</span></button>`).join('')}</div>
    <input class="search ${rv} d3" id="q" type="search" placeholder="Dhoondo — order code, naam, gaon, vendor" value="${esc(F.q)}">
    <div id="ordList">${rows.length ? rows.map(orderCard).join('') : `
      <div class="empty"><div class="e">📭</div><b>Koi order nahi</b><p>Is filter me abhi kuch nahi hai</p></div>`}</div>`;

  const qi = $('q');
  qi.oninput = e => {
    F.q = e.target.value;
    const pos = e.target.selectionStart;
    vOrders(el, false);
    const n = $('q'); n.focus(); n.setSelectionRange(pos, pos);
  };
}
function orderCard(b) {
  const [se, sl] = SLOT[b.slot] || ['', b.slot];
  const t = TYPE[b.v_type] || { e: '🛒', l: b.v_type };
  const final = b.final_total != null || b.pay_amount != null;
  const items = b.items || [];
  const names = items.filter(i => !i.removed).map(i => i.name);
  const open = OPEN.has(b.id);
  return `<div class="ord ${open ? 'open' : ''}" data-act="toggle" data-arg="${esc(b.id)}" role="button" tabindex="0">
    <div class="ord-top">
      <span class="ord-code">${esc(b.code || '—')}</span>${stPill(b.status)}
      <span class="ord-amt">${rs(final ? saleAmt(b) : b.est_total)}<small>${final
        ? (b.pay_method ? (b.pay_method === 'cash' ? 'Cash' : 'UPI') : 'Final bill') : 'Anumaanit'}</small></span>
    </div>
    <div class="ord-slot">${esc(dayLabel(b.booking_date))} · ${se} ${esc(sl)} · ${t.e} ${esc(t.l)}</div>
    <div class="ord-who">👤 <b>${esc(b.customer_name || 'Customer')}</b> · 📍 ${esc(b.area || '—')}</div>
    <div class="ord-sub">🧑‍🌾 ${esc(b.vendor_name || 'Vendor abhi assign nahi')}</div>
    <div class="ord-sub">🧺 ${items.length ? esc(names.slice(0, 4).join(', ')) + (names.length > 4 ? ` +${names.length - 4} aur` : '') : 'Koi item nahi'}</div>
    <div class="ord-items">
      ${items.map(i => `<div class="it ${i.removed ? 'rm' : ''}"><span>${esc(i.name)} · ${fmtQty(itemQty(i))} × ${esc(i.unit || '')}</span>
        <span>${rs(itemQty(i) * itemPrice(i))}</span></div>`).join('')}
      ${b.landmark ? `<div class="ord-sub">Landmark: ${esc(b.landmark)}</div>` : ''}
      <div class="ord-foot">
        ${b.customer_phone ? `<a class="call" href="tel:${esc(b.customer_phone)}">📞 Customer</a>` : ''}
        ${vendorPhone(b.vendor_id) ? `<a class="call" href="tel:${esc(vendorPhone(b.vendor_id))}">📞 Vendor</a>` : ''}
      </div>
    </div>
  </div>`;
}
const vendorPhone = id => (D.vendors.find(v => v.id === id) || {}).phone;

/* Vendors ----------------------------------------------------- */
function vVendors(el, animate) {
  const rv = animate ? 'rv' : '';
  const t = D.today, from7 = addDays(t, -6);
  const stats = v => {
    const mine = D.bookings.filter(b => b.vendor_id === v.id);
    const todayRows = mine.filter(b => b.booking_date === t && b.status !== 'cancelled');
    return {
      today: todayRows.length,
      todaySale: mine.filter(b => b.booking_date === t && isSold(b)).reduce((s, b) => s + saleAmt(b), 0),
      weekSale: mine.filter(b => b.booking_date >= from7 && b.booking_date <= t && isSold(b)).reduce((s, b) => s + saleAmt(b), 0)
    };
  };
  const order = { approved: 0, pending: 1, suspended: 2, rejected: 3 };
  const list = [...D.vendors].sort((a, b) =>
    (order[a.status] ?? 9) - (order[b.status] ?? 9) || String(a.name).localeCompare(String(b.name)));
  const live = list.filter(v => v.status === 'approved' && v.is_active).length;

  el.innerHTML = `
    <div class="tiles ${rv} d1">
      <div class="tile g"><div class="n">${live}</div><div class="l">Live vendors</div></div>
      <div class="tile"><div class="n">${list.length}</div><div class="l">Kul vendors</div></div>
    </div>
    <div class="sec ${rv} d2">Vendors <small>aaj ka kaam aur sale</small></div>
    ${list.length ? list.map((v, i) => {
      const s = stats(v), ty = TYPE[v.v_type] || { e: '🛒', l: v.v_type };
      const st = v.status === 'approved' ? (v.is_active ? ['Live', 'st-ok'] : ['Band hai', 'st-mut'])
        : v.status === 'pending' ? ['Approval baaki', 'st-go'] : [v.status === 'suspended' ? 'Suspended' : 'Rejected', 'st-bad'];
      return `<div class="ven ${rv} d${Math.min(6, i + 2)}">
        <div class="ven-top">
          <div class="ven-av av-${esc(v.v_type)}">${ty.e}</div>
          <div><div class="ven-name">${esc(v.name)}</div>
            <div class="ven-sub">${esc(v.shop_name || ty.l)} · ${v.avg_rating ? '⭐ ' + num(v.avg_rating).toFixed(1) + ` (${num(v.total_ratings)})` : 'Rating nahi'}</div></div>
          <span class="st ${st[1]}">${st[0]}</span>
        </div>
        <div class="ven-stats">
          <div class="vs"><div class="n">${s.today}</div><div class="l">Aaj ke orders</div></div>
          <div class="vs"><div class="n">${rs(s.todaySale)}</div><div class="l">Aaj ki sale</div></div>
          <div class="vs"><div class="n">${rs(s.weekSale)}</div><div class="l">7 din ki sale</div></div>
        </div>
        <div class="ven-areas">${(v.areas_served || []).map(a => `<span class="tag">📍 ${esc(a)}</span>`).join('') || '<span class="tag">Koi gaon nahi</span>'}</div>
        ${v.phone ? `<div class="ord-foot"><a class="call" href="tel:${esc(v.phone)}">📞 ${esc(v.phone)}</a></div>` : ''}
      </div>`;
    }).join('') : '<div class="empty"><div class="e">🧑‍🌾</div><b>Abhi koi vendor nahi</b></div>'}`;
}

/* Sale -------------------------------------------------------- */
function inPeriod(iso) {
  const t = D.today;
  if (iso > t) return false;
  switch (S.period) {
    case 'today': return iso === t;
    case 'yesterday': return iso === addDays(t, -1);
    case '7': return iso >= addDays(t, -6);
    case '30': return iso >= addDays(t, -29);
    default: return true;
  }
}
function vSale(el, animate) {
  const rv = animate ? 'rv' : '';
  const sold = D.bookings.filter(b => isSold(b) && inPeriod(b.booking_date));
  const byType = k => sold.filter(b => b.v_type === k);
  const sum = rows => rows.reduce((s, b) => s + saleAmt(b), 0);
  const catRows = byType(S.cat);
  const catTotal = sum(catRows);
  const t = TYPE[S.cat];

  const cash = sum(catRows.filter(b => b.pay_method === 'cash'));
  const upi = sum(catRows.filter(b => b.pay_method && b.pay_method !== 'cash'));
  const other = catTotal - cash - upi;
  const pct = n => catTotal ? (n / catTotal * 100).toFixed(1) : 0;

  /* item-wise, from the final bill lines (qty × per-unit price) */
  const items = {};
  catRows.forEach(b => (b.items || []).forEach(it => {
    if (it.removed) return;
    const k = String(it.name || '').trim().toLowerCase() + '|' + (it.unit || '');
    const r = items[k] || (items[k] = { name: String(it.name || '').trim(), unit: it.unit || '', qty: 0, amt: 0, orders: new Set() });
    r.qty += itemQty(it); r.amt += itemQty(it) * itemPrice(it); r.orders.add(b.id);
  }));
  const itemRows = Object.values(items).sort((a, b) => b.amt - a.amt);

  /* last 7 days, selected type */
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = addDays(D.today, -i);
    days.push({ d, v: sum(D.bookings.filter(b => b.v_type === S.cat && isSold(b) && b.booking_date === d)) });
  }
  const max = Math.max(1, ...days.map(x => x.v));

  const periods = [['today', 'Aaj'], ['yesterday', 'Kal'], ['7', '7 din'], ['30', '30 din'], ['all', 'Ab tak']];
  const pLbl = Object.fromEntries(periods)[S.period];
  el.innerHTML = `
    <div class="chips ${rv} d1">${periods.map(([k, l]) =>
      `<button class="chip ${S.period === k ? 'on' : ''}" data-act="period" data-arg="${k}">${l}</button>`).join('')}</div>

    <div class="cat3 ${rv} d2">${Object.entries(TYPE).map(([k, v]) =>
      `<button class="cat ${v.cls} ${S.cat === k ? '' : 'dim'}" data-act="cat" data-arg="${k}">
        <div class="e">${v.e}</div><div class="n">${rs(sum(byType(k)))}</div><div class="l">${v.l}</div></button>`).join('')}</div>

    <div class="hero ${rv} d3" style="margin-top:12px">
      <div class="deco">${t.e}</div>
      <div class="l">${t.l} ki total sale · ${esc(pLbl)}</div>
      <div class="n">${rs(catTotal)}</div>
      <div class="s">${catRows.length} order · average ${rs(catRows.length ? catTotal / catRows.length : 0)} per order</div>
    </div>

    <div class="card ${rv} d4" style="margin-top:12px">
      <div style="font-weight:800">Payment kaise aaya</div>
      <div class="split"><i class="cash" style="width:${pct(cash)}%"></i><i class="upi" style="width:${pct(upi)}%"></i></div>
      <div class="legend">
        <span><i class="dot" style="background:var(--g)"></i>Cash <b>${rs(cash)}</b></span>
        <span><i class="dot" style="background:var(--blue)"></i>UPI <b>${rs(upi)}</b></span>
      </div>
      ${other > 0.5 ? `<div class="note">${rs(other)} ka payment method record nahi hua.</div>` : ''}
    </div>

    <div class="sec ${rv} d5">Pichhle 7 din <small>${t.l}</small></div>
    <div class="card ${rv} d5"><div class="bars">${days.map(x => `
      <div class="bar ${x.d === D.today ? 'today' : ''}">
        <em>${x.v ? (x.v >= 1000 ? (x.v / 1000).toFixed(1) + 'k' : Math.round(x.v)) : ''}</em>
        <i style="height:${(x.v / max * 100).toFixed(1)}%"></i>
        <span>${x.d === D.today ? 'Aaj' : new Date(x.d + 'T00:00:00Z').getUTCDate()}</span></div>`).join('')}
    </div></div>

    <div class="sec ${rv} d6">Kya kitna bika <small>${t.l} · ${esc(pLbl)}</small></div>
    <div class="card ${rv} d6">${itemRows.length ? `
      <table class="tbl"><thead><tr><th>ITEM</th><th class="qty">MAATRA</th><th class="num">SALE</th></tr></thead><tbody>
      ${itemRows.map((r, i) => `<tr><td><span class="rank">${i + 1}</span>${esc(r.name)}</td>
        <td class="qty">${fmtQty(r.qty)} × ${esc(r.unit)}</td><td class="num">${rs(r.amt)}</td></tr>`).join('')}
      </tbody></table>
      <div class="note">Item sale vendor ke final bill se hai (maatra × rate). Total sale me asli payment gina gaya hai, isliye thoda farak ho sakta hai.</div>`
      : `<div class="empty"><div class="e">${t.e}</div><b>Is time me ${esc(t.l.toLowerCase())} ki sale nahi</b><p>Doosra din chuno</p></div>`}
    </div>`;
}

/* ---------- events ---------- */
document.addEventListener('click', e => {
  if (e.target.closest('a[href^="tel:"]')) return;          /* let calls through, don't toggle the card */
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const a = el.dataset.act, arg = el.dataset.arg;
  if (a === 'login') login();
  else if (a === 'logout') logout();
  else if (a === 'refresh') refresh();
  else if (a === 'tab') tab(arg);
  else if (a === 'day') { F.day = arg; render(); }
  else if (a === 'status') { F.status = arg; render(); }
  else if (a === 'period') { S.period = arg; render(); }
  else if (a === 'cat') { S.cat = arg; render(); }
  else if (a === 'toggle') { OPEN.has(arg) ? OPEN.delete(arg) : OPEN.add(arg); el.classList.toggle('open'); }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.id === 'pw') login();
  if ((e.key === 'Enter' || e.key === ' ') && e.target.classList?.contains('ord')) { e.preventDefault(); e.target.click(); }
});
document.addEventListener('visibilitychange', () => { if (!document.hidden && D) refresh(true); });

(async () => {
  const me = await api('/me');
  if (me.ok) showApp();
  else showLogin(me.configured === false ? 'Staff login abhi set nahi hua — admin se bolo' : '');
})();
