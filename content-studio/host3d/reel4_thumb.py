#!/usr/bin/env python3
"""Reel 4 YouTube Shorts thumbnail (1080x1920) + 16:9 (1280x720) — "FREE mein VIDEO EDIT", dark/orange style, chibi.
  python3 reel4_thumb.py <dir with fonts/ and chibi.png>    (writes thumb_v.html/png, thumb_h.html/png; needs Playwright)"""
import sys, subprocess, os
from pathlib import Path
D = Path(sys.argv[1])
FONTS = '''@font-face{font-family:IDB;src:url(fonts/InterDisplay-Black.otf)}@font-face{font-family:ISB;src:url(fonts/Inter-SemiBold.otf)}
@font-face{font-family:JBM;src:url(fonts/JetBrainsMono-Medium.ttf)}@font-face{font-family:SER;src:url(fonts/InstrumentSerif-Italic.ttf)}
*{margin:0;padding:0;box-sizing:border-box}body{background:#070505;color:#fff;font-family:IDB}
.a{position:absolute}.card{background:linear-gradient(160deg,rgba(40,31,28,.95),rgba(16,13,12,.95));border:2px solid rgba(255,140,60,.5);border-radius:24px;
box-shadow:0 0 40px rgba(255,106,26,.35),0 20px 50px rgba(0,0,0,.6);padding:16px 24px;font-size:38px;display:flex;gap:12px;align-items:center;white-space:nowrap}
.card b{font-family:JBM;font-size:22px;color:#4BE08A;background:rgba(75,224,138,.15);padding:4px 10px;border-radius:99px}
.free{background:linear-gradient(180deg,#fff 0%,#ffd2b0 40%,#ff6a1a 100%);-webkit-background-clip:text;color:transparent;filter:drop-shadow(0 0 40px rgba(255,106,26,.7)) drop-shadow(0 8px 0 #3a1404)}
.chip{background:#FF6A1A;border-radius:99px;padding:12px 28px;font-size:36px;letter-spacing:2px;box-shadow:0 0 40px rgba(255,106,26,.6)}
.no{border:3px solid rgba(255,255,255,.35);border-radius:99px;padding:10px 26px;font-size:34px;color:rgba(255,255,255,.85)}
.zero{border-radius:50%;background:radial-gradient(circle at 35% 30%,#ff9a4a,#e0480f);display:flex;align-items:center;justify-content:center;box-shadow:0 0 50px rgba(255,106,26,.7);border:5px solid #fff}
.ser{font-family:SER;color:#FF7A2F;text-shadow:0 0 30px rgba(255,106,26,.6)}
'''
BG = '''<div class="a" style="inset:0;background:radial-gradient(ellipse 700px 700px at 50% 72%,rgba(255,110,30,.42),rgba(255,90,20,.1) 55%,transparent 75%),radial-gradient(ellipse 900px 700px at 50% 25%,rgba(70,34,18,.6),transparent 70%)"></div>
<div class="a" style="inset:0;opacity:.5;background-image:linear-gradient(rgba(255,255,255,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.04) 1px,transparent 1px);background-size:72px 72px"></div>'''
V = f'''<!doctype html><html><head><meta charset="utf-8"><style>{FONTS}body{{width:1080px;height:1920px;overflow:hidden;position:relative}}</style></head><body>{BG}
<div class="a chip" style="left:70px;top:190px">✦ CLAUDE AI</div><div class="a no" style="right:70px;top:194px">NO EDITOR ✕</div>
<div class="a" style="left:0;width:1080px;top:270px;text-align:center"><div class="free" style="font-size:360px;line-height:1;letter-spacing:-12px">FREE</div>
<div style="font-size:112px;line-height:1;margin-top:-6px;letter-spacing:-2px;text-shadow:0 8px 0 #000,0 0 40px rgba(0,0,0,.8)">MEIN VIDEO EDIT</div>
<div class="ser" style="font-size:96px;margin-top:10px">sirf 1 prompt se 🤯</div></div>
<div class="a" style="left:120px;top:900px;width:840px;height:200px;border-radius:50%;background:radial-gradient(ellipse,rgba(255,120,40,.5),transparent 70%);top:1640px"></div>
<img class="a" src="chibi.png" style="left:190px;top:930px;width:700px">
<div class="a card" style="left:40px;top:1040px;transform:rotate(-6deg)">✂️ Cuts <b>✓</b></div>
<div class="a card" style="left:30px;top:1260px;transform:rotate(4deg)">💬 Captions <b>✓</b></div>
<div class="a card" style="right:40px;top:1120px;transform:rotate(6deg)">🔍 Zooms <b>✓</b></div>
<div class="a card" style="right:30px;top:1340px;transform:rotate(-4deg)">✨ Motion FX <b>✓</b></div>
<div class="a zero" style="right:90px;top:880px;width:190px;height:190px;transform:rotate(12deg)"><div style="font-size:92px;line-height:1">₹0</div></div>
<div class="a" style="left:0;width:1080px;top:1790px;text-align:center;font-family:ISB;font-size:26px;color:rgba(255,255,255,.55)">free open-source editing tools · AI character</div>
</body></html>'''
H = f'''<!doctype html><html><head><meta charset="utf-8"><style>{FONTS}body{{width:1280px;height:720px;overflow:hidden;position:relative}}</style></head><body>{BG}
<div class="a chip" style="left:56px;top:48px;font-size:30px">✦ CLAUDE AI</div>
<div class="a" style="left:50px;top:110px;width:760px"><div class="free" style="font-size:250px;line-height:1;letter-spacing:-9px">FREE</div>
<div style="font-size:84px;line-height:1;letter-spacing:-2px;text-shadow:0 6px 0 #000">MEIN VIDEO EDIT</div>
<div class="ser" style="font-size:72px;margin-top:10px">sirf 1 prompt se 🤯</div></div>
<div class="a" style="left:780px;top:560px;width:460px;height:140px;border-radius:50%;background:radial-gradient(ellipse,rgba(255,120,40,.5),transparent 70%)"></div>
<img class="a" src="chibi.png" style="left:790px;top:40px;width:470px">
<div class="a card" style="left:760px;top:545px;transform:rotate(-6deg);font-size:30px">✂️ Cuts <b>✓</b></div>
<div class="a card" style="left:1040px;top:470px;transform:rotate(6deg);font-size:30px">🔍 Zooms <b>✓</b></div>
<div class="a zero" style="left:690px;top:70px;width:150px;height:150px;transform:rotate(-10deg)"><div style="font-size:72px">₹0</div></div>
</body></html>'''
(D / 'thumb_v.html').write_text(V); (D / 'thumb_h.html').write_text(H)
js = f'''const {{chromium}}=require('playwright');(async()=>{{const b=await chromium.launch();
for (const [n,w,h] of [['v',1080,1920],['h',1280,720]]){{const p=await b.newPage({{viewport:{{width:w,height:h}}}});
await p.goto('file://{D}/thumb_'+n+'.html');await p.waitForTimeout(800);await p.screenshot({{path:'{D}/thumb_'+n+'.png'}});}}
await b.close();}})();'''
(D / 'shot.js').write_text(js)
subprocess.run(['node', str(D / 'shot.js')], check=True, env={**os.environ, 'NODE_PATH': subprocess.check_output(['npm', 'root', '-g'], text=True).strip()})
print('ok', D / 'thumb_v.png', D / 'thumb_h.png')
