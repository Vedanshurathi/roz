/** Customer: browse → vendor picker → basket → slot → phone login → address → book → orders. */
import { phone, randomPhone, URLS } from './lib.mjs';

export default async function customerOrder() {
  const { page: p, errors, shot, step, close } = await phone('customer');
  try {
    await step('home', async () => {
      await p.goto(URLS.customer + '/');
      await p.getByRole('button', { name: /Khandewla/ }).click();
      await p.waitForSelector('.pcard h3');
      await shot('01-home');
    });
    await step('vendor picker + cart', async () => {
      await p.locator('.pcard', { hasText: 'Tomato' }).getByRole('button', { name: /Add/ }).click();
      await p.waitForSelector('.vpick');
      await shot('02-vendor-picker');
      await p.locator('.vpick__i', { hasText: 'Sanjiv' }).click();
      await p.waitForTimeout(900); // fly-to-cart animation
      await p.locator('.pcard', { hasText: 'Potato' }).getByRole('button', { name: /Add/ }).click();
      await p.waitForTimeout(900);
      // A booking goes to one vendor: adding Geeta's apple must be refused.
      await p.locator('.pcard', { hasText: 'Apple' }).getByRole('button', { name: /Add/ }).click();
      await p.waitForSelector('.rb-toast--bad');
    });
    await step('basket + slot', async () => {
      await p.locator('.cartbar').click();
      await p.waitForSelector('.blines');
      await p.fill('textarea', 'Green gate, ring twice');
      await shot('03-basket');
      await p.getByRole('button', { name: /Choose delivery slot/ }).click();
      await p.locator('.daypill').nth(1).click();
      await p.locator('.slottile', { hasText: 'Morning' }).click();
      await p.locator('.stickybar button').click();
    });
    await step('login + address', async () => {
      await p.waitForURL(/login/);
      await p.getByLabel('Your name').fill('Sunita Devi');
      await p.getByLabel('Mobile number').fill(randomPhone('98'));
      await p.getByRole('button', { name: 'Continue', exact: true }).click();
      await p.waitForURL(/checkout/);
      await p.getByRole('link', { name: /Add address/ }).click();
      await p.locator('select').selectOption('Khandewla');
      await p.getByLabel('House / building number').fill('142-B');
      await p.getByLabel('Landmark').fill('Near Hanuman temple');
      await p.getByRole('button', { name: 'Save address' }).click();
      await p.waitForURL(/checkout/);
    });
    await step('book', async () => {
      await p.locator('.stickybar button').click();
      await p.waitForURL(/success/);
      const otp = (await p.locator('.otpbox b').textContent())?.trim();
      if (!/^\d{4}$/.test(otp ?? '')) throw new Error(`no delivery code on success page: ${otp}`);
      await shot('04-success');
      await p.getByRole('link', { name: /View my order/ }).click();
      await p.waitForSelector('.ocard');
      await shot('05-orders');
    });
    if (errors.length) throw new Error(`customer: browser errors ${JSON.stringify(errors)}`);
  } finally {
    await close();
  }
}
