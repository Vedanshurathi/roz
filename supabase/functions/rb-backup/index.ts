// RozBazaar — download a full database backup (.sql, structure + all data) in the browser.
//
//   https://<project>.supabase.co/functions/v1/rb-backup?t=<token>
//
// The token is a one-day link made in the database (app_settings.backup_link holds only its
// SHA-256 and expiry; see database/migrations/20261001a_backup_export.sql). Without a valid,
// unexpired token nothing is returned. The backup itself is public.rb_backup_sql(), callable only
// with the service key (which Supabase gives this function; it never leaves the server).
// Deploy with JWT verification OFF (the link is opened in a normal browser).

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

async function rpc(fn: string, args: Record<string, unknown>): Promise<unknown> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(args),
  });
  if (!r.ok) throw new Error(`${fn}: ${r.status}`);
  return await r.json();
}

const plain = (text: string, status: number) =>
  new Response(text, {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' },
  });

Deno.serve(async (req) => {
  if (req.method !== 'GET') return plain('Not found', 404);
  const token = new URL(req.url).searchParams.get('t') ?? '';
  if (!/^[a-f0-9]{64}$/.test(token)) return plain('Not found', 404);
  try {
    if ((await rpc('rb_backup_claim', { p_token: token })) !== true)
      return plain('This download link has expired. Ask for a new one.', 404);
    const sql = await rpc('rb_backup_sql', {});
    if (typeof sql !== 'string') return plain('Could not make the backup. Try again.', 500);
    const day = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
    return new Response(sql, {
      headers: {
        'Content-Type': 'application/sql; charset=utf-8',
        'Content-Disposition': `attachment; filename="rozbazaar-database-${day}.sql"`,
        'Cache-Control': 'no-store',
        'X-Robots-Tag': 'noindex',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (e) {
    console.error('backup failed', (e as Error).message);
    return plain('Could not make the backup. Try again.', 500);
  }
});
