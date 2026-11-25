#!/usr/bin/env python3
""""Avir ka ek din" — HyperFrames edit (1080x1920) over the Remotion Avir layer (media/avir.mp4).
Title hook, time-of-day + place chips, "LESSON n/6" cards, word-by-word captions (hidden while a lesson card shows the
same words), light sweeps on location changes, AI disclosure, end CTA. Writes index.html + edit.json (audio events).
  python3 din_edit.py <data.json> <hf_dir>"""
import json, sys, html
from pathlib import Path

D = json.load(open(sys.argv[1])); HF = Path(sys.argv[2]); L = D['lines']; TOT = D['total']
st = lambda i: L[i]['start']; en = lambda i: L[i]['start'] + L[i]['dur']
CHIPS = {0: ('☀️', '6:00 AM', 'Bedroom'), 2: ('📱', '7:00 AM', 'Studio'), 4: ('📉', '11:00 AM', 'Studio'), 6: ('💬', '2:00 PM', 'Living room'),
         8: ('🌴', '4:30 PM', 'Pool deck'), 10: ('🌇', '7:00 PM', 'Studio'), 12: ('🌙', '11:00 PM', 'Bedroom')}
LESSONS = [i for i, l in enumerate(L) if l.get('lesson')]
END0 = en(13) - 0.9

css = r'''
@font-face { font-family: IDB; src: url(fonts/InterDisplay-Black.otf); } @font-face { font-family: IXB; src: url(fonts/Inter-ExtraBold.otf); }
@font-face { font-family: ISB; src: url(fonts/Inter-SemiBold.otf); } @font-face { font-family: JBM; src: url(fonts/JetBrainsMono-Medium.ttf); }
@font-face { font-family: SER; src: url(fonts/InstrumentSerif-Italic.ttf); } @font-face { font-family: DEV; src: url(fonts/NotoSansDevanagari.ttf); font-weight: 100 900; }
* { margin:0; padding:0; box-sizing:border-box; } html, body { width:1080px; height:1920px; overflow:hidden; background:#000; }
#root { position:relative; width:1080px; height:1920px; overflow:hidden; color:#fff; font-family: IXB, DEV, sans-serif; }
.clip { position:absolute; } .full { left:0; top:0; width:1080px; height:1920px; object-fit:cover; }
#shade { left:0; top:0; width:1080px; height:1920px; background: linear-gradient(180deg, rgba(0,0,0,.55) 0%, rgba(0,0,0,0) 22%, rgba(0,0,0,0) 62%, rgba(0,0,0,.6) 100%); }
.chip { left:56px; top:200px; display:flex; align-items:center; gap:16px; padding:12px 24px 12px 16px; border-radius:22px; background:rgba(10,8,7,.6);
  backdrop-filter: blur(14px); border:1.5px solid rgba(255,255,255,.2); }
.chip .e { font-size:46px; } .chip .t { font-family:IDB; font-size:40px; letter-spacing:1px; } .chip .p { font-family:ISB; font-size:24px; color:#FFB27A; }
#title { left:0; width:1080px; top:1010px; text-align:center; }
#title .t1 { display:inline-block; font-family:JBM; font-size:28px; letter-spacing:6px; padding:8px 20px; border-radius:10px; background:#FF6A1A; }
#title .t2 { font-family:IDB; font-size:112px; line-height:1; margin-top:16px; white-space:nowrap; letter-spacing:-3px; text-shadow:0 10px 40px rgba(0,0,0,.8); }
#title .t3 { font-family:SER; font-size:60px; color:#FF9A5C; margin-top:8px; text-shadow:0 4px 24px rgba(0,0,0,.9); }
.lesson { left:60px; width:960px; top:1110px; padding:30px 36px 34px; border-radius:30px; background:linear-gradient(160deg, rgba(28,20,16,.88), rgba(12,9,8,.9));
  border:2px solid rgba(255,140,60,.7); box-shadow:0 0 50px rgba(255,106,26,.35), 0 30px 80px rgba(0,0,0,.6); }
.lesson .n { font-family:JBM; font-size:26px; letter-spacing:5px; color:#FF8A3D; }
.lesson .x { font-family: DEV, IDB; font-weight:800; font-size:62px; line-height:1.25; margin-top:12px; }
.lesson .dots { display:flex; gap:10px; margin-top:20px; } .lesson .dots i { width:44px; height:8px; border-radius:4px; background:rgba(255,255,255,.18); } .lesson .dots i.on { background:#FF6A1A; }
.cap { left:40px; width:1000px; top:1330px; display:flex; justify-content:center; }
.cap .pill { max-width:980px; text-align:center; padding:10px 26px 16px; border-radius:24px; background:rgba(10,8,7,.55); backdrop-filter: blur(10px); }
.cap span { display:inline-block; margin:0 7px; font-size:56px; line-height:1.3; font-family: DEV, IXB, sans-serif; font-weight:800; text-shadow:0 3px 0 rgba(0,0,0,.5); }
.sweep { left:-700px; top:0; width:520px; height:1920px; background:linear-gradient(90deg, transparent, rgba(255,180,120,.25), rgba(255,240,220,.45), rgba(255,180,120,.25), transparent); transform:skewX(-14deg); }
#ai { left:56px; top:290px; padding:8px 18px; border-radius:999px; background:rgba(10,8,7,.6); border:1px solid rgba(255,255,255,.25); font-family:ISB; font-size:22px; }
#end { left:60px; width:960px; top:1060px; padding:36px; border-radius:30px; text-align:center; background:linear-gradient(160deg, rgba(28,20,16,.9), rgba(12,9,8,.92));
  border:2px solid rgba(255,140,60,.7); box-shadow:0 0 50px rgba(255,106,26,.35); }
#end .e1 { font-family: DEV, IDB; font-weight:800; font-size:66px; } #end .e2 { display:flex; justify-content:center; gap:12px; margin-top:22px; }
#end .e2 b { width:74px; height:74px; border-radius:18px; background:#FF6A1A; font-family:IDB; font-size:44px; display:flex; align-items:center; justify-content:center; }
#end .e3 { margin-top:24px; font-family:IDB; font-size:40px; } #end .e3 span { color:#FF8A3D; } #end .e4 { margin-top:12px; font-family:ISB; font-size:22px; color:rgba(255,255,255,.6); }
#night { left:0; top:0; width:1080px; height:1920px; background:rgba(20,40,110,.42); mix-blend-mode:multiply; }
#fade { left:0; top:0; width:1080px; height:1920px; background:#000; opacity:0; }
'''
H, J = [], []
def clip(id_, t0, t1, inner='', cls='', track=3):
    H.append(f'<div id="{id_}" class="clip {cls}" data-start="{t0:.3f}" data-duration="{max(0.05, t1 - t0):.3f}" data-track-index="{track}">{inner}</div>')
