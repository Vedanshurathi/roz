#!/usr/bin/env python3
"""Reel 3 ("₹500 का AD") audio — all music and SFX synthesized here (no third-party audio), plus the voice mix.
  python3 reel3_audio.py <edit.json> <out.wav>
edit.json: {"total", "lines": [{start, dur}], "voices": [[wav, t0, gain, (fade_out_at_s)]], "ev": {...edit event times}}
Music: playful bazaar groove (110 bpm, D major pentatonic plucks + tabla-like bols + shaker), dropped to a pad under the
math/disclaimer, brighter under the DEMO AD. SFX: whooshes on scene changes, typing clicks, a soft riser while the
model generates, a chime on reveals, a rimshot after the visiting-card joke, a coin ding on ₹5,000. Final: voice EQ /
compression, music ducked under speech, loudness -14 LUFS, true peak -1.5 dB."""
import json, subprocess, sys
import numpy as np, soundfile as sf

E = json.load(open(sys.argv[1])); OUT = sys.argv[2]; sr = 48000; tot = E['total']; N = int(tot * sr); ev = E['ev']
rng = np.random.default_rng(11)
f = lambda m: 440 * 2 ** ((m - 69) / 12)


def load(p):
    x, s = sf.read(p)
    if x.ndim > 1: x = x.mean(1)
    return np.interp(np.arange(int(len(x) * sr / s)) / sr, np.arange(len(x)) / s, x) if s != sr else x


def env(n, a=0.005, r=0.3):
    e = np.ones(n); na = max(1, int(a * sr)); e[:na] = np.linspace(0, 1, na); return e * np.exp(-np.arange(n) / sr / r)


def add(buf, t0, sig, g=1.0):
    i = int(t0 * sr)
    if i < 0: sig = sig[-i:]; i = 0
    j = min(len(buf), i + len(sig))
    if i < len(buf): buf[i:j] += sig[:j - i] * g


def pluck(m, d=0.5, bright=1.0):
    n = int(d * sr); t = np.arange(n) / sr
    w = sum(np.sin(2 * np.pi * f(m) * h * t) * (bright / h ** 1.6) for h in range(1, 6)); return w * env(n, 0.002, d * 0.35)


def tabla(kind):
    n = int(0.3 * sr); t = np.arange(n) / sr
    if kind == 'dha':   # low bayan + ring
        return (np.sin(2 * np.pi * (85 + 70 * np.exp(-t * 18)) * t) * env(n, 0.001, 0.16) + 0.5 * np.sin(2 * np.pi * 520 * t) * env(n, 0.001, 0.07))
    if kind == 'na':    # dayan ring
        return np.sin(2 * np.pi * 560 * t) * env(n, 0.001, 0.09) + 0.3 * np.sin(2 * np.pi * 1120 * t) * env(n, 0.001, 0.04)
    return rng.normal(size=n) * env(n, 0.001, 0.02) * 0.5   # 'ti' tap


mus = np.zeros(N); fx = np.zeros(N)
BPM = 110; beat = 60 / BPM; bar = 4 * beat
SCALE = [62, 64, 66, 69, 71, 74, 76, 78, 81]      # D major pentatonic
CH = ([50, 57, 62, 66], [47, 54, 59, 62], [43, 50, 55, 59], [45, 52, 57, 61])   # D Bm G A


def groove(t0, t1, gain, mode='full'):
    b = 0
    while t0 + b * bar < t1:
        tb = t0 + b * bar; ch = CH[b % 4]; n = int(bar * sr); tt = np.arange(n) / sr
        pad = sum(np.sin(2 * np.pi * f(m) * tt) + 0.2 * np.sin(4 * np.pi * f(m) * tt) for m in ch) / 4
        add(mus, tb, pad * np.minimum(1, tt / 0.2) * np.minimum(1, (bar - tt) / 0.2), gain * (0.22 if mode != 'pad' else 0.3))
        if mode != 'pad':
            add(mus, tb, pluck(ch[0] - 12, 0.6, 0.6), gain * 0.5); add(mus, tb + 2 * beat, pluck(ch[0] - 12, 0.6, 0.6), gain * 0.45)
            for k, kind in enumerate(['dha', 'ti', 'na', 'ti', 'dha', 'dha', 'na', 'ti']):
                add(mus, tb + k * beat / 2, tabla(kind), gain * (0.55 if kind == 'dha' else 0.4))
            for k in range(8):   # shaker
                s = rng.normal(size=int(0.05 * sr)) * env(int(0.05 * sr), 0.004, 0.015); add(mus, tb + k * beat / 2 + beat / 4, np.diff(s, prepend=0), gain * 0.12)
            if mode == 'bright' or b % 2 == 1:   # melody hook (sparse, stays out of the voice's way)
                mel = [4, 5, 4, 3, 2, 3, 2, 0] if b % 4 < 2 else [2, 3, 4, 6, 5, 4, 3, 2]
                for k, idx in enumerate(mel):
                    if mode == 'bright' or k % 2 == 0: add(mus, tb + k * beat / 2, pluck(SCALE[idx], 0.35, 1.3), gain * 0.22)
        b += 1


