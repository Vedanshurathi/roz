#!/usr/bin/env python3
"""Reel 3 ("क्या AI से एक local shop का advertisement बन सकता है?") — writes the HyperFrames composition + audio plan.
  python3 reel3_edit.py <data.json> <hf_dir> ig|yt [<data_yt.json>]
Layout (1080x1920, mobile-safe: nothing important in the top ~170 px or bottom ~380 px, nothing over Avir's mouth):
  0-5 s   illustrative shop scene (AI-generated stills, labelled) + shopkeeper voice
  Avir    (Remotion renders avirA/B/C.mp4) between the cut-aways
  demo    the REAL screen recording of the local tool (scr*.mp4, sped up with labelled speed badges)
  ad      the finished poster + generated voice, labelled DEMO AD
Writes <hf_dir>/index.html and <hf_dir>/edit.json (times for reel3_audio.py)."""
import json, sys, html
from pathlib import Path

D = json.load(open(sys.argv[1])); HF = Path(sys.argv[2]); V = sys.argv[3]
if V == 'yt': D = json.load(open(sys.argv[4]))
L = D['lines']; TOT = D['total']; FPS = 24
st = lambda i: L[i]['start']; en = lambda i: L[i]['start'] + L[i]['dur']
def wt(i, sub):
    return next((w['t0'] for w in L[i]['words'] if sub in w['w']), st(i))

# ---- timeline (seconds) ----
T_SHOP = 1.4                         # bazaar establishing -> shopkeeper
A0, A1 = 5.0, 12.75                  # Avir: joke + challenge
SCR = [('scrA', 12.75, 14.35, '⏩ 4× fast'), ('scrB', 14.35, 16.85, '⏩ 34× fast · real time 1:24'), ('scrC', 16.85, 17.55, ''),
       ('scrD', 17.55, 18.15, '⏩ 6× fast'), ('scrE', 18.15, 19.5, ''), ('scrF', 19.5, 22.85, '⏩ 3× fast'), ('scrG', 22.85, 24.45, '')]
B0, B1 = 24.45, 27.85                # Avir: "poster बना, आवाज़ बनी…"
AD0, AD1 = 27.85, 31.85              # DEMO AD
C0 = 31.85                           # Avir to the end
END0 = en(9) - 0.55                  # end card
CARD0 = wt(2, 'AI') - 0.1            # THE ₹500 AD CHALLENGE

SHOP_WORDS = 'भाई, मेरी दुकान का एक बढ़िया सा ad बना देगा? Budget ₹500।'.split()
SHOP_T0, SHOP_T1 = 0.15, 4.85


def shop_words():
    w = [len(x.strip('?,।')) + 2 for x in SHOP_WORDS]; tot = sum(w) + 4; t = SHOP_T0; out = []
    for x, k in zip(SHOP_WORDS, w):
        d = (SHOP_T1 - SHOP_T0) * k / tot; out.append({'w': x, 't0': t, 't1': t + d}); t += d + (0.28 if x.endswith('?') else 0)
    return out


def groups(words, maxw=4, maxc=22):
    gs, cur = [], []
    for w in words:
        if cur and (len(cur) >= maxw or sum(len(x['w']) for x in cur) + len(w['w']) > maxc): gs.append(cur); cur = []
        cur.append(w)
        if w['w'][-1] in '?!।,…' and len(cur) >= 2: gs.append(cur); cur = []
    if cur: gs.append(cur)
    return gs