def pop(sel, t, d=0.35, fr='y:40,opacity:0', to='y:0,opacity:1', ease='back.out(1.7)'):
    J.append(f'tl.fromTo("{sel}",{{{fr}}},{{{to},duration:{d},ease:"{ease}"}},{t:.3f});')

H.append(f'<video id="avir" class="clip full" src="media/avir.mp4" muted playsinline data-start="0" data-duration="{TOT:.3f}" data-track-index="0"></video>')
clip('shade', 0, TOT, track=1)
clip('night', st(12) - 0.12, TOT, track=1)   # blue night grade over the last bedroom scene
J.append(f'tl.fromTo("#night",{{opacity:0}},{{opacity:1,duration:0.4}},{st(12) - 0.12:.3f});')
# hook title
clip('title', 0.0, st(1) - 0.2, '<div class="t1">A DAY IN THE LIFE</div><div class="t2">AVIR KA EK DIN</div><div class="t3">6 real lessons · 1 AI creator</div>', track=5)
pop('#title .t1', 0.0, 0.3, 'y:-30,opacity:0', 'y:0,opacity:1', 'power3.out'); pop('#title .t2', 0.1, 0.45, 'scale:1.6,opacity:0', 'scale:1,opacity:1', 'back.out(1.8)')
pop('#title .t3', 0.45, 0.4, 'opacity:0', 'opacity:1', 'none')
J.append(f'tl.to("#title",{{opacity:0,y:-30,duration:0.25}},{st(1) - 0.45:.3f});')
clip('ai', 0.3, 6.0, '🤖 Avir is an AI-generated virtual creator', track=6); pop('#ai', 0.3, 0.3, 'opacity:0', 'opacity:1', 'none')
# time-of-day chips + sweeps on location changes
keys = sorted(CHIPS)
for n, i in enumerate(keys):
    a = 0.0 if i == 0 else st(i) - 0.15; b = (st(keys[n + 1]) - 0.15) if n + 1 < len(keys) else END0
    e, tm, pl = CHIPS[i]
    clip(f'ch{i}', a, b, f'<span class="e">{e}</span><div><div class="t">{tm}</div><div class="p">{pl}</div></div>', cls='chip', track=6)
    pop(f'#ch{i}', a + (0.05 if i else st(1) - 0.2), 0.4, 'x:-80,opacity:0', 'x:0,opacity:1', 'power3.out')
    if i:
        clip(f'sw{i}', a - 0.1, a + 0.35, cls='sweep', track=9)
        J.append(f'tl.fromTo("#sw{i}",{{x:0}},{{x:2300,duration:0.42,ease:"power2.inOut"}},{a - 0.1:.3f});')
