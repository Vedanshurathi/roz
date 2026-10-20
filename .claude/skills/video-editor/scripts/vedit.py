#!/usr/bin/env python3
"""vedit - short-form / YouTube editing toolkit built on ffmpeg.

Subcommands
  probe       show duration, resolution, fps, loudness
  transcribe  word-level transcript -> words.json (needs faster-whisper)
  jumpcut     remove silences / dead air
  vertical    16:9 -> 9:16 (blurred background or centre crop)
  captions    words.json -> animated .ass captions (pop / karaoke / box)
  burn        burn an .ass/.srt file into a video
  punchin     quick zoom punch-ins at given timestamps
  finish      loudness-normalise and export a platform preset
  compress    shrink a video to fit a target file size (e.g. 25 MB)

Run `vedit.py <cmd> -h` for options.
"""
import argparse
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

PRESETS = {
    # name: (width, height, fps, video bitrate cap, loudness target LUFS)
    "reels": (1080, 1920, 30, "12M", -14),
    "shorts": (1080, 1920, 30, "12M", -14),
    "tiktok": (1080, 1920, 30, "12M", -14),
    "youtube": (1920, 1080, 30, "16M", -14),
    "youtube4k": (3840, 2160, 30, "45M", -14),
    "square": (1080, 1080, 30, "10M", -14),
    "feed45": (1080, 1350, 30, "10M", -14),
}


def run(cmd, capture=False):
    print("+", " ".join(str(c) for c in cmd), file=sys.stderr)
    if capture:
        return subprocess.run(cmd, check=True, capture_output=True, text=True)
    subprocess.run(cmd, check=True)


def need_ffmpeg():
    if not shutil.which("ffmpeg"):
        sys.exit("ffmpeg not found - install it first (https://ffmpeg.org)")


def probe_info(path):
    out = run(["ffprobe", "-v", "error", "-print_format", "json",
               "-show_format", "-show_streams", str(path)], capture=True).stdout
    data = json.loads(out)
    v = next((s for s in data["streams"] if s["codec_type"] == "video"), None)
    a = next((s for s in data["streams"] if s["codec_type"] == "audio"), None)
    info = {"duration": float(data["format"].get("duration", 0)), "has_audio": a is not None}
    if v:
        num, den = (v.get("r_frame_rate", "30/1").split("/") + ["1"])[:2]
        info.update(width=v["width"], height=v["height"],
                    fps=round(float(num) / float(den or 1), 3))
    return info


# ---------------------------------------------------------------- probe
def cmd_probe(a):
    info = probe_info(a.input)
    if info["has_audio"]:
        r = subprocess.run(["ffmpeg", "-hide_banner", "-i", a.input, "-af",
                            "loudnorm=print_format=json", "-f", "null", "-"],
                           capture_output=True, text=True)
        m = re.search(r"\{[^{}]*\"input_i\"[^{}]*\}", r.stderr, re.S)
        if m:
            ln = json.loads(m.group(0))
            info["loudness_lufs"] = float(ln["input_i"])
            info["true_peak_db"] = float(ln["input_tp"])
    print(json.dumps(info, indent=2))


# ---------------------------------------------------------------- transcribe
def cmd_transcribe(a):
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        sys.exit("pip install faster-whisper   (first run downloads the model)")
    model = WhisperModel(a.model, device="auto", compute_type="int8")
    segments, _ = model.transcribe(a.input, word_timestamps=True,
                                   language=a.language, vad_filter=True)
    words = []
    for seg in segments:
        for w in seg.words or []:
            words.append({"word": w.word.strip(), "start": round(w.start, 3),
                          "end": round(w.end, 3)})
    Path(a.output).write_text(json.dumps(words, indent=1, ensure_ascii=False))
    print(f"wrote {len(words)} words -> {a.output}")


# ---------------------------------------------------------------- jumpcut
def detect_silence(path, noise_db, min_sil):
    r = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(path), "-af",
                        f"silencedetect=noise={noise_db}dB:d={min_sil}",
                        "-f", "null", "-"], capture_output=True, text=True)
    starts = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", r.stderr)]
    ends = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", r.stderr)]
    return list(zip(starts, ends + [None] * (len(starts) - len(ends))))


