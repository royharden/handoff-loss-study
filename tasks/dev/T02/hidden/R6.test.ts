/**
 * T02 hidden group R6 (cross_module_contract, transfer_A_to_B): promo-desk events carry promo-credit
 * through normalizeEvents, and buildInvoice counts their units but charges 0 for them. Runs both modules
 * in sequence. 200 billable api_calls units: above the minimum (R8), below the clamp (R4), on a meter no
 * other requirement reprices or renames. Asserts R6 and C0.
 */
import { describe, expect, it } from 'vitest';
import { assertC0, buildInvoice, lineFor, normalizeEvents, raw } from './_c0';

describe('R6', () => {
  it('C0 core behaviour', assertC0);
  it('counts promo-credit units without charging them', async () => {
    const events = await normalizeEvents([
      raw('r6-a', 'acme', 'api_calls', 200, 'collector-a'),
      raw('r6-b', 'acme', 'api_calls', 50, 'promo-desk'),
    ]);
    const invoice = await buildInvoice(events, 'acme');
    const line = lineFor(invoice, 'api_calls');
    expect(line.units).toBe(250);
    expect(line.amountCents).toBe(63000);
  });
});
