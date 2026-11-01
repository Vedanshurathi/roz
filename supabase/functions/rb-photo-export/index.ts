// rb-photo-export — one-off helper (1 Nov 2026): returns photos from the public item-photos bucket as base64 text,
// so they can be copied to the customer website on Hostinger (the photos were using most of the free plan's data).
// Read-only. Caller must send the token stored in app_settings.item_photos_token (same as item-photos).
// After the copy it is redeployed as a 410 stub.
import { createClient } from "npm:@supabase/supabase-js@2";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });

function b64(buf: Uint8Array): string {
  let s = "";
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(s);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ ok: false, msg: "POST only" }, 405);
  let body: any; try { body = await req.json(); } catch { return json({ ok: false, msg: "bad json" }, 400); }
  const { data: s } = await db.from("app_settings").select("value").eq("key", "item_photos_token").maybeSingle();
  if (!s || !body?.token || JSON.stringify(s.value) !== JSON.stringify(body.token)) return json({ ok: false, msg: "forbidden" }, 403);
  const paths: string[] = (Array.isArray(body.paths) ? body.paths : [])
    .filter((p: unknown) => typeof p === "string" && /^(catalog|u|products)\/[A-Za-z0-9._-]+$/.test(p as string)).slice(0, 25);
  const files = [];
  for (const p of paths) {
    const { data, error } = await db.storage.from("item-photos").download(p);
    if (error || !data) { files.push({ path: p, error: String(error?.message || "missing") }); continue; }
    files.push({ path: p, type: data.type, b64: b64(new Uint8Array(await data.arrayBuffer())) });
  }
  return json({ ok: true, files });
});
