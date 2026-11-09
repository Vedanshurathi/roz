#!/usr/bin/env python3
"""Generic episode/short data prep for the Remotion templates: per-word caption timing from the lip-sync phoneme segments
(anchored at punctuation pauses) + per-frame face morphs.
  python3 prep_episode.py <ep_dir with <name>_timeline.json + lsNN.json> <timeline file name> <out_dir>"""

import ast, json, re, sys
from pathlib import Path

EP, OUT = Path(sys.argv[1]), Path(sys.argv[3]); OUT.mkdir(parents=True, exist_ok=True)
T = json.load(open(EP / sys.argv[2]))
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

json.dump({"fps": T["fps"], "total": T["total"], "lines": lines, "cue": {}}, open(OUT / "data.json", "w"), ensure_ascii=False)
json.dump(T["morph"], open(OUT / "morph.json", "w"), separators=(",", ":"))
print("ok", len(lines), "lines; total", T["total"])