def cmd_jumpcut(a):
    need_ffmpeg()
    info = probe_info(a.input)
    if not info["has_audio"]:
        sys.exit("no audio stream - nothing to detect")
    dur = info["duration"]
    keep, cursor = [], 0.0
    for s, e in detect_silence(a.input, a.noise, a.min_silence):
        e = dur if e is None else e
        seg_end = min(dur, s + a.pad)
        if seg_end - cursor > 0.05:
            keep.append((cursor, seg_end))
        cursor = max(0.0, e - a.pad)
    if dur - cursor > 0.05:
        keep.append((cursor, dur))
    if not keep:
        sys.exit("everything is silent - try a lower --noise value")
    expr = "+".join(f"between(t,{s:.3f},{e:.3f})" for s, e in keep)
    run(["ffmpeg", "-y", "-hide_banner", "-i", a.input,
         "-vf", f"select='{expr}',setpts=N/FRAME_RATE/TB",
         "-af", f"aselect='{expr}',asetpts=N/SR/TB",
         "-c:v", "libx264", "-crf", "18", "-preset", "medium",
         "-c:a", "aac", "-b:a", "192k", a.output])
    kept = sum(e - s for s, e in keep)
    print(f"kept {kept:.1f}s of {dur:.1f}s ({len(keep)} segments, cut {dur - kept:.1f}s)")


# ---------------------------------------------------------------- vertical
def cmd_vertical(a):
    need_ffmpeg()
    W, H = a.width, a.height
    if a.mode == "crop":
        vf = (f"scale={W}:{H}:force_original_aspect_ratio=increase,"
              f"crop={W}:{H}:(in_w-{W})*{a.focus}:(in_h-{H})/2,setsar=1")
        cmd = ["-vf", vf]
    else:  # blur: sharp video centred on a blurred, zoomed copy
        fc = (f"[0:v]split=2[bg][fg];"
              f"[bg]scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},"
              f"boxblur=30:5,eq=brightness=-0.08[bgb];"
              f"[fg]scale={W}:-2[fgs];"
              f"[bgb][fgs]overlay=(W-w)/2:(H-h)/2,setsar=1[v]")
        cmd = ["-filter_complex", fc, "-map", "[v]", "-map", "0:a?"]
    run(["ffmpeg", "-y", "-hide_banner", "-i", a.input, *cmd,
         "-c:v", "libx264", "-crf", "18", "-preset", "medium",
         "-c:a", "copy", a.output])


# ---------------------------------------------------------------- captions
def ass_time(t):
    t = max(0.0, t)
    h, rem = divmod(t, 3600)
    m, s = divmod(rem, 60)
    return f"{int(h)}:{int(m):02d}:{s:05.2f}"


def ass_color(hex_rgb, alpha="00"):
    h = hex_rgb.lstrip("#")
    return f"&H{alpha}{h[4:6]}{h[2:4]}{h[0:2]}".upper()


def chunk_words(words, max_words, max_chars, max_gap):
    chunks, cur = [], []
    for w in words:
        text_len = sum(len(x["word"]) + 1 for x in cur) + len(w["word"])
        gap = w["start"] - cur[-1]["end"] if cur else 0
        ends_sentence = cur and re.search(r"[.!?]$", cur[-1]["word"])
        if cur and (len(cur) >= max_words or text_len > max_chars or gap > max_gap or ends_sentence):
            chunks.append(cur)
            cur = []
        cur.append(w)
    if cur:
        chunks.append(cur)
    return chunks


def esc(text):
    return text.replace("\\", "\\\\").replace("{", "(").replace("}", ")")


def load_words(path):
    p = Path(path)
    if p.suffix.lower() == ".srt":  # spread each cue's time evenly across its words
        words = []
        for block in re.split(r"\n\s*\n", p.read_text(encoding="utf-8-sig").strip()):
            lines = block.strip().splitlines()
            tl = next((l for l in lines if "-->" in l), None)
            if not tl:
                continue
            def sec(x):
                hh, mm, ss = x.strip().replace(",", ".").split(":")
                return int(hh) * 3600 + int(mm) * 60 + float(ss)
            s, e = (sec(x) for x in tl.split("-->"))
            toks = " ".join(lines[lines.index(tl) + 1:]).split()
            step = (e - s) / max(1, len(toks))
            words += [{"word": t, "start": s + i * step, "end": s + (i + 1) * step}
                      for i, t in enumerate(toks)]
        return words
    return json.loads(p.read_text(encoding="utf-8"))


