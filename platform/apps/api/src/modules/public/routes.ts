/** Endpoints anyone can call without logging in. Writes are rate-limited. */
import { Router } from 'express';
import { z } from 'zod';
import { contactBody, pointQuery, uuidSchema, visitBody, waitlistBody, type Area } from '@rozbazaar/shared';
import type { Deps } from '../../deps.js';
import { parse } from '../../middleware/validate.js';
import { ok } from '../../lib/respond.js';
import { TtlCache } from '../../lib/ttl-cache.js';
import { mapArea, mapAreaMatch } from '../mappers.js';

export function publicRoutes(d: Deps): Router {
  const r = Router();
  const areasCache = new TtlCache<Area[]>(60_000, 2);

  r.get('/areas', async (_req, res) => {
    const areas = await areasCache.get('all', async () => {
      const out = await d.rpc.call<unknown[]>('public_areas', {}, { kind: 'anon' });
      return (Array.isArray(out.data) ? out.data : []).map((a) => mapArea(a as Record<string, unknown>));
    });
    res.setHeader('Cache-Control', 'public, max-age=60');
    ok(res, areas);
  });

  r.get('/areas/locate', async (req, res) => {
    const q = parse(pointQuery, req.query);
    const out = await d.rpc.call<Record<string, unknown>>(
      'area_from_point',
      { p_lat: q.lat, p_lng: q.lng },
      { kind: 'anon' },
    );
    ok(res, mapAreaMatch(out.data));
  });

  r.post('/visits', d.limiters.publicWrite, async (req, res) => {
    const b = parse(visitBody, req.body);
    await d.rpc.call('log_visit', { p_page: b.page }, { kind: 'anon' });
    res.status(204).end();
  });

  r.post('/contact', d.limiters.publicWrite, async (req, res) => {
    const b = parse(contactBody, req.body);
    const out = await d.rpc.call(
      'customer_send_message',
      { p_name: b.name, p_body: b.body, p_phone: b.phone ?? null, p_email: b.email ?? null },
      { kind: 'anon' },
    );
    ok(res, { sent: true }, out.message);
  });

  r.post('/waitlist', d.limiters.publicWrite, async (req, res) => {
    const b = parse(waitlistBody, req.body);
    const out = await d.rpc.call(
      'customer_join_waitlist',
      { p_area: b.area, p_type: b.type, p_phone: b.phone },
      { kind: 'anon' },
    );
    ok(res, { joined: true }, out.message);
  });

  /**
   * Push receipts from the apps' service workers: "delivered" when a push reaches the phone,
   * "opened" when it is tapped (admin → "who got it / who opened it"). notification_track only
   * ever sets those two timestamps, so an anonymous call cannot change anything else.
   */
  const trackParams = z.object({ id: uuidSchema });
  const trackBody = z.object({ event: z.enum(['delivered', 'opened']) });
  r.post('/notifications/:id/track', d.limiters.tracking, async (req, res) => {
    const { id } = parse(trackParams, req.params);
    const { event } = parse(trackBody, req.body);
    await d.rpc.call('notification_track', { p_id: id, p_event: event }, { kind: 'anon' });
    res.status(204).end();
  });

  return r;
}

/** Serves cached vendor photos: GET /v1/img/:hash[?p=productId] */
export function imageRoutes(d: Deps): Router {
  const r = Router();
  const params = z.object({ hash: z.string().regex(/^[a-f0-9]{32}$/) });
  const query = z.object({ p: z.string().uuid().optional() });

  r.get('/:hash', async (req, res) => {
    const { hash } = parse(params, req.params);
    const { p } = parse(query, req.query);
    let img = d.images.get(hash);
    if (!img && p) {
      // Cold cache (e.g. after a restart): fetch this one product photo and check it matches.
      const out = await d.rpc
        .call<{ image_url?: string }>('product_image', { p_id: p }, { kind: 'anon' })
        .catch(() => null);
      const url = out?.data?.image_url;
      if (url && d.images.put(url) === hash) img = d.images.get(hash);
    }
    if (!img) {
      res.status(404).setHeader('Cache-Control', 'no-store').end();
      return;
    }
    if (req.get('if-none-match') === `"${hash}"`) {
      res.status(304).end();
      return;
    }
    res.setHeader('Content-Type', img.mime);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('ETag', `"${hash}"`);
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    res.send(img.bytes);
  });
  return r;
}
