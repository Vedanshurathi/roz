#!/usr/bin/env python3
"""Content studio CLI: new episode, QC, approval package, approval record, guarded publish.

  python3 pipeline/studio.py new <slug> --kind short|reel|long|post --title "..."
  python3 pipeline/studio.py qc <video> --kind short          # technical checks, writes <video>.qc.json
  python3 pipeline/studio.py package <episode_dir>            # hashes + approval page + email text
  python3 pipeline/studio.py approve <episode_dir> --hash <12 chars> --by <name> --channel claude_chat|github_comment
  python3 pipeline/studio.py status
  python3 pipeline/studio.py publish <episode_dir> [--execute] # dry-run unless --execute

Rules enforced in code (not just docs):
  * publish refuses unless an approval names the CURRENT package hash
  * any change to video / thumbnail / title / description / time / privacy changes the hash
  * a hash that was already published is never uploaded twice (logs/publish.jsonl)
"""
import argparse, datetime as dt, hashlib, html, json, os, re, shutil, subprocess, sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
CFG = yaml.safe_load((ROOT / "config/studio.yaml").read_text(encoding="utf-8"))
IST = dt.timezone(dt.timedelta(hours=5, minutes=30))
LOGS = ROOT / "logs"


def now_ist():
    return dt.datetime.now(IST).replace(microsecond=0)


def sha256(p: Path) -> str:
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for b in iter(lambda: f.read(1 << 20), b""):
            h.update(b)
    return h.hexdigest()


def append_log(name, rec):
    LOGS.mkdir(exist_ok=True)
    with open(LOGS / name, "a", encoding="utf-8") as f:
        f.write(json.dumps(rec, ensure_ascii=False) + "\n")


def read_log(name):
    p = LOGS / name
    return [json.loads(l) for l in p.read_text(encoding="utf-8").splitlines() if l.strip()] if p.exists() else []


def load_ep(d: Path):
    return yaml.safe_load((d / "episode.yaml").read_text(encoding="utf-8"))


def save_ep(d: Path, ep):
    (d / "episode.yaml").write_text(yaml.safe_dump(ep, allow_unicode=True, sort_keys=False), encoding="utf-8")


# ---------------- new ----------------
def cmd_new(a):
    d = ROOT / "episodes" / f"{now_ist():%Y-%m-%d}-{a.slug}"
    if d.exists():
        sys.exit(f"exists: {d}")
    d.mkdir(parents=True)
    for t in ("script.md", "storyboard.md", "sources.md", "instagram.md"):
        shutil.copy(ROOT / "templates" / t, d / t)
    ep = yaml.safe_load((ROOT / "templates/episode.yaml").read_text(encoding="utf-8"))
    ep.update(slug=a.slug, kind=a.kind, working_title=a.title, created=now_ist().isoformat())
    save_ep(d, ep)
    print(d)


# ---------------- QC ----------------
def ffprobe(p):
    out = subprocess.run(["ffprobe", "-v", "error", "-print_format", "json", "-show_streams", "-show_format", str(p)],
                         capture_output=True, text=True, check=True).stdout
    return json.loads(out)


