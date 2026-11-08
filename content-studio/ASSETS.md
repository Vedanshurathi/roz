# Reusable assets, render times and lessons

## Assets (where they live)
| Asset | Path | In git? |
|---|---|---|
| Avir model (talking rig, 7 seated clips) | `scratchpad/avir_new/avir_mp_talk.glb` (built by `host3d/avir_mp_rig.py` from your `avatar.zip`) | **No** (repo is public) |
| Studio scene | `host3d/studio/studio.blend`; Diwali plates via `host3d/ep_plates.py --diwali` | blend yes, plates no |
| Edit template (16:9 episode, 9:16 Shorts, thumbnails) | `.claude/skills/video-editor/remotion/src/ep1/` (`Ep1`, `Short`, `Thumb`, `screens`, `perf`, `ui`) | Yes |
| Caption timing / cues | `host3d/prep_ep1.py` → `src/ep1/data.json` | Yes |
| Audio bed + SFX + mix | `host3d/ep1_audio.py` | Yes |
| Resumable chunk renderer | `host3d/render_chunks.sh` | Yes |
| Voice | Kokoro multi-lang v1.0, voice `hm_psi`, via sherpa-onnx (Apache-2.0) | model downloaded from Hugging Face, not in git |

## Measured render times (4 vCPU, software WebGL)
- Studio shot with Avir, 1920×1080: ~3.5–4 s per frame (concurrency 4).
- Screen segment with Avir in a corner window: ~2.5 s/frame (after switching CSS clip-path → WebGL scissor; before: ~48 s/frame).
- Full EP001 (4:07, 5,930 frames): ~4.5 h of rendering in 20 resumable chunks.
- Vertical Short 1080×1920 (medium camera crop): ~5.3 s/frame → a 20 s Short ≈ 45 min.
- Thumbnail still: ~1 min.

## Lessons
- Never put a CSS `clip-path` or `filter` on a container holding the WebGL canvas in heavy sections — clip in WebGL (scissor).
- The cloud machine is reclaimed after ~20 min idle: long renders need a keep-alive watcher and resumable chunks.
- Overlays that read episode time need a shifted `<Sequence>` when cut into Shorts.
- Captions must never cover the mouth in vertical framing: cards and captions sit below y≈1150 of 1920.
- EP001 Shorts (1080×1920, native vertical): startup 23 s = 55 min, fellowship 17 s = 36 min, founder 20 s = 41 min
  (≈ 5.3 s/frame). Approval package emailed 8 Nov.
