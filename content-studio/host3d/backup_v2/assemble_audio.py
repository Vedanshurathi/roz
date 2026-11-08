#!/usr/bin/env python3
"""Build the test's soundtrack from timing.json (render_test.py): voice lines at their keyed frames, footsteps at foot
contacts, quiet room tone. usage: assemble_audio.py timing.json voice_dir out.wav"""
import json, sys
import numpy as np, soundfile as sf

tm = json.load(open(sys.argv[1])); V = sys.argv[2]; out = sys.argv[3]
sr = 48000; fps = tm["fps"]; N = int(tm["frames"] / fps * sr) + sr // 2
mix = np.zeros(N); rng = np.random.default_rng(3)
for (shot, start), li in zip(sorted(tm["speech"].items(), key=lambda kv: kv[1]), ("1", "2", "3")):
    x, s = sf.read(f"{V}/l{li}.wav")
    if s != sr:
        x = np.interp(np.arange(int(len(x) * sr / s)) / sr, np.arange(len(x)) / s, x)
    i = int(start / fps * sr); mix[i:i + len(x)] += x[:N - i] * 0.9
for f in tm["steps"]:
    i = int(f / fps * sr); n = int(0.12 * sr); t = np.arange(n) / sr
    thump = np.sin(2 * np.pi * (70 + 40 * np.exp(-t * 40)) * t) * np.exp(-t * 35) * 0.25
    scuff = np.convolve(rng.normal(size=n), np.ones(12) / 12, "same") * np.exp(-t * 60) * 0.08
    mix[i:i + n] += (thump + scuff)[:N - i]
room = np.convolve(rng.normal(size=N), np.ones(400) / 400, "same") * 0.01
mix += room
mix /= max(1e-9, np.abs(mix).max()) * 1.3
sf.write(out, np.stack([mix, mix], 1), sr)
print("audio", out, round(N / sr, 2), "s, steps", len(tm["steps"]))
