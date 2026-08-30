/* ============================================================
   Admin UI. Talks only to this server's /api/* — never to
   Supabase directly, so no key ever reaches the browser.
   ============================================================ */
let D = {}, VIEW = 'home';

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g,
  c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
const money = n => '\u20B9' + Number(n || 0).toLocaleString('en-IN');
const when = d => {
  if (!d) return '\u2014';
  const m = Math.round((Date.now() - new Date(d)) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return m + 'm ago';
  if (m < 1440) return Math.round(m / 60) + 'h ago';
  return Math.round(m / 1440) + 'd ago';
};
/* ============================================================
   Real SVG chart rendering — smooth animated line(s), gradient
   fill, hover tooltips. No chart library: this is ~60 lines of
   plain SVG path math, which keeps the whole admin dependency-free.
   ============================================================ */
let chartSeq = 0;
function svgChart(points, opts) {
  opts = opts || {};
  const W = 900, H = opts.h || 220, PAD = 28, PADB = 26;
  const id = 'c' + (chartSeq++);
  const series = opts.series || [{ key: 'v', color: 'var(--g-lt)', fillTop: 'rgba(74,222,128,.32)', fillBot: 'rgba(74,222,128,0)' }];
  const n = points.length || 1;
  const allVals = points.flatMap(p => series.map(s => Number(p[s.key]) || 0));
  const max = Math.max(1, ...allVals);
  const x = i => PAD + (i / Math.max(1, n - 1)) * (W - PAD * 2);
  const y = v => H - PADB - (v / max) * (H - PADB - 14);

  const pathFor = key => points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(Number(p[key]) || 0).toFixed(1)}`).join(' ');
  const areaFor = key => `${pathFor(key)} L ${x(n - 1).toFixed(1)} ${H - PADB} L ${x(0).toFixed(1)} ${H - PADB} Z`;

  let svg = `<svg class="chart-svg" viewBox="0 0 ${W} ${H}" id="${id}" preserveAspectRatio="none" style="height:${H}px">`;
  series.forEach((s, si) => {
    if (s.fillTop) {
      svg += `<defs><linearGradient id="${id}f${si}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${s.fillTop}"/><stop offset="1" stop-color="${s.fillBot}"/></linearGradient></defs>`;
      svg += `<path class="chart-area" d="${areaFor(s.key)}" fill="url(#${id}f${si})"/>`;
    }
  });
  series.forEach(s => {
    const d = pathFor(s.key);
    const len = d.length * 1.6;
    svg += `<path class="chart-line" d="${d}" stroke="${s.color}"
      style="stroke-dasharray:${len};stroke-dashoffset:${len};animation:drawIn 1.1s var(--ez2) ${opts.delay || 0}s forwards"/>`;
  });
  points.forEach((p, i) => {
    series.forEach(s => {
      const cy = y(Number(p[s.key]) || 0);
      svg += `<circle class="chart-dot" cx="${x(i).toFixed(1)}" cy="${cy.toFixed(1)}" r="3.5"
        style="stroke:${s.color};animation:popIn .3s var(--sp) ${(opts.delay || 0) + i * 0.03}s both"/>`;
    });
    if (i % Math.ceil(n / 7) === 0 || i === n - 1) {
      svg += `<text class="chart-axis" x="${x(i).toFixed(1)}" y="${H - 6}" text-anchor="middle">${esc(p.label || '')}</text>`;
    }
    const tipLines = series.map(s => `${s.name || s.key}: ${opts.fmt ? opts.fmt(p[s.key]) : p[s.key]}`).join('|');
    svg += `<rect class="chart-hit" data-tip="${esc(p.label || '')}||${esc(tipLines)}"
      x="${(x(i) - (W / n) / 2).toFixed(1)}" y="0" width="${(W / n).toFixed(1)}" height="${H}"/>`;
  });
  svg += `</svg>`;
  return `<div class="chart-wrap" data-chart="${id}">${svg}<div class="chart-tip" id="${id}tip"></div></div>`;
}
(function injectDrawInKeyframe(){
  const s = document.createElement('style');
  s.textContent = '@keyframes drawIn{to{stroke-dashoffset:0}}';
  document.head.appendChild(s);
})();
document.addEventListener('mousemove', e => {
  const wrap = e.target.closest('[data-chart]');
  if (!wrap) return;
  const hit = e.target.closest('.chart-hit');
  const tip = wrap.querySelector('.chart-tip');
  if (!hit || !tip) { if (tip) tip.classList.remove('show'); return; }
  const [label, lines] = (hit.dataset.tip || '').split('||');
  tip.innerHTML = `<b>${esc(label)}</b><br>${(lines || '').split('|').map(esc).join('<br>')}`;
  const r = hit.getBoundingClientRect(), wr = wrap.getBoundingClientRect();
  tip.style.left = (r.left - wr.left + r.width / 2) + 'px';
  tip.style.top = (r.top - wr.top) + 'px';
  tip.classList.add('show');
});
document.addEventListener('mouseout', e => {
  if (e.target.closest('[data-chart]') && !e.relatedTarget?.closest?.('[data-chart]')) {
    document.querySelectorAll('.chart-tip.show').forEach(t => t.classList.remove('show'));
  }
});

let tT;
function toast(m) {
  const t = document.getElementById('toast');
  t.textContent = m; t.classList.add('show');
  clearTimeout(tT); tT = setTimeout(() => t.classList.remove('show'), 2400);
}
async function api(path, body) {
  const res = await fetch('/api' + path, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined
  });
  const json = await res.json().catch(() => ({ ok: false, error: 'Bad response' }));
  if (res.status === 401 && !path.startsWith('/login')) { showLogin(); return { ok: false, error: 'Session expired' }; }
  return json;
}

/* ---------- auth ---------- */
function showLogin() {
  document.getElementById('login').style.display = 'flex';
  document.getElementById('app').style.display = 'none';
}
async function doLogin() {
  const pw = document.getElementById('pw').value;
  const msg = document.getElementById('loginMsg');
  msg.textContent = '';
  const r = await api('/login', { password: pw });
  if (!r.ok) { msg.textContent = r.error || 'Wrong password'; return; }
  document.getElementById('login').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
  refresh();
}
async function doLogout() { await api('/logout', {}); location.reload(); }

async function boot() {
  const me = await api('/me');
  const pill = document.getElementById('modePill');
  pill.textContent = me.mode === 'supabase' ? 'LIVE DATA' : 'MOCK DATA';
  pill.classList.toggle('live', me.mode === 'supabase');
  if (me.configured === false) {
    const msg = document.getElementById('loginMsg');
    if (msg) msg.textContent = 'Admin login is not configured yet — set ADMIN_PASSWORD_HASH and SESSION_SECRET (see README).';
  }
  if (!me.ok) return showLogin();
  document.getElementById('login').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
  refresh();
}
async function refresh() {
  document.getElementById('stamp').textContent = 'loading\u2026';
  ALL_PRODUCTS = null;   /* the global Refresh button should refresh everything, catalogue included */
  ALL_MESSAGES = null; loadMessages();   /* eager, so the unread badge is right the moment you log in */
  const r = await api('/snapshot');
  if (!r.ok) {
    document.getElementById('stamp').textContent = 'failed';
    document.getElementById('v-' + VIEW).innerHTML =
      `<div class="empty"><div class="e">\u26A0\uFE0F</div><b>Could not load data</b>
       <p>${esc(r.error || 'Unknown error')}</p>
       <button class="btn btn-g" style="margin-top:16px" data-act="refresh">Retry</button></div>`;
    return;
  }
  D = r.data;
  const pend = D.vendors.filter(v => v.status === 'pending').length;
  const bv = document.getElementById('bVend');
  bv.style.display = pend ? 'inline-block' : 'none'; bv.textContent = pend;
  const pendP = (D.pending || []).length;
  const bp = document.getElementById('bProd');
  if (bp) { bp.style.display = pendP ? 'inline-block' : 'none'; bp.textContent = pendP; }
  const blocks = D.readiness.filter(x => x.state === 'no').length;
  const bl = document.getElementById('bLaunch');
  bl.style.display = blocks ? 'inline-block' : 'none'; bl.textContent = blocks;
  const pill = document.getElementById('modePill');
  pill.textContent = D.source === 'supabase' ? 'LIVE DATA' : 'MOCK DATA';
  pill.classList.toggle('live', D.source === 'supabase');
  document.getElementById('stamp').textContent =
    'updated ' + new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  render();
}

/* ---------- routing ---------- */
const TITLES = {
  home:      ['Overview', 'how RozBazaar is doing right now'],
  launch:    ['Launch readiness', 'what still blocks a real order'],
  bookings:  ['Bookings', 'every order, newest first'],
  vendors:   ['Vendors', 'approve, track and fix'],
  products:  ['Products', 'items vendors submitted, waiting on you'],
  customers: ['Customers', 'who has signed up'],
  areas:     ['Areas', 'villages, coordinates and coverage'],
  traffic:   ['Traffic', 'how many people are visiting'],
  messages:  ['Messages', 'what customers are telling you']
};
function go(v) {
  VIEW = v;
  document.querySelectorAll('.scr').forEach(x => x.classList.remove('on'));
  document.getElementById('v-' + v).classList.add('on');
  document.querySelectorAll('.nav[data-v]').forEach(b => b.classList.toggle('on', b.dataset.v === v));
  document.getElementById('pgTitle').textContent = TITLES[v][0];
  document.getElementById('pgSub').textContent = TITLES[v][1];
  window.scrollTo(0, 0); render();
}
function render() {
  if (!D || !D.readiness) {                       /* snapshot not in yet */
    const el = document.getElementById('v-' + VIEW);
    if (el && !el.innerHTML.trim())
      el.innerHTML = '<div class="card"><div class="sk" style="height:70px"></div></div>';
    return;
  }
  ({ home: vHome, launch: vLaunch, bookings: vBookings, vendors: vVendors,
     products: vProducts, customers: vCustomers, areas: vAreas, traffic: vTraffic,
     messages: vMessages }[VIEW] || vHome)();
  animateCounts();
}
/* Whole numbers count up from 0 on render — a small touch, but it's
   the difference between a dashboard that feels alive and one that
   just appears. Money/percent strings are left alone; only clean
   integers (data-count) animate. */
function animateCounts() {
  document.querySelectorAll('.nm[data-count]').forEach(el => {
    const target = Number(el.dataset.count) || 0;
    const dur = 700, t0 = performance.now();
    const step = now => {
      const p = Math.min(1, (now - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(target * eased).toLocaleString('en-IN');
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}
const banner = () => D.source === 'mock'
  ? `<div class="banner"><b>Mock data.</b> Nothing here touches your Supabase project.
     Set <code>USE_SUPABASE=true</code> in <code>.env</code> with a service-role key to go live.</div>` : '';

function kpi(lb, nm, dt, cls) {
  const isPlainNumber = typeof nm === 'number' || /^\d+$/.test(String(nm));
  return `<div class="card kpi ${cls || ''}"><div class="lb">${lb}</div>
    <div class="nm"${isPlainNumber ? ` data-count="${nm}"` : ''}>${isPlainNumber ? '0' : nm}</div>
    <div class="dt">${dt || ''}</div></div>`;
}

/* ---------- views ---------- */
function vHome() {
  const o = D.ov, r = D.readiness, blocked = r.filter(x => x.state === 'no');
  const done = r.filter(x => x.state === 'ok').length, pct = Math.round(done / r.length * 100);
  const d = D.daily, max = Math.max(1, ...d.map(x => Number(x.sales) || 0));
  document.getElementById('v-home').innerHTML = banner() + `
    ${blocked.length ? `<div class="card" style="border-color:rgba(229,72,77,.45)">
      <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">
        <div class="ring" style="--p:${pct}"><i>${pct}%</i></div>
        <div style="min-width:200px;flex:1">
          <div class="disp" style="font-size:19px">Not ready to launch</div>
          <div style="font-size:13.5px;color:var(--tx2);margin-top:5px;line-height:1.55">
            ${blocked.length} thing${blocked.length > 1 ? 's' : ''} still block${blocked.length > 1 ? '' : 's'} a real order:
            <b style="color:var(--red)">${blocked.map(b => esc(b.t)).join(' \u00B7 ')}</b></div>
          <button class="btn btn-g btn-sm" style="margin-top:12px" data-act="go" data-arg="launch">See what to fix \u2192</button>
        </div></div></div>`
      : `<div class="card" style="border-color:rgba(47,168,80,.45)">
        <div style="display:flex;align-items:center;gap:14px">
          <div class="ring" style="--p:100"><i>\u2713</i></div>
          <div><div class="disp" style="font-size:19px">Ready to take orders</div>
          <div style="font-size:13.5px;color:var(--tx2);margin-top:4px">Every launch check passes.</div></div>
        </div></div>`}

    <div class="sec"><h2>Today</h2></div>
    <div class="grid k4">
      ${kpi('Bookings today', o.bookings_today, 'placed today', o.bookings_today ? 'good' : '')}
      ${kpi('Needs attention', o.needs_attention, 'disputes / missed', o.needs_attention > 0 ? 'bad' : '')}
      ${kpi('Vendors live', o.vendors_live, (o.vendors_pending || 0) + ' awaiting review', o.vendors_live ? 'good' : 'bad')}
      ${kpi('Customers', o.customers_total, 'registered total', o.customers_total ? '' : 'warn')}
    </div>
    <div class="grid k3" style="margin-top:15px">
      ${kpi('Completed (30d)', o.completed_30d, 'delivered & paid')}
      ${kpi('Sales (30d)', money(o.sales_30d), 'straight to vendors')}
      ${kpi('Waitlist', o.waitlist_open, 'asking for a vendor', o.waitlist_open > 0 ? 'warn' : '')}
    </div>

    <div class="sec"><h2>Sales, last 14 days</h2>
      <span class="r">${money(d.reduce((s, x) => s + Number(x.sales || 0), 0))} total</span></div>
    <div class="card">${svgChart(
        d.map(x => ({ v: Number(x.sales) || 0, label: String(x.d).slice(8, 10) + '/' + String(x.d).slice(5, 7) })),
        { fmt: v => money(v), series: [{ key: 'v', name: 'Sales', color: 'var(--g-lt)',
          fillTop: 'rgba(74,222,128,.32)', fillBot: 'rgba(74,222,128,0)' }] }
      )}</div>

    ${D.gaps.length ? `<div class="sec"><h2>Demand with no vendor</h2>
      <span class="r">people asking, nobody to serve them</span></div>
      <div class="tw"><table><thead><tr><th>Area</th><th>Type</th><th>Requests</th>
      <th>Vendors there</th><th>Latest</th></tr></thead><tbody>
      ${D.gaps.map(g => `<tr><td><b>${esc(g.area)}</b></td><td>${esc(g.v_type)}</td>
        <td><span class="pill p-o">${g.requests}</span></td><td>${g.vendors_there}</td>
        <td class="mu">${when(g.latest)}</td></tr>`).join('')}</tbody></table></div>` : ''}`;
}

function vLaunch() {
  const r = D.readiness, done = r.filter(x => x.state === 'ok').length;
  const pct = Math.round(done / r.length * 100);
  document.getElementById('v-launch').innerHTML = banner() + `
    <div class="card"><div style="display:flex;align-items:center;gap:18px;flex-wrap:wrap">
      <div class="ring" style="--p:${pct}"><i>${pct}%</i></div>
      <div style="flex:1;min-width:200px">
        <div class="disp" style="font-size:20px">${done} of ${r.length} checks passing</div>
        <div style="font-size:13.5px;color:var(--tx2);margin-top:5px">
          Red blocks a real order. Amber is worth fixing but will not stop one.</div>
      </div></div></div>
    <div class="card" style="margin-top:15px">
      ${r.map(x => `<div class="chk ${x.state}">
        <span class="dot">${x.state === 'ok' ? '\u2713' : x.state === 'no' ? '\u2715' : '!'}</span>
        <div style="min-width:0"><b>${esc(x.t)}</b><span>${esc(x.d)}</span></div>
        <div class="act"><button class="btn btn-o btn-sm" data-act="go" data-arg="${x.act}">Open</button></div>
      </div>`).join('')}
    </div>
    <div class="sec"><h2>Settings only you can change</h2></div>
    <div class="card">
      <div class="chk wa"><span class="dot">!</span><div><b>Sign-in provider</b>
        <span>Supabase \u2192 Authentication \u2192 Providers. Enable <b>Google</b> or <b>Anonymous sign-ins</b>.
        Until one is on, nobody can register and no booking can be created.</span></div></div>
      <div class="chk wa"><span class="dot">!</span><div><b>Redirect URLs</b>
        <span>Authentication \u2192 URL Configuration. Site URL plus <code>/</code> and <code>/vendor</code>.</span></div></div>
      <div class="chk wa"><span class="dot">!</span><div><b>Leaked password protection</b>
        <span>Authentication \u2192 Policies. One toggle.</span></div></div>
    </div>`;
}

function stPill(s) {
  const m = { placed:'p-b', on_the_way:'p-o', reached:'p-o', bill_final:'p-y', bill_approved:'p-y',
    otp_verified:'p-g', paid:'p-g', delivered:'p-g', completed:'p-g',
    cancelled:'p-m', missed:'p-r', disputed:'p-r' };
  return `<span class="pill ${m[s] || 'p-m'}">${esc(String(s || '').replace(/_/g, ' '))}</span>`;
}
function vBookings() {
  const b = D.bookings;
  document.getElementById('v-bookings').innerHTML = banner() + (b.length ? `
    <div class="tw"><table><thead><tr><th>Code</th><th>Customer</th><th>Area</th><th>Vendor</th>
      <th>Slot</th><th>Status</th><th>Est</th><th>Final</th><th></th></tr></thead><tbody>
      ${b.map(x => `<tr>
        <td><b>${esc(x.code)}</b><div class="mu">${when(x.created_at)}</div></td>
        <td>${esc(x.customer_name)}<div class="mu">${esc(x.customer_phone || '')}</div></td>
        <td>${esc(x.area)}</td><td>${esc(x.vendor_name || '\u2014')}</td>
        <td>${esc(x.booking_date)}<div class="mu">${esc(x.slot)}</div></td>
        <td>${stPill(x.status)}</td><td>${money(x.est_total)}</td>
        <td>${x.final_total != null ? '<b>' + money(x.final_total) + '</b>' : '\u2014'}</td>
        <td>${['disputed','missed'].includes(x.status)
          ? `<button class="btn btn-o btn-sm" data-act="resolve" data-arg="${x.id}">Resolve</button>` : ''}
          ${!['completed','delivered','cancelled'].includes(x.status)
          ? `<button class="btn btn-r btn-sm" data-act="cancelBooking" data-arg="${x.id}" style="margin-left:6px">Cancel</button>` : ''}</td>
      </tr>`).join('')}</tbody></table></div>`
    : `<div class="empty"><div class="e">\u{1F4CB}</div><b>No bookings yet</b>
       <p>They appear the moment a customer confirms one.</p></div>`);
}
async function resolveBooking(id) {
  const r = await api('/bookings/' + id + '/resolve', {});
  toast(r.ok ? 'Marked completed' : (r.error || 'Failed'));
  if (r.ok) refresh();
}
async function cancelBookingUI(id) {
  const reason = window.prompt('Reason for cancelling this order (the customer and vendor will both see this):');
  if (reason === null) return;          /* they backed out — do nothing */
  if (!reason.trim()) { toast('A reason is required'); return; }
  const r = await api('/bookings/' + id + '/cancel', { reason: reason.trim() });
  toast(r.ok ? 'Cancelled — both sides notified' : (r.error || 'Failed'));
  if (r.ok) refresh();
}

function vVendors() {
  const v = D.vendors, perf = {}; D.perf.forEach(p => perf[p.id] = p);
  document.getElementById('v-vendors').innerHTML = banner() + `
    <div class="card" style="margin-bottom:15px">
      <div class="sec" style="margin:0 0 12px"><h2>Add a vendor</h2></div>
      <div class="grid k4" style="gap:10px">
        <div><label class="lb">Name</label><input class="fld" id="nvName" placeholder="Ramesh Kumar"></div>
        <div><label class="lb">Phone</label><input class="fld" id="nvPhone" placeholder="9812345670" maxlength="10"></div>
        <div><label class="lb">Type</label><select class="fld" id="nvType">
          <option value="vegetable">Vegetables</option><option value="fruit">Fruits</option>
          <option value="onion_potato">Pyaaz\u2013Aloo</option></select></div>
        <div><label class="lb">Capacity / slot</label><input class="fld" id="nvCap" value="15" inputmode="numeric"></div>
      </div>
      <div style="margin-top:10px"><label class="lb">Areas he covers</label>
        <div class="row" id="nvAreas">${D.areas.map(a =>
          `<label class="pill p-m" style="cursor:pointer;padding:8px 12px">
            <input type="checkbox" value="${esc(a.name)}" style="margin-right:6px">${esc(a.name)}</label>`).join('')}</div></div>
      <button class="btn btn-g" style="margin-top:13px" data-act="addVendor">+ Add vendor</button>
    </div>
    <div class="tw"><table><thead><tr><th>Vendor</th><th>Type</th><th>Areas</th><th>Status</th>
      <th>Login</th><th>Rating</th><th>Done</th><th>Stale prices</th><th></th></tr></thead><tbody>
      ${v.map(x => { const p = perf[x.id] || {}; return `<tr>
        <td><b>${esc(x.name)}</b><div class="mu">${esc(x.phone)}</div></td>
        <td>${esc(x.v_type)}</td>
        <td>${(x.areas_served || []).map(a => `<span class="pill p-b">${esc(a)}</span>`).join(' ') || '\u2014'}</td>
        <td>${x.status === 'approved'
          ? `<span class="pill ${x.is_active ? 'p-g' : 'p-m'}">${x.is_active ? 'live' : 'paused'}</span>`
          : x.status === 'pending' ? '<span class="pill p-o">pending</span>'
          : x.status === 'suspended' ? '<span class="pill p-o">blocked</span>'
          : `<span class="pill p-r">${esc(x.status)}</span>`}</td>
        <td>${x.can_log_in ? '<span class="pill p-g">linked</span>' : '<span class="pill p-r">not linked</span>'}</td>
        <td>${x.avg_rating ? '\u2B50 ' + Number(x.avg_rating).toFixed(1) : '\u2014'}</td>
        <td>${p.completed ?? 0}</td>
        <td>${p.stale_prices ? `<span class="pill p-o">${p.stale_prices}</span>` : '0'}</td>
        <td>${vendorActions(x)}</td>
      </tr>`; }).join('')}</tbody></table></div>`;
}
/* Every action a vendor's row can offer, based on current status.
   Block/unblock and remove call the SAME admin_review_vendor RPC
   that approve/reject already use — 'suspended' deactivates without
   deleting anything, 'rejected' does the same but is meant as final.
   Both auto-cancel that vendor's upcoming bookings and notify them —
   that logic already lives in the database, not here. */
function vendorActions(x) {
  if (x.status === 'pending') {
    return `<button class="btn btn-g btn-sm" data-act="review" data-arg="${x.id}" data-arg2="approved">Approve</button>
      <button class="btn btn-r btn-sm" data-act="review" data-arg="${x.id}" data-arg2="rejected">Reject</button>`;
  }
  if (x.status === 'approved' && x.is_active) {
    return `<button class="btn btn-o btn-sm" data-act="review" data-arg="${x.id}" data-arg2="suspended">Block</button>
      <button class="btn btn-r btn-sm" data-act="removeVendor" data-arg="${x.id}" data-arg2="${esc(x.name)}">Remove</button>`;
  }
  if (x.status === 'suspended') {
    return `<button class="btn btn-g btn-sm" data-act="review" data-arg="${x.id}" data-arg2="approved">Unblock</button>
      <button class="btn btn-r btn-sm" data-act="removeVendor" data-arg="${x.id}" data-arg2="${esc(x.name)}">Remove</button>`;
  }
  if (x.status === 'rejected') {
    return `<button class="btn btn-g btn-sm" data-act="review" data-arg="${x.id}" data-arg2="approved">Re-approve</button>`;
  }
  return '';
}
async function addVendor() {
  const name = document.getElementById('nvName').value.trim();
  const phone = document.getElementById('nvPhone').value.trim();
  const type = document.getElementById('nvType').value;
  const capacity = parseInt(document.getElementById('nvCap').value, 10) || 15;
  const areas = [...document.querySelectorAll('#nvAreas input:checked')].map(i => i.value);
  if (name.length < 2) return toast('Enter the vendor name');
  if (!/^\d{10}$/.test(phone)) return toast('Enter a 10-digit phone number');
  if (!areas.length) return toast('Pick at least one area');
  const r = await api('/vendors', { name, phone, type, areas, capacity });
  toast(r.ok ? ('Added ' + name) : (r.error || 'Could not add'));
  if (r.ok) refresh();
}
async function reviewVendor(id, decision) {
  const r = await api('/vendors/' + id + '/review', { decision });
  toast(r.ok ? ('Vendor ' + decision) : (r.error || 'Failed'));
  if (r.ok) refresh();
}
async function removeVendor(id, name) {
  if (!confirm(`Remove ${name}? Their upcoming bookings will be cancelled and they'll be notified. This can be undone by re-approving them later if needed.`)) return;
  const r = await api('/vendors/' + id + '/review', { decision: 'rejected' });
  toast(r.ok ? (name + ' removed') : (r.error || 'Failed'));
  if (r.ok) refresh();
}

