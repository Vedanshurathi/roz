#!/usr/bin/env python3
"""Reel 4 ("ये पूरी reel Claude ने edit की है") — 1080x1920 HyperFrames composition in the dark / orange motion-graphics
style: numbered scene header, kinetic word captions, floating glass UI cards, big glowing numbers, Avir in a facecam card.
  python3 reel4_edit.py <data.json> <hf_dir> avir|vedanshu [--no-avir]
Media: <hf_dir>/media/avir.mp4 (Remotion Reel4Avir: Avir bust over the facecam background, full length).
Writes <hf_dir>/index.html and <hf_dir>/edit.json (event times for reel3_audio.py).
Mobile-safe: header below the top ~170 px, nothing important in the bottom ~380 px.
Caption markup in the script: *word* = orange italic serif accent, [word] = orange highlight box."""
import json, sys, html, random
from pathlib import Path

D = json.load(open(sys.argv[1])); HF = Path(sys.argv[2]); ACC = sys.argv[3]; NO_AVIR = '--no-avir' in sys.argv
L = D['lines']; TOT = D['total']
st = lambda i: L[i]['start']; en = lambda i: L[i]['start'] + L[i]['dur']
W = lambda i, sub: next(w for w in L[i]['words'] if sub in w['w'])
wt = lambda i, sub: W(i, sub)['t0']

SC = [(0.0, 'THE HOOK'), (st(1) - 0.12, 'NO EDITOR'), (st(2) - 0.12, 'ONE PROMPT'), (st(3) - 0.12, 'THE ENGINE'), (st(4) - 0.12, 'THE EDIT'),
      (st(6) - 0.12, 'THE PRICE'), (st(7) - 0.12, 'YOUR COMPUTER'), (st(8) - 0.12, 'THE PROMPT'), (st(9) - 0.12, 'GET IT')]
SE = [SC[i + 1][0] if i + 1 < len(SC) else TOT for i in range(len(SC))]
END0 = W(9, 'दूँगा')['t1'] + 0.35
ACCT = {'avir': ('@unfiltered.avir', 'AI creator · real experiments, unfiltered results'),
        'vedanshu': ('@vedanshu.rathi', 'Founder, RozBazaar · AI experiments every week')}[ACC]

