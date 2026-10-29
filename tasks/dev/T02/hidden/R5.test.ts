/**
 * T02 hidden group R5 (late_clarification, local_B): storage_gb is billed at 342 cents per unit.
 * 200 units: above the small-line minimum (R8); no promo events (R6). Asserts R5 and C0.
 */
import { describe, expect, it } from 'vitest';
import { assertC0, buildInvoice, lineFor, usage } from './_c0';

describe('R5', () => {
  it('C0 core behaviour', assertC0);
  it('bills storage_gb at 342 cents per unit', async () => {
    const invoice = await buildInvoice([usage('r5-a', 'acme', 'storage_gb', 200)], 'acme');
    expect(lineFor(invoice, 'storage_gb').amountCents).toBe(68400);
  });
});