def whoosh(at, g=0.3):
    n = int(0.35 * sr); w = np.convolve(rng.normal(size=n), np.ones(30) / 30, 'same') * np.sin(np.pi * np.arange(n) / n) ** 2; add(fx, at - 0.15, w, g)


def click(at, g=0.18):
    n = int(0.03 * sr); add(fx, at, rng.normal(size=n) * np.exp(-np.arange(n) / sr / 0.004), g)


def typing(t0, dur, cps=18):
    k = 0.0
    while k < dur: click(t0 + k, 0.12); k += 1 / cps * (0.7 + 0.6 * rng.random())


def chime(at, g=0.11):
    for i, m in enumerate((81, 86, 90, 93)):
        n = int(0.9 * sr); tt = np.arange(n) / sr; add(fx, at + i * 0.06, np.sin(2 * np.pi * f(m) * tt) * np.exp(-tt * 4.5), g)


def rimshot(at):   # ba-dum-tss
    for k, (fr, d) in enumerate(((120, 0.18), (95, 0.22))):
        n = int(d * sr); tt = np.arange(n) / sr; add(fx, at + k * 0.16, np.sin(2 * np.pi * (fr + 60 * np.exp(-tt * 30)) * tt) * env(n, 0.001, 0.1), 0.35)
    n = int(0.6 * sr); tt = np.arange(n) / sr; cym = np.diff(rng.normal(size=n), prepend=0) * env(n, 0.001, 0.22)
    add(fx, at + 0.38, cym, 0.16)


def riser(t0, t1, g=0.12):
    n = int((t1 - t0) * sr); tt = np.arange(n) / sr; x = tt / tt[-1]
    s = np.sin(2 * np.pi * np.cumsum(220 + 500 * x ** 2) / sr) * x ** 1.5 + 0.4 * np.convolve(rng.normal(size=n), np.ones(12) / 12, 'same') * x ** 2
    add(fx, t0, s * np.minimum(1, (tt[-1] - tt) / 0.08), g)


def coin(at):
    for i, m in enumerate((88, 95)):
        n = int(0.5 * sr); tt = np.arange(n) / sr; add(fx, at + i * 0.08, (np.sin(2 * np.pi * f(m) * tt) + 0.4 * np.sin(2 * np.pi * f(m) * 2.76 * tt)) * np.exp(-tt * 7), 0.16)


# ---- music plan ----
groove(0.0, ev['demo_ad'][0], 0.55)                    # bazaar groove from the top through the demo
groove(ev['demo_ad'][0], ev['demo_ad'][1], 0.75, 'bright')   # the ad itself: brighter, a jingle
groove(ev['demo_ad'][1], ev['math'][1], 0.45, 'pad')  # calm under the maths + disclaimer
groove(ev['math'][1], tot, 0.55)
n = len(mus); t = np.arange(n) / sr
mus *= np.minimum(1, t / 0.4) * np.minimum(1, (tot - t) / 1.2)
# ---- SFX ----
for at in ev.get('whoosh', []): whoosh(at)
for t0, d in ev.get('typing', []): typing(t0, d)
for at in ev.get('click', []): click(at, 0.3)
for at in ev.get('chime', []): chime(at)
for at in ev.get('rimshot', []): rimshot(at)
for t0, t1 in ev.get('riser', []): riser(t0, t1)
for at in ev.get('coin', []): coin(at)
sf.write(OUT.replace('.wav', '_music.wav'), mus, sr); sf.write(OUT.replace('.wav', '_sfx.wav'), fx, sr)
# ---- voices (Avir track + shopkeeper + the tool's generated ad voice) ----
vo = np.zeros(N)
for v in E['voices']:
    x = load(v[0]) * v[2]
    if len(v) > 3 and v[3]:
        k = int(v[3] * sr); x = x[:k] * np.minimum(1, (k - np.arange(k)) / (0.12 * sr))
    add(vo, v[1], x)
sf.write(OUT.replace('.wav', '_voice.wav'), vo, sr)
p = OUT.replace('.wav', '')
subprocess.run(f'ffmpeg -loglevel error -y -i {p}_voice.wav -i {p}_music.wav -i {p}_sfx.wav -filter_complex '
               '"[0:a]highpass=f=80,equalizer=f=180:t=q:w=1:g=1.5,equalizer=f=450:t=q:w=1.2:g=-2,equalizer=f=3200:t=q:w=1:g=2.5,'
               'equalizer=f=9000:t=q:w=1:g=1.5,deesser=i=0.3,acompressor=threshold=-22dB:ratio=3.2:attack=4:release=80:makeup=1.5,volume=1.7,asplit=2[v][sc];'
               '[1:a]volume=0.42[m];[m][sc]sidechaincompress=threshold=0.02:ratio=8:attack=15:release=350[md];[2:a]volume=0.9[f];'
               '[v][md][f]amix=inputs=3:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=9[o]" -map "[o]" -ar 48000 -ac 2 ' + OUT, shell=True, check=True)
print('mix ok', OUT, round(tot, 2))
