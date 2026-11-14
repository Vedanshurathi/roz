#!/usr/bin/env python3
"""EP002 (Sunday AI update from Avir's home) — writes the HyperFrames composition (1920x1080) + audio events.
  python3 ep2_edit.py <data.json> <hf_dir>
Media expected in <hf_dir>/media: avir_<seg>.mp4 (Remotion Ep2Avir ranges), page_<name>.mp4 (real browser recordings,
already trimmed/zoomed), demo.mp4 (real recording of the local AI tool), card.png (the card it made), villa_*.png stills."""
import json, sys, html
from pathlib import Path

D = json.load(open(sys.argv[1])); HF = Path(sys.argv[2]); L = D['lines']; TOT = D['total']
st = lambda i: L[i]['start']; en = lambda i: L[i]['start'] + L[i]['dur']

# Avir on screen (seconds); everything else is cut-aways (title, demo, browser pages)
AV = [('a', 0.0, 8.0), ('b', 12.19, 19.6), ('c', 27.86, 39.7), ('e', 50.37, 63.3), ('g', 77.11, 83.52), ('i', 96.9, TOT)]
TITLE = (8.0, 12.19); DEMO = (19.6, 27.86)
PAGES = [('google', 39.7, 44.18, 'blog.google · 10 Nov 2026', 'AI NEWS 1/3 · GOOGLE'), ('9to5', 44.18, 50.37, '9to5google.com · 10 Nov 2026', 'AI NEWS 1/3 · GOOGLE'),
         ('anthropic', 63.3, 68.72, 'anthropic.com · 9 Nov 2026', 'AI NEWS 2/3 · ANTHROPIC'), ('macrumors', 68.72, 77.11, 'macrumors.com · 9 Nov 2026', 'AI NEWS 2/3 · ANTHROPIC'),
         ('inmobi', 83.52, 89.2, 'inmobi.com/ai-kaushal', 'AI NEWS 3/3 · INDIA'), ('tribune', 89.2, 96.9, 'tribuneindia.com · 12 Nov 2026', 'AI NEWS 3/3 · INDIA')]
LOCS = [(0.3, 'POOL DECK', "Avir's home"), (34.2, 'LIVING ROOM', "Avir's home"), (56.4, 'STUDIO', "Avir's home · first floor"), (97.0, 'POOL DECK', "Avir's home")]
MONTAGE = ['Society', 'Front', 'Living', 'Studio', 'Cars', 'Backyard']
END0 = TOT - 3.3


def groups(words, maxw=6, maxc=34):
    gs, cur = [], []
    for w in words:
        if cur and (len(cur) >= maxw or sum(len(x['w']) + 1 for x in cur) + len(w['w']) > maxc): gs.append(cur); cur = []
        cur.append(w)
        if w['w'][-1] in '?!।,…—' and len(cur) >= 3: gs.append(cur); cur = []
    if cur: gs.append(cur)
    return gs


cap_html, js = [], []
allg = [g for l in L for g in groups(l['words'])]; k = 0
for gi, g in enumerate(allg):
    t0 = g[0]['t0'] - 0.04; nxt = allg[gi + 1][0]['t0'] - 0.04 if gi + 1 < len(allg) else TOT; t1 = min(g[-1]['t1'] + 0.3, nxt)
    if TITLE[0] + 0.2 < t0 < TITLE[1]: continue
    spans = ''.join(f'<span id="w{k}_{j}">{html.escape(w["w"])}</span>' for j, w in enumerate(g))
    cap_html.append(f'<div class="cap clip" id="c{k}" data-start="{t0:.3f}" data-duration="{t1 - t0:.3f}" data-track-index="9"><div class="pill">{spans}</div></div>')
    js.append(f'tl.fromTo("#c{k} .pill",{{y:16,opacity:0}},{{y:0,opacity:1,duration:0.12}},{t0:.3f});')
    for j, w in enumerate(g): js.append(f'tl.set("#w{k}_{j}",{{color:"#FFD24A"}},{w["t0"]:.3f});tl.set("#w{k}_{j}",{{color:"#ffffff"}},{max(w["t0"] + 0.01, w["t1"]):.3f});')
    k += 1

