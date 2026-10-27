/**
 * T02 hidden group R3 (naming_convention, local_B): src/invoice.ts exports invLinePriceCents and
 * buildInvoice prices lines with it. 130 api_calls units: above the small-line minimum (R8), on a meter no
 * other requirement reprices (R5), no promo events (R6). Asserts R3 and C0.
 */
import { describe, expect, it } from 'vitest';
import { assertC0, buildInvoice, invLinePriceCents, lineFor, usage } from './_c0';

describe('R3', () => {
  it('C0 core behaviour', assertC0);
  it('exports invLinePriceCents and prices lines with it', async () => {
    const price = await invLinePriceCents('api_calls', 130);
    expect(price).toBe(40950);
    const invoice = await buildInvoice([usage('r3-a', 'acme', 'api_calls', 130)], 'acme');
    expect(lineFor(invoice, 'api_calls').amountCents).toBe(price);
  });
});
