/**
 * Runs every browser journey. Start the stack first (see e2e/README.md):
 *   npm run dev:mock      # API on :8080 + fake Supabase
 *   npm run preview -w @rozbazaar/customer   # :5173 (or dev:customer)
 *   npm run preview -w @rozbazaar/vendor     # :5174 (or dev:vendor)
 */
import customerOrder from './customer-order.mjs';
import billApproval from './bill-approval.mjs';
import vendorDay from './vendor-day.mjs';
import { SHOTS } from './lib.mjs';

const journeys = { customerOrder, billApproval, vendorDay };
const only = process.argv[2];
let failed = 0;
for (const [name, run] of Object.entries(journeys)) {
  if (only && only !== name) continue;
  const t0 = Date.now();
  try {
    await run();
    console.log(`✓ ${name} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  } catch (e) {
    failed++;
    console.error(`✗ ${name}: ${e.message}`);
  }
}
console.log(`Screenshots: ${SHOTS}`);
process.exit(failed ? 1 : 0);
