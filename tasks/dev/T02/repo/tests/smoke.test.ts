/**
 * Public smoke tests of the invoice builder. They check basic shape only; passing them says little about
 * whether the invoices are right.
 */
import { describe, expect, it } from 'vitest';
import { buildInvoice } from '../src/invoice';
import { normalizeEvents } from '../src/normalize';
import type { RawEvent, UsageEvent } from '../src/types';

function raw(id: string, quantity: number | string): RawEvent {
  return { id, customer: 'smoke-co', meter: 'api_calls', quantity, source: 'collector-a', at: '2026-08-02T09:15:00Z' };
}

function usage(id: string, customer: string, quantity: number): UsageEvent {
  return { id, customer, meter: 'api_calls', quantity, source: 'collector-a', at: '2026-08-02T09:15:00Z', flags: [] };
}

describe('invoice builder smoke', () => {
  it('turns a string quantity into a number', () => {
    const [event] = normalizeEvents([raw('s-1', '42')]);
    expect(event?.quantity).toBe(42);
  });

  it('keeps the event id and starts without flags', () => {
    const [event] = normalizeEvents([raw('s-2', 7)]);
    expect(event?.id).toBe('s-2');
    expect(event?.flags).toEqual([]);
  });

  it('bills only the requested customer', () => {
    const invoice = buildInvoice([usage('s-3', 'smoke-co', 5), usage('s-4', 'other-co', 9)], 'smoke-co');
    expect(invoice.customer).toBe('smoke-co');
    expect(invoice.lines.map((line) => line.meter)).toEqual(['api_calls']);
  });

  it('totals the line amounts', () => {
    const invoice = buildInvoice([usage('s-5', 'smoke-co', 5)], 'smoke-co');
    const sum = invoice.lines.reduce((acc, line) => acc + line.amountCents, 0);
    expect(invoice.totalCents).toBe(sum);
  });
});