function vCustomers() {
  const c = D.customers;
  /* Same phone number under different logins (Google account switch,
     anonymous session, etc.) creates separate rows — worth flagging
     rather than hiding, since it affects who a vendor actually calls. */
  const phoneCounts = {};
  c.forEach(x => { const p = (x.phone||'').trim(); if(p) phoneCounts[p] = (phoneCounts[p]||0)+1; });
  const dupPhones = new Set(Object.keys(phoneCounts).filter(p => phoneCounts[p] > 1));

  document.getElementById('v-customers').innerHTML = banner() + (c.length ? `
    ${dupPhones.size ? `<div class="banner" style="border-color:rgba(62,123,250,.35);background:var(--blue-s)">
      <b style="color:var(--blue)">${dupPhones.size} phone number${dupPhones.size>1?'s appear':' appears'} on multiple accounts.</b>
      Usually a customer signed in with a different Google account, or once as a guest and once with Google.
      Not necessarily wrong — just worth a look before you treat them as different people.</div>` : ''}
    <div class="tw"><table><thead><tr><th>Customer</th><th>Phone</th><th>Email</th><th>Bookings</th>
      <th>Spent</th><th>Joined</th><th></th></tr></thead><tbody>
      ${c.map(x => { const dup = dupPhones.has((x.phone||'').trim()); return `<tr${dup?' style="background:var(--blue-s)"':''}>
        <td><b>${esc(x.name)}</b>${x.is_blocked ? ' <span class="pill p-r">blocked</span>' : ''}${dup ? ' <span class="pill p-b">shared number</span>' : ''}</td>
        <td>${esc(x.phone)}</td><td class="mu">${esc(x.email || '\u2014')}</td><td>${x.bookings ?? 0}</td><td>${money(x.spent)}</td>
        <td class="mu">${when(x.created_at)}</td>
        <td><button class="btn btn-o btn-sm" data-act="block" data-arg="${x.id}" data-arg2="${!x.is_blocked}">
          ${x.is_blocked ? 'Unblock' : 'Block'}</button></td>
      </tr>`; }).join('')}</tbody></table></div>`
    : `<div class="empty"><div class="e">👥</div><b>No customers yet</b></div>`);
}
async function blockCustomer(id, blocked) {
  const r = await api('/customers/' + id + '/block', { blocked });
  toast(r.ok ? (blocked ? 'Blocked' : 'Unblocked') : (r.error || 'Failed'));
  if (r.ok) refresh();
}

