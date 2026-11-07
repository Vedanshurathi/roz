#!/usr/bin/env python3
"""Research archive: one JSON line per checked claim/story in research/archive.jsonl.

  python3 pipeline/research.py add --title "..." --url URL --published 2026-11-05 --kind official|paper|news|rumour|demo|sponsored \
        --status released|announced|rumour|unverified --claim "one-line claim" [--region India] [--access "free tier"] [--price "..."]
  python3 pipeline/research.py list [--days 7] [--status released]
  python3 pipeline/research.py check-dup URL     # exit 1 if already archived

Rules: announcement != release; label rumours; an item needs 2 sources (one primary) before it goes on screen as fact.
"""
import argparse, datetime as dt, hashlib, json, sys
from pathlib import Path

ARCH = Path(__file__).resolve().parents[1] / "research/archive.jsonl"
IST = dt.timezone(dt.timedelta(hours=5, minutes=30))


def items():
    return [json.loads(l) for l in ARCH.read_text(encoding="utf-8").splitlines() if l.strip()] if ARCH.exists() else []


def key(url):
    return hashlib.sha1(url.strip().rstrip("/").lower().encode()).hexdigest()[:12]


def main(argv=None):
    p = argparse.ArgumentParser(); s = p.add_subparsers(dest="cmd", required=True)
    a = s.add_parser("add")
    for f in ("title", "url", "published", "kind", "status", "claim"):
        a.add_argument("--" + f, required=True)
    for f in ("region", "access", "price", "notes", "second_source"):
        a.add_argument("--" + f, default="")
    l = s.add_parser("list"); l.add_argument("--days", type=int, default=0); l.add_argument("--status", default="")
    c = s.add_parser("check-dup"); c.add_argument("url")
    x = p.parse_args(argv)
    if x.cmd == "add":
        if x.kind not in {"official", "paper", "news", "rumour", "demo", "sponsored"}:
            sys.exit("bad --kind")
        if x.status not in {"released", "announced", "rumour", "unverified"}:
            sys.exit("bad --status")
        k = key(x.url)
        if any(i["id"] == k for i in items()):
            sys.exit(f"duplicate: {x.url}")
        dt.date.fromisoformat(x.published)
        rec = {"id": k, "checked_at": dt.datetime.now(IST).replace(microsecond=0).isoformat(), **{f: getattr(x, f) for f in
               ("title", "url", "published", "kind", "status", "claim", "region", "access", "price", "notes", "second_source")}}
        rec["on_screen_ok"] = bool(rec["second_source"]) and rec["kind"] in {"official", "paper"} and rec["status"] == "released"
        ARCH.parent.mkdir(exist_ok=True)
        with open(ARCH, "a", encoding="utf-8") as f:
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")
        print("added", k, "on_screen_ok" if rec["on_screen_ok"] else "(needs 2nd source / primary / release before stating as fact)")
    elif x.cmd == "list":
        cut = dt.date.today() - dt.timedelta(days=x.days) if x.days else None
        for i in items():
            if (not cut or dt.date.fromisoformat(i["published"]) >= cut) and (not x.status or i["status"] == x.status):
                print(f'{i["published"]}  {i["status"]:10} {i["kind"]:9} {i["title"][:60]}  {i["url"]}')
    else:
        sys.exit(1 if any(i["id"] == key(x.url) for i in items()) else 0)


if __name__ == "__main__":
    main()