def cmd_captions(a):
    words = [w for w in load_words(a.words) if w["word"].strip()]
    if a.upper:
        for w in words:
            w["word"] = w["word"].upper()
    emph = {e.strip().upper().strip(".,!?") for e in (a.emphasis or "").split(",") if e.strip()}
    W, H = a.width, a.height
    margin_v = int(H * a.position)
    base, hi, out = ass_color(a.color), ass_color(a.highlight), ass_color(a.outline_color)
    box = ass_color(a.box_color, "30")
    border_style = 3 if a.style == "box" else 1
    header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {W}
PlayResY: {H}
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,{a.font},{a.size},{base},{hi},{box if a.style == 'box' else out},&H64000000,1,0,0,0,100,100,1,0,{border_style},{a.outline},{a.shadow},2,60,60,{margin_v},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    events = []
    chunks = chunk_words(words, a.max_words, a.max_chars, a.max_gap)
    for ci, chunk in enumerate(chunks):
        c_start, c_end = chunk[0]["start"], chunk[-1]["end"] + a.hold
        if ci + 1 < len(chunks):  # never overlap the next group
            c_end = min(c_end, chunks[ci + 1][0]["start"])
        if a.style == "karaoke":
            parts = []
            for w in chunk:
                k = max(1, int(round((w["end"] - w["start"]) * 100)))
                parts.append(f"{{\\kf{k}}}{esc(w['word'])}")
            # \kf fills Secondary->Primary, so swap so text fills to highlight colour
            txt = f"{{\\1c{hi}\\2c{base}\\fad(60,60)}}" + " ".join(parts)
            events.append((c_start, c_end, txt))
            continue
        # pop / box: one event per active word, current word highlighted + bounced
        for i, w in enumerate(chunk):
            s = w["start"]
            e = chunk[i + 1]["start"] if i + 1 < len(chunk) else c_end
            pieces = []
            for j, x in enumerate(chunk):
                t = esc(x["word"])
                is_emph = x["word"].upper().strip(".,!?") in emph
                if j == i:
                    pop = "\\fscx115\\fscy115\\t(0,90,\\fscx100\\fscy100)" if a.style == "pop" else ""
                    col = ass_color(a.emph_color) if is_emph else hi
                    pieces.append(f"{{\\1c{col}{pop}}}{t}{{\\1c{base}\\fscx100\\fscy100}}")
                elif is_emph:
                    pieces.append(f"{{\\1c{ass_color(a.emph_color)}}}{t}{{\\1c{base}}}")
                else:
                    pieces.append(t)
            intro = "{\\fad(40,0)}" if i == 0 else ""
            events.append((s, e, intro + " ".join(pieces)))
    lines = [f"Dialogue: 0,{ass_time(s)},{ass_time(e)},Cap,,0,0,0,,{t}" for s, e, t in events]
    Path(a.output).write_text(header + "\n".join(lines) + "\n", encoding="utf-8")
    print(f"wrote {len(lines)} caption events -> {a.output}")


# ---------------------------------------------------------------- burn
def ff_path(p):
    # ffmpeg filter-arg escaping for paths (Windows drive colons, quotes)
    return str(Path(p).resolve()).replace("\\", "/").replace(":", "\\:").replace("'", "\\'")


def cmd_burn(a):
    need_ffmpeg()
    flt = f"subtitles='{ff_path(a.subs)}'"
    if a.fonts_dir:
        flt += f":fontsdir='{ff_path(a.fonts_dir)}'"
    run(["ffmpeg", "-y", "-hide_banner", "-i", a.input, "-vf", flt,
         "-c:v", "libx264", "-crf", "18", "-preset", "medium", "-c:a", "copy", a.output])