function vAreas() {
  document.getElementById('v-areas').innerHTML = banner() + `
    <div class="card" style="margin-bottom:15px">
      <div class="sec" style="margin:0 0 12px"><h2>Add a new village</h2></div>
      <div class="row">
        <input class="fld" id="newAreaName" placeholder="Village name" style="flex:1;min-width:180px">
        <button class="btn btn-g" data-act="addArea">+ Add village</button>
      </div>
      <p style="font-size:12.5px;color:var(--mut);margin-top:10px;line-height:1.6">
        It appears everywhere immediately — customer area picker, vendor coverage list.
        Coordinates start approximate; pin it below once you're standing there, or once
        enough real addresses come in from that village.</p>
    </div>
    <div class="tw"><table><thead><tr><th>Area</th><th>Vendors</th><th>Coordinates</th>
      <th>Radius</th><th>Verified</th><th></th></tr></thead><tbody>
      ${D.areas.map(x => `<tr>
        <td><b>${esc(x.name)}</b></td>
        <td>${x.vendor_count > 0 ? `<span class="pill p-g">${x.vendor_count}</span>` : '<span class="pill p-r">0</span>'}</td>
        <td class="mu">${x.lat != null ? Number(x.lat).toFixed(4) + ', ' + Number(x.lng).toFixed(4) : '<span class="pill p-r">missing</span>'}</td>
        <td>${x.radius_km ?? '\u2014'} km</td>
        <td>${x.coords_verified ? '<span class="pill p-g">verified</span>' : '<span class="pill p-o">approximate</span>'}</td>
        <td><button class="btn btn-o btn-sm" data-act="pin" data-arg="${esc(x.name)}">\u{1F4CD} Set from my GPS</button></td>
      </tr>`).join('')}</tbody></table></div>
    <p style="font-size:12.5px;color:var(--mut);margin-top:12px;line-height:1.6">
      Approximate coordinates are safe \u2014 the customer app asks people to confirm their village
      rather than guessing. Verifying only removes that extra tap.</p>`;
}
function pinHere(name) {
  if (!navigator.geolocation) return toast('This device cannot share location');
  toast('Reading GPS \u2014 stand in ' + name + ' for this to be right');
  navigator.geolocation.getCurrentPosition(async pos => {
    const r = await api('/areas/point', { name, lat: pos.coords.latitude, lng: pos.coords.longitude });
    toast(r.ok ? (name + ' pinned and verified') : (r.error || 'Failed'));
    if (r.ok) refresh();
  }, () => toast('Could not read GPS'), { enableHighAccuracy: true, timeout: 10000 });
}

