#!/bin/bash
# Reel 3 finishing: grade the Avir renders (the grade + vignette that used to be a CSS filter on the WebGL layer),
# render the HyperFrames edit (IG and YT variants) and mux the audio mix.
#   reel3_finish.sh <scratch reel3 dir> <hyperframes bin> <out dir>
set -e
D=$1; HFB=$2; OUT=$3; mkdir -p "$OUT"
GRADE="eq=contrast=1.06:saturation=1.08:brightness=0.008,vignette=angle=PI/5.5"
for n in avirA avirB avirC avirC_yt; do
  [ -s "$D/avir/$n.mp4" ] || continue
  ffmpeg -loglevel error -y -i "$D/avir/$n.mp4" -vf "$GRADE" -c:v libx264 -crf 15 -preset medium -pix_fmt yuv420p "$D/avir/${n}_g.mp4"
done
for n in avirA avirB avirC; do cp "$D/avir/${n}_g.mp4" "$D/hf/media/$n.mp4"; cp "$D/avir/${n}_g.mp4" "$D/hf_yt/media/$n.mp4"; done
cp "$D/avir/avirC_yt_g.mp4" "$D/hf_yt/media/avirC_yt.mp4"
export PUPPETEER_EXECUTABLE_PATH=/opt/pw-browsers/chromium
for v in ig yt; do
  P="$D/hf"; [ $v = yt ] && P="$D/hf_yt"
  s=$(date +%s)
  (cd "$P" && "$HFB" render -o "$OUT/reel3_${v}_video.mp4" -f 24 -q looks -w 4 --no-browser-gpu > "$OUT/hf_$v.log" 2>&1)
  ffmpeg -loglevel error -y -i "$OUT/reel3_${v}_video.mp4" -i "$D/audio/mix_$v.wav" -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -shortest -movflags +faststart "$OUT/reel3_$v.mp4"
  echo "$v done in $(( $(date +%s) - s ))s"
done