def qc_video(video: Path, kind: str):
    spec = CFG["formats"][kind]
    info = ffprobe(video)
    v = next(s for s in info["streams"] if s["codec_type"] == "video")
    au = [s for s in info["streams"] if s["codec_type"] == "audio"]
    dur = float(info["format"]["duration"])
    num, den = v["r_frame_rate"].split("/")
    fps = float(num) / float(den)
    checks = []

    def chk(name, ok, detail):
        checks.append({"check": name, "ok": bool(ok), "detail": detail})

    chk("resolution", (v["width"], v["height"]) == (spec["w"], spec["h"]), f'{v["width"]}x{v["height"]} (want {spec["w"]}x{spec["h"]})')
    chk("fps", abs(fps - spec["fps"]) < 0.01, f"{fps:.2f}")
    chk("duration", 3 <= dur <= spec["max_s"], f"{dur:.2f}s (max {spec['max_s']})")
    chk("video_codec", v["codec_name"] == "h264" and v.get("pix_fmt") == "yuv420p", f'{v["codec_name"]} {v.get("pix_fmt")}')
    chk("audio_present", len(au) == 1 and au[0]["codec_name"] == "aac", ",".join(s["codec_name"] for s in au) or "none")
    if au:
        r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(video), "-map", "0:a", "-af", "ebur128=peak=true", "-f", "null", "-"],
                           capture_output=True, text=True).stderr
        summ = r[r.rfind("Summary:"):]
        lufs = float(re.search(r"I:\s+(-?[\d.]+) LUFS", summ).group(1))
        tp = float(re.search(r"Peak:\s+(-?[\d.]+) dBFS", summ).group(1))
        chk("loudness", abs(lufs - spec["loudness_lufs"]) <= 1.0, f"{lufs} LUFS (target {spec['loudness_lufs']})")
        chk("true_peak", tp <= spec["true_peak_db"] + 0.1, f"{tp} dBTP (max {spec['true_peak_db']})")
    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(video), "-vf", "blackdetect=d=0.25:pix_th=0.06", "-an", "-f", "null", "-"],
                       capture_output=True, text=True).stderr
    blacks = [(float(m.group(1)), float(m.group(2))) for m in re.finditer(r"black_start:([\d.]+) black_end:([\d.]+)", r)]
    unexpected = [b for b in blacks if b[0] > 0.05]
    chk("no_black_gaps", not unexpected, f"black segments {blacks} (an opening fade is allowed)")
    if au:
        r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(video), "-af", "silencedetect=n=-45dB:d=1.5", "-vn", "-f", "null", "-"],
                           capture_output=True, text=True).stderr
        sil = re.findall(r"silence_start: ([\d.]+)", r)
        chk("no_long_silence", not sil, f"silences >1.5s at {sil}")
    size = video.stat().st_size / 1e6
    chk("file_size", size < 4000, f"{size:.1f} MB")
    return {"video": str(video), "kind": kind, "sha256": sha256(video), "checked_at": now_ist().isoformat(),
            "passed": all(c["ok"] for c in checks), "checks": checks}


def cmd_qc(a):
    rep = qc_video(Path(a.video), a.kind)
    Path(a.video + ".qc.json").write_text(json.dumps(rep, indent=2, ensure_ascii=False), encoding="utf-8")
    for c in rep["checks"]:
        print(("PASS " if c["ok"] else "FAIL ") + f'{c["check"]:16} {c["detail"]}')
    print("QC", "PASSED" if rep["passed"] else "FAILED")
    sys.exit(0 if rep["passed"] else 1)


# ---------------- package / approve ----------------
def package_hash(ep, d: Path):
    files = {k: sha256(d / ep["files"][k]) for k in ("video", "thumbnail") if ep["files"].get(k)}
    yt = ep["youtube"]
    core = {"files": files, "title": yt["title"], "description": yt["description"], "tags": yt.get("tags", []),
            "publish_at_ist": yt["publish_at_ist"], "privacy": yt["privacy"], "kind": ep["kind"]}
    blob = json.dumps(core, sort_keys=True, ensure_ascii=False).encode()
    return hashlib.sha256(blob).hexdigest(), core


