// deck.src.html → deck.html (icons inlined) → RozBazaar_Pitch_Deck.pdf + preview/slide-NN.png
// run: node build.js   (needs lucide-static in ../node_modules or ./node_modules, and Playwright)
const fs = require('fs'), path = require('path');
const ICONS = [path.join(__dirname, 'node_modules/lucide-static/icons'), path.join(__dirname, '../node_modules/lucide-static/icons')].find(fs.existsSync);
let html = fs.readFileSync(path.join(__dirname, 'deck.src.html'), 'utf8');
html = html.replace(/\{\{i:([a-z0-9-]+)\}\}/g, (m, n) => {
  const svg = fs.readFileSync(path.join(ICONS, n + '.svg'), 'utf8').replace(/<!--[\s\S]*?-->/, '').replace(/\s(width|height)="24"/g, '').replace(/class="[^"]*"/, '').trim();
  return `<span class="ic">${svg}</span>`;
});
fs.writeFileSync(path.join(__dirname, 'deck.html'), html);
(async () => {
  const { chromium } = require(process.env.PW || '/opt/node22/lib/node_modules/playwright');
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  await p.goto('file://' + path.join(__dirname, 'deck.html'));
  await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(800);
  const missing = await p.evaluate(() => [...document.images].filter(i => !i.complete || !i.naturalWidth).map(i => i.src));
  if (missing.length) console.log('MISSING IMAGES', missing);
  const only = process.argv[2];
  fs.mkdirSync(path.join(__dirname, 'preview'), { recursive: true });
  const n = await p.$$eval('section.slide', s => s.length);
  for (let i = 0; i < n; i++) {
    if (only && !only.split(',').includes(String(i + 1))) continue;
    const el = (await p.$$('section.slide'))[i];
    await el.screenshot({ path: path.join(__dirname, 'preview', `slide-${String(i + 1).padStart(2, '0')}.png`) });
  }
  if (!only) {
    await p.pdf({ path: path.join(__dirname, 'RozBazaar_Pitch_Deck.pdf'), width: '1920px', height: '1080px', printBackground: true, preferCSSPageSize: true });
    console.log('pdf', fs.statSync(path.join(__dirname, 'RozBazaar_Pitch_Deck.pdf')).size, 'bytes,', n, 'slides');
  }
  await b.close();
})();