async function addArea() {
  const el = document.getElementById('newAreaName');
  const name = (el && el.value || '').trim();
  if (!name) return toast('Enter a village name');
  const r = await api('/areas', { name, active: true });
  toast(r.ok ? (name + ' added') : (r.error || 'Could not add'));
  if (r.ok) { el.value = ''; refresh(); }
}

let ALL_PRODUCTS = null;   /* lazy-loaded once, refetched after any edit */
let MASTER_CATALOG = null; /* the shared catalog every vendor picks items from */
function vProducts() {
  const list = D.pending || [];
  document.getElementById('v-products').innerHTML = banner() + (list.length ? `
    <p style="font-size:13px;color:var(--tx2);margin-bottom:14px;line-height:1.6">
      A vendor's new item is invisible to every customer until you decide here.
      Price and stock edits on items already approved never come back through this queue —
      only brand-new items do.</p>
    <div class="grid k3">
      ${list.map(p => `
      <div class="card">
        <div style="display:flex;align-items:center;gap:12px">
          <div style="width:52px;height:52px;border-radius:12px;background:var(--bg3);
            display:flex;align-items:center;justify-content:center;font-size:24px;flex-shrink:0;overflow:hidden">
            ${p.image_url ? `<img src="${esc(p.image_url)}" style="width:100%;height:100%;object-fit:cover">` : '\u{1F96C}'}
          </div>
          <div style="min-width:0;flex:1">
            <b style="font-size:15px;display:block">${esc(p.name)}</b>
            <span class="mu">\u20B9${p.price} / ${esc(p.unit)} \u00B7 ${esc(p.category)}</span>
          </div>
        </div>
        <div class="row" style="margin-top:10px">
          <span class="pill p-b">${esc(p.vendor_name)}</span>
          <span class="pill p-m">${esc(p.vendor_phone || '')}</span>
        </div>
        <div class="row" style="margin-top:13px;gap:8px">
          <button class="btn btn-g btn-sm" style="flex:1" data-act="reviewProduct" data-arg="${p.id}" data-arg2="approved">Approve</button>
          <button class="btn btn-r btn-sm" style="flex:1" data-act="reviewProduct" data-arg="${p.id}" data-arg2="rejected">Reject</button>
        </div>
      </div>`).join('')}
    </div>`
    : `<div class="empty"><div class="e">\u{1F96C}</div><b>Nothing waiting</b>
       <p>New items vendors add will show up here before customers can see them.</p></div>`)
    + renderCatalogue() + renderMasterCatalog();
  if (ALL_PRODUCTS === null) loadCatalogue();
  if (MASTER_CATALOG === null) loadMasterCatalog();
}
/* Full catalogue — every product, every vendor, not just what's
   waiting on a decision. Loads once per session and refreshes itself
   after any edit, rather than being bundled into the main snapshot,
   since a large catalogue has no reason to slow down every other tab. */
