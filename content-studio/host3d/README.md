# Avir: 3D character pipeline (v2)

Avir (Unfiltered Avir) is a virtual creator. He is built **once** from code. Every future video reuses the same face,
body, hair, rig, outfits and clips, so his identity never drifts. v1 is kept in `backup_v1/` and `dist/`.

## What v2 is made of (all free, licences checked)
| Part | Source | Licence |
|---|---|---|
| Body, face shape, morph targets, rig weights | MakeHuman / MPFB2 **data** (code not run) | CC0 |
| Body motion: walk + turn, conversational gestures, sitting | CMU Graphics Lab mocap (cgspeed BVH: 16_17, 18_08, 13_04) | No restrictions (CMU + converter) |
| Hindi voice | Kokoro-82M `hm_omega` via sherpa-onnx (offline) | Apache-2.0 (official model card) |
| Renderer | Blender 5.2 Cycles (CPU), `pip install bpy==5.2.3` | GPL (tool), outputs are ours |

## Files
| File | Purpose |
|---|---|
| `build_host.py` → `stage2.py` → `stage3.py` (+ `anims.py`) | `--stage v2` builds Avir v2 in about 12 min on 4 CPUs |
| `stage3.py` | **Realism layer:** skin with subsurface scattering and pores; 52k hair strands, 30k beard strands, 3.2k brow strands, all deformed on the skin; cloth with relaxed hems, collars, thickness and fabric bump; mocap retarget (CMU → Mixamo names). |
| `lipsync.py` | Hindi phoneme lip-sync: Devanagari → phonemes → visemes, timed on the voiced audio (not volume-only) |
| `render_test.py` | The 3-shot test scene (close-up speech, medium gesture, full-body walk + turn, 3 outfits) |
| `assemble_audio.py` | Voice lines at their keyed frames, footsteps at detected foot contacts, room tone |
| `export_glb.py` | Real-time export (strand hair can't go into glTF; it uses the hair shell plus painted beard shading) |
| `character-controller.js` | three.js controller, tested against `avir.glb` (see below) |
| `dist_v2/avir.blend` | **Editable source** (Blender 5.2): character, strands, outfits, 8 clips |
| `dist_v2/avir.glb` | **Exported rigged model** (4.5 MB): 54 joints, 24 face morphs, 4 outfits, 8 clips |
| `dist_v2/ls*.json` | Lip-sync data for the three test lines |

## Controls (verified in the real files)
- **Clips:** Idle, Talk, Wave, Nod, Explain (hand-keyed); Gesture, WalkTurn, Sit (mocap).
- **Face morphs:**
  - Eyes and brows: eyeBlink/Squint/Wide L/R, browDown L/R, browInnerUp, browOuterUp L/R.
  - Mouth: jawOpen, mouthSmile L/R, mouthFrown L/R, mouthPucker, mouthFunnel, mouthStretch, mouthPress, mouthUpperUp, mouthShrugLower.
  - Nose: noseSneer L/R.
- **Gaze:** `LeftEye` / `RightEye` bones.
- **Outfits:**
  - casual = cream tee + charcoal overshirt + black chinos + white sneakers
  - hoodie = navy hoodie + chinos + sneakers
  - shirt = sky-blue casual shirt + jeans + sneakers
  - tee = black tee + jeans + sneakers

Controller test (headless Chromium, real `avir.glb`):
- all 8 clips load;
- `setOutfit("shirt")` shows exactly its 3 garments;
- WalkTurn moves the hips 2.45 m;
- `playLipsync()` applies the phoneme frame (jawOpen 0.242 at 1.0 s = lipsync.py output).

## Make a new video with Avir
1. Write the Hindi line in Devanagari, then voice it: `scripts/tts.py "<line>" lN.wav --voice hm_omega` and check it with Whisper.
2. Lip-sync: `python3 lipsync.py "<same line>" lN.wav lsN.json --fps 24`.
3. Edit `SHOTS` in `render_test.py` (or copy it): pick an outfit, a clip and the speech start per shot. Render with
   `--frames`, then build the audio with `assemble_audio.py` and mux with ffmpeg.

## Honest limits (v2)
- **Likeness:** a believable South-Asian adult built from MakeHuman's face space. It is **not** a sculpted match of the
  approved reference photo; that needs a 3D artist or a paid photo-to-3D tool such as Character Creator Headshot.
- **Skin and face:** no wrinkle maps or micro-expressions. Cheeks move only through the smile and sneer shapes.
- **Hands:** CMU mocap has no finger data. Fingers use a relaxed curl, so gestures read from wrists and arms.
- **Clothes:** body-offset garments with thickness and fabric bump; no cloth simulation, so there are no dynamic
  folds. Trousers are close-fitting.
- **Voice:** Kokoro's Hindi is clear but somewhat flat. More natural free options (Indic Parler-TTS, Apache-2.0;
  IndicF5, MIT) need the owner's free Hugging Face login to download.
- **Speed:** CPU only. About 40 s per 720×1280 frame with strand hair, so a 14 s test is about 3–4 hours.
