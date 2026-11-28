#!/usr/bin/env python3
"""Reel 5 ("AI se galat tareeke se poochna") — HyperFrames edit (1080x1920) over the Remotion Avir layer (media/avir.mp4).
  full-screen hook (stop gesture + "AI se aise MAT poochna") → split screen: chat screen on top, Avir below (bad prompt →
  boring letter → the 3 rules typed into the prompt → AI asks 2 questions → the real answer) → ❌ vs ✅ → full-screen CTA.
The AI answers are real Claude outputs; the chat screen is recreated (labelled on screen). Writes index.html + edit.json.
  python3 prompt_edit.py <data.json> <hf_dir>"""
import json, sys, html
from pathlib import Path

D = json.load(open(sys.argv[1])); HF = Path(sys.argv[2]); L = D['lines']; TOT = D['total']
st = lambda i: L[i]['start']; en = lambda i: L[i]['start'] + L[i]['dur']
wt = lambda i, sub: next((w['t0'] for w in L[i]['words'] if sub in w['w']), st(i))
S0, S1 = st(2) - 0.15, st(10) - 0.15          # split-screen section
SPLIT_Y, SPLIT_CLIP = 590, 370                # Avir layer moved down 590 px, top 370 px clipped → face in the lower half

BAD_PROMPT = 'leave application likho'
BAD_ANS = ('To,\nThe Manager,\n[Company Name]\n\nSubject: Application for Leave\n\nRespected Sir/Madam,\nI am writing to request leave for '
           '[number] days from [date] to [date] due to personal reasons. Kindly grant me leave for the same.\n\nYours faithfully,\n[Your Name]')
P1 = 'Main software developer hoon. Manager ko behen ki shaadi ke liye 12–13 Dec ki chhutti ka message likhna hai.'
P2 = ' WhatsApp message, Hinglish, 3 lines, polite but friendly.'
P3 = ' Pehle mujhse 2 sawal pucho agar kuch missing ho.'
Q_ANS = 'Zaroor! Bas 2 sawal:\n1) Aapka kaam kaun sambhalega?\n2) Manager ko naam se bulate ho?'
U_REPLY = 'Rahul sambhalega. Haan, Amit.'
GOOD_ANS = 'Hi Amit 🙏 Meri behen ki shaadi hai, isliye 12–13 Dec ki chhutti chahiye. Mera pending kaam Rahul ko hand over kar diya hai, urgent ho toh call kar lena. Thanks!'

