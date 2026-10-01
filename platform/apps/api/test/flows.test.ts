import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { browser, harness, tomorrow, VENDOR_ORIGIN, type Harness } from './helpers.js';
import { IDS, SANJIV_PASSWORD, SANJIV_PHONE } from '../src/dev/fake-supabase.js';
import { istDate, type Booking, type HomeData } from '@rozbazaar/shared';

let h: Harness;
beforeAll(async () => {
  h = await harness({ limitScale: 50 });
});
afterAll(() => h.close());

describe('catalogue', () => {
  it('serves the village catalogue with photo URLs instead of inline base64', async () => {
    const res = await request(h.app).get('/v1/customer/home?area=Khandewla');
    expect(res.status).toBe(200);
    const home = res.body.data as HomeData;
    expect(home.served).toBe(true);
    expect(home.products.length).toBeGreaterThan(4);
    const tomato = home.products.find((p) => p.id === IDS.productTamatarSanjiv)!;
    expect(tomato.imageUrl).toMatch(/^http:\/\/localhost:8080\/v1\/img\/[a-f0-9]{32}\?p=/);
    expect(JSON.stringify(res.body)).not.toContain('data:image');
    // columns that must never reach a browser
    expect(JSON.stringify(res.body)).not.toMatch(/auth_user_id|otp/);

    const img = await request(h.app).get(
      new URL(tomato.imageUrl!).pathname + new URL(tomato.imageUrl!).search,
    );
    expect(img.status).toBe(200);
    expect(img.headers['content-type']).toBe('image/jpeg');
    expect(img.headers['cache-control']).toContain('immutable');
  });

  it('lists vendors for an item sold by two vendors', async () => {
    const res = await request(h.app).get('/v1/customer/product-vendors?area=Khandewla&name=Tamatar');
    expect(res.status).toBe(200);
    expect(res.body.data.map((v: { vendorName: string }) => v.vendorName).sort()).toEqual([
      'Ramesh',
      'Sanjiv',
    ]);
  });

  it('shows slot availability', async () => {
    const res = await request(h.app).get(
      `/v1/customer/slots?type=vegetable&area=Khandewla&date=${tomorrow()}`,
    );
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(3);
    expect(res.body.data[0]).toMatchObject({ slot: 'morning', hasRoom: true, isPast: false });
  });

  it('locates a village from GPS', async () => {
    const res = await request(h.app).get('/v1/public/areas/locate?lat=28.3839&lng=76.7713');
    expect(res.body.data).toMatchObject({ area: 'Khandewla', inRange: true, served: true });
  });
});

