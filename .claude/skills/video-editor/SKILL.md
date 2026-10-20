---
name: video-editor
description: Edit Instagram Reels, YouTube Shorts, TikToks and long-form YouTube like a top-tier editor — hooks, pacing, jump cuts, animated word-by-word captions, punch-in zooms, 9:16 reframing, sound design, colour, loudness and platform-ready export. Use whenever the user wants a video edited, cut down, captioned, reframed, made "viral", or wants an edit plan / feedback on an edit.
---

# Video Editor

You are editing for retention. Every decision answers one question:
**"Does this make the viewer stay one more second?"**

## Workflow

1. **Probe** the footage: `python3 scripts/vedit.py probe in.mp4`
   (length, resolution, fps, loudness). Ask for the platform if not stated.
2. **Plan the edit before touching it** — write an edit decision list (EDL):
   hook (0–3s), beats, payoff, CTA, with timestamps. Use
   `references/playbook.md` for hook formulas and pacing rules.
3. **Rough cut** — remove dead air: `vedit.py jumpcut in.mp4 cut.mp4`
   (`--noise -30` for noisy rooms, `--pad 0.05` for tighter, `0.15` for calmer).
4. **Reframe** for vertical: `vedit.py vertical cut.mp4 v.mp4`
   (`--mode crop --focus 0.3` to track a subject left of centre).
5. **Captions**:
   `vedit.py transcribe v.mp4 -o words.json` (needs `pip install faster-whisper`;
   or pass an existing `.srt` straight to `captions`), then
   `vedit.py captions words.json -o cap.ass --style pop --emphasis money,free,secret`
   and `vedit.py burn v.mp4 cap.ass cap.mp4 --fonts-dir fonts/`.
   Proof-read words.json first — wrong captions kill credibility.
6. **Motion** — punch-ins on key lines: `vedit.py punchin cap.mp4 p.mp4 --at 2.1,6.4,11 --zoom 1.15`
   (`--ramp 0.01` = hard snap zoom, the "jump-cut punch").
   Run punch-ins *before* burning captions if you don't want captions to zoom too.
7. **Finish** — loudness to −14 LUFS, platform codec settings:
   `vedit.py finish p.mp4 final.mp4 --preset reels|shorts|tiktok|youtube|youtube4k|square|feed45`.
8. **QC** — extract frames at the hook, every caption change and the end
   (`ffmpeg -ss T -i final.mp4 -frames:v 1 f.png`) and look at them. Check
   captions stay inside the safe zone (see playbook), nothing is cut off,
   audio peaks below −1 dBTP (`vedit.py probe final.mp4`).

## Caption styles (`--style`)

| style | look | use for |
|---|---|---|
| `pop` (default) | 1–3 words, ALL CAPS, active word yellow + bounce | Reels/Shorts talking head (Hormozi / MrBeast style) |
| `karaoke` | full phrase, colour sweeps word-by-word | music, storytelling, podcasts |
| `box` | text on a solid box, active word highlighted | busy/bright backgrounds, tutorials |

Good fonts: Montserrat Black/ExtraBold, Anton, Bebas Neue, Poppins Bold, The Bold Font.
Download the .ttf into a `fonts/` folder and pass `--fonts-dir fonts/` to `burn`;
if the font isn't found libass silently falls back to a default.

## Rules of thumb (full detail in references/playbook.md)

- Hook in the **first 1–3 seconds**: visual change + spoken claim + on-screen text, all at once. No logos, no "hey guys".
- Something changes on screen every **2–4 s** in short-form (cut, zoom, B-roll, text, SFX). Long-form: every 5–10 s.
- Cut on the breath, not mid-word. Keep the beat before a punchline.
- Captions in the middle-lower third, never under the platform UI.
- Music at −20 to −28 dB under voice; duck it during speech. Voice is king.
- End with a loop (last line flows into the first) or one clear CTA — never both a CTA and a fade to black.

## What this toolkit can't do (be upfront)

It's ffmpeg-based: no AI object tracking, rotoscoping, 3D, or After Effects-style
keyframe graphs. For those, give the user exact steps for CapCut, Premiere Pro,
DaVinci Resolve or After Effects (see `references/playbook.md` → "Pro-app recipes").
If the vidIQ connector is available, its clip/b-roll/thumbnail/title tools
complement this one.
