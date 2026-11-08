#!/usr/bin/env python3
"""EP001 audio: original music bed (heartbeat hook, festive song intro/outro, lo-fi news, pads for the founder part, suspense
riser for the startup tease), SFX (whooshes on cuts, ticks on cards, stamps on each CLASSIFIED) and the final mix
(voice EQ/compression, music ducked under the voice, loudness -14 LUFS).
  cd <ep_dir> && python3 ep1_audio.py <data.json from prep_ep1.py> <diwali song.wav>"""
import json, numpy as np, soundfile as sf
import sys, subprocess
T = json.load(open('ep1_timeline.json')); CUE = json.load(open(sys.argv[1]))['cue']; L = T['lines']; tot = T['total']; sr = 48000; N = int(tot * sr)
st = [l['start'] for l in L]; rng = np.random.default_rng(4)
def load(p):
    x, s = sf.read(p)
    if x.ndim > 1: x = x.mean(1)
    return np.interp(np.arange(int(len(x) * sr / s)) / sr, np.arange(len(x)) / s, x) if s != sr else x
def env(n, a=0.005, r=0.3):
    e = np.ones(n); na = max(1, int(a * sr)); e[:na] = np.linspace(0, 1, na); return e * np.exp(-np.arange(n) / sr / r)
f = lambda m: 440 * 2 ** ((m - 69) / 12)
mus = np.zeros(N)
def add(buf, t0, sig, g=1.0):
    i = int(t0 * sr); j = min(len(buf), i + len(sig))
    if i < len(buf): buf[i:j] += sig[:j - i] * g
def fade_seg(x, fi=0.8, fo=1.2):
    n = len(x); t = np.arange(n) / sr; return x * np.minimum(1, t / fi) * np.minimum(1, (n / sr - t) / fo)
# hook: low drone + heartbeat pulses
h1 = st[3] - 2.4
t = np.arange(int(h1 * sr)) / sr
add(mus, 0, fade_seg((np.sin(2 * np.pi * 55 * t) * 0.5 + 0.3 * np.sin(2 * np.pi * 82.4 * t)) * (0.5 + 0.5 * np.sin(2 * np.pi * 0.25 * t)) * 0.35, 1.5, 0.5))
for k in np.arange(0.5, h1, 1.0):
    n = int(0.25 * sr); tt = np.arange(n) / sr; add(mus, k, np.sin(2 * np.pi * (45 + 60 * np.exp(-tt * 30)) * tt) * env(n, 0.002, 0.08), 0.5)
# title + intro: festive Diwali song (original, from the Diwali film)
song = load(sys.argv[2])
intro_len = st[12] - h1
seg = np.concatenate([song[int(15 * sr):], song[int(8 * sr):]])[:int(intro_len * sr)]
add(mus, h1, fade_seg(seg, 0.3, 1.5), 0.55)
# lo-fi beat for news (96 bpm, D major)
def lofi(t0, t1, gain, pad_only=False, chords=([62, 66, 69, 73], [59, 62, 66, 69], [55, 59, 62, 66], [57, 61, 64, 67])):
    beat = 60 / 96; bar = 4 * beat; b = 0
    while t0 + b * bar < t1:
        tb = t0 + b * bar; ch = chords[b % 4]; n = int(bar * sr); tt = np.arange(n) / sr
        pad = sum(np.sin(2 * np.pi * f(m) * tt) + 0.25 * np.sin(4 * np.pi * f(m) * tt) for m in ch) / 4 * np.minimum(1, tt / 0.3) * np.minimum(1, (bar - tt) / 0.3)
        add(mus, tb, pad, gain * 0.5)
        if not pad_only:
            for k in range(8):
                m = ch[[0, 2, 1, 3, 2, 0, 3, 1][k]] + 12; n2 = int(0.4 * sr); t2 = np.arange(n2) / sr
                add(mus, tb + k * beat / 2, np.sin(2 * np.pi * f(m) * t2) * env(n2, 0.002, 0.15), gain * 0.25)
            for k in (0, 2):
                n3 = int(0.25 * sr); t3 = np.arange(n3) / sr; add(mus, tb + k * beat, np.sin(2 * np.pi * (50 + 90 * np.exp(-t3 * 30)) * t3) * env(n3, 0.001, 0.12), gain * 0.7)
            for k in range(4):
                hh = rng.normal(size=int(0.04 * sr)) * env(int(0.04 * sr), 0.001, 0.012); add(mus, tb + k * beat + beat / 2, np.diff(hh, prepend=0), gain * 0.25)
                if k in (1, 3):
                    sn = rng.normal(size=int(0.15 * sr)) * env(int(0.15 * sr), 0.001, 0.05); add(mus, tb + k * beat, sn, gain * 0.15)
        b += 1
