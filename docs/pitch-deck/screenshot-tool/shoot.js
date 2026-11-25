const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs'), path = require('path');
const mk = require('./fake.js');
const NM = path.join(__dirname, '../node_modules');
const FONTS = {
  'Roboto': [[400, '@fontsource/roboto/files/roboto-latin-400-normal.woff2'], [500, '@fontsource/roboto/files/roboto-latin-500-normal.woff2'], [700, '@fontsource/roboto/files/roboto-latin-700-normal.woff2'], [900, '@fontsource/roboto/files/roboto-latin-900-normal.woff2']],
  'Fraunces': [[600, '@fontsource/fraunces/files/fraunces-latin-600-normal.woff2'], [700, '@fontsource/fraunces/files/fraunces-latin-700-normal.woff2'], [800, '@fontsource/fraunces/files/fraunces-latin-800-normal.woff2'], [900, '@fontsource/fraunces/files/fraunces-latin-900-normal.woff2']],
  'Noto Sans Devanagari': [[400, '@fontsource/noto-sans-devanagari/files/noto-sans-devanagari-devanagari-400-normal.woff2'], [600, '@fontsource/noto-sans-devanagari/files/noto-sans-devanagari-devanagari-600-normal.woff2'], [700, '@fontsource/noto-sans-devanagari/files/noto-sans-devanagari-devanagari-700-normal.woff2'], [800, '@fontsource/noto-sans-devanagari/files/noto-sans-devanagari-devanagari-800-normal.woff2']],
};
const CSS = Object.entries(FONTS).map(([fam, ws]) => ws.map(([w, f]) => `@font-face{font-family:'${fam}';font-weight:${w};font-style:normal;font-display:block;src:url(https://fontfiles.local/${f}) format('woff2')}`).join('\n')).join('\n');
async function page(b, { lang = 'en', loggedIn = false, way = false } = {}) {
  const cx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: lang === 'hi' ? 'hi-IN' : 'en-IN', timezoneId: 'Asia/Kolkata' });
  await cx.addInitScript(`try{localStorage.setItem('rb_appstrip_hide',String(Date.now()));localStorage.setItem('rb_lang','${lang}');localStorage.setItem('rb_oos_day','x');}catch(e){}`);
  const p = await cx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.route('**/supabase-js@2/**', r => r.fulfill({ contentType: 'application/javascript', body: mk({ loggedIn, way }) }));
  await p.route('**/fonts.googleapis.com/**', r => r.fulfill({ contentType: 'text/css', body: CSS }));
  await p.route('https://fontfiles.local/**', r => r.fulfill({ contentType: 'font/woff2', body: fs.readFileSync(path.join(NM, r.request().url().replace('https://fontfiles.local/', ''))) }));
  await p.route('**/cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/**', r => { const f = r.request().url().split('/dist/')[1]; r.fulfill({ contentType: f.endsWith('.css') ? 'text/css' : f.endsWith('.js') ? 'application/javascript' : 'image/png', body: fs.readFileSync(path.join(NM, 'leaflet/dist', f)) }); });
  await p.route('**/tile.openstreetmap.org/**', r => { const m = r.request().url().match(/\/(\d+)\/(\d+)\/(\d+)\.png/); const f = m && path.join(__dirname, 'tiles', m[1], m[2], m[3] + '.png'); if (f && fs.existsSync(f)) r.fulfill({ contentType: 'image/png', body: fs.readFileSync(f) }); else r.fulfill({ status: 404, body: '' }); });
  await p.route(/supabase\.co\/storage|arcgisonline|nominatim|googletagmanager/, r => r.fulfill({ status: 404, body: '' }));
  await p.goto('http://localhost:4322/index.html');
  await p.addStyleTag({ content: `:root{--ui:Roboto,'Noto Sans Devanagari',Arial,sans-serif}#permBar,.permbar{display:none!important}` });
  await p.waitForTimeout(3500);
  await p.evaluate(() => { try { locAsked = true; document.getElementById('locBg').classList.remove('on'); document.getElementById('locAsk').classList.remove('on'); } catch (e) {} });
  return { cx, p, errs };
}
module.exports = { page };
if (require.main === module) (async () => {
  const b = await chromium.launch(); const out = __dirname + '/out/'; fs.mkdirSync(out, { recursive: true });
  const which = process.argv[2] || 'all';
  if (which === 'all' || which === 'voice') {
    const { cx, p, errs } = await page(b, { lang: 'en' });
    await p.evaluate(() => openVoice(false)); await p.waitForTimeout(500);
    await p.evaluate(() => { const t = document.getElementById('vxText'); t.value = 'दो किलो आलू, एक किलो टमाटर, पाव भर हरी मिर्च और धनिया'; vxParse(); paintVxTop(); });
    await p.waitForTimeout(1200);
    await p.screenshot({ path: out + 'voice.png' });
    console.log('voice', errs);
    await cx.close();
  }
  if (which === 'all' || which === 'track') {
    const { cx, p, errs } = await page(b, { lang: 'en', loggedIn: true, way: true });
    await p.evaluate(() => go('home')); await p.waitForTimeout(1500);
    await p.screenshot({ path: out + 'way-home.png' });
    await p.evaluate(() => openTrack('RB-108684')); await p.waitForTimeout(3500);
    await p.screenshot({ path: out + 'track.png' });
    console.log('track', errs, await p.evaluate(() => TRK.map && TRK.map.getZoom()));
    await cx.close();
  }
  if (which === 'all' || which === 'card') {
    for (const lang of ['hi', 'en']) {
      const { cx, p, errs } = await page(b, { lang });
      await p.evaluate(() => openRateCard()); await p.waitForTimeout(3000);
      const data = await p.evaluate(() => new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(RC.blob); }));
      fs.writeFileSync(out + `card-${lang}.jpg`, Buffer.from(data.split(',')[1], 'base64'));
      await p.screenshot({ path: out + `card-sheet-${lang}.png` });
      console.log('card', lang, errs);
      await cx.close();
    }
  }
  if (which === 'all' || which === 'gali') {
    const { cx, p, errs } = await page(b, { lang: 'en', loggedIn: true });
    await p.evaluate(() => { go('success'); paintSuccess([{ g: { name: 'Sanjiv', ids: [], total: 160 }, d: { code: 'RB-108684', otp: '4821' } }], [], T('Today, Evening 5–8', 'आज, शाम 5–8')); });
    await p.waitForTimeout(2500);
    await p.screenshot({ path: out + 'gali.png' });
    console.log('gali', errs);
    await cx.close();
  }
  if (which === 'all' || which === 'oos') {
    const { cx, p, errs } = await page(b, { lang: 'en' });
    await p.evaluate(() => openOos({ km: 47.7, nearest: 'Jatola' }, 'loc')); await p.waitForTimeout(900);
    await p.screenshot({ path: out + 'oos.png' });
    console.log('oos', errs);
    await cx.close();
  }
  await b.close();
})();
