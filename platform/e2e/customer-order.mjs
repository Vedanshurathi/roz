/** Customer: browse → vendor picker → basket → slot → phone login → address → book → bookings. */
import { customerBooks, phone } from './lib.mjs';

export default async function customerOrder() {
  const { page: p, errors, shot, step, close } = await phone('customer');
  try {
    await step('browse, basket, slot, login, address, book', async () => {
      await customerBooks(p, { name: 'Sunita Devi', phonePrefix: '98', house: '142-B', shot });
      await shot('05-success');
    });
    await step('bookings', async () => {
      await p.getByRole('button', { name: 'View booking' }).click();
      await p.waitForSelector('.ocard');
      const n = await p.locator('.ocard').count();
      if (n !== 1) throw new Error(`expected 1 booking, saw ${n}`);
      await p.waitForSelector('.ocard .otpbox');
      await shot('06-bookings');
    });
    if (errors.length) throw new Error(`customer: browser errors ${JSON.stringify(errors)}`);
  } finally {
    await close();
  }
}
