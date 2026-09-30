# Deploy — step by step

Three pieces:

1. The API on Render.
2. The customer app on Hostinger.
3. The vendor app on Hostinger.

The old apps keep working the whole time. Test the new ones on test sub-domains, then switch.

> **The API must live on a sub-domain of rozbazaar.shop** (e.g. `api.rozbazaar.shop`), not on
> `onrender.com`. Login cookies are `SameSite=Lax`, and browsers only send them to the same
> site. `api.rozbazaar.shop` + `rozbazaar.shop` = same site ✅. `…onrender.com` + `rozbazaar.shop`
> = different sites ❌ (login would silently fail).

## 1. API on Render (new web service)

1. Render → **New → Web Service** → connect GitHub `Vedanshurathi/roz`, branch `main` (after this
   work is merged).
2. Settings:

   | field | value |
   |---|---|
   | Name | `rozbazaar-api` |
   | Root Directory | `platform` |
   | Runtime | Node (22) |
   | Build Command | `npm ci --include=dev && npm run build -w @rozbazaar/shared && npm run build -w @rozbazaar/api` |
   | Start Command | `npm run start -w @rozbazaar/api` |
   | Health Check Path | `/healthz` |
   | Instance | 1 instance (rate limits are per instance — see SECURITY.md #5) |

3. **Environment variables** (Render → Environment). Never commit these:

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

   While testing on the beta sub-domains (step 4), set the app URLs and add the beta origins:

   ```
   CUSTOMER_APP_URL=https://beta.rozbazaar.shop
   VENDOR_APP_URL=https://vendor-beta.rozbazaar.shop
   CORS_ORIGINS=https://beta.rozbazaar.shop,https://vendor-beta.rozbazaar.shop,https://rozbazaar.shop,https://vendor.rozbazaar.shop
   ```

4. **Custom domain:**
   - Render → the service → Settings → Custom Domains → add `api.rozbazaar.shop`.
   - Hostinger → Domains → rozbazaar.shop → DNS → add the `CNAME` record `api` → the target Render
     shows.
   - Wait until Render shows the certificate as issued.
5. Check: open `https://api.rozbazaar.shop/healthz` → `{"status":"ok"}`.

The API refuses to start if something is unsafe (http URLs, `*` in CORS, short secret, missing
service key). The Render log says exactly which variable is wrong.

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
3. Set the API variables for beta (step 1.3) and redeploy the API.
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
3. Set the API variables back to the final URLs (step 1.3) and redeploy.
4. After a few days without problems:
   - run the SQL from SECURITY.md #3;
   - move the old `customer/index.html` and `vendor-site/` into an archive folder.

## Rolling back

Upload the old `customer/index.html` (+ `sw.js`) or `vendor-site/*` again. The database is
unchanged by the switch, so both versions work against it.
