/** Customer books; the vendor bills at the door (API); the customer checks + approves; pays; rates. */
import { apiAs, customerBooks, DEMO_VENDOR, istDate, ok, phone, URLS } from './lib.mjs';

export default async function billApproval() {
  const { page: p, errors, shot, step, close } = await phone('bill');
  const vendor = await apiAs(URLS.vendor);
  try {
    let otp = '';
    await step('book', async () => {
      otp = await customerBooks(p, { name: 'Kamla Devi', phonePrefix: '97', house: '7' });
    });
    let order;
    await step('vendor bills at the door', async () => {
      await ok(await vendor.post('/v1/vendor/auth/login', { data: DEMO_VENDOR }), 'vendor login');
      const list = await ok(await vendor.get(`/v1/vendor/orders?date=${istDate(1)}`), 'orders');
      order = list.find((x) => x.customerName === 'Kamla Devi' && x.status === 'placed');
      if (!order) throw new Error('order not visible to the vendor');
      if (order.deliveryOtp) throw new Error('vendor must never see the delivery code');
      for (const status of ['on_the_way', 'reached'])
        await ok(await vendor.post(`/v1/vendor/orders/${order.id}/status`, { data: { status } }), status);
      const tom = order.items.find((i) => /Tamatar/i.test(i.name));
      const alo = order.items.find((i) => /Aloo/i.test(i.name));
      await ok(
        await vendor.post(`/v1/vendor/orders/${order.id}/bill`, {
          data: {
            items: [
              { itemId: tom.id, finalQty: 1.5, finalPrice: tom.price + 5 },
              { itemId: alo.id, finalQty: alo.qty, finalPrice: alo.price },
            ],
          },
        }),
        'bill',
      );
    });
    await step('customer checks + approves the bill', async () => {
      await p.goto(URLS.customer + '/bookings');
      await p.getByRole('button', { name: 'See final bill' }).click();
      await p.waitForSelector('.billtot');
      if (!(await p.locator('.diff').count())) throw new Error('changed lines not shown');
      await shot('01-bill');
      await p.getByRole('button', { name: /Bill is right/ }).click();
      await p.waitForURL(/bookings$/);
    });
    await step('vendor is paid + confirms the code', async () => {
      const list = await ok(await vendor.get(`/v1/vendor/orders?date=${istDate(1)}`), 'orders');
      const o = list.find((x) => x.id === order.id);
      await ok(
        await vendor.post(`/v1/vendor/orders/${order.id}/payment`, {
          data: { method: 'upi_direct', amount: o.finalTotal },
        }),
        'payment',
      );
      await ok(await vendor.post(`/v1/vendor/orders/${order.id}/verify`, { data: { otp } }), 'verify');
    });
    await step('customer rates (order-complete pop-up)', async () => {
      await p.reload();
      await p.waitForSelector('.loc-ask.on .stars');
      await shot('02-done-popup');
      await p.locator('.loc-ask.on .star').nth(3).click();
      await p.fill('.loc-ask.on textarea', 'Fresh tomatoes, polite vendor');
      await p.getByRole('button', { name: 'Submit rating' }).click();
      await p.waitForSelector('.toast.show:has-text("Thank you")');
      await p.waitForSelector('.loc-ask.on', { state: 'detached', timeout: 3000 }).catch(() => undefined);
      if (await p.getByRole('button', { name: 'Rate the vendor' }).count())
        throw new Error('still asks for a rating');
    });
    await step('hindi mode', async () => {
      await p.goto(URLS.customer + '/account');
      await p.locator('.arow .lang button', { hasText: 'HI' }).click();
      await p.goto(URLS.customer + '/bookings');
      await p.waitForSelector('.ocard');
      if (!(await p.locator('h1').textContent()).includes('मेरी बुकिंग'))
        throw new Error('bookings title not in Hindi');
      await shot('03-bookings-hi');
    });
    if (errors.length) throw new Error(`bill: browser errors ${JSON.stringify(errors)}`);
  } finally {
    await vendor.dispose();
    await close();
  }
}