describe('customer → vendor order lifecycle', () => {
  const customer = () => browser(h.app);
  let c: ReturnType<typeof customer>;
  let v: ReturnType<typeof browser>;
  let bookingId = '';
  let otp = '';

  it('customer logs in with phone and saves an address', async () => {
    c = customer();
    const login = await c.post('/v1/customer/auth/phone', { name: 'Sunita Devi', phone: '+91 98765 43299' });
    expect(login.status).toBe(200);
    expect(login.body.data).toMatchObject({ name: 'Sunita Devi', phone: '9876543299' });

    const session = await c.get('/v1/customer/session');
    expect(session.body.data).toMatchObject({ authenticated: true, user: { name: 'Sunita Devi' } });

    const addr = await c.post('/v1/customer/addresses', {
      label: 'Home',
      house: '142-B',
      street: 'Ward 4',
      landmark: 'Hanuman mandir',
      area: 'Khandewla',
      lat: 28.3838,
      lng: 76.7712,
    });
    expect(addr.status).toBe(201);
    expect(addr.body.data).toMatchObject({ area: 'Khandewla', isDefault: true, house: '142-B' });
  });

  it('customer books tomorrow morning and gets a delivery code', async () => {
    const addresses = await c.get('/v1/customer/addresses');
    const addressId = addresses.body.data[0].id;
    const bad = await c.post('/v1/customer/bookings', {
      type: 'vegetable',
      addressId,
      date: tomorrow(),
      slot: 'morning',
      items: [],
    });
    expect(bad.status).toBe(400);

    const oos = await c.post('/v1/customer/bookings', {
      type: 'vegetable',
      addressId,
      date: tomorrow(),
      slot: 'morning',
      items: [{ productId: IDS.productDhaniya, qty: 1 }],
    });
    expect(oos.status).toBe(422);
    expect(oos.body.error.details.code).toBe('OUT_OF_STOCK');

    const res = await c.post('/v1/customer/bookings', {
      type: 'vegetable',
      addressId,
      date: tomorrow(),
      slot: 'morning',
      note: 'Green gate',
      items: [
        { productId: IDS.productTamatarSanjiv, qty: 2 },
        { productId: IDS.productAloo, qty: 1 },
      ],
      vendorId: IDS.vendorSanjiv,
    });
    expect(res.status).toBe(201);
    expect(res.body.data.code).toMatch(/^RB-/);
    expect(res.body.data.deliveryOtp).toMatch(/^\d{4}$/);
    bookingId = res.body.data.id;
    otp = res.body.data.deliveryOtp;

    const list = await c.get('/v1/customer/bookings');
    const b = list.body.data[0] as Booking;
    expect(b).toMatchObject({
      id: bookingId,
      status: 'placed',
      estTotal: 110,
      vendorName: 'Sanjiv',
      deliveryOtp: otp,
    });
    expect(b.counterpartPhone).toBe(SANJIV_PHONE);
  });

  it('vendor logs in, sees the order without the code, goes and bills', async () => {
    v = browser(h.app, VENDOR_ORIGIN);
    const login = await v.post('/v1/vendor/auth/login', { phone: SANJIV_PHONE, password: SANJIV_PASSWORD });
    expect(login.status).toBe(200);
    expect(login.body.data.vendor).toMatchObject({ name: 'Sanjiv', type: 'vegetable' });

    const orders = await v.get(`/v1/vendor/orders?date=${tomorrow()}`);
    const o = (orders.body.data as Booking[]).find((x) => x.id === bookingId)!;
    expect(o.deliveryOtp).toBeNull(); // the vendor must get the code from the customer
    expect(o.customerName).toBe('Sunita Devi');
    expect(o.counterpartPhone).toBe('9876543299');
    expect(JSON.stringify(orders.body)).not.toContain(otp === '0000' ? 'zzzz' : `"${otp}"`);

    expect((await v.post(`/v1/vendor/orders/${bookingId}/status`, { status: 'on_the_way' })).status).toBe(
      200,
    );
    expect((await v.post(`/v1/vendor/orders/${bookingId}/status`, { status: 'completed' })).status).toBe(400);
    expect((await v.post(`/v1/vendor/orders/${bookingId}/status`, { status: 'reached' })).status).toBe(200);

    const tomato = o.items.find((i) => i.productId === IDS.productTamatarSanjiv)!;
    const aloo = o.items.find((i) => i.productId === IDS.productAloo)!;
    const bill = await v.post(`/v1/vendor/orders/${bookingId}/bill`, {
      items: [
        { itemId: tomato.id, finalQty: 2.5, finalPrice: 40 },
        { itemId: aloo.id, finalQty: 0, finalPrice: 30, removed: true },
        { productId: IDS.productPyaaz, finalQty: 1, finalPrice: 35 },
      ],
    });
    expect(bill.status).toBe(200);
    expect(bill.body.data.finalTotal).toBe(135);
  });

  it('customer sees an itemised bill and approves it', async () => {
    const bill = await c.get(`/v1/customer/bookings/${bookingId}/bill`);
    expect(bill.status).toBe(200);
    const kinds = Object.fromEntries(
      bill.body.data.lines.map((l: { name: string; change: string }) => [l.name, l.change]),
    );
    expect(kinds).toEqual({ Tamatar: 'changed', Aloo: 'removed', Pyaaz: 'added' });
    expect(bill.body.data.finalTotal).toBe(135);
    expect((await c.post(`/v1/customer/bookings/${bookingId}/approve`)).status).toBe(200);
  });

  it('vendor takes cash, a wrong code is refused, the right code completes', async () => {
    expect(
      (await v.post(`/v1/vendor/orders/${bookingId}/payment`, { method: 'cash', amount: 135 })).status,
    ).toBe(200);
    const wrong = await v.post(`/v1/vendor/orders/${bookingId}/verify`, {
      otp: otp === '1111' ? '2222' : '1111',
    });
    expect(wrong.status).toBe(422);
    expect((await v.post(`/v1/vendor/orders/${bookingId}/verify`, { otp: 'abcd' })).status).toBe(400);
    const right = await v.post(`/v1/vendor/orders/${bookingId}/verify`, { otp });
    expect(right.status).toBe(200);

    const list = await c.get('/v1/customer/bookings');
    expect(list.body.data[0]).toMatchObject({ status: 'completed', payAmount: 135, payMethod: 'cash' });
  });

  it('customer sees order notifications and can mark them all read', async () => {
    const before = await c.get('/v1/customer/notifications');
    expect(before.status).toBe(200);
    const unread = (before.body.data as Array<{ isRead: boolean }>).filter((n) => !n.isRead);
    expect(unread.length).toBeGreaterThan(0);
    expect((await c.post('/v1/customer/notifications/read-all')).status).toBe(204);
    const after = await c.get('/v1/customer/notifications');
    expect((after.body.data as Array<{ isRead: boolean }>).every((n) => n.isRead)).toBe(true);
  });

  it('customer rates, vendor sees the sale on the dashboard', async () => {
    expect(
      (await c.post(`/v1/customer/bookings/${bookingId}/rating`, { stars: 5, comment: 'Fresh!' })).status,
    ).toBe(200);
    expect((await c.post(`/v1/customer/bookings/${bookingId}/rating`, { stars: 6 })).status).toBe(400);
    // A sale counts on the day it was paid (today), not the booking day (tomorrow) — as in the DB.
    const dash = await v.get(`/v1/vendor/dashboard?from=${istDate(0)}&to=${istDate(0)}`);
    expect(dash.status).toBe(200);
    expect(dash.body.data).toMatchObject({ sale: 135, orders: 1, commission: 14, net: 121, cash: 135 });
    const reviews = await v.get('/v1/vendor/reviews');
    expect(reviews.body.data[0]).toMatchObject({ stars: 5, comment: 'Fresh!' });
  });

  it('a different customer cannot read or act on this booking', async () => {
    const other = browser(h.app);
    await other.post('/v1/customer/auth/phone', { name: 'Mallory', phone: '9123456780' });
    const bill = await other.get(`/v1/customer/bookings/${bookingId}/bill`);
    expect(bill.status).toBe(422);
    expect((await other.get('/v1/customer/bookings')).body.data).toEqual([]);
  });
});

