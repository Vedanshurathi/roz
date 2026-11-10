# SBI Youth Ideathon 2026 — Video Pitch (UID 110684, RozBazaar)

- `opening.png` — PDF page 4 with UID, Team Name, Idea Name and School Name filled in (shown for 3 s at the start).
- `ending.png` — PDF page 5, sponsor thank-you screen, unchanged (shown for 3 s at the end).
- `make_video.sh` — builds `110684-RozBazaar.mp4` (opening + recording + ending, with "UID: 110684" in the top-right corner the whole time).

## Upload the recording here
Put `VID_20261110_203441(1).mp4` in this folder (GitHub: **Add file → Upload files**).

## Build
```bash
./make_video.sh "VID_20261110_203441(1).mp4" "0-35.5,41.2-98"
```
The second argument lists the parts to keep, in seconds. Leave it out to keep the whole recording.
