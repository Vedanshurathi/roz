# Character bible: host (name pending; recommended "Neel")

## Identity (never changes)
- Indian man, about 22, clearly masculine; defined jaw and cheekbones, warm medium-brown skin, light stubble.
- Short natural dark hair (black-brown), textured, soft side part with a slight fringe to his left. No dyed streaks.
- Dark brown almond eyes, thick straight brows, calm confident half-smile.
- Signature detail: small silver stud in his right ear (viewer's left).
- Build: average-athletic; natural proportions (no chibi, no oversized eyes).
- Personality: curious, warm, honest about failures; energetic without shouting.

## Style
Premium cinematic anime (think high-end anime film key art, not flat vector): soft painterly shading, detailed hair
strands, warm key light from one side, teal or blue rim light from screens, shallow depth of field, night-city bokeh,
subtle film grain.

## Changes episode to episode
Outfits (overshirt over white tee, hoodie, denim jacket, kurta for festivals), expressions, poses, locations
(his room/studio as the recurring set, plus streets, metro, cafés, rooftops).

## Continuity rules
1. Every scene image starts from the locked reference sheet (front, 3/4, side, 6 expressions).
2. Same face, hair and earring in every shot. Change outfit only between episodes or story scenes.
3. Text never covers his face. Keep captions in the lower third, clear of his chin.
4. Voice: Kokoro `hm_omega` (Hindi male), speed 1.0 → tempo 1.05. Script written in Devanagari for TTS.
   Every line is checked with Whisper before editing.

## Reference status (honest)
- `reference/host_v2_design_sketch.png`: code-drawn sketch for face shape, colours and outfit only.
  **Not** the final art and not premium quality.
- The premium reference sheet needs an image-generation model. None is available in this cloud
  environment (no GPU, no image API). Options are in the README "Character art" section.

## Prompt pack (for any image generator that permits commercial use)
Master prompt:
"Premium cinematic anime key art, portrait of a 22-year-old Indian man, clearly masculine, defined jawline and
cheekbones, warm medium-brown skin, light stubble, short natural textured dark hair with a soft side part and slight
fringe, dark brown almond eyes, thick straight eyebrows, calm confident half-smile, small silver stud earring in right
ear, dark olive overshirt over white t-shirt, warm key light from left, teal rim light from a laptop screen on the
right, night city bokeh background, shallow depth of field, detailed hair strands, painterly soft shading, subtle film
grain, natural proportions, high detail, 4:5"

Negative prompt: "chibi, child, teenager, flat vector, cartoon, oversized eyes, dyed hair, beard, glasses, logo, text,
watermark, extra fingers"

Reference sheet prompt (after the master is approved, give it the master image as reference):
"Character turnaround sheet of the same man: front, three-quarter, side profile; plus expression row: excited,
thinking, surprised, worried, laughing, explaining; same face, hair and earring, neutral grey background."
