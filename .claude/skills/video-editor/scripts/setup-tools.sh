#!/usr/bin/env bash
# One-command install of the free video-editing toolbox (Ubuntu/Debian, Python 3, Node 18+).
# Usage:  bash .claude/skills/video-editor/scripts/setup-tools.sh
# Models go to ~/.cache/video-tools (override with MODELS=/path).
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
MODELS="${MODELS:-$HOME/.cache/video-tools}"
SUDO=""; [ "$(id -u)" -ne 0 ] && SUDO="sudo"

echo "== system packages (FFmpeg, Blender, Kdenlive+MLT, Audacity, SoX, HandBrake, ...)"
export DEBIAN_FRONTEND=noninteractive
$SUDO apt-get update -qq
$SUDO apt-get install -y -q --no-install-recommends \
  ffmpeg blender melt kdenlive audacity sox libsox-fmt-all frei0r-plugins \
  rubberband-cli mediainfo mkvtoolnix handbrake-cli imagemagick \
  fonts-noto-core fonts-noto-color-emoji \
  libcairo2-dev libpango1.0-dev pkg-config python3-dev

echo "== python packages"
# Debian's setuptools is too old for Python 3.13 sdists (e.g. srt, needed by manim)
pip install -q -U --ignore-installed setuptools wheel
pip install -q opencv-python-headless numpy librosa onnxruntime sherpa-onnx faster-whisper \
  auto-editor "scenedetect[opencv-headless]" moviepy pydub noisereduce pedalboard \
  ffmpeg-normalize rembg manim
# moviepy needs Pillow < 12; rembg still runs fine on 11.x
pip install -q "pillow==11.3.0"

echo "== Remotion (programmatic motion graphics)"
( cd "$HERE/remotion" && npm install --no-audit --no-fund )

echo "== models (from GitHub releases; Hugging Face is often blocked)"
mkdir -p "$MODELS"
REL=https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models
[ -d "$MODELS/sherpa-onnx-whisper-turbo" ] || \
  curl -sSL "$REL/sherpa-onnx-whisper-turbo.tar.bz2" | tar xj -C "$MODELS"
[ -f "$MODELS/silero_vad.onnx" ] || curl -sSL -o "$MODELS/silero_vad.onnx" "$REL/silero_vad.onnx"
[ -f "$MODELS/u2net_human_seg.onnx" ] || curl -sSL -o "$MODELS/u2net_human_seg.onnx" \
  https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2net_human_seg.onnx
TTS=https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models
[ -d "$MODELS/kokoro-multi-lang-v1_0" ] || \
  curl -sSL "$TTS/kokoro-multi-lang-v1_0.tar.bz2" | tar xj -C "$MODELS"     # offline voiceover (scripts/tts.py)
mkdir -p "$HOME/.fonts" && cp "$HERE"/assets/*.ttf "$HOME/.fonts/" && fc-cache -f >/dev/null

echo "== done. Quick check:"
ffmpeg -version | head -1
blender --version 2>/dev/null | head -1
melt --version 2>&1 | head -1
auto-editor --version | tail -1
scenedetect version 2>&1 | tail -1
python3 -c "import cv2, manim, moviepy; print('opencv', cv2.__version__, '| manim', manim.__version__, '| moviepy', moviepy.__version__)"
( cd "$HERE/remotion" && npx remotion --version | tail -1 )