lofi(st[12] - 1.0, st[22] - 0.6, 0.5)
lofi(st[22] - 0.6, st[32] - 0.8, 0.45, pad_only=True, chords=([57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 65], [52, 55, 59, 64]))
# startup: suspense riser + hits on CLASSIFIED
s0, s1 = st[32] - 0.8, st[37] - 0.3; n = int((s1 - s0) * sr); tt = np.arange(n) / sr
add(mus, s0, fade_seg((np.sin(2 * np.pi * (60 + 40 * tt / tt[-1]) * tt) * 0.4 + 0.2 * rng.normal(size=n) * np.minimum(1, tt / 6)) * 0.35, 1, 0.6))
# outro: festive song again
add(mus, s1, fade_seg(song[int(14 * sr):int(14 * sr) + int((tot - s1) * sr)], 0.6, 2.5), 0.55)
sf.write('music.wav', mus / (np.abs(mus).max() + 1e-9) * 0.8, sr)
# SFX: whoosh on camera cuts, ticks on cards, stamps on classified
fx = np.zeros(N); prev = None
def whoosh(at):
    n = int(0.35 * sr); w = np.convolve(rng.normal(size=n), np.ones(30) / 30, 'same') * np.sin(np.pi * np.arange(n) / n) ** 2; add(fx, at - 0.15, w, 0.35)
def tick(at, fr=1800):
    n = int(0.09 * sr); tt = np.arange(n) / sr; add(fx, at, np.sin(2 * np.pi * fr * tt) * env(n, 0.001, 0.025), 0.18)
def stamp(at):
    n = int(0.4 * sr); tt = np.arange(n) / sr; add(fx, at, (np.sin(2 * np.pi * (70 + 120 * np.exp(-tt * 25)) * tt) + 0.3 * rng.normal(size=n) * np.exp(-tt * 40)) * env(n, 0.001, 0.12), 0.6)
for l in L:
    if prev and l['shot'] != prev: whoosh(l['start'] - 0.2)
    prev = l['shot']
    if l.get('news') or l.get('lesson'): tick(l['start'] + 0.15)
tick(st[3] - 2.2, 1200); whoosh(st[3] - 2.35)
for at in CUE['classified']: stamp(at - 0.05)
sf.write('sfx.wav', fx, sr); print('music+sfx ok', round(tot, 1))
subprocess.run('ffmpeg -loglevel error -y -i voice_track.wav -i music.wav -i sfx.wav -filter_complex "[0:a]aresample=48000,highpass=f=85,equalizer=f=250:t=q:w=1:g=1.5,equalizer=f=3200:t=q:w=1:g=2.5,acompressor=threshold=-20dB:ratio=3:attack=5:release=90,aecho=0.8:0.5:30:0.08,volume=1.8,asplit=2[v][sc];[1:a]volume=0.5[m];[m][sc]sidechaincompress=threshold=0.025:ratio=8:attack=20:release=400[md];[2:a]volume=0.9[f];[v][md][f]amix=inputs=3:normalize=0,loudnorm=I=-14:TP=-2:LRA=10[o]" -map "[o]" -ar 48000 -ac 2 ep1_mix.wav', shell=True, check=True)
print('mix ok')
