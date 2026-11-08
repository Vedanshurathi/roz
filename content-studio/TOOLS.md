# Tool evaluation — Unfiltered Avir (checked 8 Nov 2026)

Decision rule: keep the working pipeline (Blender plates + three.js Avir + Remotion edit + ffmpeg mix) and add a tool only
when a small test shows it improves the actual output on this machine (4 vCPU, 15 GB RAM, no GPU, no desktop, ~9 GB free disk).

| Tool | What it is | Licence | Runs here? | Decision |
|---|---|---|---|---|
| **Remotion** (in use, 4.0.300) | React → video, headless Chrome | Remotion License: free for individuals / orgs with ≤3 people; company licence beyond that | Yes (in use) | **Keep.** Check headcount: if RozBazaar Pvt Ltd has 4+ people using it, a company licence is needed. |
| **Remotion Agent Skills** (`npx skills add remotion-dev/skills`) | Markdown guidance for agents (captions JSON, best practices); targets Remotion 4.0.541 | No licence file in the repo | Read locally as reference | **Use as reference only** (not copied into this public repo). Our own `src/ep1` template already covers captions, cards, transitions, 16:9 + 9:16. |
| **HyperFrames** (heygen-com) | HTML + GSAP compositions → MP4 via headless Chrome + FFmpeg; Three.js adapter | Apache-2.0 | Not tested: running `npx hyperframes` is downloaded code and is blocked here without a permission rule | **Not adopted.** Our bottleneck is software-WebGL rendering of Avir (~4–6 s/frame); HyperFrames also renders through headless Chrome, so it would not remove it. Re-test only if we need GSAP-heavy motion graphics. |
| **VoiceStudio** (debpalash) | Local voice app (Electron + backend API, Docker image) around many TTS engines | App: AGPL-3.0. Weights keep their own terms | Not run (see below) | Default engine **OmniVoice weights are CC-BY-NC → not for a monetised channel.** Only **VoxCPM2** lists Hindi; its model card says **Apache-2.0, commercial use OK**, 2B params, 4.96 GB. A direct CPU test with the official `voxcpm` package was **blocked by the session's safety rule for downloaded code** — needs your permission rule to run. Current voice (Kokoro `hm_psi` via sherpa-onnx, Apache-2.0) stays until a test passes. |
| **Doory** (shaongitbd) | Browser design editor (Canva-like), self-host via Docker or hosted at doory.art; REST/MCP fill API when self-hosted | Attribution Assurance License (credit must stay visible) | No Docker/DB here; hosted site is manual | **Not adopted for automation.** Our Remotion `Thumb` composition renders thumbnails with the real 3D Avir. You can use doory.art by hand for quick IG posts if you like. |
| **OpenScreen** (siddharthvaddem) | Desktop screen recorder with auto-zoom/cursor effects | MIT | No: desktop app; this cloud machine has no display. **Archived 17 Oct 2026**, fork at getopenscreen/openscreen | **Use on your laptop** (the maintained fork, or OBS) to record real AI-tool demos; I edit them (zooms, captions, Avir picture-in-picture) in Remotion. |
| **ArtCraft (FilmCraft / EffectCraft)** | Desktop NLE + motion-graphics apps | Open source (per listings) | No: GUI apps; a c't review reports EffectCraft freezing on Linux | **Skip.** The scripted pipeline does this job headlessly. |

Real vs simulated: screens built in Remotion (e.g. "Avir's AI News" pages) are explainer graphics, labelled as mock-ups where they show a
tool's UI. A *real* product test needs a real recording (your laptop) or a tool that genuinely runs here (terminal, local code).

Sources: github.com/debpalash/VoiceStudio (README, LICENSE-NOTICE.md, backend/config/model_licenses.json, docs/engines),
huggingface.co/openbmb/VoxCPM2 (model card), github.com/heygen-com/hyperframes, github.com/shaongitbd/doory,
github.com/siddharthvaddem/openscreen, github.com/remotion-dev/skills, remotion.dev/docs/ai/skills, remotion LICENSE.md / license FAQ,
c't review via tutkit.com / heise.de listing for ArtCraft.
