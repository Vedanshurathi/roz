# Avir: 3D character pipeline (v1)

One rigged glTF character, built once and reused in every video. Face, hair and beard are defined in one place
(`build_host.py` → "identity"), so they stay the same across episodes. Only outfits, poses, expressions and scenes change.

## Files
| File | What it is |
|---|---|
| `build_host.py` + `stage2.py` + `anims.py` | Builds the character from CC0 MakeHuman/MPFB2 **data** (body mesh, morph targets, Mixamo rig + weights). It does not run any MPFB code. |
| `dist/host.blend` | Editable Blender source (Blender 5.2) |
| `dist/host.glb` | Exported character (3.8 MB): 54-joint skeleton, 24 face morphs, 3 outfits, 5 clips |
| `character-controller.js` | three.js controller (owner's starting point, adapted to the real names). Live `update()` or frame-exact `setTime(t)` for rendering. |
| `render_check.py` | Quick Cycles CPU renders (face and body) for any outfit, pose or morph. |
| `../../.claude/skills/video-editor/remotion/src/host/HostTest.tsx` | Remotion movement + speech test (wave → talk with lip-sync → nod, outfit switches). |

## What the model contains
- **Skeleton:** Mixamo naming (`mixamorig:Hips` … fingers), plus `LeftEye`/`RightEye` bones for gaze. Mixamo
  animations can be retargeted onto it later.
- **Face morphs (ARKit names):**
  - Eyes and brows: eyeBlink/Squint/Wide L/R, browDown L/R, browInnerUp, browOuterUp L/R.
  - Mouth: jawOpen, mouthSmile L/R, mouthFrown L/R, mouthPucker, mouthFunnel, mouthStretch, mouthPress, mouthUpperUp, mouthShrugLower.
  - Nose: noseSneer L/R.
  - Teeth, tongue and lashes follow the jaw and blink morphs.
- **Visemes** (in the controller): rest, aa, ee, ih, oh, ou, mbp, fv. Speech is driven by voice loudness plus a viseme per frame.
- **Outfits** (the list is stored in the rig's glTF extras, so the controller reads it from the model):
  - casual = cream tee + charcoal overshirt + black chinos + white sneakers
  - hoodie = navy hoodie + chinos + sneakers
  - tee = black tee + blue jeans + sneakers
- **Clips:** Idle (8 s loop), Talk (4 s loop), Wave, Nod, Explain.

## Rebuild
```
git clone --depth 1 --filter=blob:none --sparse https://github.com/makehumancommunity/mpfb2 && (cd mpfb2 && git sparse-checkout set src/mpfb/data)
pip install bpy==5.2.3            # Blender as a Python module (Python 3.13)
python3 -I build_host.py --data mpfb2/src/mpfb/data --out dist --tex 4096    # about 2 minutes on 4 CPUs
python3 -I render_check.py dist/host.blend /tmp/check --outfit hoodie --pose Talk --keys jawOpen=0.5
```

## Use in a video
Copy `dist/host.glb` to `remotion/public/host/`, then follow `HostTest.tsx`: `new CharacterController(scene)` →
`load()` → each frame `setOutfit()`, `setMood({smile, browsUp})`, `speak(amp, viseme)`, `lookAt(x, y)`, `setTime(t, schedule)`.
Amplitude and viseme come from the voice WAV (see `hosttest.json` for the format).

## Limits of v1 (honest)
- Built procedurally on CPU from a generic CC0 body. It is a **stand-in**, not a sculpted match of the reference:
  - The hair is a sculpted shell, not strands.
  - The beard and brows are painted textures.
  - Clothes are offset copies of the body, so they are tight and have jagged necklines.
- **Upgrade path:** any premium GLB/VRM that uses ARKit morph names and a humanoid rig drops into the same controller
  and Remotion pipeline. Only the outfit mesh names need to be set in its extras.
