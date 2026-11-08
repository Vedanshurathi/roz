#!/bin/bash
# Resumable render of a Remotion composition in chunks; finished chunks are skipped, so it can be re-run after a restart.
#   render_chunks.sh <remotion_dir> <composition> <total_frames> <chunk_frames> <out_dir> <audio.wav> <final.mp4>
R=$1; COMP=$2; TOTAL=$3; CH=$4; OUT=$5; AUD=$6; FINAL=$7
mkdir -p "$OUT"; cd "$R"
n=$(( (TOTAL + CH - 1) / CH ))
for ((i=0; i<n; i++)); do
  a=$(( i * CH )); b=$(( a + CH - 1 )); (( b >= TOTAL )) && b=$(( TOTAL - 1 ))
  f=$(printf "%s/c%03d.mp4" "$OUT" $i)
  [ -s "$f" ] && continue
  s=$(date +%s)
  npx remotion render src/index.ts "$COMP" "$f.tmp.mp4" --frames=$a-$b --gl=swangle --concurrency=4 --crf=18 --muted --log=error > "$OUT/log_$i.txt" 2>&1 \
    && mv "$f.tmp.mp4" "$f" && echo "chunk $i/$n frames $a-$b done in $(( $(date +%s) - s ))s $(date +%H:%M)" >> "$OUT/progress.txt" \
    || { echo "chunk $i FAILED $(date +%H:%M)" >> "$OUT/progress.txt"; exit 1; }
done
ls "$OUT"/c*.mp4 | grep -v tmp | sed "s/^/file '/; s/$/'/" > "$OUT/list.txt"
ffmpeg -loglevel error -y -f concat -safe 0 -i "$OUT/list.txt" -i "$AUD" -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -shortest -movflags +faststart "$FINAL" \
  && echo "FINAL DONE $(date +%H:%M)" >> "$OUT/progress.txt"