css = r'''
@font-face { font-family: IDB; src: url(fonts/InterDisplay-Black.otf); } @font-face { font-family: IXB; src: url(fonts/Inter-ExtraBold.otf); }
@font-face { font-family: ISB; src: url(fonts/Inter-SemiBold.otf); } @font-face { font-family: JBM; src: url(fonts/JetBrainsMono-Medium.ttf); }
@font-face { font-family: SER; src: url(fonts/InstrumentSerif-Italic.ttf); } @font-face { font-family: DEV; src: url(fonts/NotoSansDevanagari.ttf); font-weight: 100 900; }
* { margin:0; padding:0; box-sizing:border-box; } html, body { width:1080px; height:1920px; overflow:hidden; background:#000; }
#root { position:relative; width:1080px; height:1920px; overflow:hidden; color:#fff; font-family: IXB, DEV, sans-serif; background:#0b0807; }
.clip { position:absolute; }
#avir { left:0; top:0; width:1080px; height:1920px; object-fit:cover; }
#topbg { left:0; top:0; width:1080px; height:972px; background: radial-gradient(ellipse 900px 700px at 50% 40%, #2a1a12, #0b0807 75%); opacity:0; }
#seam { left:0; top:960px; width:1080px; height:6px; background:linear-gradient(90deg,#ff5a1a,#ffb070); box-shadow:0 0 24px #ff6a1a; opacity:0; transform-origin:0 50%; }
#prog { left:0; top:0; width:1080px; height:8px; background:linear-gradient(90deg,#ff5a1a,#ffb070); transform-origin:0 50%; }
#shade { left:0; top:0; width:1080px; height:1920px; background: linear-gradient(180deg, rgba(0,0,0,.6) 0%, rgba(0,0,0,0) 30%, rgba(0,0,0,0) 62%, rgba(0,0,0,.55) 100%); }
/* hook */
#hook { left:0; width:1080px; top:150px; text-align:center; }
#hook .h1 { display:inline-block; font-family:IDB; font-size:92px; line-height:1; padding:14px 30px 18px; background:#E5322B; border-radius:22px; transform:rotate(-2deg);
  box-shadow:0 0 50px rgba(229,50,43,.6), 0 20px 50px rgba(0,0,0,.5); }
#hook .h2 { font-family:IDB; font-size:104px; line-height:1.02; margin-top:18px; text-shadow:0 8px 0 #000, 0 0 40px rgba(0,0,0,.8); }
#hook .h2 b { color:#FF7A2F; }
#badchip { left:110px; top:560px; width:860px; padding:22px 28px; border-radius:26px; background:rgba(18,14,12,.85); border:2px solid rgba(255,255,255,.15); font-family:ISB; font-size:38px; color:rgba(255,255,255,.8); }
#badchip .x { position:absolute; right:-22px; top:-26px; width:76px; height:76px; border-radius:50%; background:#E5322B; display:flex; align-items:center; justify-content:center; font-family:IDB; font-size:46px; box-shadow:0 0 30px rgba(229,50,43,.7); }
#ai { left:40px; top:28px; padding:8px 18px; border-radius:999px; background:rgba(10,8,7,.6); border:1px solid rgba(255,255,255,.22); font-family:ISB; font-size:21px; }
/* chat panel */
.panel { left:40px; top:120px; width:1000px; height:820px; border-radius:34px; background:#141110; border:2px solid rgba(255,255,255,.1); box-shadow:0 30px 80px rgba(0,0,0,.6); overflow:hidden; }
.pbar { position:absolute; left:0; top:0; width:1000px; height:84px; display:flex; align-items:center; gap:14px; padding:0 30px; border-bottom:1px solid rgba(255,255,255,.08); font-family:IXB; font-size:30px; }
.pbar .logo { width:46px; height:46px; border-radius:14px; background:linear-gradient(140deg,#ff8a3a,#c2410c); display:flex; align-items:center; justify-content:center; font-size:26px; }
.pbar .lbl { margin-left:auto; font-family:ISB; font-size:19px; color:rgba(255,255,255,.5); }
.ttl { position:absolute; left:30px; top:100px; font-family:IDB; font-size:34px; }
.msg { position:absolute; max-width:780px; padding:18px 24px; border-radius:24px; font-family:ISB; font-size:30px; line-height:1.38; white-space:pre-wrap; }
.msg.u { right:30px; background:#FF6A1A; color:#fff; border-bottom-right-radius:8px; }
.msg.a { left:30px; background:#24201e; color:#f3ece6; border-bottom-left-radius:8px; }
.input { position:absolute; left:24px; bottom:24px; width:952px; min-height:96px; padding:18px 92px 18px 26px; border-radius:28px; background:#201c1a; border:2px solid rgba(255,255,255,.1);
  font-family:ISB; font-size:29px; line-height:1.35; color:#fff; }
.input .ph { color:rgba(255,255,255,.35); } .input .cur { display:inline-block; width:3px; height:32px; background:#FF7A2F; vertical-align:middle; margin-left:3px; }
.input .send { position:absolute; right:16px; bottom:16px; width:62px; height:62px; border-radius:50%; background:#FF6A1A; display:flex; align-items:center; justify-content:center; font-size:30px; }
.c1 { color:#7CC4FF; } .c2 { color:#FFD24A; } .c3 { color:#7CFFB2; }
.stamp { position:absolute; font-family:IDB; font-size:72px; padding:8px 26px; border:6px solid; border-radius:16px; transform:rotate(-10deg); background:rgba(0,0,0,.35); }
.stamp.bad { color:#ff4a3d; border-color:#ff4a3d; right:60px; top:420px; } .stamp.good { color:#4BE08A; border-color:#4BE08A; right:50px; top:150px; }
.rule { left:90px; top:330px; display:flex; align-items:center; gap:18px; padding:18px 30px 18px 18px; border-radius:26px; background:rgba(12,9,8,.86); border:2px solid; box-shadow:0 20px 60px rgba(0,0,0,.5); }
.rule .n { width:110px; height:110px; border-radius:26px; display:flex; align-items:center; justify-content:center; font-family:IDB; font-size:70px; color:#0b0807; }
.rule .t { font-family:IDB; font-size:74px; line-height:1; } .rule .s { font-family:ISB; font-size:30px; color:rgba(255,255,255,.75); margin-top:6px; }
.ff { position:absolute; right:30px; padding:6px 14px; border-radius:999px; background:rgba(255,255,255,.1); font-family:JBM; font-size:20px; color:rgba(255,255,255,.7); }
.cmp { position:absolute; top:170px; width:455px; height:560px; border-radius:26px; padding:24px; font-family:ISB; font-size:24px; line-height:1.4; white-space:pre-wrap; overflow:hidden; }
.cmp .hd { font-family:IDB; font-size:34px; margin-bottom:14px; }
/* captions */
.cap { left:40px; width:1000px; display:flex; justify-content:center; }
.cap .pill { max-width:980px; text-align:center; padding:8px 24px 14px; border-radius:22px; background:rgba(10,8,7,.62); }
.cap span { display:inline-block; margin:0 7px; font-size:54px; line-height:1.3; font-family: DEV, IXB, sans-serif; font-weight:800; }
/* CTA */
#cta { left:40px; width:1000px; top:150px; text-align:center; }
#cta .c1t { font-family:IDB; font-size:76px; line-height:1; white-space:nowrap; text-shadow:0 8px 0 #000; } #cta .c2t { font-family:SER; font-size:130px; color:#FF7A2F; line-height:1; text-shadow:0 0 50px rgba(255,106,26,.6); }
#cta .c3t { display:inline-block; margin-top:16px; padding:12px 26px; border-radius:999px; background:rgba(10,8,7,.7); border:2px solid rgba(255,140,60,.7); font-family:IXB; font-size:34px; }
#save { right:60px; top:1180px; padding:14px 22px; border-radius:22px; background:#fff; color:#111; font-family:IDB; font-size:34px; transform:rotate(6deg); box-shadow:0 20px 50px rgba(0,0,0,.5); }
#flash { left:0; top:0; width:1080px; height:1920px; background:#fff; opacity:0; }
#fade { left:0; top:0; width:1080px; height:1920px; background:#000; opacity:0; }
'''
H, J = [], []
def clip(id_, t0, t1, inner='', cls='', track=3, style=''):
    sa = f' style="{style}"' if style else ''
    H.append(f'<div id="{id_}" class="clip {cls}"{sa} data-start="{t0:.3f}" data-duration="{max(0.05, t1 - t0):.3f}" data-track-index="{track}">{inner}</div>')
