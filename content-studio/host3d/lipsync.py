#!/usr/bin/env python3
"""Phoneme-based lip-sync for Hindi (Devanagari) TTS lines. No external tools.

  python3 lipsync.py "<devanagari text exactly as spoken>" voice.wav out.json [--fps 24] [--start 0.0]

1. Devanagari -> phonemes (Hindi spelling is close to phonetic; inherent schwa is dropped at word ends).
2. Phonemes -> visemes (mouth shapes) -> morph mixes on Avir's ARKit-style morph targets.
3. Timing: phoneme durations (typical relative lengths) are warped onto the voiced parts of the audio, so silences
   in the audio stay silent and every phoneme lands inside speech. Loudness only scales the jaw slightly; it does
   NOT decide the mouth shape.
Output: {"fps", "frames": [{morph: value, ...}, ...]}, frame 0 = --start seconds.
"""
import argparse, json
import numpy as np
import soundfile as sf

VOWELS = {"अ": "a", "आ": "aa", "इ": "i", "ई": "ii", "उ": "u", "ऊ": "uu", "ए": "e", "ऐ": "ai", "ओ": "o", "औ": "au", "ऑ": "oh", "ऋ": "ri"}
MATRAS = {"ा": "aa", "ि": "i", "ी": "ii", "ु": "u", "ू": "uu", "े": "e", "ै": "ai", "ो": "o", "ौ": "au", "ॉ": "oh", "ृ": "ri"}
CONS = {}
for ch, cls in (("पफबभम", "mbp"), ("व", "fv"), ("कखगघङह", "back"), ("चछजझशषसय", "ch"),
                ("टठडढतथदधनणलर", "dental")):
    for c in ch: CONS[c] = cls
NUKTA, VIRAMA = "़", "्"
NASAL = {"ं", "ँ"}
PUNCT = set(",.!?।…—-")

VIS = {  # viseme -> morph mix (Avir's morph target names, checked in host.glb)
    "a": {"jawOpen": 0.30},
    "aa": {"jawOpen": 0.55, "mouthStretch": 0.05},
    "i": {"jawOpen": 0.18, "mouthStretch": 0.45, "mouthSmileLeft": 0.12, "mouthSmileRight": 0.12},
    "e": {"jawOpen": 0.25, "mouthStretch": 0.4},
    "o": {"jawOpen": 0.35, "mouthFunnel": 0.5, "mouthPucker": 0.15},
    "u": {"jawOpen": 0.12, "mouthPucker": 0.75, "mouthFunnel": 0.2},
    "mbp": {"mouthPress": 0.85},
    "fv": {"jawOpen": 0.08, "mouthShrugLower": 0.6, "mouthUpperUp": 0.1},
    "back": {"jawOpen": 0.25},
    "ch": {"jawOpen": 0.12, "mouthFunnel": 0.35, "mouthStretch": 0.2},
    "dental": {"jawOpen": 0.15, "mouthStretch": 0.2},
    "rest": {},
}
VOWEL_VIS = {"a": "a", "aa": "aa", "i": "i", "ii": "i", "u": "u", "uu": "u", "e": "e", "ai": "e", "o": "o", "au": "o", "oh": "o", "ri": "i"}
DUR = {"a": 0.7, "aa": 1.2, "i": 0.8, "ii": 1.1, "u": 0.8, "uu": 1.1, "e": 1.0, "ai": 1.1, "o": 1.0, "au": 1.1, "oh": 1.0, "ri": 0.9}


