#!/usr/bin/env python3
"""Reel 5 cover / thumbnail, 1080x1920 (YouTube Shorts + Instagram Reel). Everything important sits inside the centre
1080x1440 so the Instagram profile-grid crop (3:4) keeps the text, the face and both chat bubbles.
  python3 prompt_thumb.py <dir with fonts/ and avir.png>   → cover.png + grid_preview.png"""
import sys, subprocess, os
from pathlib import Path
D = Path(sys.argv[1])
F = '''@font-face{font-family:IDB;src:url(fonts/InterDisplay-Black.otf)}@font-face{font-family:IXB;src:url(fonts/Inter-ExtraBold.otf)}
@font-face{font-family:ISB;src:url(fonts/Inter-SemiBold.otf)}@font-face{font-family:JBM;src:url(fonts/JetBrainsMono-Medium.ttf)}
*{margin:0;padding:0;box-sizing:border-box}body{width:1080px;height:1920px;position:relative;overflow:hidden;background:#000;color:#fff;font-family:IDB}.a{position:absolute}'''
V = f'''<!doctype html><html><head><meta charset="utf-8"><style>{F}
.bub{{border-radius:34px;padding:26px 32px;font-family:IXB;box-shadow:0 30px 70px rgba(0,0,0,.6)}}
</style></head><body>
<img class="a" src="avir.png" style="left:0;top:0;width:1080px;height:1920px;object-fit:cover;transform:translateY(150px) scale(1.15);transform-origin:46% 40%;filter:saturate(1.12) contrast(1.06)">
<div class="a" style="inset:0;background:radial-gradient(ellipse 620px 520px at 42% 44%,rgba(0,0,0,0) 40%,rgba(0,0,0,.55) 100%),linear-gradient(180deg,rgba(60,0,0,.85) 0%,rgba(60,0,0,.35) 20%,rgba(0,0,0,0) 34%,rgba(0,0,0,0) 68%,rgba(0,0,0,.8) 100%)"></div>
<!-- headline -->
<div class="a" style="left:0;width:1080px;top:250px;text-align:center">
 <div style="font-size:98px;line-height:1;letter-spacing:-2px;text-shadow:0 8px 0 #000,0 0 40px rgba(0,0,0,.8)">AI SE AISE</div>
 <div style="display:inline-block;margin-top:12px;font-size:122px;line-height:1;letter-spacing:-3px;white-space:nowrap;padding:8px 30px 16px;background:#E5322B;border-radius:26px;transform:rotate(-3deg);
   box-shadow:0 0 70px rgba(229,50,43,.75),0 16px 0 #7a0f0a">MAT POOCHO ❌</div>
</div>
<!-- bad bubble -->
<div class="a bub" style="right:36px;top:1010px;width:480px;background:#2a1212;border:4px solid #ff4a3d;transform:rotate(3deg)">
 <div style="font-family:JBM;font-size:22px;color:#ff8a80;letter-spacing:2px">❌ ZYADA LOG AISE</div>
 <div style="font-size:40px;margin-top:8px">“leave application likho”</div>
 <div style="margin-top:12px;font-size:30px;color:#ffb4ab">→ “Respected Sir…” 😴</div>
</div>
<div class="a" style="right:20px;top:972px;width:96px;height:96px;border-radius:50%;background:#E5322B;display:flex;align-items:center;justify-content:center;font-size:56px;box-shadow:0 0 40px rgba(229,50,43,.8);transform:rotate(-8deg)">✕</div>
<!-- arrow -->
<svg class="a" style="left:600px;top:1285px"  width="300" height="230" viewBox="0 0 300 230"><path d="M250 10 C 285 100, 200 170, 70 175" stroke="#FFD24A" stroke-width="16" fill="none" stroke-linecap="round"/>
 <path d="M95 140 L60 177 L105 197" stroke="#FFD24A" stroke-width="16" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
<!-- good bubble -->
<div class="a bub" style="left:40px;top:1420px;width:640px;background:#0f2a1a;border:4px solid #4BE08A;box-shadow:0 0 60px rgba(75,224,138,.45),0 30px 70px rgba(0,0,0,.6);transform:rotate(-2deg)">
 <div style="font-family:JBM;font-size:22px;color:#7CFFB2;letter-spacing:2px">✅ SAHI TAREEKA</div>
 <div style="font-size:52px;margin-top:6px;line-height:1.05">3 rules = <span style="color:#7CFFB2">PERFECT</span> jawab 🔥</div>
</div>
<div class="a" style="right:44px;top:1560px;padding:12px 22px;border-radius:999px;background:#fff;color:#111;font-size:34px;transform:rotate(5deg);box-shadow:0 20px 40px rgba(0,0,0,.5)">Same AI 🤯</div>
</body></html>'''
(D / 'cover.html').write_text(V)
js = f'''const {{chromium}}=require('playwright');(async()=>{{const b=await chromium.launch();const p=await b.newPage({{viewport:{{width:1080,height:1920}}}});
await p.goto('file://{D}/cover.html');await p.waitForTimeout(900);await p.screenshot({{path:'{D}/cover.png'}});await b.close();}})();'''
(D / 'shot.js').write_text(js)
subprocess.run(['node', str(D / 'shot.js')], check=True, env={**os.environ, 'NODE_PATH': subprocess.check_output(['npm', 'root', '-g'], text=True).strip()})
subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', str(D / 'cover.png'), '-vf', 'crop=1080:1440:0:240', str(D / 'grid_preview.png')], check=True)
print('ok')