def js(s): J.append(s)
def pop(sel, t, d=0.35, fr='y:40,opacity:0', to='y:0,opacity:1', ease='back.out(1.7)'):
    js(f'tl.fromTo("{sel}",{{{fr}}},{{{to},duration:{d},ease:"{ease}"}},{t:.3f});')
def typeset(sel, text, t0, t1, step=2, cursor=False):
    n = len(text)
    for k in range(0, n + 1, step):
        js(f'tl.set("{sel}",{{textContent:{json.dumps(text[:k])}}},{t0 + (t1 - t0) * k / max(1, n):.3f});')
    js(f'tl.set("{sel}",{{textContent:{json.dumps(text)}}},{t1:.3f});')

# ---- base layers
H.append(f'<video id="avir" class="clip" src="media/avir.mp4" muted playsinline data-start="0" data-duration="{TOT:.3f}" data-track-index="0"></video>')
clip('shade', 0, S0 + 0.3, track=1); js(f'tl.to("#shade",{{opacity:0,duration:0.3}},{S0:.3f});')
clip('topbg', 0, TOT, track=1)
js(f'tl.to("#topbg",{{opacity:1,duration:0.35}},{S0:.3f});tl.to("#topbg",{{opacity:0,duration:0.35}},{S1:.3f});')
js(f'tl.to("#avir",{{y:{SPLIT_Y},clipPath:"inset({SPLIT_CLIP}px 0px 0px 0px)",duration:0.45,ease:"power3.inOut"}},{S0:.3f});')
js(f'tl.to("#avir",{{y:0,clipPath:"inset(0px 0px 0px 0px)",duration:0.45,ease:"power3.inOut"}},{S1:.3f});')
js('tl.set("#avir",{clipPath:"inset(0px 0px 0px 0px)"},0);')
clip('seam', S0, S1 + 0.4, track=2); js(f'tl.fromTo("#seam",{{opacity:1,scaleX:0}},{{scaleX:1,duration:0.45,ease:"power3.out"}},{S0 + 0.05:.3f});tl.to("#seam",{{opacity:0,duration:0.3}},{S1:.3f});')
clip('prog', 0, TOT, track=9); js(f'tl.fromTo("#prog",{{scaleX:0}},{{scaleX:1,duration:{TOT:.3f},ease:"none"}},0);')
clip('ai', 0.2, S0, '🤖 Avir is an AI-generated virtual creator', track=8)

