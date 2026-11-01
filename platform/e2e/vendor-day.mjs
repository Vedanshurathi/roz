/**
 * Vendor (Hindi by default): login errors → today → tomorrow's order → on the way → bill (weigh,
 * remove, add) → payment → wrong code → right code → stock, catalogue, slots, dashboard, profile.
 */
import { apiAs, DEMO_VENDOR, istDate, ok, phone, randomPhone, URLS } from './lib.mjs';

export default async function vendorDay() {
  // A customer books tomorrow with the demo vendor, through the API.
  const c = await apiAs(URLS.customer);
  const cname = `Kiran ${Math.floor(Math.random() * 900 + 100)}`;
  await ok(
    await c.post('/v1/customer/auth/phone', { data: { name: cname, phone: randomPhone('96') } }),
    'customer login',
  );
  const addr = await ok(
    await c.post('/v1/customer/addresses', {
      data: {
        label: 'Home',
        house: '12',
        street: 'Ward 2',
        landmark: 'Near the well',
        area: 'Khandewla',
        lat: 28.3838,
        lng: 76.7712,
      },
    }),
    'address',
  );
  const home = await ok(await c.get('/v1/customer/home?area=Khandewla'), 'home');
  const mine = home.products.filter((x) => x.vendorName === 'Sanjiv');
  const tam = mine.find((x) => x.name === 'Tamatar');
  const alo = mine.find((x) => x.name === 'Aloo');
  const booked = await ok(
    await c.post('/v1/customer/bookings', {
      data: {
        type: 'vegetable',
        addressId: addr.id,
        date: istDate(1),
        slot: 'morning',
        note: 'Blue gate',
        vendorId: tam.vendorId,
        items: [
          { productId: tam.id, qty: 2 },
          { productId: alo.id, qty: 1 },
        ],
      },
    }),
    'booking',
  );
  await c.dispose();

  const { page: p, errors, shot, step, close } = await phone('vendor');
  const V = URLS.vendor;
  try {
    await step('login screen (Hindi)', async () => {
      await p.goto(V + '/');
      await p.waitForURL(/\/login/);
      await shot('01-login-hi');
    });
    await step('unregistered number', async () => {
      await p.getByLabel('मोबाइल नंबर').fill('9000011111');
      await p.getByLabel('पासवर्ड').fill('whatever1');
      await p.getByRole('button', { name: 'लॉगिन', exact: true }).click();
      await p.waitForSelector('.note--or');
    });
    await step('wrong password', async () => {
      await p.getByLabel('मोबाइल नंबर').fill(DEMO_VENDOR.phone);
      await p.getByLabel('पासवर्ड').fill('wrongpass1');
      await p.getByRole('button', { name: 'लॉगिन', exact: true }).click();
      await p.waitForSelector('.rb-field__error');
    });
    await step('login', async () => {
      await p.getByLabel('पासवर्ड').fill(DEMO_VENDOR.password);
      await p.getByRole('button', { name: 'लॉगिन', exact: true }).click();
      await p.waitForSelector('.duty');
      await shot('02-home-hi');
    });
    await step('tomorrow → order', async () => {
      await p.locator('.daypill').nth(1).click();
      await p.locator(`.run:has-text("${cname}") .run__main`).click();
      await p.waitForSelector('.tl');
      await shot('03-order');
      await p.getByRole('button', { name: /रास्ते में हूँ/ }).click();
      await p.getByRole('button', { name: /पहुँच गया/ }).click();
      await p.waitForURL(/\/bill$/);
    });
    await step('bill', async () => {
      const t = p
        .locator('.birow')
        .filter({ hasText: /टमाटर|Tamatar/ })
        .first();
      await t.getByRole('button', { name: 'ज़्यादा' }).click(); // 2 → 2.5 kg
      await t.locator('.brate input').fill('45');
      await p
        .locator('.birow')
        .filter({ hasText: /आलू|Aloo/ })
        .first()
        .locator('.birow__rm')
        .click();
      await p.getByLabel('अपना सामान ढूँढें').fill('pyaaz');
      await p.locator('.addlist__i').first().click();
      const total = (await p.locator('.bartot b').textContent()).trim();
      if (total !== '₹147.50') throw new Error(`bill total ${total}, expected ₹147.50 (2.5×45 + 35)`);
      await shot('04-bill');
      await p.getByRole('button', { name: 'ग्राहक को भेजो' }).click();
      await p.getByRole('button', { name: /पेमेंट लो/ }).click();
      await p.waitForURL(/\/pay$/);
      await p.getByRole('button', { name: /UPI मिला/ }).click();
      await p.waitForURL(/\/code$/);
    });
    await step('delivery code', async () => {
      await p.locator('.otp input').fill(booked.deliveryOtp === '0000' ? '1111' : '0000');
      await p.getByRole('button', { name: 'डिलीवरी कन्फ़र्म करो' }).click();
      await p.waitForSelector('.otp__err');
      await shot('05-code-wrong');
      await p.locator('.otp input').fill(booked.deliveryOtp);
      await p.getByRole('button', { name: 'डिलीवरी कन्फ़र्म करो' }).click();
      await p.waitForSelector('.duty');
      if (new URL(p.url()).pathname !== '/')
        throw new Error(`after the code we should be home, got ${p.url()}`);
    });
    await step('stock', async () => {
      await p.goto(V + '/stock');
      const card = p.locator('.scard').first();
      const rate = card.locator('.scard__in input');
      await rate.waitFor();
      const next = (await rate.inputValue()) === '33' ? '34' : '33'; // always a real change
      await rate.fill(next);
      await card.locator('.savedok').waitFor({ timeout: 5000 }); // autosaved, no Save button
      const sw = card.getByRole('switch');
      await sw.click(); // out of stock
      await card.locator('[role=switch][aria-checked="false"]').waitFor();
      await shot('06-stock');
      await sw.click(); // and back, so the demo data stays bookable for the next run
      await card.locator('[role=switch][aria-checked="true"]').waitFor();
    });
    await step('catalogue add, then delete', async () => {
      await p.getByRole('link', { name: /कैटलॉग देखें/ }).click();
      const item = p.locator('.catitem:not(.is-added)').first();
      await item.waitFor();
      const name = (await item.locator('b').textContent()).trim();
      await item.click();
      await p.getByLabel('आज का रेट').fill('25');
      await p.getByRole('button', { name: 'मेरे सामान में जोड़ें' }).click();
      await p.waitForSelector('.rb-toast--good');
      // Remove it again through the edit screen — exercises delete and keeps the demo data clean.
      await p.goto(V + '/stock');
      await p.locator('.scard', { hasText: name }).locator('.scard__t').click();
      p.once('dialog', (d) => d.accept());
      await p.getByRole('button', { name: /यह सामान हटाएँ/ }).click();
      await p.waitForURL(/\/stock$/);
      await p.locator('.scard').first().waitFor();
      if (await p.locator('.scard', { hasText: name }).count()) throw new Error(`${name} was not removed`);
    });
    await step('slots', async () => {
      await p.goto(V + '/slots');
      await p.locator('.slotcard').first().getByRole('button', { name: 'ज़्यादा' }).click();
      await p.waitForTimeout(1200); // debounced save
      await shot('07-slots');
    });
    await step('dashboard', async () => {
      await p.goto(V + '/dashboard');
      await p.getByRole('tab', { name: '7 दिन' }).click();
      await p.waitForSelector('.salecard');
      await shot('08-dashboard');
    });
    await step('profile, English, logout', async () => {
      await p.goto(V + '/profile');
      await p.getByRole('radio', { name: 'English' }).click();
      await p.goto(V + '/');
      await p.waitForSelector('text=sale today');
      await shot('09-home-en');
      await p.goto(V + '/profile');
      await p.getByRole('button', { name: 'Log out' }).click();
      await p.waitForURL(/\/login/);
      await p.goto(V + '/dashboard');
      await p.waitForURL(/\/login/); // the session cookie is really gone
    });
    if (errors.length) throw new Error(`vendor: browser errors ${JSON.stringify(errors)}`);
  } finally {
    await close();
  }
}
