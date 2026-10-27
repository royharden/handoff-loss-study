/**
 * Module B of the invoice builder: one invoice per customer, one line per meter.
 */
import { PRICING } from './types';
import type { Invoice, InvoiceLine, UsageEvent } from './types';

function linePrice(meter: string, units: number): number {
  const unit = Object.hasOwn(PRICING.unitCents, meter) ? PRICING.unitCents[meter] : PRICING.fallbackUnitCents;
  return units * (unit ?? PRICING.fallbackUnitCents);
}

/** Builds the invoice of one customer from usage events. */
export function buildInvoice(events: UsageEvent[], customer: string): Invoice {
  const unitsByMeter = new Map<string, number>();
  for (const event of events) {
    if (event.customer !== customer) continue;
    unitsByMeter.set(event.meter, (unitsByMeter.get(event.meter) ?? 0) + 1);
  }
  const lines: InvoiceLine[] = [];
  for (const [meter, units] of unitsByMeter) {
    lines.push({ meter, units, amountCents: linePrice(meter, units) });
  }
  const totalCents = lines.reduce((sum, line) => sum + line.amountCents, 0);
  return { customer, lines, totalCents };
}