css = r'''
@font-face { font-family: IDB; src: url(fonts/InterDisplay-Black.otf); }
@font-face { font-family: IXB; src: url(fonts/Inter-ExtraBold.otf); }
@font-face { font-family: ISB; src: url(fonts/Inter-SemiBold.otf); }
@font-face { font-family: JBM; src: url(fonts/JetBrainsMono-Medium.ttf); }
@font-face { font-family: SER; src: url(fonts/InstrumentSerif-Italic.ttf); }
@font-face { font-family: DEV; src: url(fonts/NotoSansDevanagari.ttf); font-weight: 100 900; }
* { margin:0; padding:0; box-sizing:border-box; }
html, body { width:1080px; height:1920px; overflow:hidden; background:#070505; }
#root { position:relative; width:1080px; height:1920px; overflow:hidden; color:#fff; font-family: IXB, DEV, sans-serif; background:#070505; }
.clip { position:absolute; }
#bg { left:0; top:0; width:1080px; height:1920px;
  background: radial-gradient(ellipse 620px 520px at 50% 74%, rgba(255,110,30,.34), rgba(255,90,20,.10) 55%, rgba(0,0,0,0) 75%),
              radial-gradient(ellipse 900px 700px at 50% 30%, rgba(60,30,18,.55), rgba(0,0,0,0) 70%), #070505; }
#grid { left:0; top:0; width:1080px; height:1920px; opacity:.5;
  background-image: linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.035) 1px, transparent 1px);
  background-size: 72px 72px; -webkit-mask-image: radial-gradient(ellipse at 50% 45%, #000 30%, transparent 80%); }
#warm { left:0; top:0; width:1080px; height:1920px; background: radial-gradient(ellipse 700px 900px at 50% 60%, rgba(255,120,40,.16), transparent 70%); opacity:0; }
.dust { width:4px; height:4px; border-radius:50%; background:#ffb27a; box-shadow:0 0 8px #ff8a3a; }
#hdr { left:64px; top:186px; width:952px; }
.hl { position:absolute; left:0; top:0; font-family:JBM; font-size:25px; letter-spacing:3px; color:rgba(255,255,255,.78); white-space:nowrap; }
.hl b { color:#FF7A2F; font-weight:normal; }
#rule { left:64px; top:228px; width:952px; height:2px; background:rgba(255,255,255,.12); }
#prog { left:64px; top:228px; width:952px; height:2px; background:linear-gradient(90deg,#ff5a1a,#ffb070); transform-origin:0 50%; box-shadow:0 0 10px #ff6a1a; }
#tag { left:64px; top:250px; font-family:ISB; font-size:21px; color:rgba(255,255,255,.62); letter-spacing:.5px; }
.card { background: linear-gradient(160deg, rgba(38,30,28,.92), rgba(16,13,12,.92)); border:1.5px solid rgba(255,255,255,.12); border-radius:26px;
  box-shadow: 0 30px 80px rgba(0,0,0,.65), inset 0 1px 0 rgba(255,255,255,.08); }
.bar { height:54px; border-bottom:1px solid rgba(255,255,255,.08); display:flex; align-items:center; padding:0 22px; gap:10px; font-family:JBM; font-size:21px; color:rgba(255,255,255,.6); }
.dot { width:14px; height:14px; border-radius:50%; background:#3a3230; } .dot.r { background:#ff5f57; } .dot.y { background:#febc2e; } .dot.g { background:#28c840; }
/* captions */
.cap { left:40px; width:1000px; top:850px; height:200px; display:flex; flex-wrap:wrap; justify-content:center; align-content:center; gap:4px 22px; }
.cap span { display:inline-block; font-family: IDB, DEV, sans-serif; font-weight:800; font-size:80px; line-height:1.12; letter-spacing:-1px; text-shadow:0 6px 26px rgba(0,0,0,.8); }
.cap span.acc { font-family: SER, DEV, serif; font-weight:400; font-size:100px; color:#FF7A2F; letter-spacing:0; text-shadow:0 0 30px rgba(255,110,30,.55), 0 6px 20px rgba(0,0,0,.7); }
.cap span.box { background:#FF6A1A; color:#fff; padding:0 16px; border-radius:14px; box-shadow:0 0 34px rgba(255,106,26,.55); text-shadow:none; }
/* avir facecam */
#avv { left:265px; top:1078px; width:550px; height:470px; border-radius:40px; overflow:hidden; object-fit:cover;
  box-shadow: 0 0 0 8px rgba(255,106,26,.08), 0 0 70px rgba(255,106,26,.38), 0 40px 90px rgba(0,0,0,.7);
  background: radial-gradient(ellipse at 50% 30%, #3a2418, #120c0a 75%); }
#cam { left:265px; top:1078px; width:550px; height:470px; border-radius:40px; border:2px solid rgba(255,140,60,.55); }
#avv .ph { position:absolute; left:0; top:0; width:550px; height:470px; display:flex; align-items:center; justify-content:center; font-family:IDB; font-size:64px; color:rgba(255,160,90,.35); letter-spacing:8px; }
#camlbl { left:290px; top:1500px; display:flex; align-items:center; gap:10px; padding:7px 16px; border-radius:999px; background:rgba(8,6,5,.72);
  border:1px solid rgba(255,255,255,.16); font-family:JBM; font-size:19px; color:rgba(255,255,255,.85); }
#camlbl i { width:11px; height:11px; border-radius:50%; background:#ff3b30; box-shadow:0 0 10px #ff3b30; }
/* scene 1: timeline */
#tl1 { left:70px; top:330px; width:940px; height:440px; }
.trk { position:absolute; left:110px; height:52px; width:800px; }
.trl { position:absolute; left:24px; font-family:JBM; font-size:19px; color:rgba(255,255,255,.5); }
.clp { position:absolute; top:0; height:52px; border-radius:10px; transform-origin:0 50%; }
#ph1 { position:absolute; left:110px; top:70px; width:3px; height:350px; background:#FF7A2F; box-shadow:0 0 14px #FF7A2F; }
#ph1:before { content:''; position:absolute; left:-9px; top:-6px; width:21px; height:14px; background:#FF7A2F; border-radius:4px; }
#chip1 { left:0; right:0; margin:0 auto; width:max-content; top:790px; padding:12px 26px; border-radius:999px; background:#FF6A1A; font-family:IDB; font-size:30px; letter-spacing:2px; box-shadow:0 0 40px rgba(255,106,26,.6); }
/* scene 2: editors */
.app { width:300px; height:190px; padding:26px; }
.app .nm { font-family:IDB; font-size:42px; margin-top:12px; } .app .ic { font-size:46px; } .app .sb { font-family:ISB; font-size:20px; color:rgba(255,255,255,.5); margin-top:6px; }
.strike { position:absolute; left:-14px; top:88px; width:328px; height:10px; border-radius:6px; background:#FF6A1A; box-shadow:0 0 22px #FF6A1A; transform-origin:0 50%; }
.xx { position:absolute; right:-18px; top:-18px; width:58px; height:58px; border-radius:50%; background:#FF3B30; font-family:IDB; font-size:34px; display:flex; align-items:center; justify-content:center; box-shadow:0 0 24px rgba(255,59,48,.7); }
/* scene 3: prompt */
#pr { left:60px; top:400px; width:960px; height:300px; }
#prt { position:absolute; left:34px; top:84px; width:880px; font-family:ISB; font-size:34px; line-height:1.4; color:#fff; }
#prt .cur { display:inline-block; width:3px; height:38px; background:#FF7A2F; vertical-align:middle; margin-left:4px; }
#prsend { position:absolute; right:26px; bottom:24px; width:66px; height:66px; border-radius:50%; background:#FF6A1A; display:flex; align-items:center; justify-content:center; font-size:34px; box-shadow:0 0 30px rgba(255,106,26,.6); }
#prfile { left:330px; top:300px; padding:10px 22px; border-radius:14px; background:rgba(255,106,26,.14); border:1.5px solid rgba(255,140,60,.6); font-family:JBM; font-size:24px; color:#ffb27a; }
/* scene 4: terminal */
#term { left:50px; top:330px; width:980px; height:500px; }
.tl { position:absolute; left:30px; font-family:JBM; font-size:23px; white-space:nowrap; color:rgba(255,255,255,.88); }
.tl.c { color:#FF9A5C; } .tl.ok { color:#4BE08A; } .tl.dim { color:rgba(255,255,255,.45); }
.chip { padding:10px 22px; border-radius:14px; font-family:IDB; font-size:30px; background:rgba(16,12,10,.9); border:1.5px solid rgba(255,140,60,.65); box-shadow:0 0 30px rgba(255,106,26,.35); }
/* scene 5: feature grid */
.ft { width:300px; height:150px; padding:22px 24px; }
.ft .ic { font-size:40px; } .ft .nm { font-family:IDB; font-size:31px; margin-top:8px; }
.ft .ck { position:absolute; right:16px; top:16px; padding:3px 10px; border-radius:999px; background:rgba(75,224,138,.16); color:#4BE08A; font-family:JBM; font-size:17px; }
/* scene 6: price */
#zero { left:0; width:1080px; top:270px; text-align:center; font-family:IDB; font-size:330px; line-height:1; letter-spacing:-10px;
  background:linear-gradient(180deg,#fff 0%,#ffd2b0 45%,#ff7a2f 100%); -webkit-background-clip:text; color:transparent; filter: drop-shadow(0 0 40px rgba(255,106,26,.55)); }
#free { left:700px; top:300px; padding:10px 24px; border-radius:12px; border:3px solid #FF6A1A; color:#FF7A2F; font-family:IDB; font-size:40px; letter-spacing:4px; transform:rotate(12deg); background:rgba(7,5,5,.6); }
#tools { left:0; width:1080px; top:640px; text-align:center; font-family:JBM; font-size:24px; color:rgba(255,255,255,.75); }
#fine { left:0; width:1080px; top:690px; text-align:center; font-family:ISB; font-size:21px; color:rgba(255,255,255,.5); }
/* scene 7: computer */
#pc { left:120px; top:330px; width:840px; height:430px; }
#pcbar { position:absolute; left:40px; top:250px; width:760px; height:22px; border-radius:11px; background:rgba(255,255,255,.08); overflow:hidden; }
#pcfill { width:760px; height:22px; background:linear-gradient(90deg,#ff5a1a,#ffb070); transform-origin:0 50%; box-shadow:0 0 18px #ff6a1a; }
#pcpct { position:absolute; left:40px; top:120px; font-family:IDB; font-size:96px; }
#pcfr { position:absolute; left:40px; top:300px; font-family:JBM; font-size:22px; color:rgba(255,255,255,.6); }
#pcok { position:absolute; left:40px; top:350px; font-family:JBM; font-size:22px; color:#4BE08A; }
/* scene 8: file */
#beam { left:240px; top:150px; width:600px; height:820px; background:linear-gradient(180deg, rgba(255,190,140,.28), rgba(255,140,60,.05) 70%, transparent);
  clip-path: polygon(38% 0, 62% 0, 100% 100%, 0 100%); }
#file { left:250px; top:430px; width:580px; height:170px; display:flex; align-items:center; gap:26px; padding:0 30px; }
#file .fi { width:96px; height:118px; border-radius:12px; background:linear-gradient(160deg,#ff8a3a,#e0480f); display:flex; align-items:center; justify-content:center; font-family:JBM; font-size:22px; font-weight:bold; }
#file .fn { font-family:IDB; font-size:38px; } #file .fs { font-family:JBM; font-size:20px; color:rgba(255,255,255,.55); margin-top:6px; }
#big8 { left:0; width:1080px; top:285px; text-align:center; font-family:IDB; font-size:104px; letter-spacing:-2px; }
/* scene 9: comment */
#cbox { left:110px; top:660px; width:860px; height:96px; border-radius:999px; display:flex; align-items:center; padding:0 18px 0 34px; gap:18px; }
#cbox .av { width:56px; height:56px; border-radius:50%; background:linear-gradient(160deg,#ff8a3a,#c2410c); }
#cbox .tx { flex:1; font-family:IDB; font-size:40px; letter-spacing:2px; }
#cbox .sd { width:64px; height:64px; border-radius:50%; background:#FF6A1A; display:flex; align-items:center; justify-content:center; font-size:30px; }
#cmt1 { left:0; width:1080px; top:300px; text-align:center; font-family:IDB; font-size:112px; letter-spacing:-2px; }
#cmt2 { left:0; width:1080px; top:405px; text-align:center; font-family:SER; font-size:170px; color:#FF7A2F; text-shadow:0 0 50px rgba(255,106,26,.6); }
/* end card */
#endc { left:90px; top:300px; width:900px; height:520px; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; }
#endc .e0 { font-family:JBM; font-size:24px; letter-spacing:4px; color:#FF7A2F; }
#endc .e1 { font-family:IDB; font-size:76px; margin-top:18px; letter-spacing:-1px; }
#endc .e2 { margin-top:16px; padding:14px 34px; border-radius:999px; background:#FF6A1A; font-family:IDB; font-size:40px; box-shadow:0 0 40px rgba(255,106,26,.55); }
#endc .e3 { margin-top:20px; font-family:ISB; font-size:24px; color:rgba(255,255,255,.65); }
#disc { left:0; width:1080px; top:1572px; text-align:center; font-family:ISB; font-size:20px; color:rgba(255,255,255,.55); }
.sweep { left:-700px; top:0; width:520px; height:1920px; background:linear-gradient(90deg, transparent, rgba(255,150,80,.22), rgba(255,230,200,.35), rgba(255,150,80,.22), transparent); transform:skewX(-14deg); }
#flash { left:0; top:0; width:1080px; height:1920px; background:#fff; opacity:0; }
#fade { left:0; top:0; width:1080px; height:1920px; background:#000; opacity:0; }
'''

