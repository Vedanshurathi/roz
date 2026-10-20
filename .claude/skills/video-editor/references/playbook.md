# Editing Playbook — Short-form & YouTube

## 1. Hooks (0–3 s)

The first frame must already be moving and already be interesting.
Stack three hooks at once: **visual** (motion, odd image, result first),
**verbal** (the claim), **text** (a 3–7 word headline on screen).

Formulas that work:
- **Result first:** show the end result, then "here's how".
- **Negative / warning:** "Stop doing X if you want Y."
- **Curiosity gap:** "Nobody talks about this…" / "I tried X for 30 days."
- **Direct callout:** "If you're a [specific person], watch this."
- **Number + stakes:** "3 edits that took me from 0 to 1M views."
- **In medias res:** start in the middle of the action, explain later.

Cut everything before the hook — greetings, intros, logos, "so…".

## 2. Pacing & structure

Short-form (15–60 s): Hook → Context (1 line) → 2–4 beats → Payoff → Loop/CTA.
Long-form YouTube: Hook (0–30 s, promise the payoff) → quick intro/brand (≤5 s)
→ chapters each opening with a mini-hook → re-hook every 60–90 s
("but that's not even the crazy part") → payoff → end-screen in last 20 s.

Pattern interrupts (one every 2–4 s short-form, 5–10 s long-form):
cut to new angle · punch-in 110–120 % · B-roll · on-screen text / emoji ·
SFX (whoosh, pop, riser) · speed ramp · screen shake on impact · colour flash.

Cutting rules:
- J-cuts / L-cuts (audio leads or trails the picture) feel professional.
- Cut on action — the motion hides the cut.
- Remove "um", repeats, breaths between sentences, but keep a beat before punchlines.
- Alternate punch-in / punch-out on jump cuts so the face doesn't "jump" in place.
- Match the cut rhythm to the music BPM (cut on the beat or every 2 beats).

## 3. Captions

- 1–3 words per screen for Reels/Shorts; up to ~7 words / 1 line for long-form.
- Bold sans-serif, white with black outline (5–8 px at 1080 w) + soft shadow.
- Highlight the active word (yellow #FFE600 / green #00FF88) and colour key
  words (money, numbers, emotions) — `--emphasis`.
- Position ~25–35 % up from the bottom on vertical (`--position 0.30`).
  Keep clear of the right edge (like/comment buttons) and bottom 20 % (caption + handle).
- Safe zone for 1080×1920: keep text inside x 90–930, y 250–1450.
- Add emojis sparingly, 1 per idea max.

## 4. Motion & animation

- **Punch-ins:** 110–120 % zoom on key words; hard snap for energy, 100–150 ms ease for polish.
- **Slow push-in (Ken Burns):** 100→108 % over a shot to add life to static footage.
- **Speed ramps:** 100 % → 300 % → 100 % across a transition, ease curves.
- **Text animation:** pop/scale-in (115 %→100 % in ~90 ms), slide-up, typewriter for tension.
- **Transitions:** prefer hard cuts. Use whip-pans, zoom transitions, match cuts or
  mask transitions only when motion motivates them. Avoid stock wipes/dissolves.
- **Keyframe easing:** never linear — ease-in-out or bezier.

ffmpeg recipes:
```bash
# slow push-in over a 5 s shot (1080x1920)
ffmpeg -i in.mp4 -vf "zoompan=z='min(zoom+0.0006,1.08)':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1080x1920:fps=30" out.mp4
# crossfade two clips (0.3 s at 4.7 s)
ffmpeg -i a.mp4 -i b.mp4 -filter_complex "xfade=transition=fade:duration=0.3:offset=4.7;acrossfade=d=0.3" out.mp4
# 2x speed section
ffmpeg -i in.mp4 -filter_complex "[0:v]setpts=0.5*PTS[v];[0:a]atempo=2.0[a]" -map "[v]" -map "[a]" fast.mp4
```

## 5. Sound design

- Voice: high-pass 80 Hz, de-ess, light compression, normalise.
  `-af "highpass=f=80,afftdn=nf=-25,acompressor=threshold=-18dB:ratio=3:attack=5:release=80,loudnorm=I=-14:TP=-1"`
- Music: −20 to −28 dB under dialogue; sidechain duck:
  `[music][voice]sidechaincompress=threshold=0.05:ratio=8:attack=20:release=300`
- SFX on every pattern interrupt: whoosh on transitions, pop on text, riser into reveals,
  bass hit on the payoff. Silence before a big moment makes it hit harder.
- Final loudness: −14 LUFS integrated, −1 dBTP for YouTube / IG / TikTok.

## 6. Colour

- Correct first (white balance, exposure, contrast), then grade.
- Skin tones on the vectorscope skin line. Don't over-saturate faces.
- Popular looks: teal-orange (cinematic), clean bright (lifestyle), crushed
  blacks + grain (moody). Apply a LUT: `ffmpeg -i in.mp4 -vf lut3d=look.cube out.mp4`
- Quick punch: `-vf "eq=contrast=1.08:saturation=1.15:gamma=0.98,unsharp=5:5:0.6"`

## 7. Platform specs

| platform | size | fps | length sweet spot | notes |
|---|---|---|---|---|
| Instagram Reels | 1080×1920 | 30 | 7–30 s (up to 3 min) | cover frame matters; 4:5 crop shows in grid |
| YouTube Shorts | 1080×1920 | 30/60 | 20–60 s (up to 3 min) | loops boost watch %, title on hook |
| TikTok | 1080×1920 | 30 | 15–45 s | native-looking text performs well |
| YouTube | 1920×1080 / 3840×2160 | 24/30/60 | 8–20 min | chapters, end screen last 20 s, thumbnail = 50 % of CTR |
| Feed (IG/FB) | 1080×1350 | 30 | — | 4:5 takes the most screen |

Export: H.264 High, yuv420p, AAC 48 kHz 320 kbps, `+faststart` (the `finish` command does this).

## 8. Retention checklist (before export)

- [ ] Something happens in frame 1; hook stated by 3 s
- [ ] No dead air > 0.4 s (unless intentional)
- [ ] Visual change every 2–4 s
- [ ] Captions accurate, in safe zone, key words coloured
- [ ] Music ducked under voice, SFX on interrupts
- [ ] Loudness −14 LUFS, peaks < −1 dBTP
- [ ] Ending loops or has a single CTA
- [ ] Watched once with sound off and once on a phone

## 9. Pro-app recipes (when ffmpeg isn't enough)

- **CapCut:** Auto captions → Text template "Trending"; Effects → Body → "Shake" on impacts;
  Speed → Curve → "Montage" for ramps; Remove background for green-screen-free cutouts.
- **Premiere Pro:** Text panel → Transcribe → Create captions; Essential Graphics for templates;
  Auto Reframe for 9:16; Remix to fit music length; Morph Cut to hide jump cuts.
- **DaVinci Resolve:** Smart Reframe; Magic Mask for subject isolation; Voice Isolation;
  Fairlight → Loudness at −14; Fusion for motion graphics.
- **After Effects:** Graph editor (ease in/out 70–90 % influence), Motion Tile + Directional Blur
  for whip transitions, Roto Brush for cut-outs, 3D camera tracker for tracked text.
