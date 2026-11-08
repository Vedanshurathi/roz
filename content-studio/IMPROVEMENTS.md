# Improvements backlog (make gradually — one or two per episode, never a full rebuild)

Done in EP001 (keep): Diwali studio plates · eye contact + head aim · speech-driven gestures · nods/brow raises on stressed
words · blinks at pauses · shot plan with cuts at phrase breaks and slow push/drift · screen segments with Avir in a corner
window · original memes + synthesized meme SFX · resumable chunked rendering · faster lighting (hemisphere instead of env).

Next (in order of value per effort):
1. **Voice** — save the timeline builder as a script (it was inline in EP001), then vary speed/pauses per line and add
   light breaths. Try a stronger Hindi TTS (e.g. an Indic Parler/IndicF5-class model) on a short test before switching.
2. **Gestures** — author 4–6 more seated clips (hand-to-chest "मैं", counting 1-2-3, shrug, lean-in, thinking chin-touch)
   in `avir_mp_rig.py`; pick them from words in the script (numbers → counting, "मैं" → chest).
3. **Face** — calibrate the lip-sync map against the new model (slightly wider vowels, softer "m/b/p"); add tongue for
   "l/t/d"; asymmetric smiles on jokes are already in, extend to sarcasm/surprise presets.
4. **Hands/arms** — fix the arm hidden behind the monitor in the medium shot (move monitor 10 cm left in the plates).
5. **Render speed** — render the Avir layer once at 1080p and reuse it for Shorts crops; cache plates per shot; try
   llvmpipe with more threads; measure s/frame per section and keep a log.
6. **Shorts** — render a vertical (9:16) close camera plate so Shorts are sharp instead of cropped from 16:9.
7. **B-roll** — real screen recordings of genuine experiments (terminal, local apps) captured with Playwright.
8. **Script** — keep each news item to 2 lines + 1 "आपके लिए सीख"; hook in first 3 s with a visual, not just speech.
9. **Thumbnail** — test 2 variants (face + 3 words) per episode; keep a template.
10. **Lighting match** — warm bounce from the diyas onto Avir's face in close-ups; slight contact shadow on the chair.
