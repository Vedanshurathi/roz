#!/usr/bin/env python3
"""Episode voice + lip-sync timeline from a script (the EP001 steps, made repeatable).

  KOKORO_DIR=... python3 build_timeline.py <ep_dir>      # reads <ep_dir>/script.json, writes into <ep_dir>

script.json: list of lines
  {"sec": "news", "shot": "medium", "clip": "SitTalkBoth",
   "tts": "देवनागरी text as spoken",          # or "parts": [["Real experiments.", "en-us"], ["यही वादा है।", "hi"]]
   "cap": "caption text (Hinglish, same words in the same order)",
   "speed": 1.0,          # optional per-line pace (Kokoro speed; default 1.0) — vary for energy
   "pause_before": 0.0,   # optional extra pause before this line (title card / chapter change)
   "gap": 0.42}           # optional pause after this line
Writes: lNN.wav, lsNN.json (lip-sync), voice_track.wav, <name>_timeline.json with per-frame ARKit morphs.
Then run prep_ep1.py-style data prep and the audio mix for the edit.
"""
import json, subprocess, sys
from pathlib import Path
import numpy as np
import soundfile as sf

EP = Path(sys.argv[1]); HERE = Path(__file__).resolve().parent
TTS = HERE.parent.parent / ".claude/skills/video-editor/scripts/tts.py"
VOICE = "hm_psi"          # Avir's voice — keep consistent across videos
FPS, SR = 24, 24000
# lipsync.py viseme names -> Avir's ARKit morph targets (tuned on EP001)
MAP = {"jawOpen": [("jawOpen", 0.85)], "mouthStretch": [("mouthStretchLeft", 0.6), ("mouthStretchRight", 0.6)],
       "mouthPress": [("mouthPressLeft", 0.7), ("mouthPressRight", 0.7), ("mouthClose", 0.25)], "mouthPucker": [("mouthPucker", 0.8)],
       "mouthFunnel": [("mouthFunnel", 0.7)], "mouthShrugLower": [("mouthShrugLower", 0.6)],
       "mouthUpperUp": [("mouthUpperUpLeft", 0.5), ("mouthUpperUpRight", 0.5)],
       "mouthSmileLeft": [("mouthSmileLeft", 0.7)], "mouthSmileRight": [("mouthSmileRight", 0.7)]}
EN_SPOKEN = {"Real experiments. Unfiltered results.": "रियल एक्सपेरिमेंट्स, अनफ़िल्टर्ड रिज़ल्ट्स।"}  # for lip shapes only


def tts(text, out, lang="hi", speed=1.0):
    subprocess.run(["python3", str(TTS), text, str(out), "--voice", VOICE, "--lang", lang, "--speed", f"{speed:.3f}"], check=True, capture_output=True)
    x, s = sf.read(out); assert s == SR, s
    nz = np.where(np.abs(x) > 0.01)[0]                       # trim silence at both ends
    x = x[max(0, nz[0] - int(0.03 * SR)): nz[-1] + int(0.06 * SR)]; sf.write(out, x, SR); return x


L = json.load(open(EP / "script.json"))
import os
t, lines, voice = float(os.environ.get('LEAD', '1.0')), [], []   # LEAD: silence before the first line (Shorts: ~0.3 s)
for i, l in enumerate(L):
    t += l.get("pause_before", 0.0)
    wav = EP / f"l{i:02d}.wav"; sp = l.get("speed", 1.0)
    if "parts" in l:
        xs = [tts(txt, EP / f"l{i:02d}_{k}.wav", lang, sp if lang == "hi" else 0.95) for k, (txt, lang) in enumerate(l["parts"])]
        x = np.concatenate(sum([[a, np.zeros(int(0.2 * SR))] for a in xs], [])[:-1]); sf.write(wav, x, SR)
        spoken = " ".join(EN_SPOKEN.get(txt, txt) for txt, _ in l["parts"])
    else:
        x = tts(l["tts"], wav, "hi", sp); spoken = l["tts"]
    subprocess.run(["python3", str(HERE / "lipsync.py"), spoken, str(wav), str(EP / f"ls{i:02d}.json"), "--fps", str(FPS)], check=True, capture_output=True)
    lines.append({**l, "i": i, "tts": spoken, "start": round(t, 3), "dur": round(len(x) / SR, 3), "clip": l.get("clip", "SitTalkRight"), "lips": f"ls{i:02d}.json"})
    voice.append((t, x)); t += len(x) / SR + l.get("gap", 0.42)
    print(f"{i:02d} {t:7.2f}s  {spoken[:60]}")
total = t + float(os.environ.get('TAIL', '2.5'))
buf = np.zeros(int(total * SR))
for st, x in voice: a = int(st * SR); buf[a:a + len(x)] += x
sf.write(EP / "voice_track.wav", buf, SR)
F = int(np.ceil(total * FPS)); morph = [dict() for _ in range(F)]
for ln in lines:
    fr = json.load(open(EP / ln["lips"]))["frames"]; f0 = int(round(ln["start"] * FPS))
    for k, d in enumerate(fr):
        if f0 + k >= F: break
        m = morph[f0 + k]
        for src, v in d.items():
            for dst, g in MAP.get(src, []): m[dst] = round(min(1.0, m.get(dst, 0) + v * g), 3)
out = EP / f"{EP.name.split('-')[-1] if '-' in EP.name else 'ep'}_timeline.json"
json.dump({"fps": FPS, "total": round(total, 3), "lines": lines, "morph": morph}, open(out, "w"), ensure_ascii=False, separators=(",", ":"))
print("total", round(total, 1), "s ->", out)