av = ''.join(f'<video class="clip full" id="avir_{n}" src="media/avir_{n}.mp4" muted playsinline data-start="{a:.3f}" data-duration="{b - a:.3f}" data-track-index="1"></video>' for n, a, b in AV)
pages = ''
for n, a, b, src, badge in PAGES:
    pages += f'<video class="clip full" id="pg_{n}" src="media/page_{n}.mp4" muted playsinline data-start="{a:.3f}" data-duration="{b - a:.3f}" data-track-index="2"></video>'
    pages += f'<div class="src clip" id="src_{n}" data-start="{a + 0.15:.3f}" data-duration="{b - a - 0.2:.3f}" data-track-index="6"><b>● REAL BROWSER</b> &nbsp;{html.escape(src)}</div>'
    js.append(f'tl.fromTo("#src_{n}",{{x:-40,opacity:0}},{{x:0,opacity:1,duration:0.25}},{a + 0.15:.3f});')
news = {}
for n, a, b, src, badge in PAGES: news.setdefault(badge, [a, b]); news[badge][1] = b
badges = ''.join(f'<div class="badge clip" id="nb{i}" data-start="{a:.3f}" data-duration="{b - a:.3f}" data-track-index="7">{html.escape(t)}</div>' for i, (t, (a, b)) in enumerate(news.items()))
js += [f'tl.fromTo("#nb{i}",{{y:-30,opacity:0}},{{y:0,opacity:1,duration:0.25,ease:"back.out(2)"}},{a:.3f});' for i, (t, (a, b)) in enumerate(news.items())]
locs = ''.join(f'<div class="loc clip" id="loc{i}" data-start="{t:.3f}" data-duration="3.2" data-track-index="7"><span class="pin">📍</span><div><div class="l1">{html.escape(a)}</div><div class="l2">{html.escape(b)}</div></div></div>' for i, (t, a, b) in enumerate(LOCS))
js += [f'tl.fromTo("#loc{i}",{{x:-60,opacity:0}},{{x:0,opacity:1,duration:0.35,ease:"power3.out"}},{t:.3f});tl.to("#loc{i}",{{opacity:0,duration:0.3}},{t + 2.9:.3f});' for i, (t, a, b) in enumerate(LOCS)]
dur_m = (TITLE[1] - TITLE[0]) / len(MONTAGE)
mont = ''.join(f'<img class="clip full kb" id="mt{i}" src="media/villa_{n}.png" data-start="{TITLE[0] + i * dur_m:.3f}" data-duration="{dur_m + 0.05:.3f}" data-track-index="3">' for i, n in enumerate(MONTAGE))
js += [f'tl.fromTo("#mt{i}",{{scale:1.18}},{{scale:1.04,duration:{dur_m + 0.05:.3f},ease:"power2.out"}},{TITLE[0] + i * dur_m:.3f});' for i in range(len(MONTAGE))]
chh0 = st(2) + 0.2; card0 = st(4) - 0.1
page = f'''<!doctype html><html lang="hi"><head><meta charset="UTF-8"><meta name="viewport" content="width=1920, height=1080">
<script src="gsap.min.js"></script><style>
@font-face {{ font-family: PoppinsBlack; src: url(Poppins-Black.ttf); }} @font-face {{ font-family: PoppinsXB; src: url(Poppins-ExtraBold.ttf); }}
@font-face {{ font-family: DevaBold; src: url(NotoSansDevanagari-Bold.ttf); }} @font-face {{ font-family: 'Noto Color Emoji'; src: url(NotoColorEmoji.ttf); }}
* {{ margin:0; padding:0; box-sizing:border-box; }} html, body {{ width:1920px; height:1080px; overflow:hidden; background:#0b0807; }}
#root {{ position:relative; width:1920px; height:1080px; overflow:hidden; font-family: PoppinsXB, DevaBold, 'Noto Color Emoji', sans-serif; color:#fff; }}
.clip {{ position:absolute; }} .full {{ left:0; top:0; width:1920px; height:1080px; object-fit:cover; }}
.cap {{ left:0; width:1920px; bottom:46px; display:flex; justify-content:center; }}
.cap .pill {{ max-width:1500px; text-align:center; padding:8px 30px 14px; border-radius:22px; background:rgba(10,8,7,.62); backdrop-filter: blur(12px); }}
.cap span {{ display:inline-block; margin:0 8px; font-size:50px; font-family: DevaBold, PoppinsXB, sans-serif; text-shadow:0 3px 0 rgba(0,0,0,.5); }}
.src {{ left:40px; top:36px; padding:10px 22px; border-radius:14px; background:rgba(10,10,12,.82); font-size:26px; font-family:PoppinsXB; border:1.5px solid rgba(255,255,255,.2); }} .src b {{ color:#4BE08A; }}
.badge {{ right:40px; top:36px; padding:10px 24px; border-radius:14px; background:#E5522B; font-family:PoppinsBlack; font-size:30px; letter-spacing:2px; box-shadow:0 10px 30px rgba(0,0,0,.4); }}
.loc {{ left:48px; top:48px; display:flex; gap:14px; align-items:center; padding:14px 26px 14px 18px; border-radius:20px; background:rgba(10,8,7,.62); backdrop-filter: blur(14px); border:1.5px solid rgba(255,255,255,.22); }}
.loc .pin {{ font-size:44px; }} .loc .l1 {{ font-family:PoppinsBlack; font-size:38px; letter-spacing:3px; }} .loc .l2 {{ font-size:24px; color:#FFD24A; }}
#tbg {{ left:0; top:0; width:1920px; height:1080px; background:radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 30%, rgba(0,0,0,.65) 100%); }}
#title {{ left:0; width:1920px; top:330px; text-align:center; }}
#title .t1 {{ display:inline-block; font-family:PoppinsBlack; font-size:56px; letter-spacing:10px; padding:8px 28px; background:#fff; color:#111; border-radius:12px; }}
#title .t2 {{ font-family:PoppinsBlack; font-size:190px; line-height:1; color:#FFD24A; -webkit-text-stroke:8px #120b05; paint-order:stroke fill; text-shadow:0 12px 0 #120b05; margin-top:18px; }}
#title .t3 {{ font-family:PoppinsXB; font-size:40px; letter-spacing:6px; margin-top:14px; text-shadow:0 4px 20px rgba(0,0,0,.8); }}
#chh {{ right:70px; top:120px; text-align:center; padding:26px 40px; border-radius:28px; background:linear-gradient(160deg, rgba(255,170,40,.92), rgba(220,80,20,.92)); box-shadow:0 30px 80px rgba(0,0,0,.45); }}
#chh .c1 {{ font-family:DevaBold; font-size:66px; line-height:1.1; }} #chh .c2 {{ font-size:30px; margin-top:6px; }}
#demobg {{ left:0; top:0; width:1920px; height:1080px; background: radial-gradient(ellipse at 50% 40%, #2b1d14 0%, #0d0907 75%); }}
#demo {{ left:593px; top:24px; width:734px; height:1020px; border-radius:22px; box-shadow:0 30px 90px rgba(0,0,0,.7); object-fit:cover; }}
#demotag {{ left:70px; top:300px; width:500px; }} #demotag .d1 {{ font-family:PoppinsBlack; font-size:44px; color:#4BE08A; }} #demotag .d2 {{ font-size:32px; margin-top:12px; line-height:1.35; }}
#speed {{ right:90px; top:330px; padding:12px 24px; border-radius:16px; background:#E5522B; font-size:32px; font-family:PoppinsBlack; }}
#card {{ right:110px; top:110px; width:440px; border-radius:18px; border:8px solid #fff; box-shadow:0 30px 80px rgba(0,0,0,.6); transform:rotate(4deg); }}
#hack {{ right:70px; top:150px; width:640px; padding:30px 36px; border-radius:26px; background:rgba(12,10,9,.88); border:2px solid rgba(255,210,74,.6); box-shadow:0 30px 80px rgba(0,0,0,.5); }}
#hack .h1 {{ font-family:PoppinsBlack; font-size:40px; color:#FFD24A; }} #hack .row {{ font-size:34px; margin-top:12px; font-family: DevaBold, PoppinsXB; }}
#disc {{ left:40px; bottom:150px; padding:8px 18px; border-radius:12px; background:rgba(10,10,12,.78); font-size:22px; color:rgba(255,255,255,.9); }}
#ai {{ right:40px; bottom:150px; padding:8px 18px; border-radius:999px; background:rgba(10,8,7,.6); border:1px solid rgba(255,255,255,.25); font-size:22px; }}
#end {{ left:0; width:1920px; top:210px; text-align:center; }}
#end .e1 {{ font-family:PoppinsBlack; font-size:120px; -webkit-text-stroke:6px #120b05; paint-order:stroke fill; }}
#end .e2 {{ display:inline-block; margin-top:14px; font-family:PoppinsBlack; font-size:64px; padding:10px 34px; border-radius:20px; background:#FF0000; }}
#end .e3 {{ margin-top:20px; font-size:34px; }}
#fade {{ left:0; top:0; width:1920px; height:1080px; background:#000; opacity:0; }}
</style></head><body>
<div id="root" data-composition-id="main" data-start="0" data-duration="{TOT:.3f}" data-width="1920" data-height="1080">
{av}{pages}{mont}
<div id="tbg" class="clip" data-start="{TITLE[0]:.3f}" data-duration="{TITLE[1] - TITLE[0]:.3f}" data-track-index="4"></div>
<div id="title" class="clip" data-start="{TITLE[0]:.3f}" data-duration="{TITLE[1] - TITLE[0]:.3f}" data-track-index="5"><div class="t1">UNFILTERED</div><div class="t2">SUNDAY</div><div class="t3">EP 02 · AI NEWS FROM AVIR'S HOME · 15 NOV 2026</div></div>
<div id="demobg" class="clip" data-start="{DEMO[0]:.3f}" data-duration="{DEMO[1] - DEMO[0]:.3f}" data-track-index="2"></div>
<video id="demo" class="clip" src="media/demo.mp4" muted playsinline data-start="{DEMO[0]:.3f}" data-duration="{DEMO[1] - DEMO[0]:.3f}" data-track-index="3"></video>
<div id="demotag" class="clip" data-start="{DEMO[0] + 0.2:.3f}" data-duration="{DEMO[1] - DEMO[0] - 0.3:.3f}" data-track-index="6"><div class="d1">● REAL RECORDING</div><div class="d2">Free AI on my own computer<br>DreamShaper 8 · CPU<br>prompt → image → card</div></div>
<div id="speed" class="clip" data-start="{DEMO[0] + 0.4:.3f}" data-duration="{DEMO[1] - DEMO[0] - 0.6:.3f}" data-track-index="6">⏩ SPED UP</div>
<div id="chh" class="clip" data-start="{chh0:.3f}" data-duration="{en(2) + 0.3 - chh0:.3f}" data-track-index="6"><div class="c1">छठ पूजा की<br>शुभकामनाएँ 🙏</div><div class="c2">Happy Chhath Puja</div></div>
<img id="card" class="clip" src="media/card.png" data-start="{card0:.3f}" data-duration="{en(4) + 0.9 - card0:.3f}" data-track-index="6">
<div id="hack" class="clip" data-start="{st(14) + 0.1:.3f}" data-duration="{PAGES[-1][2] - st(14) - 0.15:.3f}" data-track-index="7"><div class="h1">AI KAUSHAL HACKATHON 2026</div>
  <div class="row">📝 Registration: 20 Nov तक</div><div class="row">🏁 Finals: 8–9 Dec · IIIT Lucknow</div><div class="row">🏆 Top 5 teams: ₹1 लाख each</div><div class="row">📍 UP residents only</div></div>
<div id="disc" class="clip" data-start="{PAGES[2][1]:.3f}" data-duration="{PAGES[3][2] - PAGES[2][1]:.3f}" data-track-index="8">Disclosure: this channel is made with help from Claude (Anthropic)</div>
<div id="ai" class="clip" data-start="0.3" data-duration="7.5" data-track-index="8">🤖 Avir is an AI-generated virtual creator · virtual home</div>
<div id="end" class="clip" data-start="{END0:.3f}" data-duration="{TOT - END0:.3f}" data-track-index="7"><div class="e1">Comment: TOUR 🏡</div><div class="e2">SUBSCRIBE · UNFILTERED AVIR</div><div class="e3">Real experiments. Unfiltered results. · Instagram @unfiltered.avir</div></div>
{locs}{badges}{''.join(cap_html)}
<div id="fade" class="clip" data-start="{TOT - 0.6:.3f}" data-duration="0.6" data-track-index="10"></div>
</div><script>
window.__timelines = window.__timelines || {{}}; const tl = gsap.timeline({{ paused: true }});
tl.fromTo("#title .t1",{{y:-60,opacity:0}},{{y:0,opacity:1,duration:0.3}},{TITLE[0] + 0.1:.3f});
tl.fromTo("#title .t2",{{scale:2.4,opacity:0}},{{scale:1,opacity:1,duration:0.4,ease:"back.out(1.8)"}},{TITLE[0] + 0.25:.3f});
tl.fromTo("#title .t3",{{opacity:0}},{{opacity:1,duration:0.4}},{TITLE[0] + 0.7:.3f});
tl.fromTo("#chh",{{x:120,opacity:0,rotate:6}},{{x:0,opacity:1,rotate:0,duration:0.45,ease:"back.out(1.6)"}},{chh0:.3f});
tl.fromTo("#demo",{{y:60,opacity:0}},{{y:0,opacity:1,duration:0.35}},{DEMO[0]:.3f});
tl.fromTo("#card",{{scale:0.4,opacity:0,rotate:-12}},{{scale:1,opacity:1,rotate:4,duration:0.5,ease:"back.out(1.7)"}},{card0:.3f});
tl.fromTo("#hack",{{x:80,opacity:0}},{{x:0,opacity:1,duration:0.35,ease:"power3.out"}},{st(14) + 0.1:.3f});
tl.fromTo("#end .e1",{{scale:1.6,opacity:0}},{{scale:1,opacity:1,duration:0.35,ease:"back.out(2)"}},{END0:.3f});
tl.fromTo("#end .e2",{{y:40,opacity:0}},{{y:0,opacity:1,duration:0.3}},{END0 + 0.2:.3f});
tl.fromTo("#end .e3",{{opacity:0}},{{opacity:1,duration:0.3}},{END0 + 0.45:.3f});
tl.to("#fade",{{opacity:1,duration:0.6}},{TOT - 0.6:.3f});
{chr(10).join(js)}
tl.set({{}}, {{}}, {TOT:.3f}); window.__timelines["main"] = tl; tl.seek(0);
</script></body></html>'''
(HF / 'index.html').write_text(page)
ev = {'cuts': [a for _, a, _ in AV] + [p[1] for p in PAGES] + [TITLE[0], DEMO[0]], 'title': list(TITLE), 'demo': list(DEMO), 'pages': [[p[1], p[2]] for p in PAGES],
      'chime': [chh0, card0], 'end': END0}
json.dump({'total': TOT, 'ev': ev, 'av': AV}, open(HF / 'edit.json', 'w'), indent=1)
print('ok', round(TOT, 2), 'caption groups', k, 'avir seconds', round(sum(b - a for _, a, b in AV), 1))
