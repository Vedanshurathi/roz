/* ============================================================
   RozBazaar Admin — traditional Node server.
   For Render, Railway, Fly.io, or any VPS: always-on, no cold
   starts. Runs entirely on mock data until USE_SUPABASE=true.

   Deploying to Netlify instead? Use netlify/functions/api.js —
   same routes, same auth, packaged as a serverless function
   because Netlify's static hosting cannot run a long-lived
   Express process. See README.md.
   ============================================================ */
const path = require('path');
const express = require('express');

(function loadEnv() {
  const fs = require('fs');
  const f = path.join(__dirname, '.env');
  if (!fs.existsSync(f)) return;
  for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
})();

const { buildRouter, store, CONFIGURED } = require('./src/router');
const app = express();
const PORT = process.env.PORT || 4000;

app.disable('x-powered-by');
app.use((req, res, next) => {                 /* CSP needs 'self' to resolve against this server's own origin */
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data:; " +
    "connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  next();
});

app.use('/api', buildRouter());
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1h' }));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => {
  console.log(`\n  RozBazaar Admin  →  http://localhost:${PORT}`);
  console.log(`  data source      →  ${store.USE_SUPABASE ? 'SUPABASE (live)' : 'MOCK (no real data — set USE_SUPABASE=true to launch)'}`);
  console.log(`  admin login      →  ${CONFIGURED ? 'configured' : 'NOT CONFIGURED — see warning above, run: npm run make-password'}\n`);
});