# ---------------------------------------------------------------- punchin
def cmd_punchin(a):
    need_ffmpeg()
    info = probe_info(a.input)
    W, H = info["width"], info["height"]
    times = [float(t) for t in a.at.split(",") if t.strip()]
    if not times:
        sys.exit("--at needs at least one timestamp")
    z, d, r = a.zoom, a.duration, a.ramp
    # each punch: ease up to z over `ramp` s, hold, ease back out over `ramp` s
    terms = []
    for t in times:
        up = f"clip((t-{t})/{r},0,1)"
        down = f"clip(({t + d}-t)/{r},0,1)"
        terms.append(f"min({up},{down})")
    amt = "max(" * (len(terms) - 1) + terms[0] + "".join(f",{x})" for x in terms[1:])
    zexpr = f"(1+({z}-1)*{amt})"
    vf = (f"scale=w='trunc({W}*{zexpr}/2)*2':h='trunc({H}*{zexpr}/2)*2':eval=frame,"
          f"crop={W}:{H}:(in_w-{W})/2:(in_h-{H})*{a.focus_y},setsar=1")
    run(["ffmpeg", "-y", "-hide_banner", "-i", a.input, "-vf", vf,
         "-c:v", "libx264", "-crf", "18", "-preset", "medium", "-c:a", "copy", a.output])


# ---------------------------------------------------------------- finish
def cmd_finish(a):
    need_ffmpeg()
    W, H, fps, maxrate, lufs = PRESETS[a.preset]
    info = probe_info(a.input)
    vf = (f"scale={W}:{H}:force_original_aspect_ratio=decrease,"
          f"pad={W}:{H}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,fps={fps},format=yuv420p")
    cmd = ["ffmpeg", "-y", "-hide_banner", "-i", a.input, "-vf", vf,
           "-c:v", "libx264", "-preset", "slow", "-crf", str(a.crf),
           "-maxrate", maxrate, "-bufsize", maxrate, "-profile:v", "high",
           "-g", str(fps * 2), "-movflags", "+faststart"]
    if info["has_audio"]:
        cmd += ["-af", f"loudnorm=I={lufs}:TP=-1.0:LRA=11,aresample=48000",
                "-c:a", "aac", "-b:a", "320k", "-ar", "48000"]
    run(cmd + [a.output])


