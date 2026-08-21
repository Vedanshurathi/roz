/* ============================================================
   Netlify Functions entry point. Same router, same auth, same
   security posture as server.js — just packaged the way Netlify
   can actually run it (a serverless function, not a long-lived
   process). See README.md for what "deploying to Netlify" really
   requires — plain drag-and-drop does not provision this.
   ============================================================ */
const serverless = require('serverless-http');
const express = require('express');
const { buildRouter } = require('../../src/router');

const app = express();
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data:; " +
    "connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  next();
});
app.use('/', buildRouter());

exports.handler = serverless(app);