# ---- hook (frame 1 already shows the X and the headline)
clip('hook', 0, st(1) + 1.2, '<div class="h1">❌ RUKO!</div><div class="h2">AI se aise<br><b>MAT</b> poochna</div>', track=5)
js('tl.fromTo("#hook .h1",{scale:1.8,rotate:-12},{scale:1,rotate:-2,duration:0.35,ease:"back.out(2.4)"},0);')
js('tl.fromTo("#hook .h2",{y:30,opacity:0.0},{y:0,opacity:1,duration:0.25,ease:"power3.out"},0.08);')
js('tl.to("#hook .h1",{x:"+=8",duration:0.04,yoyo:true,repeat:5},0.35);')
js(f'tl.to("#hook",{{opacity:0,y:-30,duration:0.3}},{st(1) + 0.9:.3f});')
clip('badchip', 0.5, st(1) + 1.2, f'“{BAD_PROMPT}”<div class="x">✕</div>', track=5)
pop('#badchip', 0.5, 0.35, 'y:40,opacity:0,scale:.9', 'y:0,opacity:1,scale:1')
js(f'tl.to("#badchip",{{opacity:0,duration:0.3}},{st(1) + 0.9:.3f});')
clip('flash', 0, TOT, track=12); js('tl.fromTo("#flash",{opacity:.7},{opacity:0,duration:0.18,immediateRender:false},0.0);')
clip('shrug', st(1) + 1.1, en(1) + 0.2, '<div class="h2" style="font-family:IDB;font-size:74px;text-shadow:0 6px 0 #000">“AI bekaar hai” 🙄</div>', track=5, style='left:0;width:1080px;top:300px;text-align:center')
pop('#shrug', st(1) + 1.1, 0.35, 'scale:.6,opacity:0', 'scale:1,opacity:1', 'back.out(2)')

# ---- chat panel (split section)
BAR = '<div class="pbar"><div class="logo">✦</div>AI Chat<div class="lbl">real AI answers · screen recreated</div></div>'
# scene A: bad prompt → boring letter
A0, A1 = S0, st(4) - 0.1
clip('pA', A0, A1, BAR + f'<div class="msg u" id="aU" style="top:110px">{html.escape(BAD_PROMPT)}</div><div class="msg a" id="aA" style="top:200px;font-size:26px"></div>'
     '<div class="input"><span id="aIn"></span><span class="cur"></span><div class="send">➤</div></div><div class="stamp bad" id="aSt">BORING 😴</div>', cls='panel', track=4)
pop('#pA', A0, 0.4, 'y:-60,opacity:0', 'y:0,opacity:1', 'power3.out')
ty0 = wt(2, 'लिखा') + 0.1; ty1 = ty0 + 1.0
typeset('#aIn', BAD_PROMPT, ty0, ty1, 1)
js(f'tl.set("#aU",{{opacity:0}},{A0:.3f});tl.set("#aIn",{{textContent:""}},{ty1 + 0.25:.3f});')
pop('#aU', ty1 + 0.25, 0.25, 'y:20,opacity:0', 'y:0,opacity:1', 'power2.out')
js(f'tl.set("#aA",{{opacity:0}},{A0:.3f});tl.set("#aA",{{opacity:1}},{st(3) - 0.1:.3f});')
typeset('#aA', BAD_ANS, st(3) - 0.1, wt(3, 'boring') - 0.1, 4)
js(f'tl.set("#aSt",{{opacity:0}},{A0:.3f});')
pop('#aSt', wt(3, 'boring') - 0.05, 0.3, 'scale:2.6,opacity:0,rotate:-30', 'scale:1,opacity:1,rotate:-10', 'back.out(2.2)')
BORING = wt(3, 'boring') - 0.05
# scene B: the 3 rules typed into the prompt → AI asks → final answer
B0, B1 = st(4) - 0.1, st(9) - 0.1
inp = f'<div class="input" id="bInp"><span class="c1" id="b1"></span><span class="c2" id="b2"></span><span class="c3" id="b3"></span><span class="cur"></span><div class="send" id="bSend">➤</div></div>'
clip('pB', B0, B1, BAR + '<div class="ttl" id="bT">✅ Sahi tareeka</div>'
     f'<div class="msg u" id="bU" style="top:110px;font-size:24px"><span class="c1">{html.escape(P1)}</span><span class="c2">{html.escape(P2)}</span><span class="c3">{html.escape(P3)}</span></div>'
     f'<div class="msg a" id="bQ" style="top:330px;font-size:26px">{html.escape(Q_ANS)}</div>'
     f'<div class="msg u" id="bR" style="top:500px;font-size:26px">{html.escape(U_REPLY)}</div>'
     f'<div class="msg a" id="bA" style="top:300px;font-size:31px;border:2px solid #4BE08A;box-shadow:0 0 40px rgba(75,224,138,.3)"></div>'
     '<div class="ff" id="bFF" style="top:580px">⏩ fast-forward</div>' + inp + '<div class="stamp good" id="bSt">PERFECT 🔥</div>', cls='panel', track=4)