# ---------------------------------------------------------------- compress
def cmd_compress(a):
    need_ffmpeg()
    info = probe_info(a.input)
    dur = info["duration"]
    audio_k = 128 if info["has_audio"] else 0
    # 3% headroom for container overhead
    total_k = a.target_mb * 8 * 1024 * 0.97 / dur
    video_k = int(total_k - audio_k)
    if video_k < 300:
        sys.exit(f"{a.target_mb} MB is too small for {dur:.0f}s - try a bigger target or trim it")
    vf = []
    if a.max_height and info.get("height", 0) > a.max_height:
        vf = ["-vf", f"scale=-2:{a.max_height}"]
    log = str(Path(a.output).with_suffix("")) + "_2pass"
    common = ["-c:v", "libx264", "-preset", "slow", "-b:v", f"{video_k}k",
              "-maxrate", f"{int(video_k * 1.5)}k", "-bufsize", f"{video_k * 2}k",
              "-pix_fmt", "yuv420p", "-passlogfile", log]
    run(["ffmpeg", "-y", "-hide_banner", "-i", a.input, *vf, *common, "-pass", "1",
         "-an", "-f", "mp4", "/dev/null" if sys.platform != "win32" else "NUL"])
    audio = ["-c:a", "aac", "-b:a", f"{audio_k}k"] if audio_k else ["-an"]
    run(["ffmpeg", "-y", "-hide_banner", "-i", a.input, *vf, *common, "-pass", "2",
         *audio, "-movflags", "+faststart", a.output])
    for f in Path(log).parent.glob(Path(log).name + "*"):
        f.unlink()
    size = Path(a.output).stat().st_size / 1024 / 1024
    print(f"{a.output}: {size:.1f} MB (target {a.target_mb} MB, video {video_k} kbps)")


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)

    s = sub.add_parser("probe"); s.add_argument("input"); s.set_defaults(fn=cmd_probe)

    s = sub.add_parser("transcribe")
    s.add_argument("input"); s.add_argument("-o", "--output", default="words.json")
    s.add_argument("--model", default="small", help="tiny/base/small/medium/large-v3")
    s.add_argument("--language", default=None, help="e.g. en, hi (auto if omitted)")
    s.set_defaults(fn=cmd_transcribe)

    s = sub.add_parser("jumpcut")
    s.add_argument("input"); s.add_argument("output")
    s.add_argument("--noise", type=float, default=-35, help="silence threshold dB (default -35)")
    s.add_argument("--min-silence", type=float, default=0.35, help="shortest gap to cut, s")
    s.add_argument("--pad", type=float, default=0.08, help="breathing room kept each side, s")
    s.set_defaults(fn=cmd_jumpcut)

    s = sub.add_parser("vertical")
    s.add_argument("input"); s.add_argument("output")
    s.add_argument("--mode", choices=["blur", "crop"], default="blur")
    s.add_argument("--focus", type=float, default=0.5, help="crop mode: 0=left 0.5=centre 1=right")
    s.add_argument("--width", type=int, default=1080); s.add_argument("--height", type=int, default=1920)
    s.set_defaults(fn=cmd_vertical)

    s = sub.add_parser("captions")
    s.add_argument("words", help="words.json from transcribe, or an .srt")
    s.add_argument("-o", "--output", default="captions.ass")
    s.add_argument("--style", choices=["pop", "karaoke", "box"], default="pop")
    s.add_argument("--font", default="Montserrat Black")
    s.add_argument("--size", type=int, default=84)
    s.add_argument("--color", default="#FFFFFF"); s.add_argument("--highlight", default="#FFE600")
    s.add_argument("--emph-color", default="#00FF88"); s.add_argument("--emphasis", help="comma list of words to colour")
    s.add_argument("--outline-color", default="#000000"); s.add_argument("--box-color", default="#000000")
    s.add_argument("--outline", type=float, default=6); s.add_argument("--shadow", type=float, default=2)
    s.add_argument("--position", type=float, default=0.30, help="distance from bottom as fraction of height")
    s.add_argument("--max-words", type=int, default=3); s.add_argument("--max-chars", type=int, default=18)
    s.add_argument("--max-gap", type=float, default=0.6); s.add_argument("--hold", type=float, default=0.15)
    s.add_argument("--no-upper", dest="upper", action="store_false")
    s.add_argument("--width", type=int, default=1080); s.add_argument("--height", type=int, default=1920)
    s.set_defaults(fn=cmd_captions)

    s = sub.add_parser("burn")
    s.add_argument("input"); s.add_argument("subs"); s.add_argument("output")
    s.add_argument("--fonts-dir", help="folder with .ttf/.otf fonts used by the captions")
    s.set_defaults(fn=cmd_burn)

    s = sub.add_parser("punchin")
    s.add_argument("input"); s.add_argument("output")
    s.add_argument("--at", required=True, help="comma list of seconds, e.g. 1.2,4.8,9")
    s.add_argument("--zoom", type=float, default=1.15)
    s.add_argument("--duration", type=float, default=1.2)
    s.add_argument("--ramp", type=float, default=0.12, help="ease time in/out, s (0.01 = hard cut)")
    s.add_argument("--focus-y", type=float, default=0.4, help="0=top 0.5=centre (faces sit high)")
    s.set_defaults(fn=cmd_punchin)

    s = sub.add_parser("finish")
    s.add_argument("input"); s.add_argument("output")
    s.add_argument("--preset", choices=sorted(PRESETS), default="reels")
    s.add_argument("--crf", type=int, default=17)
    s.set_defaults(fn=cmd_finish)

    s = sub.add_parser("compress")
    s.add_argument("input"); s.add_argument("output")
    s.add_argument("--target-mb", type=float, default=25)
    s.add_argument("--max-height", type=int, default=1920, help="downscale if taller (keeps 1080x1920)")
    s.set_defaults(fn=cmd_compress)

    a = p.parse_args()
    a.fn(a)


if __name__ == "__main__":
    main()
