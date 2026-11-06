#!/usr/bin/env python3
"""Motion-graphics tech reel from a JSON spec: offline Kokoro voiceover, word-synced captions,
animated scene graphics, music + SFX, -14 LUFS, 1080x1920 H.264. No camera footage needed.

usage: techreel.py spec.json outdir

spec = {
  "tag": "TECH NEWS · 6 NOV",            # small pill at the top
  "voice": "hm_psi", "lang": "hi", "speed": 1.08,
  "music": "music_upbeat_tech.mp3",       # file in ../assets
  "handle": "@vedanshurathi",
  "scenes": [
    {"tts": "Devanagari/Hinglish text spoken",
     "cap": "Roman Hinglish caption words",  # shown word by word, same order as spoken
     "key": ["AI", "OFFLINE"],               # caption words drawn in neon red
     "visual": {"type": "title", ...}}       # see VISUALS below
  ]
}
VISUALS:
  title    {"lines": ["BIG", "TEXT"], "accent": 1, "emoji": "📱", "icon": "wifi_off"}
  cards    {"label": "small header", "items": ["EKA-1", "DHIR 2B"], "subs": ["by X", "by Y"]}
  phone    {"status": "NO INTERNET", "bubble": "text", "badge": "OFFLINE ✓"}
  chips    {"label": "header", "items": [["🧮", "MATHS"], ["</>", "CODING"]]}
  endcard  {"lines": ["AAP KYA", "BANAOGE?"], "cta": "COMMENT KARO 👇"}
"""
import json, math, os, subprocess, sys, wave
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

SK = Path(__file__).resolve().parent.parent
A = SK / "assets"
W, H, FPS = 1080, 1920, 30
BG0, BG1 = np.array([10, 8, 18], np.float32), np.array([34, 14, 60], np.float32)
RED, GOLD, WHITE, INK = (255, 52, 72), (255, 198, 60), (255, 255, 255), (14, 10, 22)
GREY = (175, 168, 195)
_f = {}


def font(name, size):
    k = (name, size)
    if k not in _f:
        p = {"black": A / "Poppins-Black.ttf", "xb": A / "Poppins-ExtraBold.ttf", "anton": A / "Anton-Regular.ttf",
             "deva": "/usr/share/fonts/truetype/noto/NotoSansDevanagari-Bold.ttf"}[name]
        _f[k] = ImageFont.truetype(str(p), size)
    return _f[k]


EMO = ImageFont.truetype("/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf", 109)
_e = {}


def emoji(ch, size):
    k = (ch, size)
    if k not in _e:
        im = Image.new("RGBA", (180, 180)); ImageDraw.Draw(im).text((10, 10), ch, font=EMO, embedded_color=True)
        bb = im.getbbox()
        _e[k] = im.crop(bb).resize((size, size), Image.LANCZOS) if bb else Image.new("RGBA", (size, size))
    return _e[k]


def is_emoji(s):
    return any(ord(c) > 0x2100 for c in s) and not any("ऀ" <= c <= "ॿ" for c in s)


def ease(x): x = min(max(x, 0.0), 1.0); return 1 - (1 - x) ** 3
def back(x):
    x = min(max(x, 0.0), 1.0); c = 1.7; return 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2


def paste(c, im, x, y, a=1.0, sc=1.0):
    if sc != 1.0:
        im = im.resize((max(1, int(im.width * sc)), max(1, int(im.height * sc))), Image.BICUBIC)
    if a < 1.0:
        arr = np.asarray(im).copy(); arr[..., 3] = (arr[..., 3] * max(a, 0)).astype(np.uint8); im = Image.fromarray(arr)
    c.alpha_composite(im, (int(x - im.width / 2), int(y - im.height / 2))) if x - im.width / 2 >= 0 and y - im.height / 2 >= 0 \
        else c.paste(im, (int(x - im.width / 2), int(y - im.height / 2)), im)


def text_img(text, f, fill, stroke=0, sfill=INK, glow=None):
    l, t, r, b = f.getbbox(text, stroke_width=stroke)
    pad = 40 if glow else 6
    im = Image.new("RGBA", (r - l + 2 * pad, b - t + 2 * pad))
    d = ImageDraw.Draw(im); d.text((pad - l, pad - t), text, font=f, fill=fill, stroke_width=stroke, stroke_fill=sfill)
    if glow:
        g = Image.new("RGBA", im.size, tuple(int(c_ * 0.75) for c_ in glow) + (0,)); g.putalpha(im.split()[3].filter(ImageFilter.GaussianBlur(18)).point(lambda v: int(v * 0.85)))
        g.alpha_composite(im); im = g
    return im