H, J = [], []      # html parts, gsap lines
def clip(id_, t0, t1, inner='', cls='', track=3, style=''):
    H.append(f'<div id="{id_}" class="clip {cls}" data-start="{t0:.3f}" data-duration="{max(0.05, t1 - t0):.3f}" data-track-index="{track}"{f" style={chr(34)}{style}{chr(34)}" if style else ""}>{inner}</div>')
def js(s): J.append(s)
def pop(sel, t, d=0.35, fr='y:40,opacity:0,scale:.9', to='y:0,opacity:1,scale:1', ease='back.out(1.7)'):
    js(f'tl.fromTo("{sel}",{{{fr}}},{{{to},duration:{d},ease:"{ease}"}},{t:.3f});')
def out(sel, t, d=0.22):
    js(f'tl.to("{sel}",{{opacity:0,scale:.94,filter:"blur(10px)",duration:{d},ease:"power2.in"}},{t - d:.3f});')

# ---------- persistent layers ----------
clip('bg', 0, TOT, track=0); clip('grid', 0, TOT, track=0); clip('warm', 0, TOT, track=0)
random.seed(4)
for i in range(34):
    x, y, s = random.uniform(40, 1040), random.uniform(260, 1700), random.uniform(.5, 1.4)
    clip(f'du{i}', 0, TOT, cls='dust', track=0, style=f'left:{x:.0f}px;top:{y:.0f}px;opacity:{random.uniform(.15, .6):.2f};transform:scale({s:.2f})')
    js(f'tl.to("#du{i}",{{y:{-random.uniform(60, 200):.0f},x:{random.uniform(-40, 40):.0f},duration:{TOT:.2f},ease:"none"}},0);')
