#!/usr/bin/env python3
"""Offline text-to-speech with Kokoro (sherpa-onnx). Free, no API key, runs on CPU.

usage: tts.py "text" out.wav [--voice hm_omega] [--lang hi] [--speed 1.05]
       tts.py --file script.txt out.wav ...

Voices (Kokoro v1.0): Hindi male hm_omega / hm_psi, Hindi female hf_alpha / hf_beta,
US English am_michael / am_adam / am_liam / af_heart / af_bella, UK bm_george / bf_emma.
Hinglish written in Devanagari sounds most natural with --lang hi; English text with --lang en-us.
Model dir: $KOKORO_DIR or ~/.cache/video-tools/kokoro-multi-lang-v1_0 (setup-tools.sh downloads it).
"""
import argparse, os, sys, wave
from pathlib import Path
import numpy as np
import sherpa_onnx

p = argparse.ArgumentParser()
p.add_argument("text", nargs="?")
p.add_argument("out")
p.add_argument("--file")
p.add_argument("--voice", default="hm_omega")
p.add_argument("--lang", default="hi")
p.add_argument("--speed", type=float, default=1.05)
a = p.parse_args()
text = Path(a.file).read_text(encoding="utf-8") if a.file else a.text
if not text:
    sys.exit("give text or --file")

d = Path(os.environ.get("KOKORO_DIR", Path.home() / ".cache/video-tools/kokoro-multi-lang-v1_0"))
lex = ",".join(str(d / f) for f in ("lexicon-us-en.txt", "lexicon-zh.txt"))
cfg = sherpa_onnx.OfflineTtsConfig(
    model=sherpa_onnx.OfflineTtsModelConfig(
        kokoro=sherpa_onnx.OfflineTtsKokoroModelConfig(
            model=str(d / "model.onnx"), voices=str(d / "voices.bin"), tokens=str(d / "tokens.txt"),
            data_dir=str(d / "espeak-ng-data"), dict_dir=str(d / "dict"), lexicon=lex, lang=a.lang),
        num_threads=4),
    max_num_sentences=1)
tts = sherpa_onnx.OfflineTts(cfg)
names = "af_alloy,af_aoede,af_bella,af_heart,af_jessica,af_kore,af_nicole,af_nova,af_river,af_sarah,af_sky,am_adam,am_echo,am_eric,am_fenrir,am_liam,am_michael,am_onyx,am_puck,am_santa,bf_alice,bf_emma,bf_isabella,bf_lily,bm_daniel,bm_fable,bm_george,bm_lewis,ef_dora,em_alex,ff_siwis,hf_alpha,hf_beta,hm_omega,hm_psi,if_sara,im_nicola".split(",")
sid = names.index(a.voice)
audio = tts.generate(text, sid=sid, speed=a.speed)
x = np.clip(np.array(audio.samples), -1, 1)
with wave.open(a.out, "wb") as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(audio.sample_rate)
    w.writeframes((x * 32767).astype(np.int16).tobytes())
print(f"{a.out}: {len(x) / audio.sample_rate:.2f}s, voice {a.voice}")