in_screen = lambda t: SCR[0][1] <= t < SCR[-1][2]
cap_html, cap_js = [], []
k = 0
allg = [(g, 'shop') for g in groups(shop_words())] + [(g, 'avir') for l in L for g in groups(l['words'])]
for gi, (g, who) in enumerate(allg):
    t0 = g[0]['t0'] - 0.05
    nxt = allg[gi + 1][0][0]['t0'] - 0.05 if gi + 1 < len(allg) else TOT
    t1 = min(g[-1]['t1'] + 0.35, nxt)
    if AD0 <= t0 < AD1: continue
    y = 1420 if in_screen(t0) else 1330
    spans = ''.join(f'<span id="w{k}_{j}">{html.escape(w["w"])}</span>' for j, w in enumerate(g))
    tag = '<div class="who">दुकान वाले भैया</div>' if who == 'shop' and gi == 0 else ''
    cap_html.append(f'<div class="cap clip" id="c{k}" data-start="{t0:.3f}" data-duration="{t1 - t0:.3f}" data-track-index="9" style="top:{y}px">{tag}<div class="pill">{spans}</div></div>')
    cap_js.append(f'tl.fromTo("#c{k} .pill",{{scale:0.86,opacity:0}},{{scale:1,opacity:1,duration:0.14,ease:"back.out(2)"}},{t0:.3f});')
    for j, w in enumerate(g):
        cap_js.append(f'tl.set("#w{k}_{j}",{{color:"#FFD24A"}},{w["t0"]:.3f});tl.set("#w{k}_{j}",{{color:"#ffffff"}},{max(w["t0"] + 0.01, w["t1"]):.3f});')
    k += 1

# the tool playing its generated line (first phrase only here; the full line plays under the DEMO AD)
PLAY0 = SCR[-1][1] + 0.1
cap_html.append(f'<div class="cap clip" id="cplay" data-start="{PLAY0:.3f}" data-duration="1.45" data-track-index="9" style="top:1420px"><div class="who">🔊 AI आवाज़</div><div class="pill"><span>शर्मा</span><span>क्लॉथ</span><span>हाउस!</span></div></div>')
cap_js.append(f'tl.fromTo("#cplay .pill",{{scale:0.86,opacity:0}},{{scale:1,opacity:1,duration:0.14,ease:"back.out(2)"}},{PLAY0:.3f});')

# Avir video segments: rendered from the same timeline, so media time = reel time (media-start 0 at the segment start)
AV = [('avirA', A0, A1), ('avirB', B0, AD0), ('avirC', C0, TOT if V == 'ig' else st(9) - 0.2)]
if V == 'yt': AV.append(('avirC_yt', st(9) - 0.2, TOT))
av_html = ''.join(f'<video class="clip full" id="{n}" src="media/{n}.mp4" muted playsinline data-start="{a:.3f}" data-duration="{b - a:.3f}" data-track-index="1"></video>' for n, a, b in AV)
scr_html = f'<video class="clip" id="scr" src="media/scr.mp4" muted playsinline data-start="{SCR[0][1]:.3f}" data-duration="{SCR[-1][2] - SCR[0][1]:.3f}" data-track-index="3"></video>'
badge_html = ''.join(f'<div class="badge clip" id="b_{n}" data-start="{a + 0.1:.3f}" data-duration="{b - a - 0.15:.3f}" data-track-index="5">{lbl}</div>' for n, a, b, lbl in SCR if lbl)

FOLLOW = ('FOLLOW', '@unfiltered.avir') if V == 'ig' else ('SUBSCRIBE', 'UNFILTERED AVIR')
x5 = wt(7, '₹5,000'); x10 = wt(7, '10'); xdis = wt(7, 'example') - 0.35
poll0 = wt(8, 'कपड़ों') - 0.15

