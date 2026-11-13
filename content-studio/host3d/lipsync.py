#!/usr/bin/env python3
"""Phoneme-based lip-sync for Hindi (Devanagari) TTS lines. No external tools.

  python3 lipsync.py "<devanagari text exactly as spoken>" voice.wav out.json [--fps 24] [--start 0.0]

1. Devanagari -> phonemes (Hindi spelling is close to phonetic; inherent schwa is dropped at word ends).
2. Phonemes -> visemes (mouth shapes) -> morph mixes on Avir's ARKit-style morph targets.
3. Timing: phoneme durations (typical relative lengths) are warped onto the voiced parts of the audio, so silences
   in the audio stay silent and every phoneme lands inside speech. Then (v2) a banded DTW pulls the predicted
   mouth-opening curve onto the measured loudness curve, so vowels open on the real syllable peaks and stops close
   on the real dips. Loudness only scales the jaw slightly; it does NOT decide the mouth shape.
4. v2 polish: lips fully close on प/ब/म (jaw forced shut), shapes lead the sound by ~30 ms (as real lips do),
   and the curves are smoothed so the mouth never jitters.  --v1 gives the old behaviour.
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


OPEN = {"a": 0.45, "aa": 1.0, "i": 0.4, "e": 0.55, "o": 0.7, "u": 0.35, "mbp": 0.0, "fv": 0.12, "back": 0.3, "ch": 0.15, "dental": 0.2}
LEAD = 0.03   # seconds the mouth shape leads the sound


def dtw_warp(cum, speech, env_v, band=22):
    """cum: phoneme boundaries in voiced time (s). env_v: loudness (0-1) sampled every 10 ms of voiced time.
    Returns warped boundaries: the monotone time map (within +-band*10 ms) that best fits predicted openness to loudness."""
    n = len(env_v)
    if n < 20 or len(speech) < 4: return cum
    pred = np.zeros(n)
    for i, (vis, _) in enumerate(speech):
        a_, b_ = int(cum[i] * 100), max(int(cum[i] * 100) + 1, int(cum[i + 1] * 100)); pred[a_:min(n, b_)] = OPEN.get(vis, 0.3)
    k = np.ones(5) / 5; pred = np.convolve(pred, k, "same"); meas = np.convolve(np.clip(env_v, 0, 1.2) / 1.2, k, "same")
    pred = (pred - pred.mean()) / (pred.std() + 1e-6); meas = (meas - meas.mean()) / (meas.std() + 1e-6)
    INF = 1e18; D = np.full((n + 1, n + 1), INF); D[0, 0] = 0; bp = np.zeros((n + 1, n + 1), np.int8)
    for i in range(1, n + 1):
        lo, hi = max(1, i - band), min(n, i + band)
        for j in range(lo, hi + 1):
            c = (pred[i - 1] - meas[j - 1]) ** 2 + 0.02 * abs(i - j) / band     # small pull toward the original timing
            opts = (D[i - 1, j - 1], D[i - 1, j] + 0.15, D[i, j - 1] + 0.15); m_ = int(np.argmin(opts)); D[i, j] = c + opts[m_]; bp[i, j] = m_
    i, j = n, n; mp = np.zeros(n + 1)
    cnt = np.zeros(n + 1)
    while i > 0 and j > 0:
        mp[i] += j; cnt[i] += 1; m_ = bp[i, j]
        if m_ == 0: i, j = i - 1, j - 1
        elif m_ == 1: i -= 1
        else: j -= 1
    mp = np.where(cnt > 0, mp / np.maximum(cnt, 1), np.arange(n + 1)); mp = np.maximum.accumulate(mp)
    out = np.interp(np.clip(cum * 100, 0, n), np.arange(n + 1), mp) / 100.0; out[0] = cum[0]; out[-1] = cum[-1]
    return np.maximum.accumulate(out)


def align(ph, wav, fps, v1=False):
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
    if not v1 and voiced.any():
        envn0 = env / (np.percentile(env[voiced], 90) + 1e-9); cum = dtw_warp(cum, speech, envn0[voiced])
    # map voiced-time -> real time
    def real_t(v):
        k = np.searchsorted(vt, v + 1e-9); return min(k, n - 1) * 0.01
    seg = [(real_t(cum[i]), real_t(cum[i + 1]), speech[i][0]) for i in range(len(speech))]
    dur = len(x) / sr; F = int(np.ceil(dur * fps)) + 1
    envn = env / (np.percentile(env[voiced], 90) + 1e-9) if voiced.any() else env
    def shape(t):
        mix = {}; close = 0.0
        for (t0, t1, vis) in seg:            # coarticulation: each viseme ramps in/out over ~45 ms around its span
            if t1 + 0.05 < t or t0 - 0.05 > t: continue
            mid0, mid1 = t0, max(t1, t0 + 0.02)
            wgt = 1.0 if mid0 <= t <= mid1 else max(0.0, 1 - min(abs(t - mid0), abs(t - mid1)) / 0.05)
            for k, v in VIS[vis].items(): mix[k] = max(mix.get(k, 0), v * wgt)
            if vis == "mbp": close = max(close, wgt)
        i = min(n - 1, max(0, int(t / 0.01)))
        speaking = voiced[max(0, i - 3):i + 4].any()
        loud = float(np.clip(envn[i], 0, 1.3)) if speaking else 0.0
        if "jawOpen" in mix: mix["jawOpen"] *= 0.65 + 0.35 * loud
        if not v1 and close > 0:             # bilabials: lips really meet
            for k in ("jawOpen", "mouthFunnel", "mouthStretch"):
                if k in mix: mix[k] *= 1 - 0.92 * close
        if not speaking: mix = {k: v * 0.2 for k, v in mix.items() if k == "mouthPress"}
        return mix
    if v1:
        frames = [{k: round(v, 3) for k, v in shape(f / fps).items() if v > 0.01} for f in range(F)]
        return frames, seg
    # v2: evaluate at 4x the frame rate, lead the sound slightly, smooth (attack fast, release slower), then sample
    SUB = 4; keys = sorted({k for v in VIS.values() for k in v}); T = F * SUB
    cur = np.zeros((T, len(keys)))
    for q in range(T):
        m = shape(q / (fps * SUB) + LEAD)
        for ki, k in enumerate(keys): cur[q, ki] = m.get(k, 0.0)
    sm = np.zeros_like(cur); st = np.zeros(len(keys)); dt = 1.0 / (fps * SUB)
    for q in range(T):
        tau = np.where(cur[q] > st, 0.018, 0.04); st = st + (cur[q] - st) * (1 - np.exp(-dt / tau)); sm[q] = st
    frames = [{k: round(float(sm[f * SUB, ki]), 3) for ki, k in enumerate(keys) if sm[f * SUB, ki] > 0.01} for f in range(F)]
    return frames, seg


if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("text"); ap.add_argument("wav"); ap.add_argument("out")
    ap.add_argument("--fps", type=int, default=24); ap.add_argument("--v1", action="store_true", help="old timing (no DTW / lead / smoothing)")
    a = ap.parse_args()
    ph = phonemes(a.text)
    frames, seg = align(ph, a.wav, a.fps, a.v1)
    json.dump({"fps": a.fps, "text": a.text, "phonemes": [p[0] for p in ph], "segments": seg, "frames": frames},
              open(a.out, "w"), ensure_ascii=False)
    print(len(ph), "phonemes,", len(frames), "frames ->", a.out)
