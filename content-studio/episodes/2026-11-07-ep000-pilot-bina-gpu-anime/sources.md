# Sources (research cut-off: 2026-11-07 17:00 IST)
This episode makes no news claims; it documents how it was made.
| id | Claim used on screen | Source | Checked | Status |
|----|----|----|----|----|
| s1 | Voice made with a free, offline model | Kokoro-82M (Apache-2.0 per model card mirrors; confirm on the official card before monetising) run via sherpa-onnx | 2026-11-07 | released |
| s2 | No GPU used | Render log: CPU-only cloud container, 4 vCPU, no GPU present (`nvidia-smi` not found) | 2026-11-07 | verified locally |
| s3 | Lip-sync driven by voice loudness | content-studio/../remotion/src/anime/Pilot.tsx (mouth = per-frame RMS of the voice track) | 2026-11-07 | verified locally |
