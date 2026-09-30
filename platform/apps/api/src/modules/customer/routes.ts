/** Customer app endpoints. Browsing works logged out; everything personal needs a session. */
import { Router } from 'express';
import { z } from 'zod';
import {
  areaQuery,
  availableVendorsQuery,
  createBookingBody,
  langBody,
  limitQuery,
  pushSubscriptionBody,
  rateBody,
  reasonBody,
  saveAddressBody,
  slotStatusQuery,
  uuidSchema,
  vendorsForProductQuery,
  type CreatedBooking,
  type HomeData,
} from '@rozbazaar/shared';
import type { Deps } from '../../deps.js';
import { parse } from '../../middleware/validate.js';
import { optionalSession, requireSession } from '../../middleware/auth.js';
import { noStore } from '../../security/headers.js';
import { ok } from '../../lib/respond.js';
import { TtlCache } from '../../lib/ttl-cache.js';
import type { RpcCaller } from '../../supabase/rpc.js';
import {
  mapAddress,
  mapBill,
  mapBooking,
  mapHome,
  mapLastOrderItem,
  mapNotification,
  mapProductVendor,
  mapSlot,
  mapVendorCard,
} from '../mappers.js';

type Row = Record<string, unknown>;
const idParam = z.object({ id: uuidSchema });
const rows = (v: unknown): Row[] => (Array.isArray(v) ? (v as Row[]) : []);