pop('#pB', B0, 0.4, 'x:80,opacity:0', 'x:0,opacity:1', 'power3.out')
for s in ('#bU', '#bQ', '#bR', '#bA', '#bFF', '#bSt'): js(f'tl.set("{s}",{{opacity:0}},{B0:.3f});')
typeset('#b1', P1, st(5) + 0.5, en(5) - 0.2, 3)
typeset('#b2', P2, st(6) + 0.6, en(6) - 0.3, 2)
p3a = st(7) + 1.2; p3b = en(7) - 0.4
typeset('#b3', P3, p3a, p3b, 2)
send = en(7) - 0.25
js(f'tl.fromTo("#bSend",{{scale:1}},{{scale:1.3,duration:0.12,yoyo:true,repeat:1}},{send:.3f});')
js(f'tl.to("#bInp",{{opacity:0,duration:0.2}},{send + 0.15:.3f});tl.to("#bT",{{opacity:0,duration:0.2}},{send:.3f});')
pop('#bU', send + 0.15, 0.25, 'y:20,opacity:0', 'y:0,opacity:1', 'power2.out')
pop('#bQ', send + 0.45, 0.25, 'y:20,opacity:0', 'y:0,opacity:1', 'power2.out')
pop('#bR', send + 0.95, 0.25, 'y:20,opacity:0', 'y:0,opacity:1', 'power2.out')
pop('#bFF', send + 0.45, 0.2, 'opacity:0', 'opacity:1', 'none')
fin0 = max(send + 1.4, st(8) + 0.2)
js(f'tl.to(["#bU","#bQ","#bR","#bFF"],{{opacity:0,y:-40,duration:0.25}},{fin0 - 0.25:.3f});')
js(f'tl.set("#bA",{{opacity:1}},{fin0:.3f});')
typeset('#bA', GOOD_ANS, fin0, fin0 + 1.6, 3)
pop('#bSt', fin0 + 1.7, 0.3, 'scale:2.6,opacity:0,rotate:-30', 'scale:1,opacity:1,rotate:-10', 'back.out(2.2)')
GOOD = fin0 + 1.7
# rule cards over Avir's half
RULES = [(5, '1', 'CONTEXT', 'kaun ho · kise · kyun', '#7CC4FF'), (6, '2', 'FORMAT', 'WhatsApp · Hinglish · 3 lines', '#FFD24A'), (7, '3', 'SAWAL', 'AI, pehle mujhse sawal pucho', '#7CFFB2')]
for i, n, t, s, c in RULES:
    clip(f'r{n}', st(i) - 0.05, (en(i) - 0.3) if i == 7 else (en(i) + 0.15), f'<div class="n" style="background:{c}">{n}</div><div><div class="t">{t}</div><div class="s">{s}</div></div>', cls='rule', track=6, style=f'border-color:{c}')
    pop(f'#r{n}', st(i) - 0.05, 0.4, 'x:-120,opacity:0', 'x:0,opacity:1', 'back.out(1.8)')
# scene C: ❌ vs ✅
C0, C1 = st(9) - 0.1, S1 + 0.1
clip('pC', C0, C1, BAR + '<div class="ttl">Same AI. Sirf prompt badla.</div>'
     f'<div class="cmp" style="left:30px;background:#2a1414;border:2px solid #ff4a3d"><div class="hd" style="color:#ff4a3d">❌ Pehle</div>{html.escape(BAD_ANS[:150])}…</div>'
     f'<div class="cmp" style="left:515px;background:#122a1c;border:2px solid #4BE08A"><div class="hd" style="color:#4BE08A">✅ Ab</div>{html.escape(GOOD_ANS)}</div>', cls='panel', track=4)
