"""Minimal YouTube Data API v3 uploader (stdlib only). Called by `studio.py publish --execute`.

Credentials come from environment variables, set as GitHub Actions secrets or in a local shell,
never pasted into chat and never committed:
  YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN   (OAuth "installed app" client, scope youtube.upload)

Facts checked against Google's docs (Nov 2026):
  * videos.insert costs 1,600 quota units (default quota is 10,000/day, about 6 uploads).
  * Uploads from UNVERIFIED API projects created after 28 Jul 2020 are locked to PRIVATE until the
    project passes Google's API audit. Scheduling with publishAt needs privacyStatus=private.
  * status.containsSyntheticMedia is the API's altered/synthetic-content disclosure flag. Verify the
    field is still in the videos resource docs before first real use.
"""
import json, os, urllib.parse, urllib.request
from pathlib import Path

TOKEN_URL = "https://oauth2.googleapis.com/token"
UPLOAD_URL = "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status"
THUMB_URL = "https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId="


def access_token():
    for k in ("YT_CLIENT_ID", "YT_CLIENT_SECRET", "YT_REFRESH_TOKEN"):
        if not os.environ.get(k):
            raise RuntimeError(f"missing env {k} (see content-studio/SETUP.md)")
    body = urllib.parse.urlencode({"client_id": os.environ["YT_CLIENT_ID"], "client_secret": os.environ["YT_CLIENT_SECRET"],
                                   "refresh_token": os.environ["YT_REFRESH_TOKEN"], "grant_type": "refresh_token"}).encode()
    with urllib.request.urlopen(urllib.request.Request(TOKEN_URL, data=body), timeout=30) as r:
        return json.load(r)["access_token"]


def build_metadata(yt, when, cfg):
    return {
        "snippet": {"title": yt["title"][:100], "description": yt["description"][:5000], "tags": yt.get("tags", []),
                    "categoryId": cfg.get("category_id", "28"), "defaultLanguage": "hi", "defaultAudioLanguage": "hi"},
        "status": {"privacyStatus": "private",
                   "publishAt": when.astimezone(__import__("datetime").timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
                   "selfDeclaredMadeForKids": bool(cfg.get("made_for_kids", False)),
                   "containsSyntheticMedia": bool(cfg.get("disclose_synthetic", True))},
    }


def upload(video: Path, yt, when, cfg) -> str:
    tok = access_token()
    meta = json.dumps(build_metadata(yt, when, cfg)).encode()
    size = video.stat().st_size
    req = urllib.request.Request(UPLOAD_URL, data=meta, method="POST", headers={
        "Authorization": f"Bearer {tok}", "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": "video/mp4", "X-Upload-Content-Length": str(size)})
    with urllib.request.urlopen(req, timeout=60) as r:
        session = r.headers["Location"]
    with open(video, "rb") as f:
        put = urllib.request.Request(session, data=f.read(), method="PUT", headers={
            "Authorization": f"Bearer {tok}", "Content-Type": "video/mp4", "Content-Length": str(size)})
        with urllib.request.urlopen(put, timeout=3600) as r:
            return json.load(r)["id"]


def set_thumbnail(video_id: str, img: Path):
    tok = access_token()
    ctype = "image/png" if img.suffix.lower() == ".png" else "image/jpeg"
    req = urllib.request.Request(THUMB_URL + video_id, data=img.read_bytes(), method="POST",
                                 headers={"Authorization": f"Bearer {tok}", "Content-Type": ctype})
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.load(r)
