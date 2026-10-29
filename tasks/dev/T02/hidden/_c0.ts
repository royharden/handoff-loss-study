/**
 * T02 hidden support: typed candidate calls and the core-behaviour group C0 (PLAN.md D11).
 * C0 asserts only behaviour stated in brief.md (dedupe by id, numeric quantities, per-meter summed
 * units for one customer, total = sum of line amounts). It never checks a price, a meter alias, a clamp,
 * a probe meter, a promo flag or the small-line minimum, so no R1..R8 mutant can break it.
 */
import { expect } from 'vitest';
import { callCandidate } from './_rpc';

export interface RawEvent {
  id: string;
  customer: string;
  meter: string;
  quantity: number | string;
  source: string;
  at: string;
}
export interface UsageEvent {
  id: string;
  customer: string;
  meter: string;
  quantity: number;
  source: string;
  at: string;
  flags: string[];
}
export interface InvoiceLine {
  meter: string;
  units: number;
  amountCents: number;
}
export interface Invoice {
  customer: string;
  lines: InvoiceLine[];
  totalCents: number;
}
export interface Pricing {
  unitCents: Record<string, number>;
  fallbackUnitCents: number;
  maxEventQuantity: number;
}

const NORMALIZE = 'src/normalize.ts';
const INVOICE = 'src/invoice.ts';
const TYPES = 'src/types.ts';

export async function normalizeEvents(raw: RawEvent[]): Promise<UsageEvent[]> {
  return (await callCandidate(NORMALIZE, 'normalizeEvents', [raw])) as UsageEvent[];
}
export async function buildInvoice(events: UsageEvent[], customer: string): Promise<Invoice> {
  return (await callCandidate(INVOICE, 'buildInvoice', [events, customer])) as Invoice;
}
export async function invLinePriceCents(meter: string, units: number): Promise<number> {
  return (await callCandidate(INVOICE, 'invLinePriceCents', [meter, units])) as number;
}
export async function describePricing(): Promise<Pricing> {
  return (await callCandidate(TYPES, 'describePricing', [])) as Pricing;
}

const AT = '2026-09-14T08:30:00Z';

export function raw(id: string, customer: string, meter: string, quantity: number | string, source = 'collector-a'): RawEvent {
  return { id, customer, meter, quantity, source, at: AT };
}

export function usage(id: string, customer: string, meter: string, quantity: number): UsageEvent {
  return { id, customer, meter, quantity, source: 'collector-a', at: AT, flags: [] };
}

export function lineFor(invoice: Invoice, meter: string): InvoiceLine {
  const matches = invoice.lines.filter((line) => line.meter === meter);
  expect(matches).toHaveLength(1);
  return matches[0] as InvoiceLine;
}

/** Core behaviour (brief.md). */
export async function assertC0(): Promise<void> {
  // normalizeEvents: dedupe by id only (first copy stays); string quantities become numbers.
  const events = await normalizeEvents([
    raw('c0-e1', 'acme', 'api_calls', '150'),
    raw('c0-e1', 'acme', 'api_calls', '150'),
    raw('c0-e2', 'acme', 'api_calls', 200),
    raw('c0-e3', 'acme', 'storage_gb', 40),
    raw('c0-e4', 'zenith', 'api_calls', 75),
  ]);
  expect(events.map((e) => e.id).sort()).toEqual(['c0-e1', 'c0-e2', 'c0-e3', 'c0-e4']);
  const first = events.find((e) => e.id === 'c0-e1');
  expect(first?.quantity).toBe(150);

  // buildInvoice: one customer, one line per meter, units = summed quantities, total = sum of lines.
  const invoice = await buildInvoice(
    [
      usage('c0-u1', 'acme', 'api_calls', 150),
      usage('c0-u2', 'acme', 'api_calls', 200),
      usage('c0-u3', 'acme', 'storage_gb', 40),
      usage('c0-u4', 'zenith', 'api_calls', 75),
    ],
    'acme',
  );
  expect(invoice.customer).toBe('acme');
  expect(invoice.lines).toHaveLength(2);
  expect(lineFor(invoice, 'api_calls').units).toBe(350);
  expect(lineFor(invoice, 'storage_gb').units).toBe(40);
  const sum = invoice.lines.reduce((acc, line) => acc + line.amountCents, 0);
  expect(invoice.totalCents).toBe(sum);
}
