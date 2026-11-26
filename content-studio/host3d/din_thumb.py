#!/usr/bin/env python3
"""Thumbnails for "Avir ka ek din": Shorts/Reel cover 1080x1920 + YouTube 16:9 1280x720 (Playwright screenshots).
  python3 din_thumb.py <dir with fonts/ and avir.png (a 1080x1920 DinAvir still)>"""
import sys, subprocess, os
from pathlib import Path
D = Path(sys.argv[1])
F = '''@font-face{font-family:IDB;src:url(fonts/InterDisplay-Black.otf)}@font-face{font-family:ISB;src:url(fonts/Inter-SemiBold.otf)}
@font-face{font-family:JBM;src:url(fonts/JetBrainsMono-Medium.ttf)}@font-face{font-family:SER;src:url(fonts/InstrumentSerif-Italic.ttf)}
@font-face{font-family:DEV;src:url(fonts/NotoSansDevanagari.ttf);font-weight:100 900}
*{margin:0;padding:0;box-sizing:border-box}body{position:relative;overflow:hidden;background:#000;color:#fff;font-family:IDB}.a{position:absolute}
.chip{background:#FF6A1A;border-radius:12px;padding:10px 22px;font-family:JBM;letter-spacing:4px;box-shadow:0 0 40px rgba(255,106,26,.6)}
.big{line-height:.95;letter-spacing:-3px;text-shadow:0 10px 0 #120b05,0 0 40px rgba(0,0,0,.7)}
.or{color:#FF7A2F;-webkit-text-stroke:0}
.time{display:flex;align-items:center;gap:14px;font-family:IDB;background:rgba(10,8,7,.75);border:2px solid rgba(255,255,255,.25);border-radius:999px;padding:12px 26px}
.ai{background:rgba(10,8,7,.75);border:2px solid rgba(255,140,60,.8);border-radius:999px;padding:10px 22px;font-family:ISB}
'''
V = f'''<!doctype html><html><head><meta charset="utf-8"><style>{F}body{{width:1080px;height:1920px}}</style></head><body>
<img class="a" src="avir.png" style="left:0;top:0;width:1080px;height:1920px;object-fit:cover;transform:scale(1.12);transform-origin:50% 30%">
<div class="a" style="inset:0;background:linear-gradient(180deg,rgba(0,0,0,.55) 0%,rgba(0,0,0,0) 18%,rgba(0,0,0,0) 48%,rgba(10,5,2,.88) 72%,rgba(10,5,2,.95) 100%)"></div>
<div class="a chip" style="left:60px;top:190px;font-size:30px">A DAY IN MY LIFE</div>
<div class="a ai" style="right:60px;top:192px;font-size:28px">🤖 AI CREATOR</div>
<div class="a" style="left:0;width:1080px;top:1130px;text-align:center">
 <div class="big" style="font-size:150px">AVIR KA</div><div class="big or" style="font-size:210px">EK DIN</div>
 <div style="font-family:DEV;font-weight:800;font-size:64px;margin-top:26px;text-shadow:0 4px 20px #000">6 lessons जो काम आएँगे 🔥</div>
 <div style="display:flex;justify-content:center;margin-top:34px"><div class="time" style="font-size:40px">☀️ 6 AM <span style="color:#FF7A2F">→</span> 🌙 11 PM</div></div>
</div></body></html>'''
H = f'''<!doctype html><html><head><meta charset="utf-8"><style>{F}body{{width:1280px;height:720px;background:radial-gradient(ellipse at 75% 40%,#5a3418,#120b07 70%)}}</style></head><body>
<div class="a" style="right:0;top:0;width:640px;height:720px;overflow:hidden"><img src="avir.png" style="width:640px;height:1138px;object-fit:cover;margin-top:-140px">
<div class="a" style="inset:0;background:linear-gradient(90deg,#120b07 0%,rgba(18,11,7,0) 35%)"></div></div>
<div class="a chip" style="left:56px;top:56px;font-size:24px">A DAY IN MY LIFE</div>
<div class="a" style="left:56px;top:130px;width:720px">
 <div class="big" style="font-size:120px">AVIR KA</div><div class="big or" style="font-size:168px">EK DIN</div>
 <div style="font-family:DEV;font-weight:800;font-size:46px;margin-top:18px;text-shadow:0 4px 20px #000">6 lessons जो काम आएँगे 🔥</div>
 <div style="display:flex;margin-top:24px"><div class="time" style="font-size:30px">☀️ 6 AM <span style="color:#FF7A2F">→</span> 🌙 11 PM</div></div></div>
<div class="a ai" style="right:40px;top:40px;font-size:22px">🤖 AI CREATOR</div>
</body></html>'''
(D / 'thumb_v.html').write_text(V); (D / 'thumb_h.html').write_text(H)
js = f'''const {{chromium}}=require('playwright');(async()=>{{const b=await chromium.launch();
for (const [n,w,h] of [['v',1080,1920],['h',1280,720]]){{const p=await b.newPage({{viewport:{{width:w,height:h}}}});
await p.goto('file://{D}/thumb_'+n+'.html');await p.waitForTimeout(800);await p.screenshot({{path:'{D}/thumb_'+n+'.png'}});}}
await b.close();}})();'''
(D / 'shot.js').write_text(js)
subprocess.run(['node', str(D / 'shot.js')], check=True, env={**os.environ, 'NODE_PATH': subprocess.check_output(['npm', 'root', '-g'], text=True).strip()})
print('ok')