js(f'tl.fromTo("#warm",{{opacity:0}},{{opacity:1,duration:1.2,yoyo:true,repeat:{int(TOT / 1.2)},ease:"sine.inOut"}},0);')
clip('rule', 0, TOT, track=1); clip('prog', 0, TOT, track=1)
js(f'tl.fromTo("#prog",{{scaleX:0}},{{scaleX:1,duration:{TOT:.3f},ease:"none"}},0);')
for i, ((a, name), b) in enumerate(zip(SC, SE)):
    clip(f'h{i}', a, b, f'<b>●</b> {i + 1:02d} / {len(SC):02d} — {name}', cls='hl', track=1, style='left:64px;top:186px')
    pop(f'#h{i}', a, 0.3, 'x:-30,opacity:0', 'x:0,opacity:1', 'power3.out')
    if i:
        clip(f'sw{i}', a - 0.05, a + 0.45, cls='sweep', track=11)
        js(f'tl.fromTo("#sw{i}",{{x:0}},{{x:2300,duration:0.45,ease:"power2.inOut"}},{a - 0.05:.3f});')
clip('tag', 0.2, SC[1][0], '🤖 Avir is an AI character · this reel was edited by Claude Code', track=1)
pop('#tag', 0.25, 0.3, 'opacity:0', 'opacity:1', 'none')

# Avir facecam (rendered by Remotion over the same background)
if NO_AVIR: clip('avv', 0, TOT, '<div class="ph">AVIR</div>', track=4)
else: H.append(f'<video id="avv" class="clip" src="media/avir.mp4" muted playsinline data-start="0" data-duration="{TOT:.3f}" data-track-index="4"></video>')
clip('cam', 0, TOT, track=5)
clip('camlbl', 0, TOT, '<i></i> AVIR · AI HOST', track=6)
pop('#avv', 0.0, 0.45, 'y:80,opacity:0,scale:.92', 'y:0,opacity:1,scale:1', 'power3.out')
pop('#cam', 0.0, 0.45, 'y:80,opacity:0,scale:.92', 'y:0,opacity:1,scale:1', 'power3.out')

