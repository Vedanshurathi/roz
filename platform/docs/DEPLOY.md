# Deploy — step by step

Three pieces:

1. **The API** — now running for free on **Supabase Edge Functions** (already deployed, §0).
   Hostinger Node.js (§1) stays possible if you ever want it on `api.rozbazaar.shop`.
2. The customer app: a static website on Hostinger.
3. The vendor app: a static website on Hostinger.

The old apps keep working the whole time. Test the new ones on test sub-domains, then switch.

## 0. API on Supabase Edge Functions (free — in use since 1 Oct 2026)

- Address: `https://srvpfyjmwaruebbkqkdj.supabase.co/functions/v1/api`
  (health check: `…/functions/v1/api/healthz` → `{"status":"ok"}`).
- Free plan: about 500,000 calls a month (check Supabase's pricing page). No server to run, never
  sleeps.
- It is the same Express API, running on Deno. `npm run build:edge` writes
  `../supabase/functions/api/` (the sources + `deno.json`) and `bundle.js` (the same code as one
  file).
- Settings are built in (`supabase/functions/api/index.ts`): production mode, header sessions,
  the app URLs and allowed origins (rozbazaar.shop, www, vendor, beta, vendor-beta). Any of them can
  be overridden with a function secret (Supabase → Edge Functions → Secrets).
- The session secret is `app_settings.api_session_secret` (made in the database, readable only with
  the service key). A `SESSION_SECRET` function secret would take priority.
- **Sessions travel in the `X-RB-Session` header, not cookies**, because supabase.co is a different
  site from rozbazaar.shop (see SECURITY.md).

**Update the deployed API after a code change**

1. `cd platform && npm run build:edge`, run the checks, commit and push (the repo is public).
2. Redeploy the `api` function with `index.ts` =
   `import "https://cdn.jsdelivr.net/gh/Vedanshurathi/roz@<commit>/supabase/functions/api/bundle.js";`
   plus `supabase/functions/api/deno.json`, JWT verification **off** (the API checks sessions
   itself). Claude does this with the Supabase connector; or with the Supabase CLI:
   `supabase functions deploy api --project-ref srvpfyjmwaruebbkqkdj --no-verify-jwt`
   (from the repo root — this uploads the sources directly).
3. Check `…/functions/v1/api/healthz`.

**Google login** — Supabase → Authentication → URL Configuration → Redirect URLs → add:

```
https://srvpfyjmwaruebbkqkdj.supabase.co/functions/v1/api/v1/customer/auth/callback
https://srvpfyjmwaruebbkqkdj.supabase.co/functions/v1/api/v1/vendor/auth/callback
```

**Build the apps for it:**
`VITE_API_URL=https://srvpfyjmwaruebbkqkdj.supabase.co/functions/v1/api npm run build`, then
upload as in §4–5. Skip §1 entirely.

---

> The sections below are for running the API on **Hostinger** instead (Node.js).
>
> **The API must then live on a sub-domain of rozbazaar.shop** (e.g. `api.rozbazaar.shop`). Login
> cookies are `SameSite=Lax`, and browsers only send them to the same site.
>
> **Your Hostinger plan must run Node.js** (Business / Cloud plans, or a VPS).

## 1. API on Hostinger

### Option A — Node.js app (Business / Cloud plan)

1. hPanel → **Websites → Add website → Node.js app**. Connect GitHub `Vedanshurathi/roz` (branch
   `main`), or upload a zip of the `platform/` folder. **Don't include `node_modules`.**
2. Settings:

   | field                | value                                                      |
   | -------------------- | ---------------------------------------------------------- |
   | Root / app directory | `platform`                                                 |
   | Node version         | 22                                                         |
   | Framework            | Express (or "Other")                                       |
   | Build command        | `npm ci --include=dev && npm run build:api`                |
   | Start command        | `npm start`                                                |
   | Domain               | `api.rozbazaar.shop` (hPanel creates the sub-domain + SSL) |

3. **Environment variables** (the app's Environment/Variables screen). Never commit these:

   ```
   NODE_ENV=production
   LOG_LEVEL=info
   SUPABASE_URL=https://srvpfyjmwaruebbkqkdj.supabase.co
   SUPABASE_ANON_KEY=<Supabase → Project Settings → API → anon / publishable key>
   SUPABASE_SERVICE_ROLE_KEY=<same page → service_role key (secret)>
   SESSION_SECRET=<run: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))">
   PUBLIC_API_URL=https://api.rozbazaar.shop
   CUSTOMER_APP_URL=https://rozbazaar.shop
   VENDOR_APP_URL=https://vendor.rozbazaar.shop
   CORS_ORIGINS=https://rozbazaar.shop,https://www.rozbazaar.shop,https://vendor.rozbazaar.shop
   TRUST_PROXY=1
   ```

   Hostinger sets `PORT` itself; the API listens on it. While testing on the beta sub-domains
   (step 4), set the app URLs and add the beta origins:

   ```
   CUSTOMER_APP_URL=https://beta.rozbazaar.shop
   VENDOR_APP_URL=https://vendor-beta.rozbazaar.shop
   CORS_ORIGINS=https://beta.rozbazaar.shop,https://vendor-beta.rozbazaar.shop,https://rozbazaar.shop,https://vendor.rozbazaar.shop
   ```

4. Deploy. Then open `https://api.rozbazaar.shop/healthz` → you should see `{"status":"ok"}`.

The API refuses to start if something is unsafe (http URLs, `*` in CORS, short secret, missing
service key). The app's log in hPanel says exactly which variable is wrong.

### Option B — Hostinger VPS

1. Pick the Ubuntu template, then SSH in and install Node 22.
2. Deploy the API:

   ```bash
   git clone https://github.com/Vedanshurathi/roz && cd roz/platform
   npm ci --include=dev && npm run build:api
   # put the variables above (plus PORT=8080) in apps/api/.env — readable only by this user
   npm i -g pm2 && pm2 start "node --env-file=apps/api/.env apps/api/dist/server.js" --name rozbazaar-api
   pm2 save && pm2 startup
   ```

3. Put nginx in front: `api.rozbazaar.shop` → `http://127.0.0.1:8080`, with a Let's Encrypt
   certificate (`certbot --nginx`). Keep `TRUST_PROXY=1`.
4. Hostinger DNS: add an `A` record `api` → the VPS IP.

## 2. Supabase settings (once)

Supabase → Authentication → URL Configuration → **Redirect URLs** → add:

```
https://api.rozbazaar.shop/v1/customer/auth/callback
https://api.rozbazaar.shop/v1/vendor/auth/callback
```

(Google login now returns to the API, which finishes the login and sends the person back to the
app.)

## 3. Build the apps (on your computer)

```bash
cd platform
npm ci
VITE_API_URL=https://api.rozbazaar.shop npm run build
```

This creates:

- `apps/customer/dist/` — the customer website
- `apps/vendor/dist/` — the vendor website

Each folder already contains its `.htaccess`: security headers, HTTPS redirect, and "every page →
index.html" for the app's links.

## 4. Test on beta sub-domains first

1. Hostinger → create sub-domains `beta.rozbazaar.shop` and `vendor-beta.rozbazaar.shop`.
2. Upload **everything inside** `apps/customer/dist/` into beta's `public_html`, and everything
   inside `apps/vendor/dist/` into vendor-beta's `public_html`.
   - Include the hidden files: `.htaccess` and `.well-known/` (turn on "show hidden files" in the
     File Manager).
3. Set the API variables for beta (step 1) and redeploy the API.
4. On a real phone:
   - order something as a customer;
   - log in as a vendor;
   - take it through on the way → bill → customer approves → payment → delivery code;
   - turn on alerts on both phones.

## 5. Switch (cut-over)

1. **Customer:** in `rozbazaar.shop`'s `public_html`, replace `index.html` and the other app
   files with the contents of `apps/customer/dist/`. Keep:
   - `vendor.html` (it forwards old vendor links);
   - anything else not built by the app.

   The build already carries `.well-known/assetlinks.json` (the Play Store app's link),
   `privacy.html`, `og.jpg`, `sw.js` and the icons, so those are updated in the same upload.

2. **Vendor:** replace `vendor.rozbazaar.shop`'s `public_html` with `apps/vendor/dist/`.
3. Set the API variables back to the final URLs (step 1) and redeploy.
4. After a few days without problems:
   - run the SQL from SECURITY.md #3;
   - move the old `customer/index.html` and `vendor-site/` into an archive folder.

## Rolling back

Upload the old `customer/` files or `vendor-site/*` again. The database is unchanged by the switch,
so both versions work against it.

> **Always upload the old `.htaccess` too** (`customer/.htaccess`). The new build's `.htaccess`
> has a Content-Security-Policy that only allows `api.rozbazaar.shop`; if it stays in
> `public_html`, the old app cannot load supabase-js or reach Supabase and shows **no products,
> vendors or villages** (this happened on 1 Oct 2026). Also delete the new app's leftovers:
> the `assets/` and `brand/` folders, `privacy.css`, `privacy.js`.
