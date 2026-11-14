#!/bin/bash
# Resumable render of only the frame ranges a composition is actually on screen (e.g. Avir between screen-recording
# cut-aways). Each range is rendered in chunks (finished chunks are skipped), then joined into <out_dir>/<name>.mp4.
#   [BUNDLE=<prebuilt bundle dir>] [EXTRA="--scale=0.6667"] [CONC=2] render_ranges.sh <remotion_dir> <composition> <chunk_frames> <out_dir> '<props json>' name:a-b [name:a-b ...]
R=$1; COMP=$2; CH=$3; OUT=$4; PROPS=$5; shift 5
mkdir -p "$OUT"; cd "$R"
for spec in "$@"; do
  name=${spec%%:*}; rng=${spec#*:}; A=${rng%-*}; B=${rng#*-}
  [ -s "$OUT/$name.mp4" ] && continue
  k=0
  for ((a=A; a<=B; a+=CH)); do
    b=$(( a + CH - 1 )); (( b > B )) && b=$B
    f=$(printf "%s/%s_%03d.mp4" "$OUT" "$name" $k); k=$((k+1))
    [ -s "$f" ] && continue
    s=$(date +%s); ok=0
    for try in 1 2 3; do
      rm -f "$f.tmp.mp4"
      if npx remotion render "${BUNDLE:-src/index.ts}" "$COMP" "$f.tmp.mp4" --frames=$a-$b --props="$PROPS" --gl=swangle --concurrency=${CONC:-4} --crf=16 --muted ${EXTRA:-} --timeout=${FRAME_TIMEOUT:-180000} --log=error > "$OUT/log_${name}.txt" 2>&1; then
        mv "$f.tmp.mp4" "$f"; echo "$name frames $a-$b done in $(( $(date +%s) - s ))s $(date +%H:%M)" >> "$OUT/progress.txt"; ok=1; break
      fi
      echo "$name $a-$b try $try failed $(date +%H:%M)" >> "$OUT/progress.txt"
    done
    [ $ok = 1 ] || { echo "$name FAILED $(date +%H:%M)" >> "$OUT/progress.txt"; exit 1; }
  done
  ls "$OUT/${name}"_[0-9][0-9][0-9].mp4 | sed "s/^/file '/; s/$/'/" > "$OUT/list_$name.txt"
  ffmpeg -loglevel error -y -f concat -safe 0 -i "$OUT/list_$name.txt" -c copy "$OUT/$name.mp4" && echo "$name JOINED $(date +%H:%M)" >> "$OUT/progress.txt"
done
echo "ALL DONE $(date +%H:%M)" >> "$OUT/progress.txt"