# ---------- captions ----------
def clean(w): return w.replace('*', '').replace('[', '').replace(']', '')
def kind(w):
    if '*' in w: return 'acc' if clean(w).isascii() else 'box'
    if '[' in w: return 'box'
    return ''
def groups(words, maxw=5, maxc=22):
    gs, cur = [], []
    for w in words:
        c = len(clean(w['w']))
        if cur and (len(cur) >= maxw or sum(len(clean(x['w'])) + 1 for x in cur) + c > maxc): gs.append(cur); cur = []
        cur.append(w)
        if clean(w['w'])[-1] in '?!।,…—' and len(cur) >= 2: gs.append(cur); cur = []
    if cur: gs.append(cur)
    return gs
allg = [g for l in L for g in groups(l['words'])]
for k, g in enumerate(allg):
    t0 = g[0]['t0'] - 0.06; t1 = allg[k + 1][0]['t0'] - 0.06 if k + 1 < len(allg) else min(g[-1]['t1'] + 0.5, END0)
    if g[-1]['t1'] > END0: t1 = END0
    sp = ''
    for j, w in enumerate(g):
        txt = clean(w['w'])
        if txt == '—': continue
        sp += f'<span id="w{k}_{j}" class="{kind(w["w"])}">{html.escape(txt)}</span>'
    clip(f'cg{k}', t0, t1, sp, cls='cap', track=9)
    for j, w in enumerate(g):
        if clean(w['w']) == '—': continue
        a = max(t0, w['t0'] - 0.05)
        if kind(w['w']) == 'acc': pop(f'#w{k}_{j}', a, 0.32, 'y:30,opacity:0,scale:1.5,rotate:-4', 'y:0,opacity:1,scale:1,rotate:0', 'back.out(2.2)')
        elif kind(w['w']) == 'box': pop(f'#w{k}_{j}', a, 0.26, 'opacity:0,scale:.4', 'opacity:1,scale:1', 'back.out(2.6)')
        else: pop(f'#w{k}_{j}', a, 0.2, 'y:26,opacity:0', 'y:0,opacity:1', 'power3.out')

# ---------- scene 1: the hook (an editing timeline that edits itself) ----------
a, b = SC[0][0], SE[0]
tracks = [('V2', 70, ['#ff7a2f'] * 5, 'TEXT'), ('V1', 150, ['#5b8cff'] * 6, 'VIDEO'), ('A1', 230, ['#4BE08A'] * 4, 'VOICE'), ('A2', 310, ['#c08bff'] * 2, 'MUSIC')]
inner = '<div class="bar"><span class="dot r"></span><span class="dot y"></span><span class="dot g"></span>&nbsp; reel_final.mp4 — auto-edit</div>'
random.seed(9); ci = 0
for tn, y, cols, lab in tracks:
    inner += f'<div class="trl" style="top:{y + 14}px">{tn}</div><div class="trk" style="top:{y}px">'
    x = 0
    for c in cols:
        w = random.uniform(80, 200) * (800 / (len(cols) * 150))
        w = min(w, 800 - x - 4)
        if w < 30: break
        inner += f'<div class="clp" id="cl{ci}" style="left:{x:.0f}px;width:{w:.0f}px;background:linear-gradient(180deg,{c},{c}aa);"></div>'
        js(f'tl.fromTo("#cl{ci}",{{scaleX:0,opacity:0}},{{scaleX:1,opacity:1,duration:0.18,ease:"power2.out"}},{0.08 + ci * 0.09:.3f});'); ci += 1
        x += w + random.uniform(6, 14)
    inner += '</div>'
inner += '<div id="ph1"></div>'
clip('tl1', a, b, inner, cls='card', track=3)
pop('#tl1', 0.0, 0.35, 'y:90,opacity:0,rotateX:25,scale:.9', 'y:0,opacity:1,rotateX:0,scale:1', 'power3.out')
js(f'tl.fromTo("#ph1",{{x:0}},{{x:790,duration:{b - 0.3:.2f},ease:"power1.inOut"}},0.2);')
t_cl = wt(0, 'Claude'); t_ed = wt(0, 'edit')
clip('chip1', t_cl - 0.05, b, '✦ EDITED BY CLAUDE', track=6)
pop('#chip1', t_cl - 0.05, 0.35, 'y:-30,opacity:0,scale:1.6', 'y:0,opacity:1,scale:1', 'back.out(2)')
out('#tl1', b)
FLASH = [t_ed]; PUNCH = [t_ed]

# ---------- scene 2: no editor ----------
a, b = SC[1][0], SE[1]
apps = [('Premiere', '🎞️', 'heavy desktop editor', 70, 360, -6, wt(1, 'Premiere')), ('CapCut', '✂️', 'manual timeline work', 390, 330, 2, wt(1, 'CapCut')),
        ('Editor', '🧑‍💻', '₹₹₹ per reel', 710, 360, 7, wt(1, 'editor'))]