def fit(text, name, max_w, start):
    s = start
    while s > 20 and font(name, s).getlength(text) > max_w: s -= 4
    return font(name, s)


# ------------------------------------------------------------------ background
YY, XX = np.mgrid[0:H, 0:W].astype(np.float32)
GRAD = BG0 + (BG1 - BG0) * (YY / H)[..., None]


def background(t):
    img = GRAD.copy()
    for k, (cx, cy, rx, col) in enumerate([(300, 600, 600, (120, 30, 60)), (820, 1300, 650, (60, 30, 140))]):
        cx2 = cx + 60 * math.sin(t * 0.5 + k); cy2 = cy + 40 * math.cos(t * 0.4 + k)
        img += (np.clip(1 - np.sqrt(((XX - cx2) / rx) ** 2 + ((YY - cy2) / rx) ** 2), 0, 1) ** 2)[..., None] * np.array(col)
    grid = ((np.mod(XX + t * 12, 90) < 1.5) | (np.mod(YY + t * 24, 90) < 1.5)).astype(np.float32)[..., None]
    img += grid * 10
    return Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).convert("RGBA")


# ------------------------------------------------------------------ visuals (draw in band y 330..1170)
def wifi_off(size, col=WHITE):
    im = Image.new("RGBA", (size, size)); d = ImageDraw.Draw(im); s = size
    for k, r in enumerate([0.46, 0.33, 0.20]):
        bb = [s / 2 - r * s, s * 0.78 - r * s, s / 2 + r * s, s * 0.78 + r * s]
        d.arc(bb, 225, 315, fill=col, width=int(s * 0.07))
    d.ellipse([s / 2 - s * 0.06, s * 0.72, s / 2 + s * 0.06, s * 0.84], fill=col)
    d.line([(s * 0.15, s * 0.15), (s * 0.85, s * 0.9)], fill=RED, width=int(s * 0.09))
    return im


def v_title(c, v, t, d):
    lines = v["lines"]; acc = v.get("accent", len(lines) - 1)
    y = 760 - 95 * len(lines) + (60 if (v.get("emoji") or v.get("icon")) else 0)
    if v.get("icon") == "wifi_off" or v.get("emoji"):
        p = back(t / 0.45)
        ic = wifi_off(300) if v.get("icon") == "wifi_off" else emoji(v["emoji"], 260)
        paste(c, ic, W / 2, y - 120, a=min(1, t / 0.2), sc=max(0.05, p))
        y += 110
    for k, ln in enumerate(lines):
        t0 = 0.12 * k + 0.15
        if t < t0: continue
        f = fit(ln, "anton", 960, 190)
        im = text_img(ln, f, RED if k == acc else WHITE, stroke=5 if k == acc else 0, sfill=WHITE, glow=RED if k == acc else None)
        paste(c, im, W / 2, y + int(40 * (1 - ease((t - t0) / 0.3))), a=ease((t - t0) / 0.2))
        y += int(f.size * 1.05)


def card(w, h, title, sub, hot):
    im = Image.new("RGBA", (w + 40, h + 40)); d = ImageDraw.Draw(im)
    g = Image.new("L", im.size); ImageDraw.Draw(g).rounded_rectangle([20, 20, 20 + w, 20 + h], 28, fill=255)
    im.paste(Image.new("RGBA", im.size, (RED if hot else (150, 110, 255)) + (255,)), (0, 0), g.filter(ImageFilter.GaussianBlur(14)).point(lambda v: v * 0.5))
    d.rounded_rectangle([20, 20, 20 + w, 20 + h], 28, fill=(20, 14, 34, 245), outline=(RED if hot else (150, 110, 255)) + (255,), width=4)
    f = fit(title, "anton", w - 60, 92); l_, t_, r_, b_ = f.getbbox(title); tw = r_ - l_
    d.text((20 + (w - tw) / 2 - l_, 20 + h * 0.12 - t_), title, font=f, fill=WHITE)
    if sub:
        sf = font("xb", 30); d.text((20 + (w - sf.getlength(sub)) / 2, 20 + h * 0.70), sub, font=sf, fill=GREY)
    return im


