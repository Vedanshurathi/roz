#!/usr/bin/env python3
"""Re-pin the inline-script hash in admin-site/ after editing index.html.

The admin site's Content-Security-Policy only lets the inline <script> run if its
sha256 matches. Any edit to that script changes the hash, so run this afterwards:
    python3 scripts/admin-site-csp.py
It updates both the <meta> CSP in index.html and the header in .htaccess.
"""
import base64, hashlib, pathlib, re

root = pathlib.Path(__file__).resolve().parent.parent / 'admin-site'
page, ht = root / 'index.html', root / '.htaccess'
h = page.read_text()
a = h.rindex('<script>') + len('<script>')
b = h.rindex('</script>')
sha = "'sha256-" + base64.b64encode(hashlib.sha256(h[a:b].encode()).digest()).decode() + "'"
pat = re.compile(r"'sha256-[A-Za-z0-9+/=]+'")
for f, text in ((page, h), (ht, ht.read_text())):
    if len(pat.findall(text)) != 1:
        raise SystemExit(f'{f.name}: expected exactly one sha256 source')
    f.write_text(pat.sub(sha, text))
print('pinned', sha)
