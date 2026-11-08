# Avir's studio: the recurring "Unfiltered Avir" set (v1)
Built by `../studio_room.py`, so it can be re-generated and edited in code.
- `studio.blend`: editable set (Blender 5.2). `studio.glb`: real-time copy (no Avir in it).
- **Layout:** Avir at the origin facing the camera; oak desk in front (monitor with code + AI chat, keyboard, podcast mic, mug).
  - **Back wall:** "UNFILTERED AVIR" cyan neon, saffron accent bar, hex felt panels, two floating shelves with books,
    plants and glowing cubes, cyan LED cove.
  - **Room:** night-city window with blinds (left), monstera plant and a softbox (right).
- **Camera presets:** `Cam_DeskMedium` (talking head), `Cam_Wide` (establishing), `Cam_Screen` (screen insert).
- **Lights:** front key softbox, fill, cyan and warm rims, moonlight from the window, practical LEDs.
- **Preview with Avir:** `python3 -I studio_room.py <out> --avir ../avaturn/avir_avaturn_try1.glb --preview 540`
