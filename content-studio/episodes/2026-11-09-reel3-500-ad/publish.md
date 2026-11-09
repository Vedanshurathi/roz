# Reel 3 — "क्या AI से एक local shop का advertisement बन सकता है?" · package (DRAFT — awaiting approval, NOT published, NOT scheduled)

- Instagram Reel: `previews/REEL3_ig.mp4` (1080×1920, 24 fps, ~46.8 s, −14 LUFS) — ends "FOLLOW @unfiltered.avir"
- YouTube Short: `previews/REEL3_yt.mp4` (1080×1920, 24 fps, ~47.2 s) — ends "SUBSCRIBE: UNFILTERED AVIR" (last line says "सब्सक्राइब करो")
- Cover (both): `previews/REEL3_cover.jpg`
- YouTube setting: "Altered or synthetic content" = **Yes** (AI character, AI voice, AI-generated shop images). Not made for kids.
- EP001 is untouched (not re-uploaded, not edited).

## Instagram caption (short, 5 hashtags)
```
₹500 में दुकान का AD? 😅
मैंने free AI से सच में बनाकर देखा — poster + आवाज़, असली screen recording के साथ.

अगला AD किसका बनाऊँ? 👕 कपड़ों की दुकान या 🥦 सब्ज़ी वाले भैया — comment करो 👇
Save करो & follow @unfiltered.avir 🔁

🤖 Avir is an AI-generated virtual creator. Shop + shopkeeper are an illustrative scenario (AI-generated images). ₹5,000 = example, not an earnings promise.
#AItools #smallbusiness #localbusiness #reels #UnfilteredAvir
```

## YouTube Shorts
Title:
```
₹500 में दुकान का AD? 😱 Free AI से बनाकर देखा! #shorts
```
Description:
```
क्या AI से एक local shop का advertisement बन सकता है? मैंने try किया — poster और आवाज़, दोनों free AI से, मेरे computer पर (real screen recording).

🛠 Tools (free, no paid API): DreamShaper 8 + LCM-LoRA (image) · Kokoro (Hindi voice) · HyperFrames + Remotion (edit)
⚠️ दुकान, shopkeeper और ₹500 वाला scenario illustrative है (AI-generated images). ₹5,000 सिर्फ़ example है — कमाई की guarantee नहीं।
🤖 Avir is an AI-generated virtual creator.

👇 अगला ad — कपड़ों की दुकान या सब्ज़ी वाले भैया?
Real experiments. Unfiltered results.
Instagram: @unfiltered.avir

#shorts #AItools #smallbusiness #UnfilteredAvir #Hindi
```
Pinned comment:
```
अगला AD किसका? 👕 कपड़ों की दुकान या 🥦 सब्ज़ी वाले भैया — एक word में लिखो 👇
```

## Final spoken script (as recorded)
| # | Who | Line (spoken) | On screen |
|---|---|---|---|
| — | दुकान वाले भैया (illustrative, Kokoro hm_omega) | भाई, मेरी दुकान का एक बढ़िया सा ad बना देगा? Budget पाँच सौ रुपये। | Bazaar + "शर्मा क्लॉथ हाउस" (AI-generated images), label "Illustrative scene" |
| 0 | Avir | पाँच सौ में ad? | close-up, disbelief |
| 1 | Avir | भैया… editor आएगा, या उसका visiting card? | close-up on the punchline + rimshot |
| 2 | Avir | चलो देखते हैं — AI से दुकान का ad बनता है, या नहीं! | "THE ₹500 AD CHALLENGE"; Avir looks to his monitor |
| 3 | Avir | पहले AI को बोला — भाई, दुकान का poster बना! | REAL screen recording: prompt typed, generation (34× timelapse, real time 1:24) |
| 4 | Avir | और ये देखो! | zoom on the generated image → text added → poster |
| 5 | Avir | अब इसमें आवाज़ चाहिए। मैंने AI को line दी… और ये बोल पड़ा! | REAL screen recording: voice tab, Kokoro generates in 4.1 s, waveform; its first phrase plays |
| 6 | Avir | Poster बना, आवाज़ बनी… और ये रहा, हमारा छोटा सा ad! | — |
| — | AI voice (Kokoro hf_beta, generated in the recording) | शर्मा क्लॉथ हाउस! शानदार कपड़े, शानदार दाम — आज ही आइए! | DEMO AD (4 s) |
| 7 | Avir | सोचो — दस clients, पाँच-पाँच सौ, तो पाँच हज़ार! ये सिर्फ़ example है, कमाई की guarantee नहीं। | "10 clients × ₹500 = ₹5,000" + "Illustrative example · कमाई की guarantee नहीं" |
| 8 | Avir | अब बताओ — अगला ad कपड़ों की दुकान का बनाऊँ, या सब्ज़ी वाले भैया का? | poll chips + COMMENT |
| 9 | Avir | IG: ऐसी चीज़ें सीखने के लिए, follow करो Unfiltered Avir! / YT: … subscribe करो Unfiltered Avir! | end card |

## What is real vs generated
- **Real screen recording:** the local tool `content-studio/demo_tool/` (our own small web page) running on this machine's CPU,
  recorded live from a visible Chromium window on a virtual display (Xvfb + FFmpeg x11grab). The prompt, every generation
  step preview, the timer ("done · 83.8 s"), the poster and the voice generation ("done · 4.1 s") are what actually happened.
  Long waits are sped up and labelled (4×, 34×, 6×, 3×). It is a local open model, **not ChatGPT**.
- **Generated in that recording:** the poster image (DreamShaper 8 + LCM-LoRA, seed 7, 6 steps) and the ad voice (Kokoro hf_beta).
  The Hindi words on the poster are added by the tool's text template (the image model cannot write Hindi) — the tool says so on screen.
