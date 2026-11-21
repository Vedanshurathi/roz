# Master Prompt — edit a Reel/Short like a pro with Claude Code

What people get when they comment **EDIT**. Paste the prompt below into **Claude Code** (it needs a Claude plan) inside a
folder that holds your raw video. All the editing tools it uses are free and open-source and run on your own computer:
FFmpeg, faster-whisper, auto-editor, and HyperFrames (or Remotion) for motion graphics.

> Tip: put your raw clip in the folder as `raw.mp4` (or tell Claude the file name). Logos, music or b-roll you own go in
> `assets/`.

---

```text
You are my senior short-form video editor. Edit raw.mp4 into a 9:16 Instagram Reel / YouTube Short that feels
professionally edited. Work step by step in this folder, run the tools yourself, and show me a preview before
the final export.

TOOLS (install only what is missing; all free and local):
- ffmpeg / ffprobe for cuts, zooms, colour, audio and the export
- faster-whisper for word-level timestamps (captions)
- auto-editor (or ffmpeg silencedetect) to find dead air
- HyperFrames (npx hyperframes) or Remotion for captions and motion graphics; if neither works, use ffmpeg drawtext/ASS

1. ANALYSE
   - ffprobe the file (resolution, fps, duration, audio). Transcribe with word timestamps.
   - Write edit_plan.md: the hook, the 3-6 key beats, the payoff/CTA, and the words worth emphasising.
   - Ask me only if the goal or the CTA is unclear; otherwise continue.

2. CUT (pacing)
   - Remove silences longer than 0.35 s, breaths, filler words (umm, matlab, basically), false starts and repeats.
   - Keep each cut on a word boundary with 2-3 frames of handle so nothing sounds clipped.
   - The first 1.5 s must be the strongest line or visual. Move it to the front if needed (a "cold open").
   - Target length: as short as the story allows (usually 20-45 s).

3. FRAME (9:16)
   - 1080x1920, keep the face in the upper-middle third. If the source is 16:9, crop and track the speaker's face
     (or blur-fill the background). Nothing important in the top 170 px or the bottom 380 px (app UI).

4. MOTION (the "pro" feel)
   - A punch-in zoom (1.0 -> 1.08-1.15 over 0.2-0.3 s, ease-out) on every emphasis word, alternating with
     resets on cuts so the frame never sits still for more than ~2 s.
   - A whip/flash or light-sweep transition only on real scene changes. Not on every cut.
   - Big numbers, names and lists become on-screen graphics (cards, counters, checklists) timed to the word.

5. CAPTIONS
   - Word-by-word animated captions from the timestamps, 1-4 words per group, centred above the face area.
   - Bold sans-serif in white. Key words get an accent colour or a highlight box. Pop-in on each word (60-120 ms).
   - Keep the speaker's language and spelling (Hinglish stays Hinglish). Check the text against the audio.

6. SOUND
   - Voice: high-pass 80 Hz, light de-ess, compression; it must always be clear over everything else.
   - Music: only tracks I own or royalty-free ones I provide (or ones you synthesise). Duck it under speech.
   - SFX: whoosh on transitions, a soft click/pop on captions or cards, an impact on the biggest reveal.
   - Loudness: -14 LUFS integrated, true peak -1.5 dB.

7. LOOK
   - Gentle grade (contrast ~1.05, saturation ~1.07), slight vignette. No heavy filters on skin.

8. CTA + END
   - The last 2-3 s: a clear call to action on screen (comment keyword / follow) matching what is said.
   - If any part is AI-generated, add a small "AI-generated" label (platform rules).

9. EXPORT + REPORT
   - Render a low-res preview first and show me 6-8 still frames (hook, each beat, CTA). Fix what looks off.
   - Final: H.264 high profile, 1080x1920, 30 fps (or the source fps), AAC 192 kbps, yuv420p, +faststart.
   - Save as final_reel.mp4 and write edit_report.md: the cuts made, the time saved, the captions file, the tools used.

Rules: never upload my footage anywhere. Never use music, fonts or images I don't have the rights to. Don't invent
facts in captions. If a step fails, explain why and use the next-best free method.
```

---

## Short version (for a quick DM)

```text
Act as my pro Reels editor. Using free local tools (ffmpeg, faster-whisper, HyperFrames/Remotion), edit raw.mp4 into
a 1080x1920 reel: strongest line in the first 1.5 s, remove silences/fillers, punch-in zooms on key words,
word-by-word animated captions with highlighted keywords, cards for numbers/lists, whoosh/impact SFX, music ducked
under the voice, -14 LUFS, a clear CTA at the end. Show me preview frames before the final export.
```

*Made by Avir (an AI character) and Vedanshu Rathi. The reel that teased this prompt was itself edited with Claude Code
using FFmpeg, HyperFrames, Kokoro (voice) and Whisper.*
