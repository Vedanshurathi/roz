// Real browser recordings of news pages for an episode: a visible (headful) Chromium on a virtual X display, captured by
// ffmpeg while it opens each page and scrolls smoothly to the passages the episode quotes. Nothing on the page is changed.
//   DISPLAY=:99 NODE_PATH=$(npm root -g) node record_pages.js <out_dir> <pages.json>
// pages.json: [{"name", "url", "stops": ["text to scroll to", ...], "hold": 2.5}]
const {chromium} = require('playwright');
const {spawn} = require('child_process');
const fs = require('fs');
const OUT = process.argv[2], PAGES = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
const W = 1920, H = 1080;
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const b = await chromium.launch({headless: false, args: [`--window-size=${W},${H}`, '--window-position=0,0', '--start-maximized', '--force-device-scale-factor=1', '--disable-infobars', '--hide-scrollbars']});
  const ctx = await b.newContext({viewport: null}); const p = await ctx.newPage();
  for (const pg of PAGES) {
    await p.goto('about:blank'); await sleep(400);
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'x11grab', '-draw_mouse', '0', '-framerate', '24', '-video_size', `${W}x${H}`, '-i', `${process.env.DISPLAY}+0,0`,
      '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '16', '-pix_fmt', 'yuv420p', `${OUT}/${pg.name}.mkv`], {stdio: ['pipe', 'inherit', 'inherit']});
    await sleep(600);
    try {
      await p.goto(pg.url, {waitUntil: 'domcontentloaded', timeout: 45000}); await sleep(3500);
      // close cookie banners only by clicking their own "accept/close" buttons, if present
      for (const t of ['Accept all', 'Accept', 'I agree', 'Got it', 'OK']) { const bt = p.getByRole('button', {name: t, exact: true}); if (await bt.count()) { await bt.first().click().catch(() => {}); await sleep(500); break; } }
      await sleep(1500);
      for (const s of pg.stops || []) {
        const y = await p.evaluate((txt) => {
          const it = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n;
          while ((n = it.nextNode())) if (n.textContent.includes(txt)) { const r = n.parentElement.getBoundingClientRect(); return r.top + window.scrollY - window.innerHeight * 0.3; }
          return null; }, s);
        if (y === null) { console.log(pg.name, 'not found:', s); continue; }
        const y0 = await p.evaluate(() => window.scrollY), steps = 60;
        for (let i = 1; i <= steps; i++) { const k = i / steps, e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; await p.evaluate((v) => window.scrollTo(0, v), y0 + (y - y0) * e); await sleep(25); }
        await sleep((pg.hold || 2.5) * 1000);
      }
    } catch (e) { console.log(pg.name, 'ERR', e.message.slice(0, 100)); }
    await sleep(800); ff.stdin.write('q'); await new Promise(r => ff.on('close', r)); console.log('recorded', pg.name);
  }
  await b.close();
})();