for i, (nm, ic, sb, x, y, r, t) in enumerate(apps):
    clip(f'ap{i}', t - 0.1, b, f'<div class="ic">{ic}</div><div class="nm">{nm}</div><div class="sb">{sb}</div><div class="strike" id="sk{i}"></div><div class="xx" id="xx{i}">✕</div>',
         cls='card app', track=3, style=f'left:{x}px;top:{y}px;transform:rotate({r}deg)')
    pop(f'#ap{i}', t - 0.1, 0.32, f'y:70,opacity:0,rotate:{r * 2}', f'y:0,opacity:1,rotate:{r}', 'back.out(1.8)')
    ts = t + 0.38
    js(f'tl.fromTo("#sk{i}",{{scaleX:0}},{{scaleX:1,duration:0.16,ease:"power2.out"}},{ts:.3f});')
    pop(f'#xx{i}', ts + 0.08, 0.22, 'scale:0,opacity:0', 'scale:1,opacity:1', 'back.out(3)')
    js(f'tl.to("#ap{i}",{{x:"+=10",duration:0.04,yoyo:true,repeat:5}},{ts:.3f});tl.to("#ap{i}",{{opacity:.45,duration:0.25}},{ts + 0.3:.3f});')
    out(f'#ap{i}', b)

# ---------- scene 3: one master prompt ----------
a, b = SC[2][0], SE[2]
PROMPT = 'Edit this reel like a pro: 1-sec hook, jump cuts, word-by-word captions, punch zooms, motion graphics, music + SFX.'
clip('pr', a, b, '<div class="bar"><span class="dot r"></span><span class="dot y"></span><span class="dot g"></span>&nbsp; Claude Code</div><div id="prt"><span id="prtx"></span><span class="cur"></span></div><div id="prsend">➤</div>', cls='card', track=3)
pop('#pr', a, 0.35, 'y:80,opacity:0,scale:.92', 'y:0,opacity:1,scale:1', 'power3.out')
n = len(PROMPT); ty0, ty1 = a + 0.2, b - 0.45
for i in range(0, n + 1, 3):
    js(f'tl.set("#prtx",{{textContent:{json.dumps(PROMPT[:i])}}},{ty0 + (ty1 - ty0) * i / n:.3f});')
js(f'tl.set("#prtx",{{textContent:{json.dumps(PROMPT)}}},{ty1:.3f});')
js(f'tl.fromTo("#prsend",{{scale:1}},{{scale:1.25,duration:0.12,yoyo:true,repeat:1}},{ty1 + 0.05:.3f});')
clip('prfile', wt(2, 'master') - 0.05, b, '📄 master_prompt.md', track=6)
pop('#prfile', wt(2, 'master') - 0.05, 0.3, 'y:20,opacity:0', 'y:0,opacity:1')
out('#pr', b); out('#prfile', b)

# ---------- scene 4: the engine (Claude Code drives FFmpeg + HyperFrames) ----------
a, b = SC[3][0], SE[3]
TL = [('c', '> edit raw.mp4 using master_prompt.md'), ('', '⏺ Bash(ffmpeg -i raw.mp4 -af silencedetect …)'), ('ok', '  ✓ 14 jump cuts · dead air removed'),
      ('', '⏺ Bash(whisper voice.wav → words.json)'), ('ok', '  ✓ word-by-word captions timed'), ('', '⏺ Write(index.html) · HyperFrames scenes'),
      ('', '⏺ Bash(npx hyperframes render -o reel.mp4)'), ('ok', '  ✓ rendered 1080×1920 · 24 fps')]
inner = '<div class="bar"><span class="dot r"></span><span class="dot y"></span><span class="dot g"></span>&nbsp; claude — ~/reels</div>'
inner += ''.join(f'<div class="tl {c}" id="tl_{i}" style="top:{76 + i * 50}px">{html.escape(t)}</div>' for i, (c, t) in enumerate(TL))
clip('term', a, b, inner, cls='card', track=3)
pop('#term', a, 0.35, 'y:80,opacity:0,scale:.92', 'y:0,opacity:1,scale:1', 'power3.out')
for i in range(len(TL)):
    pop(f'#tl_{i}', a + 0.2 + i * (b - a - 0.7) / len(TL), 0.12, 'x:-20,opacity:0', 'x:0,opacity:1', 'power2.out')
for nm, x, y, t in (('FFmpeg', 180, 258, wt(3, 'FFmpeg')), ('HyperFrames', 560, 258, wt(3, 'HyperFrames'))):
    clip(f'ch_{nm}', t - 0.05, b, nm, cls='chip', track=6, style=f'left:{x}px;top:{y}px')
    pop(f'#ch_{nm}', t - 0.05, 0.3, 'y:30,opacity:0,scale:1.4', 'y:0,opacity:1,scale:1', 'back.out(2.2)')
    out(f'#ch_{nm}', b)