page = f'''<!doctype html>
<html lang="hi"><head><meta charset="UTF-8"><meta name="viewport" content="width=1080, height=1920">
<script src="gsap.min.js"></script>
<style>
@font-face {{ font-family: PoppinsBlack; src: url(Poppins-Black.ttf); }}
@font-face {{ font-family: PoppinsXB; src: url(Poppins-ExtraBold.ttf); }}
@font-face {{ font-family: DevaBold; src: url(NotoSansDevanagari-Bold.ttf); }}
@font-face {{ font-family: 'Noto Color Emoji'; src: url(NotoColorEmoji.ttf); }}
* {{ margin:0; padding:0; box-sizing:border-box; }}
html, body {{ width:1080px; height:1920px; overflow:hidden; background:#0b0807; }}
#root {{ position:relative; width:1080px; height:1920px; overflow:hidden; font-family: PoppinsXB, DevaBold, 'Noto Color Emoji', sans-serif; color:#fff; }}
.clip {{ position:absolute; }}
.full {{ left:0; top:0; width:1080px; height:1920px; object-fit:cover; }}
.kb {{ left:0; top:0; width:1080px; height:1920px; object-fit:cover; }}
#scrbg {{ left:0; top:0; width:1080px; height:1920px; background: radial-gradient(ellipse at 50% 35%, #3a2a20 0%, #120d0a 70%); }}
#scr {{ left:65px; top:215px; width:950px; height:1188px; border-radius:26px; object-fit:cover; box-shadow:0 30px 80px rgba(0,0,0,.6), 0 0 0 2px rgba(255,255,255,.08); }}
.chip {{ top:150px; left:50%; transform:translateX(-50%); white-space:nowrap; padding:10px 22px; border-radius:999px; font-size:27px; letter-spacing:.5px;
  background:rgba(12,10,9,.72); border:1.5px solid rgba(255,255,255,.22); backdrop-filter: blur(10px); font-family: PoppinsXB, DevaBold, sans-serif; }}
.chip b {{ color:#4BE08A; }}
.badge {{ right:95px; top:1250px; padding:10px 20px; border-radius:16px; font-size:30px; background:#E5522B; color:#fff; box-shadow:0 10px 30px rgba(0,0,0,.4); }}
.cap {{ left:0; width:1080px; display:flex; flex-direction:column; align-items:center; }}
.cap .pill {{ max-width:960px; text-align:center; padding:10px 26px 16px; border-radius:24px; background:rgba(10,8,7,.62); backdrop-filter: blur(12px); line-height:1.25; }}
.cap span {{ display:inline-block; margin:0 8px; font-size:58px; font-family: DevaBold, PoppinsXB, sans-serif; color:#fff; text-shadow:0 3px 0 rgba(0,0,0,.5); }}
.who {{ font-size:28px; padding:4px 16px; border-radius:12px; background:#8e0c14; margin-bottom:10px; font-family: DevaBold, sans-serif; }}
#title {{ left:0; width:1080px; top:250px; text-align:center; }}
#title .t1 {{ display:inline-block; font-family:PoppinsBlack; font-size:64px; letter-spacing:4px; padding:8px 26px; background:#fff; color:#111; border-radius:14px; transform:rotate(-3deg); }}
#title .t2 {{ font-family:PoppinsBlack; font-size:150px; line-height:1; color:#FFD24A; -webkit-text-stroke:6px #120b05; paint-order:stroke fill; text-shadow:0 10px 0 #120b05; margin-top:14px; }}
#title .t3 {{ font-family:PoppinsBlack; font-size:84px; letter-spacing:6px; color:#fff; -webkit-text-stroke:5px #120b05; paint-order:stroke fill; }}
#adbg {{ left:-60px; top:-60px; width:1200px; height:2040px; object-fit:cover; filter: blur(40px) brightness(.55) saturate(1.3); }}
#ad {{ left:140px; top:290px; width:800px; height:1200px; border-radius:20px; box-shadow:0 40px 100px rgba(0,0,0,.7); object-fit:cover; }}
#adtag {{ left:140px; top:196px; padding:8px 20px; border-radius:12px; background:#E5522B; font-family:PoppinsBlack; font-size:40px; letter-spacing:3px; }}
#adnote {{ left:380px; top:208px; font-size:26px; color:rgba(255,255,255,.85); font-family: PoppinsXB, sans-serif; }}
#sheen {{ left:140px; top:290px; width:800px; height:1200px; border-radius:20px; overflow:hidden; }}
#sheen i {{ position:absolute; top:-200px; left:-400px; width:220px; height:1800px; background:linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,.35), rgba(255,255,255,0)); transform:rotate(18deg); }}
#math {{ left:90px; top:240px; width:900px; padding:30px 34px; border-radius:30px; text-align:center;
  background:linear-gradient(140deg, rgba(255,255,255,.2), rgba(255,255,255,.06)); backdrop-filter: blur(22px) saturate(160%) brightness(.8); border:1.5px solid rgba(255,255,255,.3); }}
#math .m1 {{ font-family:PoppinsBlack; font-size:84px; }}
#math .m2 {{ font-family:PoppinsBlack; font-size:120px; color:#FFD24A; line-height:1.1; }}
#math .m3 {{ display:inline-block; margin-top:14px; font-size:30px; padding:8px 18px; border-radius:12px; background:rgba(0,0,0,.45); font-family: PoppinsXB, DevaBold, sans-serif; }}
#poll {{ left:0; width:1080px; top:250px; display:flex; flex-direction:column; align-items:center; gap:22px; }}
#poll .q {{ font-family:PoppinsBlack; font-size:44px; padding:8px 22px; border-radius:14px; background:#fff; color:#111; }}
#poll .o {{ font-family:DevaBold; font-size:54px; padding:14px 34px; border-radius:22px; background:rgba(10,8,7,.7); border:3px solid #FFD24A; }}
#end {{ left:0; width:1080px; top:250px; text-align:center; }}
#end .e1 {{ font-family:PoppinsBlack; font-size:{96 if V == 'ig' else 92}px; color:#fff; -webkit-text-stroke:5px #120b05; paint-order:stroke fill; }}
#end .e2 {{ display:inline-block; margin-top:10px; font-family:PoppinsBlack; font-size:{70 if V == 'ig' else 62}px; padding:10px 30px; border-radius:20px; background:{'linear-gradient(90deg,#f58529,#dd2a7b,#8134af)' if V == 'ig' else '#FF0000'}; }}
#end .e3 {{ margin-top:18px; font-size:30px; color:rgba(255,255,255,.9); }}
#fade {{ left:0; top:0; width:1080px; height:1920px; background:#000; opacity:0; }}
</style></head><body>
<div id="root" data-composition-id="main" data-start="0" data-duration="{TOT:.3f}" data-width="1080" data-height="1920">
  <img id="bazaar" class="clip kb" src="media/shop_wide.png" data-start="0" data-duration="{T_SHOP:.3f}" data-track-index="0">
  <img id="shop" class="clip kb" src="media/shop_scene_v.png" data-start="{T_SHOP:.3f}" data-duration="{A0 - T_SHOP:.3f}" data-track-index="0">
  <div class="chip clip" id="ch_shop" style="top:1490px" data-start="0.2" data-duration="{A0 - 0.3:.3f}" data-track-index="6">Illustrative scene · <b>AI-generated</b> images</div>
  {av_html}
  <div class="chip clip" id="ch_avir" data-start="{A0 + 0.3:.3f}" data-duration="3.0" data-track-index="6">Avir · <b>AI-generated</b> virtual creator</div>
  <div id="scrbg" class="clip" data-start="{SCR[0][1]:.3f}" data-duration="{SCR[-1][2] - SCR[0][1]:.3f}" data-track-index="2"></div>
  {scr_html}
  <div class="chip clip" id="ch_scr" data-start="{SCR[0][1] + 0.1:.3f}" data-duration="{SCR[-1][2] - SCR[0][1] - 0.2:.3f}" data-track-index="6">● <b>REAL</b> screen recording · local AI on CPU</div>
  {badge_html}
  <div id="title" class="clip" data-start="{CARD0:.3f}" data-duration="{A1 - CARD0:.3f}" data-track-index="7"><div class="t1">THE</div><div class="t2">₹500</div><div class="t3">AD CHALLENGE</div></div>
  <img id="adbg" class="clip" src="media/poster.png" data-start="{AD0:.3f}" data-duration="{AD1 - AD0:.3f}" data-track-index="2">
  <img id="ad" class="clip" src="media/poster.png" data-start="{AD0:.3f}" data-duration="{AD1 - AD0:.3f}" data-track-index="3">
  <div id="sheen" class="clip" data-start="{AD0:.3f}" data-duration="{AD1 - AD0:.3f}" data-track-index="4"><i></i></div>
  <div id="adtag" class="clip" data-start="{AD0:.3f}" data-duration="{AD1 - AD0:.3f}" data-track-index="5">DEMO AD</div>
  <div id="adnote" class="clip" data-start="{AD0:.3f}" data-duration="{AD1 - AD0:.3f}" data-track-index="5">fictional shop · free local AI</div>
  <div id="math" class="clip" data-start="{x10 - 0.15:.3f}" data-duration="{en(7) + 0.2 - x10:.3f}" data-track-index="7">
    <div class="m1">10 clients × ₹500</div><div class="m2">= ₹5,000</div><div class="m3">Illustrative example · कमाई की guarantee नहीं</div></div>
  <div id="poll" class="clip" data-start="{poll0:.3f}" data-duration="{en(8) + 0.15 - poll0:.3f}" data-track-index="7">
    <div class="q">अगला AD? 👇 COMMENT</div><div class="o" id="o1">👕 कपड़ों की दुकान</div><div class="o" id="o2">🥦 सब्ज़ी वाले भैया</div></div>
  <div id="end" class="clip" data-start="{END0:.3f}" data-duration="{TOT - END0:.3f}" data-track-index="7">
    <div class="e1">{FOLLOW[0]}</div><div class="e2">{FOLLOW[1]}</div><div class="e3">Real experiments. Unfiltered results.</div></div>
  {''.join(cap_html)}
  <div id="fade" class="clip" data-start="{TOT - 0.5:.3f}" data-duration="0.5" data-track-index="10"></div>
</div>
<script>
window.__timelines = window.__timelines || {{}};
const tl = gsap.timeline({{ paused: true }});
tl.fromTo("#bazaar", {{scale:1.12}}, {{scale:1.0, duration:{T_SHOP:.3f}, ease:"none"}}, 0);
tl.fromTo("#shop", {{scale:1.0, transformOrigin:"50% 36%"}}, {{scale:1.22, duration:{A0 - T_SHOP:.3f}, ease:"power1.inOut"}}, {T_SHOP:.3f});
tl.fromTo("#scr", {{y:60, opacity:0, scale:0.96}}, {{y:0, opacity:1, scale:1, duration:0.3, ease:"power3.out"}}, {SCR[0][1]:.3f});
// (the zoom onto the poster is baked into media/scr.mp4 by FFmpeg zoompan)
document.querySelectorAll(".badge").forEach(b => tl.fromTo(b, {{scale:0.6, opacity:0}}, {{scale:1, opacity:1, duration:0.18, ease:"back.out(2.5)"}}, parseFloat(b.dataset.start)));
tl.fromTo("#title .t1", {{y:-40, opacity:0}}, {{y:0, opacity:1, duration:0.2}}, {CARD0:.3f});
tl.fromTo("#title .t2", {{scale:2.2, opacity:0}}, {{scale:1, opacity:1, duration:0.32, ease:"back.out(2)"}}, {CARD0 + 0.12:.3f});
tl.fromTo("#title .t3", {{y:40, opacity:0}}, {{y:0, opacity:1, duration:0.25, ease:"power3.out"}}, {CARD0 + 0.35:.3f});
tl.to("#title", {{opacity:0, y:-30, duration:0.2}}, {A1 - 0.25:.3f});
tl.fromTo("#ad", {{scale:0.85, opacity:0, rotate:-3}}, {{scale:1, opacity:1, rotate:0, duration:0.45, ease:"back.out(1.6)"}}, {AD0:.3f});
tl.to("#ad", {{scale:1.05, duration:{AD1 - AD0 - 0.45:.3f}, ease:"none"}}, {AD0 + 0.45:.3f});
tl.fromTo("#sheen i", {{x:0}}, {{x:1500, duration:0.9, ease:"power2.inOut"}}, {AD0 + 0.6:.3f});
tl.fromTo("#adtag", {{x:-200, opacity:0}}, {{x:0, opacity:1, duration:0.3, ease:"power3.out"}}, {AD0 + 0.2:.3f});
tl.fromTo("#adnote", {{opacity:0}}, {{opacity:1, duration:0.3}}, {AD0 + 0.4:.3f});
tl.fromTo("#math", {{y:-40, opacity:0}}, {{y:0, opacity:1, duration:0.3, ease:"power3.out"}}, {x10 - 0.15:.3f});
tl.fromTo("#math .m2", {{scale:0.5, opacity:0}}, {{scale:1, opacity:1, duration:0.3, ease:"back.out(2.5)"}}, {x5:.3f});
tl.fromTo("#math .m3", {{opacity:0}}, {{opacity:1, duration:0.25}}, {xdis:.3f});
tl.fromTo("#poll .q", {{y:-30, opacity:0}}, {{y:0, opacity:1, duration:0.25}}, {poll0:.3f});
tl.fromTo("#o1", {{x:-300, opacity:0}}, {{x:0, opacity:1, duration:0.3, ease:"back.out(1.8)"}}, {poll0 + 0.15:.3f});
tl.fromTo("#o2", {{x:300, opacity:0}}, {{x:0, opacity:1, duration:0.3, ease:"back.out(1.8)"}}, {wt(8, 'सब्ज़ी') - 0.15:.3f});
tl.fromTo("#end .e1", {{scale:1.8, opacity:0}}, {{scale:1, opacity:1, duration:0.3, ease:"back.out(2)"}}, {END0:.3f});
tl.fromTo("#end .e2", {{y:40, opacity:0}}, {{y:0, opacity:1, duration:0.3, ease:"power3.out"}}, {END0 + 0.15:.3f});
tl.fromTo("#end .e3", {{opacity:0}}, {{opacity:1, duration:0.3}}, {END0 + 0.35:.3f});
tl.to("#fade", {{opacity:1, duration:0.5}}, {TOT - 0.5:.3f});
{chr(10).join(cap_js)}
tl.set({{}}, {{}}, {TOT:.3f});
window.__timelines["main"] = tl; tl.seek(0);
</script></body></html>'''
(HF / 'index.html').write_text(page)

# events for the audio mix
cuts = [T_SHOP, A0, SCR[0][1], AD0, AD1 - 0.02, B0]
ev = {'demo_ad': [AD0, AD1], 'math': [x10, en(7)], 'whoosh': cuts + [SCR[5][1]],
      'typing': [[SCR[0][1] + 0.05, SCR[0][2] - SCR[0][1] - 0.1], [SCR[3][1], 0.55], [SCR[5][1] + 0.6, 0.9]],
      'click': [SCR[1][1] - 0.02, SCR[3][2] - 0.05, SCR[5][1] + 1.85], 'riser': [[SCR[1][1] + 0.1, SCR[2][1]]],
      'chime': [SCR[2][1], AD0 + 0.1, END0], 'rimshot': [en(1) + 0.05], 'coin': [x5]}
json.dump({'total': TOT, 'ev': ev, 'play0': PLAY0, 'ad0': AD0, 'scr': SCR, 'av': AV}, open(HF / 'edit.json', 'w'), ensure_ascii=False, indent=1)
print('ok', V, round(TOT, 2), 'caption groups', k)
