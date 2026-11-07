# Unfiltered Avir: content studio
"Real experiments. Unfiltered results." Natural Hindi with everyday English, hosted by **Avir**, a virtual creator.
YouTube [@unfilteredavir](https://www.youtube.com/@unfilteredavir) · Instagram [@unfiltered.avir](https://www.instagram.com/unfiltered.avir/)

**Status (2026-11-07):** Brand and character name are locked (`config/studio.yaml`, `brand/`). A rigged 3D model of
Avir (v1) is in `host3d/`. Nothing is published without the owner's approval of the exact final package.

## Pipeline
research → idea → script → storyboard → visuals → voice → edit → captions → thumbnail/copy → QC → **final approval package** → publish → analytics

| Step | How | Where |
|---|---|---|
| Research | Web search in Claude sessions; every claim logged with source, date, status (released / announced / rumour) | `pipeline/research.py`, `research/archive.jsonl` |
| Script & storyboard | Templates; hook → journey → payoff; stills grid before any render | `templates/` |
| Visuals | Remotion (React → video) on CPU; character art from the locked reference sheet | `../.claude/skills/video-editor/remotion` |
| Voice | Kokoro-82M `hm_omega`, offline via sherpa-onnx; Whisper check | `../.claude/skills/video-editor/scripts/tts.py` |
| Music & SFX | Synthesised in code (original, no licence risk) | per-episode scripts |
| QC | Resolution, fps, codec, duration, −14 LUFS, true peak ≤ −1.5 dBTP, black gaps, silences | `studio.py qc` |
| Approval | Package page + email text + hash; approval must name the hash | `studio.py package / approve` |
| Publish | YouTube API uploader with approval-hash check, duplicate guard and dry-run default | `studio.py publish`, `pipeline/youtube_upload.py` |

`python3 -m unittest pipeline/test_studio.py` tests the approval guards end to end.

## Tools (checked 2026-11-07)
| Tool | Purpose | Cost | Setup | Limits / risks | Why |
|---|---|---|---|---|---|
| Claude Code (cloud) | research, scripts, code, renders, scheduled runs | in Claude Pro, shared 5-hour + weekly limits | none | heavy days can hit limits; container is temporary | already paid for |
| Remotion 4 | programmatic animation | free for individuals / ≤3-person companies | npm | CPU render only | precise, repeatable |
| Kokoro-82M | Hindi male voice | free (Apache-2.0 per mirrors; confirm on official card) | 330 MB model | Hindi quality "C" grade; must write in Devanagari | only free offline Hindi male voice that works here |
| Whisper turbo (sherpa-onnx) | pronunciation check, captions | free (MIT) | model download | struggles with brand names | catches bad TTS lines |
| FFmpeg | edit, mix, loudness, QC | free | apt | none | standard |
| YouTube Data API | upload/schedule | free quota: 10,000 units/day; one upload = 1,600 | Google Cloud project + OAuth | uploads from unaudited projects stay **private** | only official route |
| Image model for premium anime art | character sheet + scenes | **not available here** | see below | — | — |
| Gmail connector | send approval email | free | owner must authorise in claude.ai settings | not connected now | notification only |

## Known limitations
- **Character art:** no image-generation model in this environment, so premium anime art can't be generated here.
  `brand/reference/host_v2_design_sketch.png` is a code-drawn design sketch only.
- **Handles:** YouTube and Instagram are blocked from the sandbox, so handle availability is unverified.
- **YouTube auto-publish:** needs the owner's Google Cloud OAuth setup. Public scheduling needs Google's API audit;
  until then API uploads stay private. Fallback: upload the approved package by hand or via the owner's browser.
- **Email:** the Gmail connector is not authorised. The approval package is shown in chat; approval in chat is recorded with its hash.

`episodes/2026-11-07-ep000-pilot-bina-gpu-anime` is an internal pipeline test, not for publishing.