out('#term', b)

# ---------- scene 5: the edit (feature cards pop on their words) ----------
a, b = SC[4][0], SE[4]
FT = [('✂️', 'Jump cuts', wt(4, 'cuts')), ('🔍', 'Punch zooms', wt(4, 'zooms')), ('💬', 'Word captions', wt(4, 'word-by-word')),
      ('✨', 'Motion graphics', wt(5, 'motion')), ('🎵', 'Music', wt(5, 'music')), ('🔊', 'Sound FX', wt(5, 'sound'))]
for i, (ic, nm, t) in enumerate(FT):
    x = 60 + (i % 3) * 330; y = 330 + (i // 3) * 190; r = (-3, 2, -2, 3, -2, 2)[i]
    clip(f'ft{i}', t - 0.08, b, f'<div class="ic">{ic}</div><div class="nm">{nm}</div><div class="ck" id="ck{i}">✓ done</div>', cls='card ft', track=3, style=f'left:{x}px;top:{y}px;transform:rotate({r}deg)')
    pop(f'#ft{i}', t - 0.08, 0.3, f'y:60,opacity:0,scale:.6,rotate:{r * 4}', f'y:0,opacity:1,scale:1,rotate:{r}', 'back.out(2)')
    out(f'#ft{i}', b)
t_sab = wt(5, 'सब')
for i in range(len(FT)):
    js(f'tl.fromTo("#ft{i}",{{boxShadow:"0 0 0 rgba(255,106,26,0)"}},{{boxShadow:"0 0 50px rgba(255,106,26,.75)",borderColor:"rgba(255,140,60,.9)",duration:0.2}},{t_sab + i * 0.04:.3f});')
FLASH += [wt(4, 'cuts')]; PUNCH += [wt(4, 'zooms'), t_sab]

# ---------- scene 6: the price ----------
a, b = SC[5][0], SE[5]
t_free = wt(6, 'free')
clip('zero', a + 0.05, b, '₹0', track=3)
pop('#zero', a + 0.05, 0.45, 'scale:2.4,opacity:0,filter:"blur(20px)"', 'scale:1,opacity:1,filter:"blur(0px)"', 'expo.out')
clip('free', t_free - 0.05, b, 'FREE', track=6)
pop('#free', t_free - 0.05, 0.3, 'scale:3,opacity:0,rotate:40', 'scale:1,opacity:1,rotate:12', 'back.out(2.5)')
clip('tools', a + 0.35, b, 'FFmpeg · HyperFrames · Whisper · Kokoro', track=6); pop('#tools', a + 0.35, 0.3, 'y:20,opacity:0', 'y:0,opacity:1')
clip('fine', a + 0.55, b, 'free, open-source editing tools · Claude Code itself needs a Claude plan', track=6); pop('#fine', a + 0.55, 0.3, 'opacity:0', 'opacity:1', 'none')
for s in ('#zero', '#free', '#tools', '#fine'): out(s, b)
PUNCH += [t_free]

# ---------- scene 7: your computer ----------
a, b = SC[6][0], SE[6]
clip('pc', a, b, '<div class="bar"><span class="dot r"></span><span class="dot y"></span><span class="dot g"></span>&nbsp; 💻 your computer · rendering</div>'
     '<div id="pcpct">0%</div><div id="pcbar"><div id="pcfill"></div></div><div id="pcfr">frame 0 / 629</div><div id="pcok">✓ no paid editor · no timeline dragging</div>', cls='card', track=3)
pop('#pc', a, 0.35, 'y:80,opacity:0,scale:.92', 'y:0,opacity:1,scale:1', 'power3.out')
r0, r1 = a + 0.25, b - 0.35
js(f'tl.fromTo("#pcfill",{{scaleX:0}},{{scaleX:1,duration:{r1 - r0:.3f},ease:"power1.inOut"}},{r0:.3f});')
for k in range(0, 21):
    p = k / 20; t = r0 + (r1 - r0) * p
    js(f'tl.set("#pcpct",{{textContent:"{int(p * 100)}%"}},{t:.3f});tl.set("#pcfr",{{textContent:"frame {int(p * 629)} / 629"}},{t:.3f});')
pop('#pcok', r1 - 0.1, 0.25, 'x:-20,opacity:0', 'x:0,opacity:1', 'power2.out')
out('#pc', b)

# ---------- scene 8: want the master prompt? ----------
a, b = SC[7][0], SE[7]
clip('beam', a, b, track=2); pop('#beam', a, 0.4, 'opacity:0', 'opacity:1', 'power2.out')
clip('big8', a + 0.05, b, 'Master Prompt?', track=3); pop('#big8', a + 0.05, 0.35, 'y:-40,opacity:0,scale:1.3', 'y:0,opacity:1,scale:1', 'back.out(2)')
clip('file', a + 0.3, b, '<div class="fi">.MD</div><div><div class="fn">master_prompt.md</div><div class="fs">1 file · copy → paste → edit like a pro</div></div>', cls='card', track=3)
pop('#file', a + 0.3, 0.4, 'y:60,opacity:0,rotate:-6', 'y:0,opacity:1,rotate:0', 'back.out(1.8)')
js(f'tl.to("#file",{{y:-10,duration:0.6,yoyo:true,repeat:2,ease:"sine.inOut"}},{a + 0.7:.3f});')
for s in ('#beam', '#big8', '#file'): out(s, b)

# ---------- scene 9: comment EDIT + end card ----------
a = SC[8][0]
t_edit = wt(9, 'EDIT')
clip('cmt1', a, END0, 'Comment', track=3); pop('#cmt1', a, 0.3, 'y:-30,opacity:0', 'y:0,opacity:1', 'power3.out')
clip('cmt2', t_edit - 0.05, END0, '“EDIT”', track=3); pop('#cmt2', t_edit - 0.05, 0.4, 'scale:2.2,opacity:0,rotate:-8', 'scale:1,opacity:1,rotate:0', 'back.out(2)')
clip('cbox', a + 0.1, END0, '<div class="av"></div><div class="tx" id="cbt"></div><div class="sd" id="cbs">➤</div>', cls='card', track=3)
pop('#cbox', a + 0.1, 0.35, 'y:50,opacity:0', 'y:0,opacity:1', 'power3.out')
for i, s in enumerate(['E', 'ED', 'EDI', 'EDIT']): js(f'tl.set("#cbt",{{textContent:"{s}"}},{t_edit - 0.2 + i * 0.09:.3f});')
js(f'tl.fromTo("#cbs",{{scale:1}},{{scale:1.3,duration:0.12,yoyo:true,repeat:1}},{t_edit + 0.35:.3f});')
for s in ('#cmt1', '#cmt2', '#cbox'): out(s, END0)
handle, sub = ACCT
clip('endc', END0, TOT, f'<div class="e0">MASTER PROMPT · COMMENT “EDIT”</div><div class="e1">Follow for more AI</div><div class="e2">{html.escape(handle)}</div><div class="e3">{html.escape(sub)}</div>', cls='card', track=3)
pop('#endc', END0, 0.45, 'y:80,opacity:0,scale:.9', 'y:0,opacity:1,scale:1', 'back.out(1.6)')
clip('disc', END0, TOT, 'Avir is an AI character · edited with Claude Code + free open-source tools', track=6)
pop('#disc', END0 + 0.2, 0.3, 'opacity:0', 'opacity:1', 'none')
PUNCH += [t_edit]

# ---------- global "crazy edit" accents: flashes + punch-in zooms on the beat words ----------
clip('flash', 0, TOT, track=12)
for t in FLASH: js(f'tl.fromTo("#flash",{{opacity:.85}},{{opacity:0,duration:0.16,ease:"power2.out",immediateRender:false}},{t - 0.02:.3f});')
for t in PUNCH: js(f'tl.fromTo("#stage",{{scale:1.07}},{{scale:1,duration:0.35,ease:"power3.out",immediateRender:false}},{t - 0.02:.3f});')
clip('fade', TOT - 0.45, TOT, track=12); js(f'tl.to("#fade",{{opacity:1,duration:0.45}},{TOT - 0.45:.3f});')

page = f'''<!doctype html><html lang="hi"><head><meta charset="UTF-8"><meta name="viewport" content="width=1080, height=1920">
<script src="gsap.min.js"></script><style>{css}
#stage {{ position:absolute; left:0; top:0; width:1080px; height:1920px; transform-origin:50% 45%; }}
</style></head><body>
<div id="root" data-composition-id="main" data-start="0" data-duration="{TOT:.3f}" data-width="1080" data-height="1920">
<div id="stage">
{chr(10).join(H)}
</div>
</div><script>
window.__timelines = window.__timelines || {{}}; const tl = gsap.timeline({{ paused: true }});
{chr(10).join(J)}
tl.set({{}}, {{}}, {TOT:.3f}); window.__timelines["main"] = tl; tl.seek(0);
</script></body></html>'''
(HF / 'index.html').write_text(page)
ev = {'whoosh': [a for a, _ in SC[1:]] + [END0], 'click': [], 'chime': [t_cl, END0 + 0.1], 'coin': [t_free],
      'typing': [[SC[2][0] + 0.2, SE[2] - SC[2][0] - 0.65], [t_edit - 0.2, 0.36]], 'riser': [[SC[6][0] + 0.25, SE[6] - 0.35]],
      'impact': FLASH + PUNCH, 'scenes': SC, 'end': END0}
for i in range(len(TL)): ev['click'].append(SC[3][0] + 0.2 + i * (SE[3] - SC[3][0] - 0.7) / len(TL))
json.dump({'total': TOT, 'ev': ev}, open(HF / 'edit.json', 'w'), indent=1, ensure_ascii=False)
print('ok', ACC, round(TOT, 2), 'caption groups', len(allg), 'scenes', len(SC), 'end', round(END0, 2))
