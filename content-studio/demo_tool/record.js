// Real screen recording of the local AI tool: a visible (headful) Chromium on a virtual X display, captured by ffmpeg.
// Nothing is mocked: the page calls the local server, which runs the image and voice models live.
//   DISPLAY=:99 NODE_PATH=$(npm root -g) node record.js <out_dir> [url]
// Writes <out_dir>/screen.mkv plus events.json (wall-clock times of each step, used for the edit's timelapse labels).
const {chromium} = require('playwright');
const {spawn} = require('child_process');
const fs = require('fs');
const OUT = process.argv[2], URL = process.argv[3] || 'http://127.0.0.1:8765/';
const W = 1080, H = 1500;
const PROMPT = 'festive sale poster for an Indian clothing shop, colourful silk sarees on display, marigold flowers, diya lamps, warm golden light, rich red and gold, professional advertising photo';
const AD_LINE = 'शर्मा क्लॉथ हाउस! शानदार कपड़े, शानदार दाम — आज ही आइए!';
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const b = await chromium.launch({headless: false, args: [`--window-size=${W},${H}`, '--window-position=0,0', '--kiosk', '--force-device-scale-factor=1', '--disable-infobars']});
  const ctx = await b.newContext({viewport: null}); const p = await ctx.newPage();
  await p.goto(URL); await p.waitForTimeout(1500);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'x11grab', '-draw_mouse', '0', '-framerate', '24', '-video_size', `${W}x${H}`, '-i', `${process.env.DISPLAY}+0,0`,
    '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '14', '-pix_fmt', 'yuv420p', `${OUT}/screen.mkv`], {stdio: ['pipe', 'inherit', 'inherit']});
  const t0 = Date.now(); const ev = {}; const mark = k => { ev[k] = (Date.now() - t0) / 1000; console.log(k, ev[k]); };
  await sleep(1200);
  mark('type_prompt'); await p.click('#prompt'); await p.type('#prompt', PROMPT, {delay: 28});
  await sleep(700); mark('click_generate'); await p.click('#gen');
  await p.waitForFunction(() => window.__imgDone === true, null, {timeout: 600000, polling: 200}); mark('image_done');
  await sleep(1800);
  mark('type_text'); await p.click('#shop'); await p.type('#shop', 'शर्मा क्लॉथ हाउस', {delay: 45});
  await p.click('#line'); await p.type('#line', 'शानदार कपड़े, शानदार दाम!', {delay: 40});
  await p.click('#foot'); await p.type('#foot', 'आज ही आइए • मेन बाज़ार', {delay: 40});
  await sleep(500); mark('click_make'); await p.click('#mk');
  await p.waitForFunction(() => window.__posterDone === true, null, {timeout: 30000}); mark('poster_done');
  await sleep(2500);
  mark('voice_tab'); await p.click('#t2'); await sleep(900);
  await p.click('#vtext'); await p.type('#vtext', AD_LINE, {delay: 35});
  await sleep(600); mark('click_voice'); await p.click('#vgen');
  await p.waitForFunction(() => !!window.__voiceDone, null, {timeout: 120000}); mark('voice_done');
  ev.voice_url = await p.evaluate(() => window.__voiceDone);
  await sleep(3500); mark('end');
  ff.stdin.write('q'); await new Promise(r => ff.on('close', r));
  fs.writeFileSync(`${OUT}/events.json`, JSON.stringify(ev, null, 1));
  await b.close();
})();