pop('#pC', C0, 0.4, 'scale:.9,opacity:0', 'scale:1,opacity:1', 'back.out(1.6)')

# ---- CTA (full screen again)
clip('cta', S1 + 0.25, TOT, '<div class="c1t">Full prompt template?</div><div class="c2t">“PROMPT”</div><div class="c3t">Comment karo 👇 DM mein bhejunga</div>', track=5)
pop('#cta .c1t', S1 + 0.25, 0.35, 'y:-30,opacity:0', 'y:0,opacity:1', 'power3.out')
pop('#cta .c2t', wt(10, 'PROMPT') - 0.05, 0.4, 'scale:2.2,opacity:0,rotate:-8', 'scale:1,opacity:1,rotate:0', 'back.out(2)')
pop('#cta .c3t', S1 + 0.9, 0.3, 'y:20,opacity:0', 'y:0,opacity:1')
clip('save', S1 + 1.4, TOT, '📌 SAVE karo', track=6); pop('#save', S1 + 1.4, 0.35, 'scale:0,opacity:0', 'scale:1,opacity:1', 'back.out(2.5)')
clip('ai2', S1 + 0.3, TOT, '🤖 Avir is an AI-generated virtual creator', track=8, style='left:40px;top:1470px;padding:8px 18px;border-radius:999px;background:rgba(10,8,7,.6);border:1px solid rgba(255,255,255,.22);font-family:ISB;font-size:21px')
clip('fade', TOT - 0.45, TOT, track=13); js(f'tl.to("#fade",{{opacity:1,duration:0.45}},{TOT - 0.45:.3f});')
for t in (BORING, GOOD): js(f'tl.fromTo("#flash",{{opacity:.35}},{{opacity:0,duration:0.15,immediateRender:false}},{t:.3f});')

# ---- word captions: lower third in full screen, on the seam in split screen
def groups(words, maxw=4, maxc=22):
    gs, cur = [], []
    for w in words:
        if cur and (len(cur) >= maxw or sum(len(x['w']) + 1 for x in cur) + len(w['w']) > maxc): gs.append(cur); cur = []
        cur.append(w)
        if w['w'][-1] in '?!।,…—' and len(cur) >= 2: gs.append(cur); cur = []
    if cur: gs.append(cur)
    return gs
k = 0
for i, l in enumerate(L):
    if i == 0: continue                           # the hook headline already says it
    gs = groups(l['words'])
    for gi, g in enumerate(gs):
        t0 = g[0]['t0'] - 0.04; t1 = gs[gi + 1][0]['t0'] - 0.04 if gi + 1 < len(gs) else en(i) + 0.3
        top = 975 if S0 <= t0 < S1 else 1360
        sp = ''.join(f'<span id="w{k}_{j}">{html.escape(w["w"].strip("“”"))}</span>' for j, w in enumerate(g) if w['w'] != '—')
        clip(f'c{k}', t0, t1, f'<div class="pill">{sp}</div>', cls='cap', track=10, style=f'top:{top}px')
        js(f'tl.fromTo("#c{k} .pill",{{y:12,opacity:0}},{{y:0,opacity:1,duration:0.1}},{t0:.3f});')
        for j, w in enumerate(g):
            if w['w'] == '—': continue
            js(f'tl.set("#w{k}_{j}",{{color:"#FF9A4D"}},{w["t0"]:.3f});tl.set("#w{k}_{j}",{{color:"#ffffff"}},{max(w["t0"] + 0.01, w["t1"]):.3f});')
        k += 1

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
ev = {'impact': [0.0, BORING], 'whoosh': [S0, st(4) - 0.1, st(9) - 0.1, S1], 'click': [st(5) - 0.05, st(6) - 0.05, st(7) - 0.05, ty1 + 0.2, send],
      'typing': [[ty0, 1.0], [st(5) + 0.5, en(5) - st(5) - 0.7], [st(6) + 0.6, en(6) - st(6) - 0.9], [p3a, p3b - p3a]], 'chime': [GOOD],
      'riser': [[fin0 - 1.0, fin0]], 'coin': []}
json.dump({'total': TOT, 'ev': ev, 'plan': [[0.0, TOT, 0.42, 'tech']], 'clear': True}, open(HF / 'edit.json', 'w'), indent=1)
print('ok', round(TOT, 2), 'split', round(S0, 2), round(S1, 2), 'captions', k)
