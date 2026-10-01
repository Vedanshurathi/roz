// Sends a real Web Push notification to every device a person has subscribed on (VAPID keys
// generated for this project). Called by the database (push_note) right after a notification
// row is written, so the in-app inbox and the phone alert stay in sync.
//
// Tracking: with notification_id it records on that row how many phones it went to
// (push_devices / push_sent / push_failed / push_at) and puts the id in the payload as `nid`,
// so each site's sw.js can report "delivered" (push arrived on the phone) and "opened" (tapped)
// back through notification_track().
import webpush from "npm:web-push@3.6.7";
import { createClient } from "jsr:@supabase/supabase-js@2";

const VAPID_PUBLIC = "BFlTM-YF_0e6X_gZBy4ptZzxxM25c_l-C9kIOKZOiKbYybWBQom8L0CEoU9xLRK5vyiJml4sSq0Q7OUmynyaOhQ";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// The private VAPID key is not in the code: it is read once from app_settings.vapid_private
// (RLS-protected, only the service role reads it) or the VAPID_PRIVATE_KEY secret.
let vapidReady: Promise<void> | null = null;
function ensureVapid() {
  if (!vapidReady) vapidReady = (async () => {
    let key = Deno.env.get("VAPID_PRIVATE_KEY") || "";
    if (!key) {
      const { data } = await supabase.from("app_settings").select("value").eq("key", "vapid_private").maybeSingle();
      key = typeof data?.value === "string" ? data.value : "";
    }
    webpush.setVapidDetails("mailto:vedanshurathi@gmail.com", VAPID_PUBLIC, key);
  })();
  return vapidReady;
}

async function record(nid: string | undefined, devices: number, sent: number, failed: number) {
  if (!nid) return;
  await supabase.from("notifications")
    .update({ push_devices: devices, push_sent: sent, push_failed: failed, push_at: new Date().toISOString() })
    .eq("id", nid);
}

Deno.serve(async (req) => {
  try {
    await ensureVapid();
    const { user_id, role, title, body, url, notification_id } = await req.json();
    if (!user_id || !role || !title) {
      return new Response(JSON.stringify({ ok: false, msg: "missing fields" }), { status: 400 });
    }

    const { data: subs, error } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth_key")
      .eq("user_id", user_id)
      .eq("role", role)
      .eq("is_active", true);

    if (error) return new Response(JSON.stringify({ ok: false, msg: error.message }), { status: 500 });
    const real = (subs || []).filter((s) => s.p256dh && s.auth_key);   // permission-only rows have no keys
    if (real.length === 0) {
      await record(notification_id, 0, 0, 0);
      return new Response(JSON.stringify({ ok: true, sent: 0, note: "no subscriptions" }));
    }

    const payload = JSON.stringify({ title, body: body || "", url: url || "/", nid: notification_id || null });
    let sent = 0, failed = 0;
    for (const s of real) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth_key } },
          payload,
          { TTL: 86400 }
        );
        sent++;
      } catch (e) {
        failed++;
        // 404/410 = the subscription is gone (uninstalled, expired) — stop trying it
        const status = (e as any)?.statusCode;
        if (status === 404 || status === 410) {
          await supabase.from("push_subscriptions").update({ is_active: false }).eq("id", s.id);
        }
      }
    }
    await record(notification_id, real.length, sent, failed);
    return new Response(JSON.stringify({ ok: true, sent, failed }));
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, msg: String(e) }), { status: 500 });
  }
});