def phonemes(text):
    """returns list of (viseme, relative duration); 'pause' entries for punctuation"""
    out = []
    for word in text.replace("।", " । ").split():
        if all(c in PUNCT for c in word):
            out.append(("pause", 1.0)); continue
        chars = [c for c in word if c != NUKTA]
        i = 0
        while i < len(chars):
            c = chars[i]
            if c in VOWELS:
                v = VOWELS[c]; out.append((VOWEL_VIS[v], DUR[v])); i += 1
            elif c in CONS:
                cls = "fv" if (c == "फ" and NUKTA in word) else CONS[c]
                out.append((cls, 0.55))
                nxt = chars[i + 1] if i + 1 < len(chars) else None
                if nxt in MATRAS:
                    v = MATRAS[nxt]; out.append((VOWEL_VIS[v], DUR[v])); i += 2
                elif nxt == VIRAMA:
                    i += 2
                else:
                    word_end = nxt is None or nxt in PUNCT
                    if not word_end and nxt not in NASAL:
                        out.append(("a", DUR["a"]))
                    i += 1
            elif c in NASAL:
                out.append(("mbp" if (i + 1 < len(chars) and CONS.get(chars[i + 1]) == "mbp") else "dental", 0.35)); i += 1
            elif c in PUNCT:
                out.append(("pause", 1.0)); i += 1
            else:
                i += 1
    return out


def align(ph, wav, fps):
    x, sr = sf.read(wav)
    if x.ndim > 1: x = x.mean(axis=1)
    hop = int(sr * 0.01); n = len(x) // hop
    env = np.array([np.sqrt(np.mean(x[i * hop:(i + 1) * hop] ** 2)) for i in range(n)])
    thr = max(np.percentile(env, 20) * 3, env.max() * 0.04)
    voiced = env > thr
    # close tiny gaps (<60 ms) inside words; keep real pauses
    gap = 0
    for i in range(n):
        if not voiced[i]: gap += 1
        else:
            if 0 < gap < 6: voiced[i - gap:i] = True
            gap = 0
    vt = np.cumsum(voiced) * 0.01                  # cumulative voiced time
    speech = [p for p in ph if p[0] != "pause"]
    w = np.array([d for _, d in speech]); cum = np.concatenate([[0], np.cumsum(w)]) / w.sum() * vt[-1]
    # map voiced-time -> real time
    def real_t(v):
        k = np.searchsorted(vt, v + 1e-9); return min(k, n - 1) * 0.01
    seg = [(real_t(cum[i]), real_t(cum[i + 1]), speech[i][0]) for i in range(len(speech))]
    dur = len(x) / sr; F = int(np.ceil(dur * fps)) + 1
    envn = env / (np.percentile(env[voiced], 90) + 1e-9) if voiced.any() else env
    frames = []
    for f in range(F):
        t = f / fps; mix = {}
        for (t0, t1, vis) in seg:            # coarticulation: each viseme ramps in/out over ~45 ms around its span
            if t1 + 0.05 < t or t0 - 0.05 > t: continue
            mid0, mid1 = t0, max(t1, t0 + 0.02)
            wgt = 1.0 if mid0 <= t <= mid1 else max(0.0, 1 - min(abs(t - mid0), abs(t - mid1)) / 0.05)
            for k, v in VIS[vis].items(): mix[k] = max(mix.get(k, 0), v * wgt)
        i = min(n - 1, int(t / 0.01))
        speaking = voiced[max(0, i - 3):i + 4].any()
        loud = float(np.clip(envn[i], 0, 1.3)) if speaking else 0.0
        if "jawOpen" in mix: mix["jawOpen"] *= 0.65 + 0.35 * loud
        if not speaking: mix = {k: v * 0.2 for k, v in mix.items() if k == "mouthPress"}
        frames.append({k: round(v, 3) for k, v in mix.items() if v > 0.01})
    return frames, seg


if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("text"); ap.add_argument("wav"); ap.add_argument("out")
    ap.add_argument("--fps", type=int, default=24)
    a = ap.parse_args()
    ph = phonemes(a.text)
    frames, seg = align(ph, a.wav, a.fps)
    json.dump({"fps": a.fps, "text": a.text, "phonemes": [p[0] for p in ph], "segments": seg, "frames": frames},
              open(a.out, "w"), ensure_ascii=False)
    print(len(ph), "phonemes,", len(frames), "frames ->", a.out)