async function loadCatalogue() {
  const r = await api('/products');
  ALL_PRODUCTS = r.ok ? r.data : [];
  if (VIEW === 'products') vProducts();
}
function renderCatalogue() {
  const rows = ALL_PRODUCTS;
  return `
    <div class="sec"><h2>Full catalogue</h2>
      <span class="r">${rows === null ? 'loading\u2026' : rows.length + ' products, every vendor'}</span></div>
    ${rows === null ? `<div class="card"><div class="sk" style="height:70px"></div></div>` :
      !rows.length ? `<div class="empty"><div class="e">\u{1F96C}</div><b>No products yet</b></div>` : `
    <div class="tw"><table><thead><tr><th>Product</th><th>Vendor</th><th>Category</th>
      <th>Price</th><th>Status</th><th></th><th></th></tr></thead><tbody>
      ${rows.map(p => `<tr>
        <td><b>${esc(p.name)}</b><div class="mu">${esc(p.unit)}</div></td>
        <td>${esc(p.vendor_name)}</td>
        <td class="mu">${esc(p.category)}</td>
        <td>\u20B9<input value="${p.price}" data-act="editPrice" data-arg="${p.id}"
              inputmode="decimal" style="width:56px;border:none;border-bottom:1.5px solid var(--line);
              background:transparent;color:var(--tx);font-weight:800;font-size:13.5px;padding:2px 3px;outline:none"></td>
        <td>${p.in_stock
              ? `<button class="pill p-g" data-act="toggleStock" data-arg="${p.id}" data-arg2="false" style="cursor:pointer">in stock</button>`
              : `<button class="pill p-r" data-act="toggleStock" data-arg="${p.id}" data-arg2="true" style="cursor:pointer">out of stock</button>`}
            ${p.review_status !== 'approved' ? `<span class="pill p-o">${esc(p.review_status)}</span>` : ''}</td>
        <td class="mu">${p.price_updated_at ? when(p.price_updated_at) : '\u2014'}</td>
        <td><button class="btn btn-o btn-sm" data-act="editProductDetails" data-arg="${p.id}">Edit</button></td>
      </tr>`).join('')}</tbody></table></div>`}`;
}
async function editProductDetails(id) {
  /* This is the only path to fix a vendor's typo or an old wrong
     category directly — vendor_upsert_product's fields (name,
     category, unit) previously had no admin-side correction at all.
     A blank answer at any step leaves that field untouched, so
     someone can fix just the one thing that's actually wrong. */
  const p = (ALL_PRODUCTS || []).find(x => x.id === id);
  if (!p) return;
  const name = window.prompt('Product name:', p.name);
  if (name === null) return;
  const category = window.prompt('Category — type: vegetable, fruit, or onion_potato', p.category);
  if (category === null) return;
  if (category.trim() && !['vegetable','fruit','onion_potato'].includes(category.trim())) {
    toast('Category must be exactly: vegetable, fruit, or onion_potato'); return;
  }
  const unit = window.prompt('Unit (e.g. "1 kg", "500 g", "1 pc"):', p.unit);
  if (unit === null) return;
  const r = await api('/products/' + id + '/update', {
    name: name.trim() || undefined, category: category.trim() || undefined, unit: unit.trim() || undefined
  });
  toast(r.ok ? 'Product updated' : (r.error || 'Failed'));
  if (r.ok) { ALL_PRODUCTS = null; loadCatalogue(); }
}
async function editPrice(id, val) {
  const price = parseFloat(val);
  if (isNaN(price) || price <= 0) { toast('Enter a valid price'); ALL_PRODUCTS = null; return vProducts(); }
  const r = await api('/products/' + id + '/update', { price });
  toast(r.ok ? 'Price updated' : (r.error || 'Failed'));
  ALL_PRODUCTS = null; loadCatalogue();
}
async function toggleStock(id, makeInStock) {
  const r = await api('/products/' + id + '/update', { in_stock: makeInStock === 'true' });
  toast(r.ok ? (makeInStock === 'true' ? 'Marked in stock' : 'Marked out of stock') : (r.error || 'Failed'));
  ALL_PRODUCTS = null; loadCatalogue();
}

