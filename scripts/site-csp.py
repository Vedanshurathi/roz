#!/usr/bin/env python3
"""Re-pin the inline-script hash of a static site after editing its index.html.

admin-site/ and staff-site/ have a Content-Security-Policy that only lets the
inline <script> run if its sha256 matches. Any edit to that script changes the
hash, so run this afterwards (no argument = both sites):
    python3 scripts/site-csp.py [admin-site|staff-site]
It updates both the <meta> CSP in index.html and the header in .htaccess.
"""
import base64, hashlib, pathlib, re, sys

base = pathlib.Path(__file__).resolve().parent.parent
for site in (sys.argv[1:] or ['admin-site', 'staff-site']):
  root = base / site
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
  print(site, 'pinned', sha)
