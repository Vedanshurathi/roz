# Reference reels (sent by Vedanshu) — what each teaches

## Ref A & B — "Claude just killed it" (laptop 3D film), 30–35 s
- One static phone shot of a **laptop on a desk** (warm lamp one side, blue light other side); hand taps the laptop in frame 1.
- Screen plays a **cinematic voxel/3D film**: cozy night room, retro computer, blocky character, slow camera moves, captions inside the film.
- Two big **stickers** at the top: old tool crossed out ✗ + new tool. One fixed white-on-black caption on the keyboard for the whole reel.
- Script: claim → "everyone wants my secret" → bad-AI vs good-AI comparison → what it does (camera, light, motion, sound) → **"Comment SKILL and I'll send the file."**
- Built here as `remotion/src/room/Room.tsx` (Three.js). Laptop shot: film over a green screen (`GREEN_SCREEN` image with pink corner markers) and screen-replace.

## Ref C — "Claude Mastery ep 2" (talking head tutorial), 100 s
- **Split screen**: top = clean screen recording / B-roll on a cream background; bottom = face (dark moody light, studio mic). Captions at the split line.
- Switch to **full-screen face** on key lines; cinematic **series title card** ("Episode 2") after a collage-of-past-reels opener.
- Minimal captions: 1–3 white words, one bold key word.
- Workflow taught (adopted in `README.md`): studio folders, brand kit from references, storyboard → approve/reject/feedback loop, context is everything. Tools: FFmpeg, Whisper, yt-dlp, Remotion (+ HyperFrames, HTML→video).

## Built from these references (remotion/src/room)
- `Film.tsx` — multi-world voxel film (sky + giant voxel letters, red stage + comment cards, chibi close-up, pastel stairs, purple burst sphere + flying props, gallery). Shared parts are exported: `Chibi` (beanie / founder / uncle), `VoxelWord`, `Card`, `Cloud`, `Sky`, easing helpers.
- `Diwali.tsx` — 9:16 Diwali film reusing them: diya + rangoli, village houses, local shop that lights up, fireworks, giant voxel HAPPY DIWALI.
- Render (CPU-only machines): `npx remotion bundle src/index.ts --out-dir out/b && npx remotion render out/b <Id> out/x.mp4 --gl=swangle --concurrency=4`. ~2.5 s/frame at 720p; always check 6–10 `remotion still` frames first (storyboard), then render.