/* The shared master catalog every vendor's "Browse catalog" screen
   picks from. Previously the only way to add something here was a
   database migration — this makes it a real admin action instead,
   so the catalog can grow without needing a developer each time. */
async function loadMasterCatalog() {
  const r = await api('/catalog');
  MASTER_CATALOG = r.ok ? r.data : [];
  if (VIEW === 'products') vProducts();
}
function renderMasterCatalog() {
  const rows = MASTER_CATALOG;
  return `
    <div class="sec"><h2>Master catalog</h2>
      <span class="r">${rows === null ? 'loading\u2026' : rows.filter(c=>c.is_active).length + ' items vendors can add'}</span></div>
    <p style="font-size:13px;color:var(--tx2);margin-bottom:14px;line-height:1.6">
      This is the shared list every vendor's "Browse catalog" screen picks from — add
      something once here and every vendor can switch it on for their own shop.</p>
    <div class="card" style="margin-bottom:15px">
      <div class="sec" style="margin:0 0 12px"><h2>Add a catalog item</h2></div>
      <div class="grid k4" style="gap:10px">
        <div><label class="lb">Name (English)</label><input class="fld" id="mcNameEn" placeholder="Shalgam"></div>
        <div><label class="lb">Name (Hindi)</label><input class="fld" id="mcNameHi" placeholder="शलगम"></div>
        <div><label class="lb">Category</label><select class="fld" id="mcCategory">
          <option value="vegetable">Vegetable</option><option value="fruit">Fruit</option>
          <option value="onion_potato">Onion / Potato</option></select></div>
        <div><label class="lb">Default unit</label><input class="fld" id="mcUnit" value="1 kg"></div>
      </div>
      <div class="grid k4" style="gap:10px;margin-top:10px">
        <div style="grid-column:span 2"><label class="lb">Description (English)</label><input class="fld" id="mcDescEn" placeholder="Winter root vegetable"></div>
        <div style="grid-column:span 2"><label class="lb">Description (Hindi)</label><input class="fld" id="mcDescHi" placeholder="सर्दी की जड़ वाली सब्ज़ी"></div>
      </div>
      <button class="btn btn-g" style="margin-top:13px" data-act="addCatalogItem">+ Add to catalog</button>
    </div>
    ${rows === null ? `<div class="card"><div class="sk" style="height:70px"></div></div>` :
      `<div class="tw"><table><thead><tr><th>Item</th><th>Hindi</th><th>Category</th><th>Unit</th><th></th></tr></thead><tbody>
      ${rows.filter(c=>c.is_active).map(c => `<tr>
        <td><b>${esc(c.name_en)}</b><div class="mu">${esc(c.desc_en||'')}</div></td>
        <td>${esc(c.name_hi)}</td>
        <td class="mu">${esc(c.category)}</td>
        <td class="mu">${esc(c.default_unit)}</td>
        <td><button class="btn btn-r btn-sm" data-act="removeCatalogItem" data-arg="${c.key}">Remove</button></td>
      </tr>`).join('')}</tbody></table></div>`}`;
}
async function addCatalogItem() {
  const name_en = document.getElementById('mcNameEn').value.trim();
  const name_hi = document.getElementById('mcNameHi').value.trim();
  const desc_en = document.getElementById('mcDescEn').value.trim();
  const desc_hi = document.getElementById('mcDescHi').value.trim();
  const category = document.getElementById('mcCategory').value;
  const unit = document.getElementById('mcUnit').value.trim() || '1 kg';
  if (!name_en || !name_hi) return toast('Both English and Hindi names are needed');
  const r = await api('/catalog', { name_en, name_hi, desc_en, desc_hi, category, unit });
  toast(r.ok ? ('Added ' + name_en + ' to the catalog') : (r.error || 'Could not add'));
  if (r.ok) { MASTER_CATALOG = null; loadMasterCatalog(); }
}
async function removeCatalogItem(key) {
  if (!confirm('Remove this from the master catalog? Vendors already using it keep it in their own shop, but no one else can newly add it.')) return;
  const r = await api('/catalog/' + key + '/remove', {});
  toast(r.ok ? 'Removed from catalog' : (r.error || 'Failed'));
  if (r.ok) { MASTER_CATALOG = null; loadMasterCatalog(); }
}