def v_cards(c, v, t, d):
    lab = v.get("label")
    if lab:
        im = text_img(lab, font("black", 46), GOLD); paste(c, im, W / 2, 400, a=ease(t / 0.25))
    items, subs = v["items"], v.get("subs", [""] * len(v["items"]))
    n = len(items); cw, ch = 860, 200
    for k, (it, sb) in enumerate(zip(items, subs)):
        t0 = 0.25 + 0.35 * k
        if t < t0: continue
        p = back((t - t0) / 0.4)
        y = 560 + k * 230
        paste(c, card(cw, ch, it, sb, k == v.get("hot", -1)), W / 2 + int(500 * (1 - min(p, 1))), y, a=ease((t - t0) / 0.2))


def v_phone(c, v, t, d):
    pw, ph = 470, 820; x0, y0 = (W - pw) // 2, 330
    p = ease(t / 0.35); yoff = int(80 * (1 - p))
    ph_im = Image.new("RGBA", (pw + 60, ph + 60)); pd = ImageDraw.Draw(ph_im)
    g = Image.new("L", ph_im.size); ImageDraw.Draw(g).rounded_rectangle([30, 30, 30 + pw, 30 + ph], 60, fill=255)
    ph_im.paste(Image.new("RGBA", ph_im.size, (150, 110, 255, 255)), (0, 0), g.filter(ImageFilter.GaussianBlur(22)).point(lambda v_: v_ * 0.55))
    pd.rounded_rectangle([30, 30, 30 + pw, 30 + ph], 60, fill=(16, 12, 26, 255), outline=(90, 80, 120, 255), width=10)
    pd.rounded_rectangle([30 + pw / 2 - 60, 50, 30 + pw / 2 + 60, 74], 12, fill=(5, 5, 8, 255))
    # status bar: no signal
    st = v.get("status", "NO INTERNET"); sf = font("xb", 26)
    pd.rounded_rectangle([60, 100, 60 + sf.getlength(st) + 70, 146], 22, fill=(70, 20, 30, 255))
    ic = wifi_off(40, WHITE); ph_im.alpha_composite(ic, (70, 103))
    pd.text((118, 106), st, font=sf, fill=WHITE)
    # chat: user bubble then AI typing then AI answer
    bub = v.get("bubble", "")
    if t > 0.6:
        bf = font("xb", 30); words = bub.split(); lines, cur = [], ""
        for w_ in words:
            if bf.getlength(cur + " " + w_) > pw - 120: lines.append(cur); cur = w_
            else: cur = (cur + " " + w_).strip()
        lines.append(cur)
        n_chars = int((t - 0.6) * 40); shown = []
        for ln in lines:
            if n_chars <= 0: break
            shown.append(ln[:n_chars]); n_chars -= len(ln)
        bh = 40 * len(lines) + 40
        pd.rounded_rectangle([60, 200, 30 + pw - 30, 200 + bh], 26, fill=(124, 77, 255, 255))
        for k, ln in enumerate(shown): pd.text((84, 218 + 40 * k), ln, font=bf, fill=WHITE)
    if t > 1.6:
        dots = int(t * 3) % 4
        pd.rounded_rectangle([60, 420, 220, 480], 26, fill=(45, 38, 66, 255))
        for k in range(3):
            r = 9 if k < dots else 6
            pd.ellipse([95 + k * 40 - r, 450 - r, 95 + k * 40 + r, 450 + r], fill=WHITE)
    c.alpha_composite(ph_im, (x0 - 30, y0 - 30 + yoff))
    bd = v.get("badge")
    if bd and t > 1.2:
        q = back((t - 1.2) / 0.35)
        bim = Image.new("RGBA", (420, 110)); bdd = ImageDraw.Draw(bim)
        bdd.rounded_rectangle([0, 0, 419, 109], 55, fill=(30, 200, 110, 255))
        f = font("black", 52); bx = (420 - f.getlength(bd) - 60) / 2
        bdd.text((bx, 18), bd, font=f, fill=WHITE)
        cx_ = bx + f.getlength(bd) + 18; bdd.line([(cx_, 56), (cx_ + 14, 72), (cx_ + 40, 38)], fill=WHITE, width=9, joint="curve")
        paste(c, bim.rotate(-6, expand=True, resample=Image.BICUBIC), W / 2 + 200, 1060, sc=max(0.05, q))


