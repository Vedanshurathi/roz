/**
 * A fake Supabase (Auth + PostgREST RPC) for tests and local development.
 *
 * It implements the database functions the customer and vendor apps use, with the same
 * response shapes and the same permission rules (login-only functions refuse the anon role),
 * over in-memory data. Nothing here ever talks to the real production database.
 */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { APPLE_JPEG, ONION_JPEG, POTATO_JPEG, TOMATO_JPEG } from './fixture-images.js';

type Row = Record<string, unknown>;
type Role = 'anon' | 'authenticated' | 'service_role';
interface Ctx {
  role: Role;
  uid: string | null;
}
type Fn = (args: Row, ctx: Ctx) => unknown;

const SECRET = 'fake-supabase-secret';
const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');

export function fakeJwt(payload: Row): string {
  const head = b64({ alg: 'HS256', typ: 'JWT' });
  const body = b64(payload);
  const sig = createHmac('sha256', SECRET).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${sig}`;
}
function readJwt(token: string): Row | null {
  const [h, p, s] = token.split('.');
  if (!h || !p || !s) return null;
  const sig = createHmac('sha256', SECRET).update(`${h}.${p}`).digest('base64url');
  if (sig !== s) return null;
  try {
    return JSON.parse(Buffer.from(p, 'base64url').toString('utf8')) as Row;
  } catch {
    return null;
  }
}

export const FAKE_ANON_KEY = fakeJwt({ role: 'anon', iss: 'fake' });
export const FAKE_SERVICE_KEY = fakeJwt({ role: 'service_role', iss: 'fake' });

/** Fixed ids so tests can refer to them. */
export const IDS = {
  vendorSanjiv: '11111111-1111-4111-8111-111111111111',
  vendorRamesh: '22222222-2222-4222-8222-222222222222',
  vendorGeeta: '33333333-3333-4333-8333-333333333333',
  userSanjiv: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  userRamesh: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  productTamatarSanjiv: '44444444-4444-4444-8444-444444444441',
  productAloo: '44444444-4444-4444-8444-444444444442',
  productBhindi: '44444444-4444-4444-8444-444444444443',
  productDhaniya: '44444444-4444-4444-8444-444444444444',
  productPyaaz: '44444444-4444-4444-8444-444444444445',
  productTamatarRamesh: '44444444-4444-4444-8444-444444444446',
  productSeb: '44444444-4444-4444-8444-444444444447',
  productKela: '44444444-4444-4444-8444-444444444448',
};
export const SANJIV_PHONE = '8198941588';
export const SANJIV_PASSWORD = 'sabzi1234';

const SLOTS = [
  { slot: 'morning', starts: '07:00:00', ends: '11:00:00', end: 11 },
  { slot: 'afternoon', starts: '12:00:00', ends: '16:00:00', end: 16 },
  { slot: 'evening', starts: '17:00:00', ends: '20:00:00', end: 20 },
] as const;

const LOGIN_ONLY = new Set([
  'customer_create_booking',
  'customer_my_bookings',
  'customer_my_addresses',
  'customer_save_address',
  'customer_delete_address',
  'customer_set_default_address',
  'customer_bill_preview',
  'customer_approve_bill',
  'customer_dispute_bill',
  'customer_cancel_booking',
  'customer_rate',
  'customer_notifications',
  'customer_mark_read',
  'customer_last_order',
  'customer_toggle_favourite',
  'customer_me',
  'customer_bootstrap',
  'set_language',
  'save_push_subscription',
  'customer_test_push',
  'customer_test_push_status',
  'vendor_me',
  'vendor_bookings',
  'vendor_set_status',
  'vendor_finalize_bill',
  'vendor_record_payment',
  'vendor_verify_otp',
  'vendor_my_products',
  'vendor_upsert_product',
  'vendor_delete_product',
  'vendor_set_stock',
  'vendor_bulk_prices',
  'vendor_activate_catalog_item',
  'vendor_my_slots',
  'vendor_set_capacity',
  'vendor_get_slot_areas',
  'vendor_set_slot_areas',
  'vendor_stats',
  'vendor_dashboard',
  'vendor_my_reviews',
  'vendor_update_profile',
  'vendor_set_active',
  'vendor_save_push',
  'vendor_password_status',
  'vendor_set_first_password',
  'vendor_request_password',
  'vendor_apply',
]);

function istParts(now: Date): { date: string; hour: number } {
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', hour12: false }).format(
      now,
    ),
  );
  return { date, hour };
}

export interface FakeSupabase {
  url: string;
  anonKey: string;
  serviceKey: string;
  state: ReturnType<typeof seed>;
  /** Every RPC call, for assertions: [fn, role]. */
  calls: Array<[string, Role]>;
  setAccessTtl(seconds: number): void;
  close(): Promise<void>;
}

function seed() {
  const vendor = (
    id: string,
    uid: string | null,
    name: string,
    phone: string,
    v_type: string,
    areas: string[],
    rating: number,
  ) => ({
    id,
    auth_user_id: uid,
    name,
    phone,
    v_type,
    status: 'approved',
    is_active: true,
    areas_served: areas,
    default_capacity: 15,
    avg_rating: rating,
    total_ratings: 12,
    total_orders: 20,
    photo_url: null as string | null,
    lang: 'hi',
    shop_name: null as string | null,
    vehicle: 'Thela',
    applied_at: '2026-08-23T04:25:40Z',
    created_at: '2026-08-23T04:25:40Z',
  });
  const product = (
    id: string,
    vendor_id: string,
    name: string,
    name_en: string,
    name_hi: string,
    unit: string,
    price: number,
    category: string,
    image_url: string | null,
    extra: Row = {},
  ) => ({
    id,
    vendor_id,
    name,
    name_en,
    name_hi,
    unit,
    price,
    category,
    image_url,
    in_stock: true,
    catalog_key: null as string | null,
    stock_image_url: null as string | null,
    sort_order: 0,
    review_status: 'approved',
    review_note: null,
    price_updated_at: new Date().toISOString(),
    created_at: '2026-08-26T01:00:00Z',
    ...extra,
  });
  return {
    areas: [
      { name: 'Khandewla', lat: 28.383824, lng: 76.77121, radius_km: 4, served: true, verified: true },
      { name: 'Jatola', lat: 28.28, lng: 76.82, radius_km: 4, served: true, verified: false },
    ],
    users: new Map<
      string,
      { id: string; email: string | null; password: string | null; isAnon: boolean; meta: Row }
    >([
      [
        IDS.userSanjiv,
        {
          id: IDS.userSanjiv,
          email: `${SANJIV_PHONE}@vendor.rozbazaar.shop`,
          password: SANJIV_PASSWORD,
          isAnon: false,
          meta: {},
        },
      ],
      [
        IDS.userRamesh,
        { id: IDS.userRamesh, email: 'ramesh@example.com', password: null, isAnon: false, meta: {} },
      ],
    ]),
    vendors: [
      vendor(
        IDS.vendorSanjiv,
        IDS.userSanjiv,
        'Sanjiv',
        SANJIV_PHONE,
        'vegetable',
        ['Khandewla', 'Jatola'],
        4.8,
      ),
      vendor(IDS.vendorRamesh, IDS.userRamesh, 'Ramesh', '9812300001', 'vegetable', ['Khandewla'], 4.5),
      vendor(IDS.vendorGeeta, null, 'Geeta', '9812300002', 'fruit', ['Khandewla'], 4.9),
    ],
    products: [
      product(
        IDS.productTamatarSanjiv,
        IDS.vendorSanjiv,
        'Tamatar',
        'Tomato',
        'टमाटर',
        '1 kg',
        40,
        'vegetable',
        TOMATO_JPEG,
        { catalog_key: 'p6' },
      ),
      product(
        IDS.productAloo,
        IDS.vendorSanjiv,
        'Aloo',
        'Potato',
        'आलू',
        '1 kg',
        30,
        'onion_potato',
        POTATO_JPEG,
        { catalog_key: 'p1' },
      ),
      product(
        IDS.productPyaaz,
        IDS.vendorSanjiv,
        'Pyaaz',
        'Onion',
        'प्याज़',
        '1 kg',
        35,
        'onion_potato',
        ONION_JPEG,
        { catalog_key: 'p2' },
      ),
      product(IDS.productBhindi, IDS.vendorSanjiv, 'Bhindi', 'Okra', 'भिंडी', '500 g', 30, 'vegetable', null),
      product(
        IDS.productDhaniya,
        IDS.vendorSanjiv,
        'Dhaniya',
        'Coriander',
        'धनिया',
        '100 g',
        10,
        'vegetable',
        null,
        { in_stock: false },
      ),
      product(
        IDS.productTamatarRamesh,
        IDS.vendorRamesh,
        'Tamatar',
        'Tomato',
        'टमाटर',
        '1 kg',
        45,
        'vegetable',
        null,
        { catalog_key: 'p6' },
      ),
      product(IDS.productSeb, IDS.vendorGeeta, 'Seb', 'Apple', 'सेब', '1 kg', 180, 'fruit', APPLE_JPEG, {
        catalog_key: 'p21',
      }),
      product(IDS.productKela, IDS.vendorGeeta, 'Kela', 'Banana', 'केला', '1 dozen', 60, 'fruit', null),
    ],
    catalog: [
      {
        key: 'p1',
        name_en: 'Aloo',
        english_name: 'Potato',
        name_hi: 'आलू',
        category: 'onion_potato',
        default_unit: '1 kg',
        image_url: null,
        is_active: true,
      },
      {
        key: 'p2',
        name_en: 'Pyaaz',
        english_name: 'Onion',
        name_hi: 'प्याज़',
        category: 'onion_potato',
        default_unit: '1 kg',
        image_url: null,
        is_active: true,
      },
      {
        key: 'p6',
        name_en: 'Tamatar',
        english_name: 'Tomato',
        name_hi: 'टमाटर',
        category: 'vegetable',
        default_unit: '1 kg',
        image_url: null,
        is_active: true,
      },
      {
        key: 'p40',
        name_en: 'Lauki',
        english_name: 'Bottle gourd',
        name_hi: 'लौकी',
        category: 'vegetable',
        default_unit: '1 pc',
        image_url: null,
        is_active: true,
      },
      {
        key: 'p21',
        name_en: 'Seb',
        english_name: 'Apple',
        name_hi: 'सेब',
        category: 'fruit',
        default_unit: '1 kg',
        image_url: null,
        is_active: true,
      },
    ],
    customers: [] as Row[],
    addresses: [] as Row[],
    bookings: [] as Row[],
    items: [] as Row[],
    favourites: [] as Array<{ customer_id: string; product_id: string }>,
    notifications: [] as Row[],
    ratings: [] as Row[],
    messages: [] as Row[],
    waitlist: [] as Row[],
    push: [] as Row[],
    capacity: new Map<string, { capacity: number; is_open: boolean }>(),
    slotAreas: new Map<string, Record<string, string[] | null>>(),
    passwordRequests: [] as Row[],
    refresh: new Map<string, string>(),
    pkce: new Map<string, { challenge: string; userId: string }>(),
  };
}

export async function startFakeSupabase(
  opts: { port?: number; now?: () => Date } = {},
): Promise<FakeSupabase> {
  const state = seed();
  const calls: Array<[string, Role]> = [];
  const now = opts.now ?? (() => new Date());
  let accessTtl = 3600;

  /* ---------- helpers ---------- */
  const okd = (data: unknown, extra: Row = {}) => ({ ok: true, data, ...extra });
  const bad = (msg: string, extra: Row = {}) => ({ ok: false, msg, ...extra });
  const today = () => istParts(now()).date;
  const customerOf = (ctx: Ctx) => state.customers.find((c) => c.auth_user_id === ctx.uid) ?? null;
  const vendorOf = (ctx: Ctx) => state.vendors.find((v) => v.auth_user_id === ctx.uid) ?? null;
  const vendorById = (id: unknown) => state.vendors.find((v) => v.id === id) ?? null;
  const covers = (v: (typeof state.vendors)[number], area: string, slot?: string) => {
    if (!v.areas_served.includes(area)) return false;
    const sa = state.slotAreas.get(v.id);
    const list = slot && sa ? sa[slot] : null;
    return !list || list.includes(area);
  };
  const capKey = (vid: string, date: string, slot: string) => `${vid}|${date}|${slot}`;
  const capacity = (vid: string, date: string, slot: string) =>
    state.capacity.get(capKey(vid, date, slot)) ?? {
      capacity: vendorById(vid)?.default_capacity ?? 15,
      is_open: true,
    };
  const bookedCount = (vid: string, date: string, slot: string) =>
    state.bookings.filter(
      (b) => b.vendor_id === vid && b.booking_date === date && b.slot === slot && b.status !== 'cancelled',
    ).length;
  const notify = (
    userId: string | null | undefined,
    role: string,
    title: string,
    title_en: string,
    booking: string | null = null,
  ) => {
    if (!userId) return;
    state.notifications.unshift({
      id: randomUUID(),
      user_id: userId,
      role,
      type: 'order',
      title,
      title_en,
      message: title,
      message_en: title_en,
      is_read: false,
      booking_id: booking,
      created_at: now().toISOString(),
    });
  };
  const productRow = (p: (typeof state.products)[number]) => {
    const v = vendorById(p.vendor_id);
    return { ...p, vendor_name: v?.name ?? null, vendor_rating: v?.avg_rating ?? null };
  };
  const itemsOf = (bid: unknown) => state.items.filter((i) => i.booking_id === bid);
  const bookingRow = (b: Row, viewer: 'customer' | 'vendor') => {
    const addr = state.addresses.find((a) => a.id === b.address_id) ?? {};
    const v = vendorById(b.vendor_id);
    const c = state.customers.find((x) => x.id === b.customer_id) ?? {};
    const rating = state.ratings.find((r) => r.booking_id === b.id);
    const row: Row = {
      ...b,
      area: addr.area,
      house_no: addr.house_no ?? null,
      street: addr.street ?? null,
      landmark: addr.landmark ?? null,
      lat: addr.lat ?? null,
      lng: addr.lng ?? null,
      addr_label: addr.label ?? null,
      vendor_name: v?.name ?? null,
      vendor_phone: v?.phone ?? null,
      shop_name: v?.shop_name ?? null,
      customer_name: c.name ?? null,
      customer_phone: c.phone ?? null,
      items: itemsOf(b.id).map((i) => ({
        ...i,
        image_url: state.products.find((p) => p.id === i.product_id)?.image_url ?? null,
      })),
      item_count: itemsOf(b.id).length,
      rating_stars: rating?.stars ?? null,
      rating_comment: rating?.comment ?? null,
    };
    if (viewer === 'vendor') {
      delete row.delivery_otp;
      row.maps_url = addr.lat
        ? `https://www.google.com/maps/dir/?api=1&destination=${addr.lat},${addr.lng}`
        : null;
      row.has_pin = Boolean(addr.lat);
    }
    delete row.otp_attempts;
    return row;
  };
  const lineTotal = (i: Row) =>
    i.removed ? 0 : Number(i.final_qty ?? i.qty) * Number(i.final_price ?? i.price_at_booking);
  const myBooking = (ctx: Ctx, id: unknown, as: 'customer' | 'vendor') => {
    const b = state.bookings.find((x) => x.id === id);
    if (!b) return null;
    if (as === 'customer' && b.customer_id !== customerOf(ctx)?.id) return null;
    if (as === 'vendor' && b.vendor_id !== vendorOf(ctx)?.id) return null;
    return b;
  };
  /** Same rule as vendor_sale_rows() in the DB: a sale counts on the day it was paid (IST), else its booking day. */
  const saleDay = (b: Row) =>
    b.paid_at ? istParts(new Date(String(b.paid_at))).date : String(b.booking_date);
  const saleRows = (vid: string) =>
    state.bookings.filter(
      (b) =>
        b.vendor_id === vid &&
        (b.pay_amount != null || ['paid', 'delivered', 'completed'].includes(String(b.status))),
    );

  /* ---------- RPC implementations ---------- */
  const fns: Record<string, Fn> = {
    public_areas: () => state.areas,
    log_visit: () => null,
    notification_track: (a) => {
      const n = state.notifications.find((x) => x.id === a.p_id);
      if (n) n[a.p_event === 'opened' ? 'opened_at' : 'delivered_at'] = new Date().toISOString();
      return null;
    },
    area_from_point: (a) => {
      const lat = Number(a.p_lat),
        lng = Number(a.p_lng);
      let best: { area: (typeof state.areas)[number]; d: number } | null = null;
      for (const ar of state.areas) {
        const d = Math.hypot((ar.lat - lat) * 111, (ar.lng - lng) * 111 * Math.cos((lat * Math.PI) / 180));
        if (!best || d < best.d) best = { area: ar, d };
      }
      const inRange = Boolean(best && best.d <= best.area.radius_km);
      return okd({
        area: inRange ? best!.area.name : null,
        in_range: inRange,
        served: inRange && best!.area.served,
        confident: inRange,
        distance_km: best ? Math.round(best.d * 10) / 10 : null,
      });
    },
    customer_home: (a, ctx) => {
      const area = String(a.p_area);
      const vs = state.vendors.filter((v) => v.status === 'approved' && v.is_active && covers(v, area));
      const products = state.products.filter((p) => vs.some((v) => v.id === p.vendor_id)).map(productRow);
      const types = [...new Set(vs.map((v) => v.v_type))].map((t) => ({
        v_type: t,
        vendor_count: vs.filter((v) => v.v_type === t).length,
        avg_rating: 4.7,
        sample_vendor: vs.find((v) => v.v_type === t)?.name,
      }));
      const c = customerOf(ctx);
      return okd({
        area,
        areas: state.areas.map((x) => x.name),
        served: vs.length > 0,
        types,
        products,
        favourites: c ? state.favourites.filter((f) => f.customer_id === c.id).map((f) => f.product_id) : [],
      });
    },
    customer_slot_status: (a) => {
      const { date: t, hour } = istParts(now());
      const vs = state.vendors.filter((v) => v.v_type === a.p_type && v.status === 'approved' && v.is_active);
      return okd(
        SLOTS.map((s) => {
          const free = vs
            .filter((v) => covers(v, String(a.p_area), s.slot))
            .reduce((n, v) => {
              const c = capacity(v.id, String(a.p_date), s.slot);
              return (
                n + (c.is_open ? Math.max(0, c.capacity - bookedCount(v.id, String(a.p_date), s.slot)) : 0)
              );
            }, 0);
          const isPast = String(a.p_date) < t || (String(a.p_date) === t && hour >= s.end - 1);
          return {
            slot: s.slot,
            starts: s.starts,
            ends: s.ends,
            free,
            is_past: isPast,
            has_room: free > 0 && !isPast,
          };
        }),
        { now: now().toISOString() },
      );
    },
    customer_vendors_in_area: (a) =>
      okd(
        state.vendors
          .filter((v) => v.status === 'approved' && covers(v, String(a.p_area)))
          .map((v) => ({
            id: v.id,
            name: v.name,
            v_type: v.v_type,
            photo_url: v.photo_url,
            avg_rating: v.avg_rating,
            total_ratings: v.total_ratings,
            orders_completed: v.total_orders,
            product_count: state.products.filter((p) => p.vendor_id === v.id).length,
          })),
      ),
    customer_available_vendors: (a) =>
      okd(
        state.vendors
          .filter((v) => v.v_type === a.p_type && covers(v, String(a.p_area), String(a.p_slot)))
          .map((v) => ({
            id: v.id,
            name: v.name,
            photo_url: v.photo_url,
            avg_rating: v.avg_rating,
            total_ratings: v.total_ratings,
            booked: bookedCount(v.id, String(a.p_date), String(a.p_slot)),
            capacity: capacity(v.id, String(a.p_date), String(a.p_slot)).capacity,
          })),
      ),
    customer_vendors_for_product: (a) => {
      const name = String(a.p_product_name).toLowerCase();
      const list = state.products
        .filter((p) => [p.name, p.name_en, p.catalog_key].some((x) => String(x ?? '').toLowerCase() === name))
        .filter((p) => {
          const v = vendorById(p.vendor_id);
          return v && covers(v, String(a.p_area));
        });
      return okd(
        list.map((p) => {
          const v = vendorById(p.vendor_id)!;
          return {
            id: v.id,
            name: v.name,
            unit: p.unit,
            price: p.price,
            v_type: v.v_type,
            in_stock: p.in_stock,
            photo_url: null,
            avg_rating: v.avg_rating,
            product_id: p.id,
            total_ratings: v.total_ratings,
            orders_completed: v.total_orders,
          };
        }),
      );
    },
    customer_join_waitlist: (a) => {
      state.waitlist.push({ ...a });
      return okd(null, { msg: 'Aapko bata denge' });
    },
    customer_send_message: (a) => {
      state.messages.push({ ...a });
      return okd(null, { msg: 'Message mil gaya' });
    },
    product_image: (a) => {
      const p = state.products.find((x) => x.id === a.p_id && x.image_url?.startsWith('data:'));
      return p ? okd({ image_url: p.image_url }) : bad('No photo');
    },
    catalog_items_list: () => okd(state.catalog),

    customer_phone_login: (a, ctx) => {
      if (!ctx.uid) return bad('Session nahi mila — dubara try karo');
      const phone = String(a.p_phone ?? '').replace(/\D/g, '');
      if (phone.length !== 10) return bad('Sahi 10-digit number daalo');
      const name = String(a.p_name ?? '').trim();
      if (!name) return bad('Naam daalo');
      let c = state.customers.find((x) => x.phone === phone) ?? null;
      const own = customerOf(ctx);
      if (own) {
        if (c && c.id !== own.id) c.phone = null;
        Object.assign(own, { phone, name });
        c = own;
      } else if (c) {
        Object.assign(c, { auth_user_id: ctx.uid, name });
      } else {
        c = {
          id: randomUUID(),
          auth_user_id: ctx.uid,
          name,
          phone,
          email: null,
          auth_provider: 'phone',
          lang: 'hi',
          is_blocked: false,
          created_at: now().toISOString(),
        };
        state.customers.push(c);
      }
      return okd(c);
    },
    customer_bootstrap: (a, ctx) => {
      let c = customerOf(ctx);
      if (!c) {
        c = {
          id: randomUUID(),
          auth_user_id: ctx.uid,
          name: a.p_name,
          phone: a.p_phone,
          email: a.p_email,
          auth_provider: a.p_provider,
          lang: 'hi',
          is_blocked: false,
        };
        state.customers.push(c);
      }
      return okd(c);
    },
    customer_me: (_a, ctx) => {
      const c = customerOf(ctx);
      return okd(
        c
          ? { id: c.id, name: c.name, phone: c.phone, email: c.email, lang: c.lang, is_blocked: c.is_blocked }
          : null,
      );
    },
    set_language: (a, ctx) => {
      const c = customerOf(ctx);
      if (c) c.lang = a.p_lang;
      const v = vendorOf(ctx);
      if (v) v.lang = String(a.p_lang);
      return okd(null);
    },
    customer_toggle_favourite: (a, ctx) => {
      const c = customerOf(ctx);
      if (!c) return bad('Please log in first');
      const i = state.favourites.findIndex((f) => f.customer_id === c.id && f.product_id === a.p_product);
      if (i >= 0) {
        state.favourites.splice(i, 1);
        return { ok: true, faved: false, msg: 'Removed' };
      }
      state.favourites.push({ customer_id: String(c.id), product_id: String(a.p_product) });
      return { ok: true, faved: true, msg: 'Saved' };
    },
    customer_my_addresses: (_a, ctx) => {
      const c = customerOf(ctx);
      return okd(state.addresses.filter((x) => x.customer_id === c?.id));
    },
    customer_save_address: (a, ctx) => {
      const c = customerOf(ctx);
      if (!c) return bad('Pehle login karo');
      if (!state.areas.some((x) => x.name === a.p_area)) return bad('Ye gaon abhi list me nahi hai');
      const mine = state.addresses.filter((x) => x.customer_id === c.id && !x.hidden);
      let row = a.p_address_id
        ? state.addresses.find((x) => x.id === a.p_address_id && x.customer_id === c.id)
        : null;
      if (a.p_address_id && !row) return bad('Address nahi mila');
      const fields = {
        label: a.p_label,
        house_no: a.p_house,
        street: a.p_street,
        landmark: a.p_landmark,
        area: a.p_area,
        lat: a.p_lat,
        lng: a.p_lng,
      };
      if (row) Object.assign(row, fields);
      else {
        row = {
          id: randomUUID(),
          customer_id: c.id,
          hidden: false,
          is_default: mine.length === 0,
          created_at: now().toISOString(),
          ...fields,
        };
        state.addresses.push(row);
      }
      if (a.p_make_default)
        state.addresses.forEach((x) => {
          if (x.customer_id === c.id) x.is_default = x.id === row!.id;
        });
      return okd(row, { msg: 'Address save ho gaya' });
    },
    customer_set_default_address: (a, ctx) => {
      const c = customerOf(ctx);
      state.addresses.forEach((x) => {
        if (x.customer_id === c?.id) x.is_default = x.id === a.p_id;
      });
      return okd(null);
    },
    customer_delete_address: (a, ctx) => {
      const c = customerOf(ctx);
      const row = state.addresses.find((x) => x.id === a.p_id && x.customer_id === c?.id);
      if (!row) return bad('Address nahi mila');
      if (state.bookings.some((b) => b.address_id === row.id)) {
        row.hidden = true;
        return okd(null, { msg: 'Hata diya' });
      }
      state.addresses.splice(state.addresses.indexOf(row), 1);
      return okd(null, { msg: 'Hata diya' });
    },
    customer_create_booking: (a, ctx) => {
      const c = customerOf(ctx);
      if (!c) return bad('Pehle login karo');
      const addr = state.addresses.find((x) => x.id === a.p_address_id && x.customer_id === c.id);
      if (!addr) return bad('Address nahi mila');
      const items = (a.p_items as Array<{ product_id: string; qty: number }>) ?? [];
      const prods = items.map((i) => ({ i, p: state.products.find((p) => p.id === i.product_id) }));
      if (prods.some((x) => !x.p)) return bad('Kuch saman ab nahi mil raha');
      const out = prods.filter((x) => !x.p!.in_stock);
      if (out.length)
        return bad(`Stock me nahi: ${out.map((x) => x.p!.name).join(', ')}`, { code: 'OUT_OF_STOCK' });
      const slot = String(a.p_slot),
        date = String(a.p_date);
      const { date: t, hour } = istParts(now());
      const s = SLOTS.find((x) => x.slot === slot)!;
      if (date < t || (date === t && hour >= s.end - 1)) return bad('Ye slot nikal gaya — doosra slot chuno');
      const vendorIds = [...new Set(prods.map((x) => x.p!.vendor_id))];
      if (vendorIds.length > 1) return bad('Ek booking me ek hi vendor ka saman');
      let vid = (a.p_vendor_id as string | null) ?? vendorIds[0]!;
      const v = vendorById(vid);
      if (!v || !covers(v, String(addr.area), slot))
        return bad('Ye vendor aapke gaon me is slot me nahi aata');
      const cap = capacity(vid, date, slot);
      if (!cap.is_open || bookedCount(vid, date, slot) >= cap.capacity)
        return bad('Vendor is slot me full hai', { code: 'VENDOR_FULL' });
      vid = v.id;
      const id = randomUUID();
      const code = `RB-${String(100000 + ((state.bookings.length * 7919) % 899999))}`;
      const otp = String(1000 + ((state.bookings.length * 7349 + 1234) % 9000));
      const est = prods.reduce((n, x) => n + x.p!.price * x.i.qty, 0);
      state.bookings.push({
        id,
        code,
        customer_id: c.id,
        vendor_id: vid,
        address_id: addr.id,
        v_type: a.p_type,
        booking_date: date,
        slot,
        status: 'placed',
        note: a.p_note ?? null,
        est_total: est,
        final_total: null,
        pay_amount: null,
        pay_method: null,
        delivery_otp: otp,
        otp_attempts: 0,
        created_at: now().toISOString(),
        updated_at: now().toISOString(),
        cancel_reason: null,
        dispute_reason: null,
      });
      for (const x of prods)
        state.items.push({
          id: randomUUID(),
          booking_id: id,
          product_id: x.p!.id,
          product_name: x.p!.name,
          unit: x.p!.unit,
          qty: x.i.qty,
          price_at_booking: x.p!.price,
          final_qty: null,
          final_price: null,
          removed: false,
          added_at_door: false,
        });
      notify(ctx.uid, 'customer', 'बुकिंग पक्की', 'Booking confirmed', id);
      notify(v.auth_user_id, 'vendor', 'नया ऑर्डर', 'New order', id);
      return okd({ id, code, delivery_otp: otp }, { msg: 'Booking pakki' });
    },
    customer_my_bookings: (a, ctx) => {
      const c = customerOf(ctx);
      return okd(
        state.bookings
          .filter((b) => b.customer_id === c?.id)
          .slice(-Number(a.p_limit ?? 30))
          .reverse()
          .map((b) => bookingRow(b, 'customer')),
      );
    },
    customer_bill_preview: (a, ctx) => {
      const b = myBooking(ctx, a.p_booking, 'customer');
      if (!b) return bad('Order nahi mila');
      const changes = itemsOf(b.id).map((i) => {
        const fq = Number(i.final_qty ?? i.qty),
          fp = Number(i.final_price ?? i.price_at_booking);
        const kind = i.removed
          ? 'removed'
          : i.added_at_door
            ? 'added'
            : fq !== Number(i.qty) || fp !== Number(i.price_at_booking)
              ? 'changed'
              : 'same';
        return {
          item_id: i.id,
          product_name: i.product_name,
          unit: i.unit,
          booked_qty: i.added_at_door ? 0 : i.qty,
          final_qty: fq,
          booked_price: i.price_at_booking,
          final_price: fp,
          delta: lineTotal(i) - (i.added_at_door ? 0 : Number(i.qty) * Number(i.price_at_booking)),
          change_kind: kind,
          removed: i.removed,
          image_url: null,
        };
      });
      return okd({
        code: b.code,
        status: b.status,
        est_total: b.est_total,
        final_total: b.final_total ?? b.est_total,
        changes,
      });
    },
    customer_approve_bill: (a, ctx) => {
      const b = myBooking(ctx, a.p_booking, 'customer');
      if (!b || b.status !== 'bill_final') return bad('Bill abhi approve nahi ho sakta');
      b.status = 'bill_approved';
      return okd(null, { msg: 'Bill approve ho gaya' });
    },
    customer_dispute_bill: (a, ctx) => {
      const b = myBooking(ctx, a.p_booking, 'customer');
      if (!b || b.status !== 'bill_final') return bad('Abhi shikayat nahi ho sakti');
      Object.assign(b, { status: 'disputed', dispute_reason: a.p_reason });
      return okd(null, { msg: 'Vendor ko bata diya' });
    },
    customer_cancel_booking: (a, ctx) => {
      const b = myBooking(ctx, a.p_booking, 'customer');
      if (!b || b.status !== 'placed') return bad('Ab cancel nahi ho sakta');
      Object.assign(b, { status: 'cancelled', cancel_reason: a.p_reason });
      return okd(null, { msg: 'Cancel ho gaya' });
    },
    customer_rate: (a, ctx) => {
      const b = myBooking(ctx, a.p_booking, 'customer');
      if (!b || !['delivered', 'completed'].includes(String(b.status)))
        return bad('Delivery ke baad rating do');
      if (state.ratings.some((r) => r.booking_id === b.id)) return bad('Rating pehle hi di hai');
      state.ratings.push({
        booking_id: b.id,
        vendor_id: b.vendor_id,
        stars: a.p_stars,
        comment: a.p_comment,
        customer_name: customerOf(ctx)?.name,
        created_at: now().toISOString(),
      });
      return okd(null, { msg: 'Shukriya!' });
    },
    customer_last_order: (_a, ctx) => {
      const c = customerOf(ctx);
      const b = [...state.bookings]
        .reverse()
        .find((x) => x.customer_id === c?.id && x.status !== 'cancelled');
      return okd(
        b
          ? itemsOf(b.id)
              .filter((i) => !i.removed)
              .map((i) => ({
                product_id: i.product_id,
                name: i.product_name,
                unit: i.unit,
                qty: i.final_qty ?? i.qty,
                image_url: null,
              }))
          : [],
      );
    },
    customer_notifications: (a, ctx) =>
      okd(
        state.notifications
          .filter((n) => n.user_id === ctx.uid && n.role === 'customer')
          .slice(0, Number(a.p_limit ?? 30)),
      ),
    customer_mark_read: (a, ctx) => {
      const n = state.notifications.find((x) => x.id === a.p_id && x.user_id === ctx.uid);
      if (n) n.is_read = true;
      return okd(null);
    },
    save_push_subscription: (a, ctx) => {
      state.push.push({ ...a, user_id: ctx.uid });
      return okd(null);
    },
    customer_test_push: (_a, ctx) => {
      const id = randomUUID();
      notify(ctx.uid, 'customer', 'टेस्ट', 'Test', null);
      state.notifications[0]!.id = id;
      return okd({ id, devices: state.push.filter((p) => p.user_id === ctx.uid).length });
    },
    customer_test_push_status: () =>
      okd({ devices: 1, sent: 1, failed: 0, delivered_at: now().toISOString(), opened_at: null }),

    /* vendor */
    vendor_login_lookup: (a) => {
      const phone = String(a.p_phone ?? '')
        .replace(/\D/g, '')
        .slice(-10);
      if (phone.length !== 10) return bad('10 digit ka phone number daalo');
      const v = state.vendors.find((x) => x.phone === phone);
      if (!v) return okd({ registered: false });
      const u = v.auth_user_id ? state.users.get(v.auth_user_id) : null;
      if (!u?.password)
        return okd({ registered: true, has_password: false, google: Boolean(v.auth_user_id) });
      return okd({ registered: true, has_password: true, email: u.email });
    },
    vendor_me: (_a, ctx) => {
      const v = vendorOf(ctx);
      return v ? okd({ ...v, total_orders: v.total_orders }) : bad('Vendor nahi mila');
    },
    vendor_bookings: (a, ctx) => {
      const v = vendorOf(ctx);
      return okd(
        state.bookings
          .filter((b) => b.vendor_id === v?.id && b.booking_date === a.p_date)
          .map((b) => bookingRow(b, 'vendor')),
      );
    },
    vendor_set_status: (a, ctx) => {
      const b = myBooking(ctx, a.p_booking, 'vendor');
      if (!b) return bad('Order not found');
      if (!['on_the_way', 'reached'].includes(String(a.p_status))) return bad('Status not settable here');
      b.status = a.p_status;
      const cust = state.customers.find((c) => c.id === b.customer_id);
      notify(
        cust?.auth_user_id as string,
        'customer',
        a.p_status === 'reached' ? 'वेंडर पहुँच गए' : 'वेंडर निकल चुके',
        a.p_status === 'reached' ? 'Vendor has arrived' : 'Vendor is on the way',
        String(b.id),
      );
      return {
        ok: true,
        msg: 'Customer notified',
        maps_url: 'https://www.google.com/maps/dir/?api=1&destination=28.38,76.77',
      };
    },
    vendor_finalize_bill: (a, ctx) => {
      const b = myBooking(ctx, a.p_booking, 'vendor');
      if (!b) return bad('Order nahi mila');
      if (!['placed', 'on_the_way', 'reached', 'bill_final', 'disputed'].includes(String(b.status)))
        return bad('Is order ka bill ab nahi badal sakta');
      for (const line of (a.p_items as Row[]) ?? []) {
        if (line.item_id) {
          const it = state.items.find((i) => i.id === line.item_id && i.booking_id === b.id);
          if (!it) return bad('Galat item');
          Object.assign(it, {
            final_qty: line.final_qty,
            final_price: line.final_price,
            removed: Boolean(line.removed),
          });
        } else {
          const p = state.products.find((x) => x.id === line.product_id && x.vendor_id === b.vendor_id);
          if (!p) return bad('Galat saman');
          state.items.push({
            id: randomUUID(),
            booking_id: b.id,
            product_id: p.id,
            product_name: p.name,
            unit: p.unit,
            qty: line.final_qty,
            price_at_booking: p.price,
            final_qty: line.final_qty,
            final_price: line.final_price,
            removed: false,
            added_at_door: true,
          });
        }
      }
      b.final_total = itemsOf(b.id).reduce((n, i) => n + lineTotal(i), 0);
      b.status = 'bill_final';
      return okd({ final_total: b.final_total }, { msg: 'Bill customer ko bhej diya' });
    },
    vendor_record_payment: (a, ctx) => {
      const b = myBooking(ctx, a.p_booking, 'vendor');
      if (!b) return bad('Order nahi mila');
      if (!['bill_final', 'bill_approved'].includes(String(b.status))) return bad('Pehle bill banao');
      if (!['cash', 'upi_direct', 'online'].includes(String(a.p_method))) return bad('Galat tareeka');
      Object.assign(b, {
        status: 'paid',
        pay_amount: a.p_amount,
        pay_method: a.p_method,
        paid_at: now().toISOString(),
      });
      return okd(null, { msg: 'Payment note ho gaya' });
    },
    vendor_verify_otp: (a, ctx) => {
      const b = myBooking(ctx, a.p_booking, 'vendor');
      if (!b) return bad('Order nahi mila');
      if (Number(b.otp_attempts) >= 5)
        return bad('Bahut galat code — admin se baat karo', { code: 'OTP_LOCKED' });
      if (a.p_otp !== b.delivery_otp) {
        b.otp_attempts = Number(b.otp_attempts) + 1;
        return bad('Galat code — customer se dobara poochho', { code: 'OTP_WRONG' });
      }
      Object.assign(b, {
        status: b.status === 'paid' ? 'completed' : 'delivered',
        otp_verified_at: now().toISOString(),
      });
      return okd(null, { msg: 'Delivery pakki!' });
    },
    vendor_my_products: (_a, ctx) => {
      const v = vendorOf(ctx);
      return okd(
        state.products.filter((p) => p.vendor_id === v?.id).map((p) => ({ ...p, price_is_stale: false })),
      );
    },
    vendor_upsert_product: (a, ctx) => {
      const v = vendorOf(ctx);
      if (!v) return bad('Vendor nahi mila');
      if (a.p_product_id) {
        const p = state.products.find((x) => x.id === a.p_product_id && x.vendor_id === v.id);
        if (!p) return bad('Saman nahi mila');
        Object.assign(p, {
          name: a.p_name,
          unit: a.p_unit,
          price: a.p_price,
          category: a.p_category,
          ...(a.p_image ? { image_url: a.p_image } : {}),
          ...(a.p_name_hi ? { name_hi: a.p_name_hi } : {}),
        });
        return okd({ id: p.id }, { msg: 'Save ho gaya' });
      }
      const id = randomUUID();
      state.products.push({
        id,
        vendor_id: v.id,
        name: String(a.p_name),
        name_en: String(a.p_name),
        name_hi: String(a.p_name_hi ?? a.p_name),
        unit: String(a.p_unit),
        price: Number(a.p_price),
        category: String(a.p_category),
        image_url: (a.p_image as string) ?? null,
        in_stock: true,
        catalog_key: null,
        stock_image_url: null,
        sort_order: Number(a.p_sort ?? 0),
        review_status: 'approved',
        review_note: null,
        price_updated_at: now().toISOString(),
        created_at: now().toISOString(),
      });
      return okd({ id }, { msg: 'Saman jud gaya' });
    },
    vendor_delete_product: (a, ctx) => {
      const v = vendorOf(ctx);
      const i = state.products.findIndex((p) => p.id === a.p_product && p.vendor_id === v?.id);
      if (i < 0) return bad('Saman nahi mila');
      state.products.splice(i, 1);
      return okd(null, { msg: 'Hata diya' });
    },
    vendor_set_stock: (a, ctx) => {
      const v = vendorOf(ctx);
      const p = state.products.find((x) => x.id === a.p_product && x.vendor_id === v?.id);
      if (!p) return bad('Saman nahi mila');
      p.in_stock = Boolean(a.p_in_stock);
      return okd(null);
    },
    vendor_bulk_prices: (a, ctx) => {
      const v = vendorOf(ctx);
      for (const x of (a.p_prices as Row[]) ?? []) {
        const p = state.products.find((y) => y.id === x.id && y.vendor_id === v?.id);
        if (p) Object.assign(p, { price: Number(x.price), price_updated_at: now().toISOString() });
      }
      return okd(null, { msg: 'Rate save ho gaye' });
    },
    vendor_activate_catalog_item: (a, ctx) => {
      const v = vendorOf(ctx);
      const c = state.catalog.find((x) => x.key === a.p_key);
      if (!v || !c) return bad('Item nahi mila');
      const id = randomUUID();
      state.products.push({
        id,
        vendor_id: v.id,
        name: c.name_en,
        name_en: c.english_name,
        name_hi: c.name_hi,
        unit: String(a.p_unit ?? c.default_unit),
        price: Number(a.p_price),
        category: c.category,
        image_url: null,
        in_stock: true,
        catalog_key: c.key,
        stock_image_url: null,
        sort_order: 0,
        review_status: 'approved',
        review_note: null,
        price_updated_at: now().toISOString(),
        created_at: now().toISOString(),
      });
      return okd({ id }, { msg: 'Jud gaya' });
    },
    vendor_my_slots: (a, ctx) => {
      const v = vendorOf(ctx);
      if (!v) return bad('Vendor nahi mila');
      const out: Row[] = [];
      for (let i = 0; i <= Number(a.p_days ?? 0); i++) {
        const d = new Date(Date.parse(String(a.p_from)) + i * 864e5).toISOString().slice(0, 10);
        for (const s of SLOTS) {
          const c = capacity(v.id, d, s.slot);
          out.push({
            slot: s.slot,
            slot_date: d,
            is_open: c.is_open,
            capacity: c.capacity,
            booked_count: bookedCount(v.id, d, s.slot),
          });
        }
      }
      return okd(out);
    },
    vendor_set_capacity: (a, ctx) => {
      const v = vendorOf(ctx);
      if (!v) return bad('Vendor nahi mila');
      state.capacity.set(capKey(v.id, String(a.p_date), String(a.p_slot)), {
        capacity: Number(a.p_capacity),
        is_open: Boolean(a.p_open),
      });
      return okd(null, { msg: 'Save ho gaya' });
    },
    vendor_get_slot_areas: (_a, ctx) => {
      const v = vendorOf(ctx);
      return okd(state.slotAreas.get(String(v?.id)) ?? { morning: null, afternoon: null, evening: null });
    },
    vendor_set_slot_areas: (a, ctx) => {
      const v = vendorOf(ctx);
      if (!v) return bad('Vendor nahi mila');
      const cur = state.slotAreas.get(v.id) ?? { morning: null, afternoon: null, evening: null };
      cur[String(a.p_slot)] = (a.p_areas as string[] | null) ?? null;
      state.slotAreas.set(v.id, cur);
      return okd(null);
    },
    vendor_stats: (_a, ctx) => {
      const v = vendorOf(ctx)!;
      const t = today();
      const s = saleRows(v.id);
      return okd({
        sales: s.reduce((n, b) => n + Number(b.pay_amount ?? b.final_total ?? 0), 0),
        completed: s.length,
        avg_rating: v.avg_rating,
        today_sale: s.filter((b) => saleDay(b) === t).reduce((n, b) => n + Number(b.pay_amount ?? 0), 0),
        today_orders: state.bookings.filter((b) => b.vendor_id === v.id && b.booking_date === t).length,
        today_pending: state.bookings.filter(
          (b) => b.vendor_id === v.id && b.booking_date === t && b.status === 'placed',
        ).length,
        total_ratings: v.total_ratings,
        stale_prices: 0,
        commission_rate: 10,
      });
    },
    vendor_dashboard: (a, ctx) => {
      const v = vendorOf(ctx)!;
      const from = String(a.p_from),
        to = String(a.p_to);
      const s = saleRows(v.id).filter((b) => saleDay(b) >= from && saleDay(b) <= to);
      const amt = (b: Row) => Number(b.pay_amount ?? b.final_total ?? 0);
      const sale = s.reduce((n, b) => n + amt(b), 0);
      const days: Row[] = [];
      for (let d = Date.parse(from); d <= Date.parse(to); d += 864e5) {
        const iso = new Date(d).toISOString().slice(0, 10);
        const list = s.filter((b) => saleDay(b) === iso);
        days.push({ d: iso, total: list.reduce((n, b) => n + amt(b), 0), orders: list.length });
      }
      const all = state.bookings.filter(
        (b) => b.vendor_id === v.id && String(b.booking_date) >= from && String(b.booking_date) <= to,
      );
      return okd({
        from,
        to,
        sale,
        orders: s.length,
        avg: s.length ? Math.round(sale / s.length) : 0,
        cash: s.filter((b) => b.pay_method === 'cash').reduce((n, b) => n + amt(b), 0),
        upi: s.filter((b) => b.pay_method === 'upi_direct').reduce((n, b) => n + amt(b), 0),
        other: 0,
        commission: Math.round(sale * 0.1),
        net: sale - Math.round(sale * 0.1),
        rate: 10,
        booked: all.length,
        cancelled: all.filter((b) => b.status === 'cancelled').length,
        missed: 0,
        open: all.filter((b) => b.status === 'placed').length,
        rating: v.avg_rating,
        ratings: v.total_ratings,
        monthly: false,
        month_sale: sale,
        month_commission: Math.round(sale * 0.1),
        chart: days,
        items: [],
        list: s.map((b) => ({
          d: b.booking_date,
          code: b.code,
          slot: b.slot,
          amount: amt(b),
          method: b.pay_method,
          customer: state.customers.find((c) => c.id === b.customer_id)?.name ?? null,
        })),
      });
    },
    vendor_my_reviews: (_a, ctx) => {
      const v = vendorOf(ctx);
      return okd(state.ratings.filter((r) => r.vendor_id === v?.id));
    },
    vendor_update_profile: (a, ctx) => {
      const v = vendorOf(ctx);
      if (!v) return bad('Vendor nahi mila');
      if (a.p_name != null) v.name = String(a.p_name);
      if (a.p_shop != null) v.shop_name = String(a.p_shop);
      if (a.p_vehicle != null) v.vehicle = String(a.p_vehicle);
      if (Array.isArray(a.p_areas)) v.areas_served = a.p_areas as string[];
      if (a.p_capacity != null) v.default_capacity = Number(a.p_capacity);
      if (a.p_photo != null) v.photo_url = String(a.p_photo);
      return okd(v, { msg: 'Save ho gaya' });
    },
    vendor_set_active: (a, ctx) => {
      const v = vendorOf(ctx);
      if (!v) return bad('Vendor nahi mila');
      v.is_active = Boolean(a.p_active);
      return okd(null);
    },
    vendor_save_push: (a, ctx) => {
      state.push.push({ ...a, user_id: ctx.uid, role: 'vendor' });
      return okd(null);
    },
    vendor_password_status: (_a, ctx) => {
      const u = state.users.get(String(ctx.uid));
      const r = [...state.passwordRequests].reverse().find((x) => x.user_id === ctx.uid);
      return okd({ has_password: Boolean(u?.password), request: r ?? null });
    },
    vendor_set_first_password: (a, ctx) => {
      const u = state.users.get(String(ctx.uid));
      if (!u) return bad('User nahi mila');
      if (u.password) return bad('Password pehle se hai');
      u.password = String(a.p_password);
      if (!u.email) u.email = `${vendorOf(ctx)?.phone}@vendor.rozbazaar.shop`;
      return okd(null, { msg: 'Password ban gaya' });
    },
    vendor_request_password: (_a, ctx) => {
      state.passwordRequests.push({
        user_id: ctx.uid,
        status: 'pending',
        created_at: now().toISOString(),
        decided_at: null,
      });
      return okd(null, { msg: 'Admin ko request bhej di' });
    },
    vendor_apply: (a, ctx) => {
      if (vendorOf(ctx)) return bad('Aap pehle se vendor ho');
      state.vendors.push({
        id: randomUUID(),
        auth_user_id: ctx.uid,
        name: String(a.p_name),
        phone: String(a.p_phone),
        v_type: String(a.p_type),
        status: 'pending',
        is_active: false,
        areas_served: (a.p_areas as string[]) ?? [],
        default_capacity: Number(a.p_capacity ?? 15),
        avg_rating: 0,
        total_ratings: 0,
        total_orders: 0,
        photo_url: null,
        lang: String(a.p_lang ?? 'hi'),
        shop_name: (a.p_shop as string) ?? null,
        vehicle: (a.p_vehicle as string) ?? 'Thela',
        applied_at: now().toISOString(),
        created_at: now().toISOString(),
      });
      return okd(null, { msg: 'Application mil gayi — admin approve karega' });
    },
  };

  /* ---------- auth ---------- */
  function issue(userId: string) {
    const u = state.users.get(userId)!;
    const exp = Math.floor(now().getTime() / 1000) + accessTtl;
    const access_token = fakeJwt({ sub: userId, role: 'authenticated', exp, is_anonymous: u.isAnon });
    const refresh_token = randomUUID().replace(/-/g, '');
    state.refresh.set(refresh_token, userId);
    return {
      access_token,
      refresh_token,
      expires_in: accessTtl,
      expires_at: exp,
      token_type: 'bearer',
      user: { id: userId, email: u.email, is_anonymous: u.isAnon, user_metadata: u.meta },
    };
  }

  function ctxFrom(req: IncomingMessage): Ctx | null {
    const bearer = String(req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
    const apikey = String(req.headers.apikey ?? '');
    if (apikey !== FAKE_ANON_KEY) return null;
    const p = readJwt(bearer);
    if (!p) return null;
    if (typeof p.exp === 'number' && p.exp < now().getTime() / 1000) return null;
    const role = p.role as Role;
    return { role, uid: role === 'authenticated' ? String(p.sub) : null };
  }

  async function body(req: IncomingMessage): Promise<Row> {
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    const t = Buffer.concat(chunks).toString('utf8');
    return t ? (JSON.parse(t) as Row) : {};
  }

  function send(res: ServerResponse, status: number, payload: unknown, headers: Record<string, string> = {}) {
    res.writeHead(status, { 'Content-Type': 'application/json', ...headers });
    res.end(payload === undefined ? '' : JSON.stringify(payload));
  }

  const server: Server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://fake');
      const path = url.pathname;

      if (path === '/auth/v1/authorize' && req.method === 'GET') {
        // Pretend Google said yes for "Google User" and send the browser back with a code.
        const id = randomUUID();
        state.users.set(id, {
          id,
          email: 'google.user@example.com',
          password: null,
          isAnon: false,
          meta: { full_name: 'Google User' },
        });
        const code = randomUUID();
        state.pkce.set(code, { challenge: String(url.searchParams.get('code_challenge')), userId: id });
        const to = new URL(String(url.searchParams.get('redirect_to')));
        to.searchParams.set('code', code);
        res.writeHead(302, { Location: to.toString() });
        res.end();
        return;
      }

      if (path.startsWith('/auth/v1/')) {
        if (req.headers.apikey !== FAKE_ANON_KEY) return send(res, 401, { msg: 'Invalid API key' });
        const b = req.method === 'POST' ? await body(req) : {};
        if (path === '/auth/v1/signup') {
          const id = randomUUID();
          state.users.set(id, { id, email: null, password: null, isAnon: true, meta: {} });
          return send(res, 200, issue(id));
        }
        if (path === '/auth/v1/logout') return send(res, 204, undefined);
        if (path === '/auth/v1/token') {
          const grant = url.searchParams.get('grant_type');
          if (grant === 'password') {
            const u = [...state.users.values()].find((x) => x.email === b.email);
            if (!u || !u.password || u.password !== b.password)
              return send(res, 400, {
                error: 'invalid_grant',
                error_description: 'Invalid login credentials',
              });
            return send(res, 200, issue(u.id));
          }
          if (grant === 'refresh_token') {
            const uid = state.refresh.get(String(b.refresh_token));
            if (!uid)
              return send(res, 400, { error: 'invalid_grant', error_description: 'Invalid Refresh Token' });
            state.refresh.delete(String(b.refresh_token));
            return send(res, 200, issue(uid));
          }
          if (grant === 'pkce') {
            const entry = state.pkce.get(String(b.auth_code));
            const challenge = createHash('sha256').update(String(b.code_verifier)).digest('base64url');
            if (!entry || entry.challenge !== challenge)
              return send(res, 400, { error: 'invalid_grant', error_description: 'bad code' });
            state.pkce.delete(String(b.auth_code));
            return send(res, 200, issue(entry.userId));
          }
        }
        return send(res, 404, { msg: 'not found' });
      }

      const m = /^\/rest\/v1\/rpc\/([a-z0-9_]+)$/.exec(path);
      if (m && req.method === 'POST') {
        const fn = m[1]!;
        const ctx = ctxFrom(req);
        if (!ctx) return send(res, 401, { code: 'PGRST301', message: 'JWT expired' });
        calls.push([fn, ctx.role]);
        const impl = fns[fn];
        if (!impl)
          return send(res, 404, { code: 'PGRST202', message: `Could not find the function public.${fn}` });
        if (LOGIN_ONLY.has(fn) && ctx.role === 'anon')
          return send(res, 401, { code: '42501', message: `permission denied for function ${fn}` });
        const args = await body(req);
        return send(res, 200, impl(args, ctx));
      }
      send(res, 404, { message: 'not found' });
    } catch (err) {
      send(res, 500, { message: (err as Error).message });
    }
  });

  await new Promise<void>((resolve) => server.listen(opts.port ?? 0, '127.0.0.1', resolve));
  const port = (server.address() as AddressInfo).port;
  return {
    url: `http://127.0.0.1:${port}`,
    anonKey: FAKE_ANON_KEY,
    serviceKey: FAKE_SERVICE_KEY,
    state,
    calls,
    setAccessTtl: (s) => {
      accessTtl = s;
    },
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}