# lesson cards
for n, i in enumerate(LESSONS):
    a, b = st(i) - 0.25, en(i) + L[i].get('gap', 0.5) - 0.05
    dots = ''.join(f'<i class="{"on" if k <= n else ""}"></i>' for k in range(len(LESSONS)))
    clip(f'ls{n}', a, b, f'<div class="n">LESSON {n + 1}/{len(LESSONS)}</div><div class="x">{html.escape(L[i]["cap"])}</div><div class="dots">{dots}</div>', cls='lesson', track=7)
    pop(f'#ls{n}', a, 0.42, 'y:60,opacity:0,scale:.92', 'y:0,opacity:1,scale:1', 'back.out(1.6)')
# captions (not during lessons / title)
def groups(words, maxw=5, maxc=26):
    gs, cur = [], []
    for w in words:
        if cur and (len(cur) >= maxw or sum(len(x['w']) + 1 for x in cur) + len(w['w']) > maxc): gs.append(cur); cur = []
        cur.append(w)
        if w['w'][-1] in '?!।,…—' and len(cur) >= 2: gs.append(cur); cur = []
    if cur: gs.append(cur)
    return gs
k = 0
for i, l in enumerate(L):
    if l.get('lesson'): continue
    gs = groups(l['words'])
    for gi, g in enumerate(gs):
        t0 = g[0]['t0'] - 0.04; t1 = gs[gi + 1][0]['t0'] - 0.04 if gi + 1 < len(gs) else en(i) + 0.3
        if i == 0 and t0 < st(1) - 0.2 and False: continue
        sp = ''.join(f'<span id="w{k}_{j}">{html.escape(w["w"])}</span>' for j, w in enumerate(g) if w['w'] != '—')
        clip(f'c{k}', t0, t1, f'<div class="pill">{sp}</div>', cls='cap', track=8)
        J.append(f'tl.fromTo("#c{k} .pill",{{y:14,opacity:0}},{{y:0,opacity:1,duration:0.12}},{t0:.3f});')
        for j, w in enumerate(g):
            if w['w'] == '—': continue
            J.append(f'tl.set("#w{k}_{j}",{{color:"#FF9A4D"}},{w["t0"]:.3f});tl.set("#w{k}_{j}",{{color:"#ffffff"}},{max(w["t0"] + 0.01, w["t1"]):.3f});')
        k += 1
# end CTA
clip('end', END0, TOT, '<div class="e1">कौन सा lesson आपके काम का था?</div><div class="e2">' + ''.join(f'<b>{n}</b>' for n in range(1, 7)) +
     '</div><div class="e3">Comment करो 👇 · <span>@unfiltered.avir</span></div><div class="e4">🤖 Avir is an AI-generated virtual creator · real lessons</div>', track=7)
pop('#end', END0, 0.45, 'y:60,opacity:0,scale:.9', 'y:0,opacity:1,scale:1', 'back.out(1.6)')
for n in range(1, 7): pop(f'#end .e2 b:nth-child({n})', END0 + 0.2 + n * 0.07, 0.25, 'scale:0,opacity:0', 'scale:1,opacity:1', 'back.out(3)')
clip('fade', TOT - 0.5, TOT, track=10); J.append(f'tl.to("#fade",{{opacity:1,duration:0.5}},{TOT - 0.5:.3f});')

page = f'''<!doctype html><html lang="hi"><head><meta charset="UTF-8"><meta name="viewport" content="width=1080, height=1920">
<script src="gsap.min.js"></script><style>{css}</style></head><body>
<div id="root" data-composition-id="main" data-start="0" data-duration="{TOT:.3f}" data-width="1080" data-height="1920">
{chr(10).join(H)}
</div><script>
window.__timelines = window.__timelines || {{}}; const tl = gsap.timeline({{ paused: true }});
{chr(10).join(J)}
tl.set({{}}, {{}}, {TOT:.3f}); window.__timelines["main"] = tl; tl.seek(0);
</script></body></html>'''
(HF / 'index.html').write_text(page)
ev = {'whoosh': [st(i) - 0.15 for i in keys if i], 'chime': [st(i) - 0.2 for i in LESSONS] + [END0], 'click': [], 'typing': [], 'riser': [], 'coin': []}
json.dump({'total': TOT, 'ev': ev, 'plan': [[0.0, TOT, 0.5, 'pad']]}, open(HF / 'edit.json', 'w'), indent=1)
print('ok', round(TOT, 2), 'captions', k, 'lessons', len(LESSONS), 'end', round(END0, 2))
