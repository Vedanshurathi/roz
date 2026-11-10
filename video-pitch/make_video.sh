#!/usr/bin/env bash
# Builds 110684-RozBazaar.mp4 for SBI Youth Ideathon 2026.
#   3 s opening screen (PDF page 4, filled)  +  edited recording  +  3 s ending screen (PDF page 5)
#   "UID: 110684" shown top-right for the whole video.
#
# Usage:
#   ./make_video.sh "VID_20261110_203441(1).mp4"                      # keep whole recording
#   ./make_video.sh "VID_20261110_203441(1).mp4" "0-35.5,41.2-98,104-125"   # keep only these parts (seconds)
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
IN="$1"; KEEP="${2:-}"
OUT="${OUT:-$DIR/110684-RozBazaar.mp4}"
FPS=$(ffprobe -v error -select_streams v:0 -show_entries stream=avg_frame_rate -of csv=p=0 "$IN")
[[ "$FPS" == "0/0" || -z "$FPS" ]] && FPS=30
FONT=$(fc-match -f '%{file}' 'sans:bold' 2>/dev/null || echo /usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf)
FIT="scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=$FPS,format=yuv420p"
A="aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo"

# Recording: keep listed segments (or all of it)
FC=""; N=0
if [[ -n "$KEEP" ]]; then
  IFS=',' read -ra SEGS <<< "$KEEP"
  for s in "${SEGS[@]}"; do
    a=${s%-*}; b=${s#*-}
    FC+="[0:v]trim=$a:$b,setpts=PTS-STARTPTS,$FIT[v$N];[0:a]atrim=$a:$b,asetpts=PTS-STARTPTS,$A[a$N];"
    N=$((N+1))
  done
else
  FC+="[0:v]$FIT[v0];[0:a]$A[a0];"; N=1
fi
LIST=""; for ((i=0;i<N;i++)); do LIST+="[v$i][a$i]"; done
FC+="${LIST}concat=n=$N:v=1:a=1[mv][ma];"
# Opening (input 1) and ending (input 2) screens, 3 s each, silent audio (inputs 3,4)
FC+="[1:v]$FIT[ov];[2:v]$FIT[ev];[3:a]$A[oa];[4:a]$A[ea];"
FC+="[ov][oa][mv][ma][ev][ea]concat=n=3:v=1:a=1[cv][ca];"
FC+="[cv]drawtext=fontfile='$FONT':text='UID\: 110684':fontsize=34:fontcolor=white:box=1:boxcolor=black@0.55:boxborderw=12:x=w-tw-36:y=30[outv]"

ffmpeg -hide_banner -y -i "$IN" \
  -loop 1 -framerate "$FPS" -t 3 -i "$DIR/opening.png" \
  -loop 1 -framerate "$FPS" -t 3 -i "$DIR/ending.png" \
  -f lavfi -t 3 -i anullsrc=r=48000:cl=stereo \
  -f lavfi -t 3 -i anullsrc=r=48000:cl=stereo \
  -filter_complex "$FC" -map "[outv]" -map "[ca]" \
  -c:v libx264 -preset medium -crf 23 -maxrate 5M -bufsize 10M -pix_fmt yuv420p \
  -c:a aac -b:a 128k -movflags +faststart "$OUT"

D=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT")
SZ=$(du -m "$OUT" | cut -f1)
echo "Done: $OUT  duration=${D}s  size=${SZ}MB  (must be 105-135 s, <100 MB)"
