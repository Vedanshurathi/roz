# Unattended production — what works today, what is missing (8 Nov 2026)

## What actually exists
| Piece | Status | Notes |
|---|---|---|
| Cloud machine | **Per-session, not persistent.** 4 vCPU, 15 GB RAM, no GPU. | Reclaimed after ~20 min without activity; files in the session's scratch area survived restarts within this session, but a *new* session starts from the git repo only. |
| Scheduler | **Works** — claude.ai scheduled tasks can start a fresh cloud session on a cron schedule, without your laptop. | Smoke test: see below. Runs use your Claude plan usage; long renders (4–7 h per episode) use a lot of it. |
| Long renders | **Work** with `render_chunks.sh` + a keep-alive watcher (resumable chunks). | EP001: 5,930 frames ≈ 4.5 h. |
| Storage for Avir + plates | **Missing for fresh sessions.** | The repo is **public**, so Avir's model (`avir_mp_talk.glb`, from your `avatar.zip`) and plates are not committed. Fix: make `Vedanshurathi/roz` private (GitHub → Settings → Danger zone → Change visibility), then I commit `content-studio/assets/` (~90 MB). Or create a separate private assets repo. |
| Environment set-up | Partly manual | A setup script (npm install for Remotion, pip install bpy + sherpa-onnx, Kokoro download) should be saved on the environment once assets are in the repo. |
| Email approvals | **Not connected.** | Connect Gmail at https://claude.ai/customize/connectors. Scheduled tasks created from this session cannot carry connectors — create the weekly routine from the claude.ai routines page after Gmail is connected (or I prepare it and you click create). |
| YouTube upload | **Not connected.** | No connector; `www.googleapis.com` is not on the network allowlist; uploading needs a Google Cloud OAuth client + your consent (refresh tokens expire/rotate, so a static API key does not work). Practical now: you upload/schedule in YouTube Studio from the approval package (2 minutes). |
| Instagram | **Not connected.** | Graph API publishing needs a Business/Creator account linked to a Facebook Page, a Meta app and a publicly reachable video URL. Practical now: schedule Reels/posts in Meta Business Suite (free, built-in scheduler). Note: Google/Meta developer accounts and monetisation may require an adult account holder — check with a parent/guardian. |

Nothing is uploaded or scheduled on YouTube/Instagram by me until you approve the exact package **and** a working connection exists.

## Weekly plan (starting assumptions — no channel analytics yet)
All times IST. Adjust after 2–3 weeks of YouTube Studio / Instagram Insights data.
| Day | Item | Notes |
|---|---|---|
| Sun 8:00 AM | **Weekly AI update** (long-form, 4–6 min) | Approval package by **Sun 7:30 AM** → production Fri (research/script) + Sat (voice, render ~5–7 h). |
| Mon 6:30 PM | Short/Reel #1 | Cut from Sunday's episode (vertical, re-rendered). |
| Wed 6:30 PM | Short/Reel #2 | |
| Thu 7:00 PM | Instagram post | Static/carousel (e.g. "AI tool of the week" fact card). |
| Fri 7:00 PM | Short/Reel #3 | |
| Sat 12:30 PM | Short/Reel #4 | |
| (Wed 7:00 PM) | Optional 2nd long-form | Only with a strong topic + a real demo recording. |

Same vertical file goes to YouTube Shorts and Instagram Reels, with platform-specific titles/captions.

## Next 7 days (proposed)
- **Mon 9 Nov 12:30 PM** — EP001 (if approved) + thumbnail v2.
- **Tue 10 / Wed 11 / Fri 13 Nov** — EP001 Shorts: startup, IndiaAI Fellowship (deadline 30 Nov — timely), founder life.
- **Wed 11 Nov (Bhai Dooj)** — idea: a real experiment, e.g. "AI से भाई/बहन के लिए gift idea — 3 tools, real answers compared" (needs real screen recordings from your laptop).
- **Thu 12 Nov** — IG post: IndiaAI Fellowship fact card (who/how much/last date/portal).
- **Sun 15 Nov 8:00 AM (Chhath main day)** — EP002 weekly AI update; open with a short Chhath greeting, no generic festival video.
- Children's Day (14 Nov) — possible Short: "बच्चों के लिए safe AI tools" (only with real tests).

## Smoke test of the scheduler
See the result section appended below by the check on 8 Nov.

### Result (8 Nov 2026, 17:20 UTC) — scheduler works, production does not yet
- A one-off scheduled task started a fresh cloud session on its own and finished in ~15 s (cost ≈ $0.08 of plan usage).
- That session had Node 22, npm 10, Python 3.11, ffmpeg 6.1, 4 CPU, 15 GB RAM, ~31 GB free disk.
- **It did not have the repository** (working dir `/home/user`, no `roz` checkout): scheduled tasks created from this session
  carry no repository source. → Create the production routine from the claude.ai routines page with `Vedanshurathi/roz`
  selected (or I recreate it once a repo source can be attached).
- Missing on a fresh machine: `bpy`, Remotion `node_modules`, Avir model + plates (not in git) → needs private asset
  storage + an environment setup script.
- Network: `huggingface.co` and `www.googleapis.com` reachable; `graph.facebook.com` (Instagram API) **blocked** (403).
- YouTube upload from this environment **works** with a short-lived OAuth Playground token (EP001 uploaded 8 Nov); the
  shared Playground project hit `quotaExceeded` when setting the thumbnail. For regular uploads, a Google Cloud project of
  your own (free) gives your own quota.