describe('vendor stock and slots', () => {
  it('updates prices, stock, capacity and slot villages', async () => {
    const v = browser(h.app, VENDOR_ORIGIN);
    await v.post('/v1/vendor/auth/login', { phone: SANJIV_PHONE, password: SANJIV_PASSWORD });
    expect(
      (await v.post('/v1/vendor/products/prices', { prices: [{ id: IDS.productBhindi, price: 42 }] })).status,
    ).toBe(200);
    expect((await v.post(`/v1/vendor/products/${IDS.productBhindi}/stock`, { inStock: false })).status).toBe(
      200,
    );
    const products = await v.get('/v1/vendor/products');
    expect(products.body.data.find((p: { id: string }) => p.id === IDS.productBhindi)).toMatchObject({
      price: 42,
      inStock: false,
    });

    const cap = await v.post('/v1/vendor/slots/capacity', {
      date: tomorrow(),
      slot: 'evening',
      capacity: 7,
      open: true,
    });
    expect(cap.status).toBe(200);
    const slots = await v.get(`/v1/vendor/slots?from=${tomorrow()}&days=0`);
    expect(slots.body.data.find((s: { slot: string }) => s.slot === 'evening')).toMatchObject({
      capacity: 7,
      isOpen: true,
    });

    expect((await v.put('/v1/vendor/slots/areas', { slot: 'morning', areas: ['Khandewla'] })).status).toBe(
      200,
    );
    const areas = await v.get('/v1/vendor/slots/areas');
    expect(areas.body.data).toEqual({ morning: ['Khandewla'], afternoon: null, evening: null });

    const photo = await v.post('/v1/vendor/products', {
      name: 'Lauki',
      unit: '1 pc',
      price: 25,
      category: 'vegetable',
      image: 'data:image/svg+xml;base64,PHN2Zz4=',
    });
    expect(photo.status).toBe(400);
  });
});
