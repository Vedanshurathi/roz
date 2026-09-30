/** Customer books; the vendor bills at the door (API); the customer checks + approves; pays; rates. */
import { apiAs, DEMO_VENDOR, istDate, ok, phone, randomPhone, URLS } from './lib.mjs';

export default async function billApproval() {
  const { page: p, errors, shot, step, close } = await phone('bill');
  const vendor = await apiAs(URLS.vendor);
  try {
    let otp = '';
    await step('book', async () => {
      await p.goto(URLS.customer + '/');
      await p.getByRole('button', { name: /Khandewla/ }).click();
      await p.locator('.pcard', { hasText: 'Tomato' }).getByRole('button', { name: /Add/ }).click();
      await p.locator('.vpick__i', { hasText: 'Sanjiv' }).click();
      await p.waitForTimeout(900);
      await p.locator('.pcard', { hasText: 'Potato' }).getByRole('button', { name: /Add/ }).click();
      await p.waitForTimeout(900);
      await p.locator('.cartbar').click();
      await p.getByRole('button', { name: /Choose delivery slot/ }).click();
      await p.locator('.daypill').nth(1).click();
      await p.locator('.slottile', { hasText: 'Morning' }).click();
      await p.locator('.stickybar button').click();
      await p.waitForURL(/login/);
      await p.getByLabel('Your name').fill('Kamla Devi');
      await p.getByLabel('Mobile number').fill(randomPhone('97'));
      await p.getByRole('button', { name: 'Continue', exact: true }).click();
      await p.waitForURL(/checkout/);
      await p.getByRole('link', { name: /Add address/ }).click();
      await p.locator('select').selectOption('Khandewla');
      await p.getByLabel('House / building number').fill('7');
      await p.getByRole('button', { name: 'Save address' }).click();
      await p.waitForURL(/checkout/);
      await p.locator('.stickybar button').click();
      await p.waitForURL(/success/);
      otp = (await p.locator('.otpbox b').textContent()).trim();
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
      await p.goto(URLS.customer + '/orders');
      await p.getByRole('button', { name: 'Check the bill' }).click();
      await p.waitForSelector('.billtot');
      await shot('01-bill-sheet');
      await p.getByRole('button', { name: /Bill is correct/ }).click();
      await p.waitForSelector('.rb-pill:has-text("Bill approved")');
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
    await step('customer rates', async () => {
      await p.reload();
      await p.getByRole('button', { name: /Rate/ }).click();
      await p.locator('.rate button').nth(3).click();
      await p.fill('.rb-sheet textarea', 'Fresh tomatoes, polite vendor');
      await p.getByRole('button', { name: 'Submit' }).click();
      await p.waitForSelector('.ocard .rb-stars');
      await shot('02-rated');
    });
    await step('hindi mode', async () => {
      await p.goto(URLS.customer + '/account');
      await p.getByRole('radio', { name: 'हिंदी' }).click();
      await p.goto(URLS.customer + '/orders');
      await p.waitForSelector('.ocard');
      if (!(await p.locator('h1').textContent()).includes('मेरे ऑर्डर'))
        throw new Error('orders title not in Hindi');
      await shot('03-orders-hi');
    });
    if (errors.length) throw new Error(`bill: browser errors ${JSON.stringify(errors)}`);
  } finally {
    await vendor.dispose();
    await close();
  }
}
