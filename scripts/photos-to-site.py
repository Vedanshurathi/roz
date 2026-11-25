#!/usr/bin/env python3
"""Copy item photos from Supabase Storage into the customer website (customer/img/p/) as small WebP files.

Why: photos were most of the free Supabase plan's data. The customer page swaps any Supabase photo link that is in
PHOTO_V (path → ?v= version) for its copy here, and falls back to Supabase if a copy is missing.

How (see CLAUDE.md "Item photos from the website"):
  1. deploy supabase/functions/rb-photo-export/index.ts, ask it for the photos with net.http_post (≤25 paths a call),
     save each reply's content (rows {id, content}) to a file;
  2. list the photo links in use as "path|v,path|v,…" (SQL in CLAUDE.md) into a file;
  3. python3 scripts/photos-to-site.py <links.txt> <reply files…>   (needs Pillow)
  4. redeploy rb-photo-export as the 410 stub; upload customer/index.html + customer/img/p/ to Hostinger.
Old files stay (other links may still point to them); names carry the version, so nothing is ever stale.
"""
import base64, io, json, os, re, sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'customer', 'img', 'p')
PAGE = os.path.join(ROOT, 'customer', 'index.html')
PRE = {'catalog': 'c', 'products': 'pr', 'u': 'u'}

def replies(fn):
    t = open(fn, encoding='utf-8').read()
    try:
        outer = json.loads(t); t = outer['result'] if isinstance(outer, dict) and 'result' in outer else t
    except ValueError:
        pass
    m = re.search(r'(\[\s*\{.*\}\s*\])', t, re.S)
    for row in json.loads(m.group(1)):
        for f in json.loads(row['content']).get('files', []):
            yield f

def main():
    links = [x.split('|') for x in open(sys.argv[1]).read().strip().split(',') if x]
    want = dict((p, v) for p, v in links)
    got = {}
    for fn in sys.argv[2:]:
        for f in replies(fn):
            if 'b64' in f: got[f['path']] = base64.b64decode(f['b64'])
    os.makedirs(OUT, exist_ok=True)
    man, made, skipped = {}, 0, []
    for p, v in sorted(want.items()):
        if p not in got: skipped.append(p); continue
        try:
            im = Image.open(io.BytesIO(got[p])); im.load()
        except Exception:
            skipped.append(p); continue
        im = im.convert('RGBA' if im.mode in ('RGBA', 'LA', 'P') else 'RGB')
        im.thumbnail((400, 400), Image.LANCZOS)
        folder, name = p.split('/'); base = name.rsplit('.', 1)[0]
        im.save(os.path.join(OUT, f"{PRE[folder]}-{base}{'-' + v if v else ''}.webp"), 'WEBP', quality=74, method=6)
        man[p] = v; made += 1
    page = open(PAGE, encoding='utf-8').read()
    js = '{' + ','.join(f"'{p}':'{v}'" for p, v in sorted(man.items())) + '}'
    page = re.sub(r'/\* PHOTO-V-START \*/.*?/\* PHOTO-V-END \*/', lambda _: '/* PHOTO-V-START */' + js + '/* PHOTO-V-END */', page, flags=re.S)
    open(PAGE, 'w', encoding='utf-8').write(page)
    print(f'{made} photos written to customer/img/p, PHOTO_V updated; not copied (missing/broken): {skipped}')

if __name__ == '__main__':
    main()