def cmd_package(a):
    d = Path(a.episode).resolve()
    ep = load_ep(d)
    vid = d / ep["files"]["video"]
    if not vid.exists():
        sys.exit(f"missing video {vid} (videos live outside git; see README)")
    qc = qc_video(vid, ep["kind"])
    if not qc["passed"]:
        sys.exit("QC failed — fix before packaging:\n" + "\n".join(c["check"] + ": " + c["detail"] for c in qc["checks"] if not c["ok"]))
    h, core = package_hash(ep, d)
    pk = d / "approval"
    pk.mkdir(exist_ok=True)
    yt, ig = ep["youtube"], ep.get("instagram", {})
    (pk / "package.json").write_text(json.dumps({"hash": h, "core": core, "qc": qc, "created": now_ist().isoformat(),
                                                 "research_cutoff_ist": ep.get("research_cutoff_ist")}, indent=2, ensure_ascii=False), encoding="utf-8")
    e = html.escape
    page = f"""<!doctype html><meta charset="utf-8"><title>Approval {e(ep['slug'])}</title>
<style>body{{font-family:system-ui,'Noto Sans Devanagari';max-width:760px;margin:24px auto;padding:0 16px;background:#0E1330;color:#FFF4E6}}
code{{background:#1A2150;padding:2px 6px;border-radius:6px}} .card{{background:#1A2150;border-radius:16px;padding:16px;margin:12px 0}}
video,img{{max-width:100%;border-radius:12px}} h1{{color:#FF9A3C}}</style>
<h1>Unfiltered Avir · approval package: {e(ep['working_title'])}</h1>
<p>Package hash: <code>{h[:12]}</code> · created {now_ist():%d %b %Y %H:%M} IST · research cut-off: {e(str(ep.get('research_cutoff_ist')))}</p>
<div class="card"><video controls src="../{e(ep['files']['video'])}"></video></div>
{f'<div class="card"><img src="../{e(ep["files"]["thumbnail"])}"></div>' if ep['files'].get('thumbnail') else ''}
<div class="card"><b>YouTube title</b><br>{e(yt['title'])}<br><br><b>Description</b><pre style="white-space:pre-wrap">{e(yt['description'])}</pre>
<b>Schedule</b>: {e(yt['publish_at_ist'])} IST · privacy after publish: {e(yt['privacy'])}</div>
<div class="card"><b>Instagram caption</b><pre style="white-space:pre-wrap">{e(ig.get('caption', '—'))}</pre></div>
<div class="card"><b>Story</b><p>{e(ep.get('summary', ''))}</p><b>Sources</b><pre style="white-space:pre-wrap">{e((d / 'sources.md').read_text(encoding='utf-8') if (d / 'sources.md').exists() else '—')}</pre></div>
<div class="card"><b>QC</b><ul>{''.join(f"<li>{'✅' if c['ok'] else '❌'} {e(c['check'])}: {e(c['detail'])}</li>" for c in qc['checks'])}</ul></div>
<div class="card"><b>To decide</b>: reply in the Claude chat (or on the GitHub approval issue) with one of<br>
<code>APPROVE {h[:12]}</code> · <code>REVISE {h[:12]}: what to change</code> · <code>REJECT {h[:12]}</code><br>
Approval covers only this exact video, thumbnail, title, description and time.</div>"""
    (pk / "package.html").write_text(page, encoding="utf-8")
    (pk / "email.md").write_text(
        f"Subject: [Approval needed] {ep['working_title']} — {yt['publish_at_ist']} IST — {h[:12]}\n\n"
        f"Title: {yt['title']}\nSchedule: {yt['publish_at_ist']} IST ({yt['privacy']})\nSummary: {ep.get('summary', '')}\n"
        f"Research cut-off: {ep.get('research_cutoff_ist')}\n\nPreview: <secure link>\n\n"
        f"Reply in Claude chat or on GitHub: APPROVE {h[:12]} / REVISE {h[:12]}: … / REJECT {h[:12]}\n", encoding="utf-8")
    ep["state"] = "awaiting_approval"
    ep["package_hash"] = h
    save_ep(d, ep)
    append_log("events.jsonl", {"at": now_ist().isoformat(), "event": "packaged", "episode": ep["slug"], "hash": h})
    print(f"packaged {ep['slug']} hash {h[:12]} -> {pk / 'package.html'}")


def cmd_approve(a):
    d = Path(a.episode).resolve()
    ep = load_ep(d)
    h, _ = package_hash(ep, d)
    if ep.get("package_hash") != h:
        sys.exit("files or metadata changed since packaging — run `package` again and get a fresh approval")
    if not h.startswith(a.hash) or len(a.hash) < 12:
        sys.exit(f"approval hash {a.hash} does not match current package {h[:12]} — NOT approved")
    if a.channel not in CFG["approval"]["accepted_channels"]:
        sys.exit(f"channel {a.channel} is not an accepted approval channel")
    rec = {"at": now_ist().isoformat(), "episode": ep["slug"], "hash": h, "by": a.by, "channel": a.channel, "evidence": a.evidence}
    append_log("approvals.jsonl", rec)
    ep["state"] = "approved"
    save_ep(d, ep)
    print("approved", h[:12])


