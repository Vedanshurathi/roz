# Tech reel recipe (runs every 3 days)

Channel: **@vedanshurathi** — Vedanshu Rathi, 15-year-old founder of RozBazaar Pvt Ltd and
Kishan Suraksha AI. Audience: young Indians who follow tech and startups. Language: Hinglish.

Goal of each run: ONE finished, verified 30–45 s vertical reel about a real, recent tech story,
plus a cover image and a ready-to-post caption, delivered to the user.

## 1. Setup (fresh machine every run)
```bash
cd <repo>   # the roz checkout
git fetch origin claude/upbeat-archimedes-jld98p && git checkout claude/upbeat-archimedes-jld98p
bash .claude/skills/video-editor/scripts/setup-tools.sh      # ~5–10 min: ffmpeg, whisper, kokoro voice, fonts...
export KOKORO_DIR=$HOME/.cache/video-tools/kokoro-multi-lang-v1_0
```
Read `../SKILL.md`, `../references/playbook.md` and everything in `../studio/` (brand kit + Vedanshu's feedback rules).

## 2. Pick the story
- Web-search tech news from the **last 3 days**: AI tools, phones/gadgets, apps, big-tech moves,
  Indian startups/tech, useful how-tos. Pick what a 15–22-year-old Indian viewer would share.
- Skip anything already in `log.md`. Skip politics, tragedies, rumours, leaks without confirmation.
- **Confirm every fact in at least 2 independent reputable sources.** Note the URLs.
  Never invent numbers, quotes, prices, dates or launch claims. If unsure, leave it out.

## 3. Script (80–110 words ≈ 35 s)
- 0–3 s hook: a surprising fact or question ("Ab phone bina internet ke AI chalayega?").
- 3 beats: what happened → why it matters to *you* → one practical takeaway.
- End: "Aise hi tech updates ke liye follow karo @vedanshurathi."
- Write the voiceover in **Devanagari Hinglish** (English tech words may stay in Latin script:
  "AI", "Google", "app"). Keep a parallel **Roman-Hinglish** version for on-screen captions.

## 4. Voice
```bash
python3 .claude/skills/video-editor/scripts/tts.py --file vo.txt vo.wav --voice hm_psi --lang hi --speed 1.08
```
Check it with Whisper (sherpa-onnx turbo, `language=hi`) — every sentence must transcribe recognisably.
Then clean: `highpass=80, loudnorm I=-15`.

## 5. Visuals (no camera footage needed)
**Fastest path:** write a scene spec and run the ready-made engine, which does voice, captions,
graphics, music, SFX and the final mix in one go:
```bash
python3 .claude/skills/video-editor/scripts/techreel.py spec.json out/    # -> out/reel.mp4
```
Spec format and scene types (title, cards, phone, chips, endcard) are documented at the top of
`scripts/techreel.py`. Example: `tech-reels/example_spec.json`.
Only hand-build graphics when a story needs something the engine can't show.

- Pure motion graphics, 1080×1920, 30 fps, built with Python/PIL + ffmpeg (or Remotion in `../remotion`).
- Look: dark background (#0A0812 → deep purple), accent **red #FF3448** + **gold #FFC63C**,
  fonts in `../assets` (Poppins Black/ExtraBold, Anton).
- Word-by-word **stacked captions** synced to the voice (timings from Whisper), key word in neon red.
- Every 2–4 s something changes: big number cards, simple icons/emoji, a progress bar,
  a "how it works" diagram, before/after, comparison table. Company names as text only — no logos
  you don't have rights to, no real people's photos.
- Motion: ease-out entrances with slight overshoot; no constant zooming, no shake.
- Last 2 s: "Follow @vedanshurathi" end card.

## 6. Sound
Music bed from `../assets/music_upbeat_tech.mp3` or `music_cinematic_hiphop.mp3`, ducked under voice
(sidechaincompress). Soft whoosh / pop / tick SFX on graphic entrances (synthesise with ffmpeg).
Final mix −14 LUFS, true peak ≤ −1.5 dBTP.

## 7. Export + QC
H.264 High, yuv420p, AAC 48 kHz, `+faststart`. Check: duration 30–45 s, 1080×1920, no black frames,
voice audible over music (re-transcribe the final mix), captions inside the Instagram safe zone
(y 250–1450, x 60–1020), no clipped text. Look at 10+ frames before delivering.

## 8. Deliver
1. Send the user the MP4, a 1080×1920 cover PNG (big hook text + bold visual), and a caption:
   2–3 lines + 5–8 hashtags + a "Sources:" list of the URLs used.
2. Append a row to `log.md` (date | topic | source URLs), commit, and push to
   `claude/upbeat-archimedes-jld98p` (not main). Do not commit the video files.
3. If any step was blocked (search, push, model download), say exactly what and still deliver what worked.