let ALL_MESSAGES = null;
async function vMessages() {
  document.getElementById('v-messages').innerHTML = banner() + `
    <div class="sec"><h2>Messages</h2>
      <span class="r">${ALL_MESSAGES === null ? 'loading\u2026' : ALL_MESSAGES.length + ' total'}</span></div>
    ${ALL_MESSAGES === null ? `<div class="card"><div class="sk" style="height:70px"></div></div>` :
      !ALL_MESSAGES.length ? `<div class="empty"><div class="e">\u{1F4EC}</div><b>No messages yet</b>
        <p>Anything a customer sends from the app's Contact screen shows up here.</p></div>` :
      ALL_MESSAGES.map(m => `
        <div class="card" style="margin-bottom:12px;${m.is_read ? '' : 'border-color:rgba(59,130,246,.45)'}">
          <div style="display:flex;align-items:flex-start;gap:12px">
            <div style="min-width:0;flex:1">
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                <b style="font-size:14.5px">${esc(m.name)}</b>
                ${!m.is_read ? '<span class="pill p-b">new</span>' : ''}
                ${m.phone ? `<span class="mu">${esc(m.phone)}</span>` : ''}
                <span class="mu" style="margin-left:auto">${when(m.created_at)}</span>
              </div>
              <p style="font-size:13.5px;margin-top:8px;line-height:1.55;color:var(--tx2)">${esc(m.body)}</p>
            </div>
          </div>
          <div class="row" style="margin-top:12px;gap:8px">
            ${m.phone ? `<a class="btn btn-o btn-sm" href="tel:+91${esc(m.phone)}" style="text-decoration:none">\u{1F4DE} Call</a>` : ''}
            <button class="btn btn-o btn-sm" data-act="markRead" data-arg="${m.id}" data-arg2="${!m.is_read}">
              ${m.is_read ? 'Mark unread' : 'Mark read'}</button>
          </div>
        </div>`).join('')}`;
  if (ALL_MESSAGES === null) loadMessages();
}
async function loadMessages() {
  const r = await api('/messages');
  ALL_MESSAGES = r.ok ? r.data : [];
  const unread = ALL_MESSAGES.filter(m => !m.is_read).length;
  const b = document.getElementById('bMsg');
  b.style.display = unread ? 'inline-block' : 'none'; b.textContent = unread;
  if (VIEW === 'messages') vMessages();
}
async function markRead(id, makeRead) {
  const r = await api('/messages/' + id + '/read', { read: makeRead === 'true' });
  toast(r.ok ? (makeRead === 'true' ? 'Marked read' : 'Marked unread') : (r.error || 'Failed'));
  ALL_MESSAGES = null; loadMessages();
}

async function reviewProduct(id, decision) {
  const note = decision === 'rejected' ? (prompt('Optional note for the vendor (why?)') || null) : null;
  const r = await api('/products/' + id + '/review', { decision, note });
  toast(r.ok ? ('Product ' + decision) : (r.error || 'Failed'));
  if (r.ok) refresh();
}

function vTraffic() {
  const v = D.visits || { daily: [], totals: { total:0, customer:0, vendor:0, today:0 } };
  const max = Math.max(1, ...v.daily.map(x => (x.customer||0) + (x.vendor||0)));
  document.getElementById('v-traffic').innerHTML = banner() + `
    <div class="grid k4">
      ${kpi('Today', v.totals.today, 'visits so far today', v.totals.today ? 'good' : '')}
      ${kpi('Last 30 days', v.totals.total, 'total page loads')}
      ${kpi('Customer site', v.totals.customer, 'of the last 30 days')}
      ${kpi('Vendor app', v.totals.vendor, 'of the last 30 days')}
    </div>
    <div class="sec"><h2>Visits, last 30 days</h2>
      <span class="r">customer site vs vendor app</span></div>
    <div class="card">${svgChart(
        v.daily.map(x => ({ c: Number(x.customer)||0, ve: Number(x.vendor)||0,
          label: String(x.d).slice(8,10)+'/'+String(x.d).slice(5,7) })),
        { series: [
            { key:'c',  name:'Customer', color:'var(--g-lt)',   fillTop:'rgba(74,222,128,.28)', fillBot:'rgba(74,222,128,0)' },
            { key:'ve', name:'Vendor',   color:'var(--blue)',   fillTop:'rgba(59,130,246,.22)', fillBot:'rgba(59,130,246,0)' }
          ] }
      )}
    <div class="row" style="margin-top:16px;gap:18px;font-size:12.5px;font-weight:700;color:var(--tx2)">
      <span><span style="display:inline-block;width:10px;height:10px;background:var(--g-lt);border-radius:3px;margin-right:6px"></span>Customer site</span>
      <span><span style="display:inline-block;width:10px;height:10px;background:var(--blue);border-radius:3px;margin-right:6px"></span>Vendor app</span>
    </div></div>
    <p style="font-size:12.5px;color:var(--mut);margin-top:12px;line-height:1.6">
      Counts a page load, nothing else \u2014 no cookies, no IP, no personal data stored.</p>`;
}

window.addEventListener('DOMContentLoaded', boot);

/* ============================================================
   Event delegation. The CSP is script-src 'self' with no
   'unsafe-inline', so inline onclick= is blocked by design —
   every action is routed from here instead.
   ============================================================ */
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const a = el.dataset.arg, a2 = el.dataset.arg2;
  switch (el.dataset.act) {
    case 'go':        go(a); break;
    case 'refresh':   refresh(); break;
    case 'login':     doLogin(); break;
    case 'logout':    doLogout(); break;
    case 'addVendor': addVendor(); break;
    case 'resolve':   resolveBooking(a); break;
    case 'cancelBooking': cancelBookingUI(a); break;
    case 'review':    reviewVendor(a, a2); break;
    case 'removeVendor': removeVendor(a, a2); break;
    case 'block':     blockCustomer(a, a2 === 'true'); break;
    case 'toggleStock': toggleStock(a, a2); break;
    case 'addCatalogItem': addCatalogItem(); break;
    case 'removeCatalogItem': removeCatalogItem(a); break;
    case 'markRead': markRead(a, a2); break;
    case 'pin':       pinHere(a); break;
    case 'addArea':      addArea(); break;
    case 'reviewProduct': reviewProduct(a, a2); break;
    case 'editProductDetails': editProductDetails(a); break;
  }
});
/* A change-event twin of the click delegation above — same CSP reason:
   script-src 'self' with no 'unsafe-inline' blocks a raw onchange= the
   same way it blocks onclick=, so the price field routes through here
   instead of an inline handler. */
document.addEventListener('change', e => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  if (el.dataset.act === 'editPrice') editPrice(el.dataset.arg, el.value);
});
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.matches('[data-enter="login"]')) doLogin();
});
