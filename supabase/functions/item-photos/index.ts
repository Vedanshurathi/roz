// item-photos — finds a real photo for a grocery item and stores it in Storage.
// Source: the lead image of the item's English Wikipedia article (Wikimedia Commons,
// freely licensed), fetched as a 480 px thumbnail (already resized by Wikimedia).
// Saved to the public bucket item-photos; the URL is written to
//   catalog_items.image_url (+ products.stock_image_url of matching products)  mode 'catalog'
//   products.stock_image_url                                                  mode 'product'
// Caller must send the token stored in app_settings.item_photos_token (the DB trigger
// tg_product_fill and admins running the backfill do).
import { createClient } from "npm:@supabase/supabase-js@2";

const UA = "RozBazaar/1.0 (https://rozbazaar.shop) item-photo-fetcher";
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });

async function wikiThumb(title: string, size: number): Promise<string | null> {
  const u = `https://en.wikipedia.org/w/api.php?action=query&format=json&redirects=1&prop=pageimages&piprop=thumbnail&pithumbsize=${size}&titles=${encodeURIComponent(title)}`;
  const r = await fetch(u, { headers: { "User-Agent": UA } });
  if (!r.ok) return null;
  const j = await r.json();
  const pages = j?.query?.pages || {};
  for (const k of Object.keys(pages)) if (pages[k]?.thumbnail?.source) return pages[k].thumbnail.source;
  return null;
}
// Wikimedia Commons file search → [{file, thumb}] (thumb = small preview url)
async function commonsSearch(q: string, n: number, size: number) {
  const u = `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=${n}` +
    `&gsrsearch=${encodeURIComponent(q + " filetype:bitmap")}&prop=imageinfo&iiprop=url|mime&iiurlwidth=${size}`;
  const r = await fetch(u, { headers: { "User-Agent": UA } });
  if (!r.ok) return [];
  const j = await r.json();
  return Object.values(j?.query?.pages || {}).sort((a: any, b: any) => (a.index || 0) - (b.index || 0))
    .map((p: any) => ({ file: p.title, thumb: p.imageinfo?.[0]?.thumburl, mime: p.imageinfo?.[0]?.mime }))
    .filter((x: any) => x.thumb && /jpeg|png|webp/.test(x.mime || ""));
}
async function fileThumb(file: string, size: number): Promise<string | null> {
  const u = `https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url&iiurlwidth=${size}&titles=${encodeURIComponent(file)}`;
  const r = await fetch(u, { headers: { "User-Agent": UA } });
  if (!r.ok) return null;
  const j = await r.json();
  for (const p of Object.values(j?.query?.pages || {}) as any[]) if (p?.imageinfo?.[0]?.thumburl) return p.imageinfo[0].thumburl;
  return null;
}
async function b64(url: string): Promise<string | null> {
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA } });
    if (!r.ok) return null;
    const b = new Uint8Array(await r.arrayBuffer());
    let s = ""; for (const x of b) s += String.fromCharCode(x);
    return btoa(s);
  } catch { return null; }
}
async function wikiSearch(q: string): Promise<string | null> {
  const u = `https://en.wikipedia.org/w/api.php?action=query&format=json&list=search&srlimit=3&srsearch=${encodeURIComponent(q)}`;
  const r = await fetch(u, { headers: { "User-Agent": UA } });
  if (!r.ok) return null;
  const j = await r.json();
  for (const s of j?.query?.search || []) { const t = await wikiThumb(s.title, 480); if (t) return t; }
  return null;
}
async function store(path: string, src: string): Promise<string> {
  const r = await fetch(src, { headers: { "User-Agent": UA } });
  if (!r.ok) throw new Error("download " + r.status);
  const type = r.headers.get("content-type") || "image/jpeg";
  const buf = new Uint8Array(await r.arrayBuffer());
  const ext = type.includes("png") ? "png" : type.includes("webp") ? "webp" : "jpg";
  const full = `${path}.${ext}`;
  const { error } = await db.storage.from("item-photos").upload(full, buf, { contentType: type, upsert: true, cacheControl: "31536000" });
  if (error) throw new Error(error.message);
  return db.storage.from("item-photos").getPublicUrl(full).data.publicUrl + "?v=" + Date.now().toString(36);
}
async function preview(src: string): Promise<string | null> {
  try {
    const small = src.replace(/\/(\d+)px-/, "/120px-");
    const r = await fetch(small, { headers: { "User-Agent": UA } });
    if (!r.ok) return null;
    const b = new Uint8Array(await r.arrayBuffer());
    let s = ""; for (const x of b) s += String.fromCharCode(x);
    return btoa(s);
  } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ ok: false, msg: "POST only" }, 405);
  let body: any; try { body = await req.json(); } catch { return json({ ok: false, msg: "bad json" }, 400); }
  const { data: s } = await db.from("app_settings").select("value").eq("key", "item_photos_token").maybeSingle();
  if (!s || !body?.token || JSON.stringify(s.value) !== JSON.stringify(body.token)) return json({ ok: false, msg: "forbidden" }, 403);

  if (body.mode === "product") {
    const q = String(body.query || "").trim();
    if (!body.id || !q) return json({ ok: false, msg: "id + query" }, 400);
    const c = body.file ? null : ((await commonsSearch(q + " vegetable", 1, 480))[0] || (await commonsSearch(q, 1, 480))[0]);
    const src = body.file ? await fileThumb(body.file, 480) : ((c && (c as any).thumb) || (await wikiSearch(q + " vegetable")));
    if (!src) return json({ ok: false, msg: "no photo found" });
    const url = await store(`products/${body.id}`, src);
    const upd = db.from("products").update({ stock_image_url: url }).eq("id", body.id);
    await (body.file ? upd : upd.is("stock_image_url", null));
    return json({ ok: true, url });
  }

  // mode candidates: items = [{key, q}] → 4 Commons photos each, with small previews (for review)
  if (body.mode === "candidates") {
    const out: any[] = [];
    for (const it of body.items || []) {
      const c = await commonsSearch(it.q, body.n || 4, 110);
      for (const x of c) (x as any).preview = await b64((x as any).thumb);
      out.push({ key: it.key, q: it.q, candidates: c.map((x: any) => ({ file: x.file, preview: x.preview })) });
    }
    return json({ ok: true, data: out });
  }

  // mode catalog: items = [{key, title}] (Wikipedia article lead image) or [{key, file}] (a Commons file)
  const out: any[] = [];
  for (const it of body.items || []) {
    try {
      const src = it.file ? await fileThumb(it.file, 480) : await wikiThumb(it.title, 480);
      if (!src) { out.push({ key: it.key, title: it.title, ok: false, msg: "no image" }); continue; }
      const url = await store(`catalog/${it.key}`, src);
      await db.from("catalog_items").update({ image_url: url }).eq("key", it.key);
      await db.from("products").update({ stock_image_url: url }).eq("catalog_key", it.key);
      out.push({ key: it.key, title: it.title, ok: true, url, src, preview: body.preview ? await preview(src) : undefined });
    } catch (e) { out.push({ key: it.key, title: it.title, ok: false, msg: String(e) }); }
  }
  return json({ ok: true, data: out });
});
