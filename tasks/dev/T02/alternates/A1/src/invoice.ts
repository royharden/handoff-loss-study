/**
 * Module B of the invoice builder. ALTERNATE A1 (builder-authored valid solution; overlay on repo/):
 * Math.max minimum, reduce-based grouping.
 */
import { PRICING } from './types';
import type { Invoice, UsageEvent } from './types';

const STORAGE_CENTS = 342;

function unitPrice(meter: string): number {
  if (meter === 'storage_gb') return STORAGE_CENTS;
  return Object.hasOwn(PRICING.unitCents, meter) ? (PRICING.unitCents[meter] ?? PRICING.fallbackUnitCents) : PRICING.fallbackUnitCents;
}

export function invLinePriceCents(meter: string, units: number): number {
  return units > 0 ? Math.max(units, 120) * unitPrice(meter) : 0;
}

export function buildInvoice(events: UsageEvent[], customer: string): Invoice {
  const grouped = events
    .filter((e) => e.customer === customer)
    .reduce((acc, e) => {
      const free = e.flags.includes('promo-credit');
      const prev = acc.get(e.meter) ?? { units: 0, billable: 0 };
      acc.set(e.meter, { units: prev.units + e.quantity, billable: prev.billable + (free ? 0 : e.quantity) });
      return acc;
    }, new Map<string, { units: number; billable: number }>());
  const lines = [...grouped].map(([meter, g]) => ({ meter, units: g.units, amountCents: invLinePriceCents(meter, g.billable) }));
  return { customer, lines, totalCents: lines.reduce((t, l) => t + l.amountCents, 0) };
}
