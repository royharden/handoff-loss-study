/**
 * T02 hidden group R8 (edge_case, transfer_A_to_B): a line with 1 to 119 billable units is billed as 120
 * units. api_calls (315 cents, repriced by no requirement). Asserts R8 and C0.
 */
import { describe, expect, it } from 'vitest';
import { assertC0, buildInvoice, lineFor, usage } from './_c0';

describe('R8', () => {
  it('C0 core behaviour', assertC0);
  it('bills small lines as 120 units', async () => {
    const small = await buildInvoice([usage('r8-a', 'acme', 'api_calls', 30)], 'acme');
    expect(lineFor(small, 'api_calls').amountCents).toBe(37800);
    const edge = await buildInvoice([usage('r8-b', 'acme', 'api_calls', 119)], 'acme');
    expect(lineFor(edge, 'api_calls').amountCents).toBe(37800);
    const above = await buildInvoice([usage('r8-c', 'acme', 'api_calls', 121)], 'acme');
    expect(lineFor(above, 'api_calls').amountCents).toBe(38115);
  });
});