- **AI-generated, illustrative:** the bazaar shot and the shopkeeper photo (DreamShaper, same model, separate run); the shop
  sign text "शर्मा क्लॉथ हाउस" was rendered by us and placed over the model's garbled sign. Shop, shopkeeper and the ₹500 job
  are fictional; the shopkeeper's voice is Kokoro (hm_omega). No real paid client.
- **Avir:** 3D character (three.js in Remotion), AI voice (Kokoro hm_psi), lip-sync from our Hindi phoneme timing.
- **Music & SFX:** synthesized in `reel3_audio.py` (original, no third-party audio).

## Production report
**Tools actually installed and used**
| Tool | Used for | Status |
|---|---|---|
| DreamShaper 8 + LCM-LoRA (diffusers 0.42, CPU) | poster image (in the recording), bazaar + shopkeeper stills | works: 512×768, 6 steps ≈ 84 s; 640×960, 8 steps ≈ 2.7 min |
| Kokoro v1.0 via sherpa-onnx | Avir (hm_psi), shopkeeper (hm_omega), ad voice (hf_beta, generated live in the tool) | works; ad line generated in 4.1 s |
| Own local tool `content-studio/demo_tool/` (Python server + web page) | the on-screen "AI tool" for the real recording | new |
| Playwright + Xvfb + FFmpeg x11grab | real screen recording of that tool | 3 takes; take 3 used (take 1 poster text covered the face, take 2 had a display bug that hid the finished poster) |
| Blender 5.2 (Cycles, CPU) | premium studio plates (`ep_plates.py --premium`) | close + medium, 64 samples |
| Remotion + three.js | Avir performance (lip-sync, moods, glances, framing) | rendered only the ranges he is on screen |
| HyperFrames 0.9.26 | the edit: layout, captions, cards, DEMO AD, end cards | both variants |
| Sherpa-onnx Whisper (turbo) | checked every voice line and the final mix | all lines intelligible |
| FFmpeg | segment speed-ups, zoom on the poster, grade, mix, loudness | — |

**Talking Avatar (InterviewFlowAI):** not used. It drives Oculus `viseme_*` morph targets (Avir has the 51 ARKit shapes, no visemes)
and its lip-sync is trained for English; our Hindi phoneme → ARKit lip-sync is already matched to the actual speech.
**VoxCPM2:** not used — the install was blocked twice by this environment's safety rule for external code, and PyPI has no
torchaudio build for the installed torch. Kokoro was used for every voice. Not bypassed.
**Faster-Whisper:** not installed; the already-installed sherpa-onnx Whisper did the verification instead (word timing comes
from our TTS alignment, which is exact for synthetic speech).

**Avir improvements in this reel**
- New premium studio: walnut slat wall with a warm hidden LED, fabric floor lamp + shelf lamp, warm dark walls; removed the
  hexagon graphics, orange tagline bar and cyan glow; neon sign toned down; keyboard RGB dimmed.
- New premium light set for Avir (warm soft key, neutral fill, warm rims; the old strong cyan rim removed).
- Framing: chest-up medium (hands enter from the frame edge instead of floating in mid-air) + close-ups for the punchlines;
  no pointing clip anywhere; slow push-ins per shot.
- Acting: per-line moods (disbelief, smirk on the joke, "impressed" on the reveal, calmer on the disclaimer, playful question),
  a real look at his monitor (head turn + eyes) while he "asks the AI", blinks at pauses, lip-sync from the spoken audio.
- Not photoreal: he is a stylised 3D character; skin has no subsurface scattering in the real-time renderer.

**Shop / shopkeeper:** a convincing *speaking* shopkeeper is not possible here without fabricating footage: there is no GPU for a
talking-head model, and no licensed real footage. So the shop scene is a labelled illustrative still (AI-generated) with his
voice over it. For a real speaking shot we need either (a) a consenting real shopkeeper filmed on a phone (10 s, vertical,
saying the line), or (b) a GPU talking-head model (e.g. LivePortrait/SadTalker class — check licence) run on a GPU machine.

**Render time (CPU only, 4 vCPU)**
| Step | Time |
|---|---|
| Image model download (one time) | ~2 min |
| Shop/bazaar stills (4 × 640×960) | ~11 min |
| Real tool recordings (3 takes × ~2 min) | ~6 min |
| Studio plates (Cycles, close + medium) | ~8 min |
| Avir (Remotion, only on-screen frames: 750 of 1,132) | ~2 h 06 min (≈10 s/frame; close-ups ≈14 s) |
| HyperFrames edit (IG + YT) | ~2 min each |
| Audio (music/SFX synth + mix), Whisper QC | ~2 min |

Lesson: a CSS `filter` on the WebGL layer made frames ~2× slower again (same issue as EP001's corner window) — the grade and
vignette now run in FFmpeg after the render (`reel3_finish.sh`).

**Limitations**
- Length is ~46.8 s (IG) / ~47.2 s (YT), slightly over the 35–45 s target, to keep every scripted beat.
- Avir is a stylised 3D character, not photoreal; very tight close-ups crop the top of his hair.
- The shopkeeper does not move his lips (still image + voice) — see above for what a real speaking shot needs.
- Kokoro pronounces "कपड़े" a little soft in the ad voice (Whisper hears "कप्र"); it is the tool's real output, kept as is.
- The AI image has the usual SD-1.5 look (slightly smooth face); fine for a demo poster, not a final client ad.

**QC:** 1080×1920, 24 fps, H.264 + AAC; −14.4 LUFS, peak −4.0 dBFS (IG) / −2.6 dBFS (YT); every line checked with Whisper;
captions kept out of the top ~170 px and bottom ~380 px and off Avir's mouth.