def chip(icon, label, w=420, h=150):
    im = Image.new("RGBA", (w, h)); d = ImageDraw.Draw(im)
    d.rounded_rectangle([0, 0, w - 1, h - 1], 36, fill=(24, 18, 40, 240), outline=(150, 110, 255, 255), width=4)
    if is_emoji(icon):
        im.alpha_composite(emoji(icon, 86), (26, (h - 86) // 2))
    else:
        f = fit(icon, "deva" if any("ऀ" <= ch <= "ॿ" for ch in icon) else "black", 100, 70)
        d.text((30, (h - f.size) // 2 - 8), icon, font=f, fill=GOLD)
    lf = fit(label, "black", w - 150, 48); d.text((130, (h - lf.size) // 2 - 4), label, font=lf, fill=WHITE)
    return im


def v_chips(c, v, t, d):
    if v.get("label"):
        paste(c, text_img(v["label"], fit(v["label"], "black", 960, 54), GOLD), W / 2, 420, a=ease(t / 0.25))
    items = v["items"]; n = len(items)
    cols = 2 if n > 3 else 1
    for k, (ic, lb) in enumerate(items):
        t0 = 0.3 + 0.28 * k
        if t < t0: continue
        q = back((t - t0) / 0.35)
        if cols == 2:
            x = W / 2 + (-235 if k % 2 == 0 else 235); y = 600 + (k // 2) * 190
            im = chip(ic, lb, 440, 160)
        else:
            x = W / 2; y = 600 + k * 200; im = chip(ic, lb, 800, 170)
        paste(c, im, x, y, a=ease((t - t0) / 0.15), sc=max(0.05, min(q, 1.08)))


def v_endcard(c, v, t, d):
    y = 560
    for k, ln in enumerate(v["lines"]):
        t0 = 0.1 + 0.12 * k
        if t < t0: continue
        f = fit(ln, "anton", 960, 200)
        paste(c, text_img(ln, f, GOLD if k == len(v["lines"]) - 1 else WHITE), W / 2, y + int(40 * (1 - ease((t - t0) / 0.3))), a=ease((t - t0) / 0.2))
        y += int(f.size * 1.05)
    if v.get("cta") and t > 0.6:
        q = back((t - 0.6) / 0.35); f = font("black", 54); tx = v["cta"]
        im = Image.new("RGBA", (int(f.getlength(tx)) + 90, 110)); dd = ImageDraw.Draw(im)
        dd.rounded_rectangle([0, 0, im.width - 1, 109], 55, fill=RED + (255,))
        dd.text((45, 18), tx, font=f, fill=WHITE)
        if v.get("cta_emoji"):
            paste(c, emoji(v["cta_emoji"], 96), W / 2, y + 230, sc=max(0.05, q))
        paste(c, im, W / 2, y + 90, sc=max(0.05, q))


VIS = {"title": v_title, "cards": v_cards, "phone": v_phone, "chips": v_chips, "endcard": v_endcard}


# ------------------------------------------------------------------ captions
def caption_layer(c, words, t, keys):
    for ch in words:
        if ch["s"] <= t < ch["e"]:
            parts = []
            for w_ in ch["words"]:
                active = w_["s"] <= t
                key = w_["w"].strip(",.?!—").upper() in keys
                if not active: continue
                parts.append((w_["w"].upper(), key, t - w_["s"]))
            if not parts: return
            f = font("black", 74)
            total = sum(f.getlength(p[0] + " ") for p in parts)
            x = (W - total) / 2; y = 1300
            for txt, key, age in parts:
                col = RED if key else (GOLD if age < 0.18 else WHITE)
                im = text_img(txt, f, col, stroke=7)
                sc = 1.15 - 0.15 * ease(age / 0.12)
                paste(c, im, x + f.getlength(txt) / 2, y, sc=sc)
                x += f.getlength(txt + " ")
            return


def chunk(scene_words):
    out, cur = [], []
    for w_ in scene_words:
        if cur and (len(cur) >= 3 or sum(len(x["w"]) + 1 for x in cur) + len(w_["w"]) > 16):
            out.append(cur); cur = []
        cur.append(w_)
        if w_["w"][-1:] in ",.?!": out.append(cur); cur = []
    if cur: out.append(cur)
    res = []
    for k, g in enumerate(out):
        e = out[k + 1][0]["s"] if k + 1 < len(out) else g[-1]["e"] + 0.2
        res.append({"words": g, "s": g[0]["s"], "e": e})
    return res


# ------------------------------------------------------------------ main
def main():
    spec = json.load(open(sys.argv[1], encoding="utf-8")); out = Path(sys.argv[2]); out.mkdir(parents=True, exist_ok=True)
    sys.path.insert(0, str(SK / "scripts"))
    import sherpa_onnx
    kd = Path(os.environ.get("KOKORO_DIR", Path.home() / ".cache/video-tools/kokoro-multi-lang-v1_0"))
    tts = sherpa_onnx.OfflineTts(sherpa_onnx.OfflineTtsConfig(model=sherpa_onnx.OfflineTtsModelConfig(
        kokoro=sherpa_onnx.OfflineTtsKokoroModelConfig(model=str(kd / "model.onnx"), voices=str(kd / "voices.bin"),
            tokens=str(kd / "tokens.txt"), data_dir=str(kd / "espeak-ng-data"), dict_dir=str(kd / "dict"),
            lexicon=f"{kd / 'lexicon-us-en.txt'},{kd / 'lexicon-zh.txt'}", lang=spec.get("lang", "hi")), num_threads=4),
        max_num_sentences=1))
    names = ("af_alloy,af_aoede,af_bella,af_heart,af_jessica,af_kore,af_nicole,af_nova,af_river,af_sarah,af_sky,am_adam,am_echo,"
             "am_eric,am_fenrir,am_liam,am_michael,am_onyx,am_puck,am_santa,bf_alice,bf_emma,bf_isabella,bf_lily,bm_daniel,bm_fable,"
             "bm_george,bm_lewis,ef_dora,em_alex,ff_siwis,hf_alpha,hf_beta,hm_omega,hm_psi").split(",")
    sid = names.index(spec.get("voice", "hm_psi"))
    GAP = 0.28
    pcm, t, scenes = [], 0.0, []
    for k, sc in enumerate(spec["scenes"]):
        a = tts.generate(sc["tts"], sid=sid, speed=spec.get("speed", 1.08)); sr = a.sample_rate
        x = np.array(a.samples, np.float32)
        nz = np.where(np.abs(x) > 0.01)[0]                          # trim TTS silence
        x = x[max(0, nz[0] - int(0.03 * sr)): nz[-1] + int(0.06 * sr)] if len(nz) else x
        dur = len(x) / sr
        pcm.append(x); pcm.append(np.zeros(int(GAP * sr), np.float32))
        wds = sc["cap"].split(); wt = np.array([len(w_) + 2 for w_ in wds], float); cum = np.concatenate([[0], np.cumsum(wt)]) / wt.sum()
        words = [{"w": w_, "s": t + 0.04 + cum[i] * (dur - 0.08), "e": t + 0.04 + cum[i + 1] * (dur - 0.08)} for i, w_ in enumerate(wds)]
        scenes.append({**sc, "t0": t, "t1": t + dur + GAP, "chunks": chunk(words), "keys": {k_.upper() for k_ in sc.get("key", [])}})
        t += dur + GAP
    HOLD = 1.2
    total = t + HOLD
    voice = np.concatenate(pcm)
    with wave.open(str(out / "voice_raw.wav"), "wb") as w_:
        w_.setnchannels(1); w_.setsampwidth(2); w_.setframerate(sr); w_.writeframes((np.clip(voice, -1, 1) * 32767).astype(np.int16).tobytes())
    print(f"voice {t:.2f}s, total {total:.2f}s", flush=True)

    # ---------------- frames
    enc = subprocess.Popen(["ffmpeg", "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                            "-c:v", "libx264", "-crf", "16", "-preset", "fast", "-pix_fmt", "yuv420p", str(out / "video.mp4")], stdin=subprocess.PIPE)
    n = int(round(total * FPS))
    for i in range(n):
        tt = i / FPS
        c = background(tt); d = ImageDraw.Draw(c)
        sc = [s for s in scenes if s["t0"] <= tt] or scenes[:1]; sc = sc[-1]
        lt = tt - sc["t0"]
        # scene layer with exit fade
        layer = Image.new("RGBA", (W, H))
        VIS[sc["visual"]["type"]](layer, sc["visual"], lt, ImageDraw.Draw(layer))
        ex = 1.0 if sc is scenes[-1] else ease((sc["t1"] - tt) / 0.18)
        if ex < 1:
            arr = np.asarray(layer).copy(); arr[..., 3] = (arr[..., 3] * ex).astype(np.uint8); layer = Image.fromarray(arr)
        c.alpha_composite(layer)
        caption_layer(c, sc["chunks"], tt, sc["keys"])
        # top pill + progress bar + handle
        tag = spec.get("tag", "TECH NEWS"); tf = font("black", 32)
        d.rounded_rectangle([(W - tf.getlength(tag)) / 2 - 30, 230, (W + tf.getlength(tag)) / 2 + 30, 286], 28, fill=RED)
        d.text(((W - tf.getlength(tag)) / 2, 236), tag, font=tf, fill=WHITE)
        d.rectangle([0, 0, int(W * min(tt / t, 1)), 10], fill=GOLD)
        hf = font("xb", 30); hd = spec.get("handle", "@vedanshurathi")
        d.text(((W - hf.getlength(hd)) / 2, 1560), hd, font=hf, fill=(200, 195, 215))
        enc.stdin.write(np.asarray(c.convert("RGB")).tobytes())
        if i % 150 == 0: print(f"frame {i}/{n}", flush=True)
    enc.stdin.close(); enc.wait()

    # ---------------- audio: clean voice + music ducked + SFX at scene changes
    def ff(*a): subprocess.run(["ffmpeg", "-y", "-v", "error", *map(str, a)], check=True)
    S = "aformat=channel_layouts=stereo,aresample=48000"
    ff("-f", "lavfi", "-i", "anoisesrc=d=0.4:c=pink:a=0.5", "-af", f"highpass=f=300,lowpass=f=6000,afade=t=in:d=0.25:curve=exp,afade=t=out:st=0.25:d=0.15,volume=0.45,{S}", out / "whoosh.wav")
    ff("-f", "lavfi", "-i", "sine=f=1100:d=0.09", "-af", f"afade=t=out:st=0:d=0.09:curve=exp,volume=0.3,{S}", out / "pop.wav")
    cues = [("whoosh", s["t0"] - 0.15) for s in scenes[1:]] + [("pop", s["t0"] + 0.3) for s in scenes]
    ins, fl = [], []
    for k, (f_, at) in enumerate(cues):
        ins += ["-i", out / f"{f_}.wav"]; fl.append(f"[{k}]adelay={int(max(0, at) * 1000)}:all=1[c{k}]")
    fl.append("".join(f"[c{k}]" for k in range(len(cues))) + f"amix=inputs={len(cues)}:normalize=0,apad,atrim=0:{total:.3f}[s]")
    ff(*ins, "-filter_complex", ";".join(fl), "-map", "[s]", out / "sfx.wav")
    music = A / spec.get("music", "music_upbeat_tech.mp3")
    ff("-i", out / "voice_raw.wav", "-af", f"highpass=f=80,acompressor=threshold=-20dB:ratio=2.5:attack=5:release=100,loudnorm=I=-15:TP=-2,{S}", out / "voice.wav")
    ff("-stream_loop", "-1", "-i", music, "-i", out / "voice.wav", "-i", out / "sfx.wav", "-filter_complex",
       f"[0]atrim=0:{total:.3f},asetpts=PTS-STARTPTS,loudnorm=I=-20,volume=0.6,afade=t=in:d=0.5,afade=t=out:st={total - 1.2:.2f}:d=1.2,{S}[m];"
       f"[1]apad,atrim=0:{total:.3f},{S},asplit=2[v][vk];[m][vk]sidechaincompress=threshold=0.04:ratio=7:attack=12:release=280[md];"
       f"[v][md][2]amix=inputs=3:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=9,aresample=48000[a]", "-map", "[a]", out / "mix.wav")
    ff("-i", out / "video.mp4", "-i", out / "mix.wav", "-map", "0:v", "-map", "1:a", "-c:v", "libx264", "-preset", "slow", "-crf", "18",
       "-maxrate", "10M", "-bufsize", "10M", "-profile:v", "high", "-g", "60", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "256k", "-ar", "48000",
       "-shortest", "-movflags", "+faststart", out / "reel.mp4")
    json.dump([{"id": k, "t0": s["t0"], "t1": s["t1"]} for k, s in enumerate(scenes)], open(out / "timeline.json", "w"), indent=1)
    print("done", out / "reel.mp4")


if __name__ == "__main__":
    main()
