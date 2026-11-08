# Avir character tool evaluation (2026-11-08)
`compare_faces.png`:
- **MetaPerson:** public sample head from avatarsdk/metaperson-loader-unity (BSD-3), rendered here in Blender Cycles with `render_mp.py`.
  Evaluation only; it is someone else's face, never Avir.
- **Ara 3D Gen:** a frame of the project's own `docs/media/demo.gif`. Ara could not be run in this session: the
  safety check blocks running its downloaded code until a permission rule is added.
- **Avir v2:** our Blender build (frame 40 of the v2 test).

## Round 2 (2026-11-08): Avaturn added — `compare_all.png`
- **Avaturn sample:** `avaturn/avaturn-unity-examples` (MIT repo), a 2022 photo-based export rendered with `render_glb.py`.
  Rig: 52 joints, Mixamo names, full fingers. This 2022 file has **no face blend shapes**; Avaturn says current exports
  add ARKit shapes and visemes (not verified without a fresh export). The default `avaturn-threejs-example` model is a
  blank mannequin.
- **Avaturn Terms of Use** (Goodsize Inc., last updated 26 Jan 2023), read from the published Google Doc:
  - avatars are Goodsize Content (owned by or licensed to Goodsize; the user gets a limited licence);
  - use needs **attribution** (credit + link to Avaturn);
  - **commercial use only after notifying hello@avaturn.me** with a link to the project;
  - Avaturn may ask you to stop using an avatar at its sole discretion;
  - users under 18 need a parent or guardian's supervision;
  - Pro plan is $800/month and the Basic plan is free.
- **MetaPerson:** the avatarsdk.com terms couldn't be read (the site refuses automated readers), so commercial
  rights for the free avatar are unconfirmed.