export function customerRoutes(d: Deps): Router {
  const r = Router();
  const AUD = 'customer' as const;
  const auth = requireSession(d.sessions, AUD);
  const maybe = optionalSession(d.sessions, AUD);
  const as = (req: { auth?: { accessToken: string } }): RpcCaller =>
    req.auth ? { kind: 'user', token: req.auth.accessToken } : { kind: 'anon' };
  const user = (req: { auth?: { accessToken: string } }): RpcCaller => ({
    kind: 'user',
    token: req.auth!.accessToken,
  });
  // The catalogue of a village is the same for every logged-out visitor: cache it briefly.
  const homeCache = new TtlCache<HomeData>(20_000, 100);

  /* ---------- catalogue (public, personalised when logged in) ---------- */

  r.get('/home', maybe, async (req, res) => {
    const { area } = parse(areaQuery, req.query);
    const load = async (caller: RpcCaller) =>
      mapHome(d.map, (await d.rpc.call<Row>('customer_home', { p_area: area }, caller)).data ?? {});
    const data = req.auth
      ? await load(as(req))
      : await homeCache.get(area.toLowerCase(), () => load({ kind: 'anon' }));
    res.setHeader('Cache-Control', req.auth ? 'private, no-store' : 'public, max-age=20');
    ok(res, data);
  });

  r.get('/slots', async (req, res) => {
    const q = parse(slotStatusQuery, req.query);
    const out = await d.rpc.call<unknown>(
      'customer_slot_status',
      { p_type: q.type, p_area: q.area, p_date: q.date },
      { kind: 'anon' },
    );
    ok(res, rows(out.data).map(mapSlot));
  });

  r.get('/vendors', async (req, res) => {
    const { area } = parse(areaQuery, req.query);
    const out = await d.rpc.call<unknown>('customer_vendors_in_area', { p_area: area }, { kind: 'anon' });
    ok(
      res,
      rows(out.data).map((v) => mapVendorCard(d.map, v)),
    );
  });

  r.get('/vendors/available', async (req, res) => {
    const q = parse(availableVendorsQuery, req.query);
    const out = await d.rpc.call<unknown>(
      'customer_available_vendors',
      { p_type: q.type, p_area: q.area, p_date: q.date, p_slot: q.slot },
      { kind: 'anon' },
    );
    ok(
      res,
      rows(out.data).map((v) => mapVendorCard(d.map, v)),
    );
  });

  r.get('/product-vendors', async (req, res) => {
    const q = parse(vendorsForProductQuery, req.query);
    const out = await d.rpc.call<unknown>(
      'customer_vendors_for_product',
      { p_area: q.area, p_product_name: q.name },
      { kind: 'anon' },
    );
    ok(res, rows(out.data).map(mapProductVendor));
  });

  /* ---------- everything below needs a customer session ---------- */
  r.use(auth, noStore);

  r.put('/language', async (req, res) => {
    const b = parse(langBody, req.body);
    await d.rpc.call('set_language', { p_lang: b.lang }, user(req));
    res.status(204).end();
  });

  r.post('/favourites/:id/toggle', async (req, res) => {
    const { id } = parse(idParam, req.params);
    const out = await d.rpc.call('customer_toggle_favourite', { p_product: id }, user(req));
    ok(res, { favourite: out.extra.faved === true }, out.message);
  });

  /* addresses */
  r.get('/addresses', async (req, res) => {
    const out = await d.rpc.call<unknown>('customer_my_addresses', {}, user(req));
    ok(
      res,
      rows(out.data)
        .filter((a) => a.hidden !== true)
        .map(mapAddress),
    );
  });

  r.post('/addresses', async (req, res) => {
    const b = parse(saveAddressBody, req.body);
    const out = await d.rpc.call<Row>(
      'customer_save_address',
      {
        p_label: b.label ?? null,
        p_house: b.house ?? null,
        p_street: b.street ?? null,
        p_landmark: b.landmark ?? null,
        p_area: b.area,
        p_lat: b.lat ?? null,
        p_lng: b.lng ?? null,
        p_make_default: b.makeDefault ?? false,
        p_address_id: b.id ?? null,
      },
      user(req),
    );
    ok(res, mapAddress(out.data ?? {}), out.message, b.id ? 200 : 201);
  });

  r.post('/addresses/:id/default', async (req, res) => {
    const { id } = parse(idParam, req.params);
    await d.rpc.call('customer_set_default_address', { p_id: id }, user(req));
    res.status(204).end();
  });

  r.delete('/addresses/:id', async (req, res) => {
    const { id } = parse(idParam, req.params);
    const out = await d.rpc.call('customer_delete_address', { p_id: id }, user(req));
    ok(res, { deleted: true }, out.message);
  });

  /* bookings */
  r.get('/bookings', async (req, res) => {
    const { limit } = parse(limitQuery, req.query);
    const out = await d.rpc.call<unknown>('customer_my_bookings', { p_limit: limit }, user(req));
    ok(
      res,
      rows(out.data).map((b) => mapBooking(d.map, b, 'customer')),
    );
  });

  r.post('/bookings', d.limiters.booking, async (req, res) => {
    const b = parse(createBookingBody, req.body);
    const out = await d.rpc.call<Row>(
      'customer_create_booking',
      {
        p_type: b.type,
        p_address_id: b.addressId,
        p_date: b.date,
        p_slot: b.slot,
        p_items: b.items.map((i) => ({ product_id: i.productId, qty: i.qty })),
        p_note: b.note?.trim() || null,
        p_vendor_id: b.vendorId ?? null,
      },
      user(req),
    );
    const row = out.data ?? {};
    const created: CreatedBooking = {
      id: String(row.id ?? ''),
      code: String(row.code ?? ''),
      deliveryOtp:
        typeof row.delivery_otp === 'string'
          ? row.delivery_otp
          : typeof row.otp === 'string'
            ? row.otp
            : null,
    };
    ok(res, created, out.message, 201);
  });

  r.get('/bookings/:id/bill', async (req, res) => {
    const { id } = parse(idParam, req.params);
    const out = await d.rpc.call<Row>('customer_bill_preview', { p_booking: id }, user(req));
    ok(res, mapBill(d.map, out.data ?? {}));
  });

  r.post('/bookings/:id/approve', async (req, res) => {
    const { id } = parse(idParam, req.params);
    const out = await d.rpc.call('customer_approve_bill', { p_booking: id }, user(req));
    ok(res, { approved: true }, out.message);
  });

  r.post('/bookings/:id/dispute', async (req, res) => {
    const { id } = parse(idParam, req.params);
    const b = parse(reasonBody, req.body);
    const out = await d.rpc.call('customer_dispute_bill', { p_booking: id, p_reason: b.reason }, user(req));
    ok(res, { disputed: true }, out.message);
  });

  r.post('/bookings/:id/cancel', async (req, res) => {
    const { id } = parse(idParam, req.params);
    const b = parse(reasonBody, req.body);
    const out = await d.rpc.call('customer_cancel_booking', { p_booking: id, p_reason: b.reason }, user(req));
    ok(res, { cancelled: true }, out.message);
  });

  r.post('/bookings/:id/rating', async (req, res) => {
    const { id } = parse(idParam, req.params);
    const b = parse(rateBody, req.body);
    const out = await d.rpc.call(
      'customer_rate',
      { p_booking: id, p_stars: b.stars, p_comment: b.comment ?? null },
      user(req),
    );
    ok(res, { rated: true }, out.message);
  });

  r.get('/last-order', async (req, res) => {
    const out = await d.rpc.call<unknown>('customer_last_order', {}, user(req));
    ok(
      res,
      rows(out.data).map((i) => mapLastOrderItem(d.map, i)),
    );
  });

  /* notifications + push */
  r.get('/notifications', async (req, res) => {
    const { limit } = parse(limitQuery, req.query);
    const out = await d.rpc.call<unknown>('customer_notifications', { p_limit: limit }, user(req));
    ok(res, rows(out.data).map(mapNotification));
  });

  r.post('/notifications/:id/read', async (req, res) => {
    const { id } = parse(idParam, req.params);
    await d.rpc.call('customer_mark_read', { p_id: id }, user(req));
    res.status(204).end();
  });

  r.post('/push-subscriptions', async (req, res) => {
    const b = parse(pushSubscriptionBody, req.body);
    await d.rpc.call(
      'save_push_subscription',
      {
        p_endpoint: b.endpoint,
        p_p256dh: b.keys.p256dh,
        p_auth: b.keys.auth,
        p_agent: b.agent ?? null,
        p_role: 'customer',
      },
      user(req),
    );
    res.status(204).end();
  });

  r.post('/push/test', async (req, res) => {
    const out = await d.rpc.call<Row>('customer_test_push', {}, user(req));
    ok(res, { id: String(out.data?.id ?? ''), devices: Number(out.data?.devices ?? 0) }, out.message);
  });

  r.get('/push/test/:id', async (req, res) => {
    const { id } = parse(idParam, req.params);
    const out = await d.rpc.call<Row>('customer_test_push_status', { p_id: id }, user(req));
    const s = out.data ?? {};
    ok(res, {
      devices: Number(s.devices ?? 0),
      sent: Number(s.sent ?? 0),
      failed: Number(s.failed ?? 0),
      delivered: Boolean(s.delivered_at),
      opened: Boolean(s.opened_at),
    });
  });

  return r;
}