def approved(h):
    return any(r["hash"] == h for r in read_log("approvals.jsonl"))


# ---------------- publish ----------------
def cmd_publish(a):
    d = Path(a.episode).resolve()
    ep = load_ep(d)
    h, core = package_hash(ep, d)
    problems = []
    if ep.get("package_hash") != h:
        problems.append("package changed after packaging")
    if not approved(h):
        problems.append(f"no approval recorded for {h[:12]}")
    if any(r["hash"] == h and r.get("status") == "uploaded" for r in read_log("publish.jsonl")):
        problems.append("this exact package was already uploaded (duplicate protection)")
    when = dt.datetime.fromisoformat(ep["youtube"]["publish_at_ist"]).replace(tzinfo=IST)
    if when < now_ist() - dt.timedelta(minutes=5):
        problems.append(f"scheduled time {when} is in the past — re-schedule and re-approve")
    if problems:
        print("REFUSED:\n - " + "\n - ".join(problems))
        sys.exit(2)
    plan = {"video": str(d / ep["files"]["video"]), "thumbnail": ep["files"].get("thumbnail"), "title": core["title"],
            "privacy": "private", "publishAt_utc": when.astimezone(dt.timezone.utc).isoformat().replace("+00:00", "Z"), "hash": h}
    if not a.execute:
        print("DRY RUN — would upload:\n" + json.dumps(plan, indent=2, ensure_ascii=False))
        return
    if not CFG["publishing"]["youtube"]["enabled"]:
        sys.exit("youtube publishing is disabled in config (enable only after OAuth setup is tested)")
    sys.path.insert(0, str(Path(__file__).parent))
    import youtube_upload as yu
    append_log("publish.jsonl", {"at": now_ist().isoformat(), "hash": h, "status": "started"})
    try:
        vid = yu.upload(d / ep["files"]["video"], ep["youtube"], when, CFG["publishing"]["youtube"])
        if ep["files"].get("thumbnail"):
            yu.set_thumbnail(vid, d / ep["files"]["thumbnail"])
    except Exception as ex:  # noqa: BLE001
        append_log("publish.jsonl", {"at": now_ist().isoformat(), "hash": h, "status": "failed", "error": str(ex)[:500]})
        raise
    append_log("publish.jsonl", {"at": now_ist().isoformat(), "hash": h, "status": "uploaded", "video_id": vid,
                                 "url": f"https://youtu.be/{vid}", "publish_at": plan["publishAt_utc"]})
    ep["state"] = "scheduled"
    ep["youtube"]["video_id"] = vid
    save_ep(d, ep)
    print(f"uploaded https://youtu.be/{vid} (private, scheduled {when} IST)")


def cmd_status(a):
    for d in sorted((ROOT / "episodes").glob("*/episode.yaml")):
        ep = yaml.safe_load(d.read_text(encoding="utf-8"))
        print(f"{d.parent.name:40} {ep.get('kind', ''):6} {ep.get('state', ''):18} {str(ep.get('package_hash', ''))[:12]}")


def main(argv=None):
    p = argparse.ArgumentParser()
    s = p.add_subparsers(dest="cmd", required=True)
    n = s.add_parser("new"); n.add_argument("slug"); n.add_argument("--kind", default="short", choices=["short", "reel", "long", "post"]); n.add_argument("--title", default="")
    q = s.add_parser("qc"); q.add_argument("video"); q.add_argument("--kind", default="short")
    k = s.add_parser("package"); k.add_argument("episode")
    ap = s.add_parser("approve"); ap.add_argument("episode"); ap.add_argument("--hash", required=True); ap.add_argument("--by", required=True)
    ap.add_argument("--channel", required=True); ap.add_argument("--evidence", default="")
    s.add_parser("status")
    pb = s.add_parser("publish"); pb.add_argument("episode"); pb.add_argument("--execute", action="store_true")
    a = p.parse_args(argv)
    {"new": cmd_new, "qc": cmd_qc, "package": cmd_package, "approve": cmd_approve, "status": cmd_status, "publish": cmd_publish}[a.cmd](a)


if __name__ == "__main__":
    main()
