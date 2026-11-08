#!/usr/bin/env python3
"""Episode data for the Remotion edit: per-word caption timing (from the lip-sync phoneme segments, anchored at each
punctuation pause), per-frame face morphs, and cue times for on-screen graphics.
  python3 prep_ep1.py <ep_dir with ep1_timeline.json + lsNN.json> <out_dir>"""
import ast, json, re, sys
from pathlib import Path

EP, OUT = Path(sys.argv[1]), Path(sys.argv[2]); OUT.mkdir(parents=True, exist_ok=True)
T = json.load(open(EP / "ep1_timeline.json"))
PUNCT = re.compile(r"[?।,—…!.:;]+")
EMOJI = re.compile("[\U0001F300-\U0001FAFF☀-➿️]")


def lit(v):
    return ast.literal_eval(v) if isinstance(v, str) else v


def timed_words(text, spans):
    """Spread the words of `text` over voiced `spans` [(t0, t1)] in proportion to their length (time only runs while voiced)."""
    words = [w for w in text.split() if w.strip()]
    if not words: return []
    total = sum(b - a for a, b in spans) or 1e-3
    lens = [max(1, len(re.sub(r"[^\w]", "", w))) for w in words]; L = sum(lens)

    def at(f):   # voiced fraction -> time
        need = f * total
        for a, b in spans:
            if need <= b - a + 1e-9: return a + need
            need -= b - a
        return spans[-1][1]
    out, acc = [], 0
    for w, n in zip(words, lens):
        t0 = at(acc / L); acc += n; out.append({"w": w, "t0": round(t0, 3), "t1": round(at(acc / L), 3)})
    return out


lines = []
for l in T["lines"]:
    d = json.load(open(EP / f"ls{l['i']:02d}.json"))
    ph, sg = lit(d["phonemes"]), lit(d["segments"])
    groups, cur = [], []
    for p in ph:
        if p == "pause":
            if cur: groups.append(cur); cur = []
        else: cur.append(p)
    if cur: groups.append(cur)
    # voiced spans per pause-group (segments follow the non-pause phonemes in order)
    gspans, k = [], 0
    for g in groups:
        seg = sg[k:k + len(g)]; k += len(g)
        spans = []
        for a, b, _ in seg:
            if spans and a - spans[-1][1] < 0.06: spans[-1][1] = b
            else: spans.append([a, b])
        gspans.append(spans)
    cap = EMOJI.sub("", l["cap"]).replace("  ", " ").strip()
    chunks = [c.strip() for c in re.split(r"(?<=[?।,—…!.:;])\s+", cap) if c.strip()]
    s0 = l["start"]
    if len(chunks) == len(gspans):
        words = sum((timed_words(c, [(s0 + a, s0 + b) for a, b in sp]) for c, sp in zip(chunks, gspans)), [])
    else:
        words = timed_words(cap, [(s0 + a, s0 + b) for sp in gspans for a, b in sp])
    item = {k_: l[k_] for k_ in ("i", "sec", "shot", "start", "dur", "clip") if k_ in l}
    item.update({"news": l.get("news", 0), "lesson": l.get("lesson", 0), "cap": cap, "words": words})
    lines.append(item)

cue = {}
w34 = [w for w in lines[34]["words"] if "CLASSIFIED" in w["w"].upper()]
cue["classified"] = [w["t0"] for w in w34]


def w(i, sub, nth=0, end=False):
    ws = [x for x in lines[i]["words"] if sub.lower() in x["w"].lower()]
    if len(ws) <= nth: return lines[i]["start"]
    return ws[nth]["t1" if end else "t0"]


st = lambda i: lines[i]["start"]
en = lambda i: lines[i]["start"] + lines[i]["dur"]
# B-roll: full-screen screens and memes. Longer than 4 s -> Avir stays on screen in a corner window (pip).
broll = [
    {"kind": "wifi", "t0": w(4, "wifi") - 0.05, "t1": min(en(4) + 0.3, w(4, "wifi") + 1.9)},
    {"kind": "news0", "t0": st(13) - 0.15, "t1": en(14) + 0.2, "ev": [w(13, "line"), w(13, "gif"), w(14, "50%"), w(14, "धीरे")]},
    {"kind": "news1", "t0": st(16) - 0.15, "t1": en(16) + 0.2, "ev": [w(16, "15"), w(16, "30%"), w(16, "paid")]},
    {"kind": "news2", "t0": st(18) - 0.15, "t1": en(18) + 0.2, "ev": [w(18, "bank"), w(18, "read-only"), w(18, "ख़र्चों"), w(18, "america")]},
    {"kind": "news3", "t0": st(20) - 0.15, "t1": en(21) + 0.2, "ev": [w(20, "ug"), w(20, "pg"), w(20, "last"), w(21, "portal"), w(21, "link")]},
    {"kind": "expect", "t0": st(24) - 0.15, "t1": st(25) - 0.12, "ev": [w(24, "office"), w(24, "funding"), w(24, "congrat")]},
    {"kind": "reality", "t0": st(25) - 0.12, "t1": en(25) + 0.2, "ev": [w(25, "रात"), w(25, "bug"), w(25, "सुबह")]},
    {"kind": "v01", "t0": w(29, "version") - 0.05, "t1": min(en(29), w(29, "देखना") + 0.9), "ev": [w(29, "देखना")]},
]
for b_ in broll: b_["pip"] = (b_["t1"] - b_["t0"]) > 4.0
cue["broll"] = broll
json.dump({"fps": T["fps"], "total": T["total"], "lines": lines, "cue": cue}, open(OUT / "data.json", "w"), ensure_ascii=False)
json.dump(T["morph"], open(OUT / "morph.json", "w"), separators=(",", ":"))
print("ok", len(lines), "lines; classified at", cue["classified"])
