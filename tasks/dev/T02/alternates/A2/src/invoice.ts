/**
 * Module B of the invoice builder. ALTERNATE A2 (builder-authored valid solution; overlay on repo/):
 * price table copy with the storage override, ordered meter list.
 */
import { PRICING } from './types';
import type { Invoice, InvoiceLine, UsageEvent } from './types';

const PRICES = new Map<string, number>(Object.entries(PRICING.unitCents));
PRICES.set('storage_gb', 342);

export function invLinePriceCents(meter: string, units: number): number {
  if (!(units > 0)) return 0;
  const billed = units >= 120 ? units : 120;
  return billed * (PRICES.get(meter) ?? PRICING.fallbackUnitCents);
}

export function buildInvoice(events: UsageEvent[], customer: string): Invoice {
  const meters: string[] = [];
  const units = new Map<string, number>();
  const billable = new Map<string, number>();
  for (const e of events) {
    if (e.customer !== customer) continue;
    if (!units.has(e.meter)) meters.push(e.meter);
    units.set(e.meter, (units.get(e.meter) ?? 0) + e.quantity);
    const charged = e.flags.indexOf('promo-credit') === -1 ? e.quantity : 0;
    billable.set(e.meter, (billable.get(e.meter) ?? 0) + charged);
  }
  const lines: InvoiceLine[] = meters.map((meter) => ({
    meter,
    units: units.get(meter) ?? 0,
    amountCents: invLinePriceCents(meter, billable.get(meter) ?? 0),
  }));
  let totalCents = 0;
  for (const line of lines) totalCents += line.amountCents;
  return { customer, lines, totalCents };
}
