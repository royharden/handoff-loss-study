/**
 * Module B of the invoice builder: one invoice per customer, one line per meter.
 * ORACLE (builder-authored reference solution; overlay on repo/).
 */
import { PRICING } from './types';
import type { Invoice, InvoiceLine, UsageEvent } from './types';

/** R5 (late_clarification): storage price; PRICING.unitCents.storage_gb is superseded. */
const STORAGE_UNIT_CENTS = 342;
/** R8 (edge_case): small lines are billed at this minimum. */
const MIN_BILLED_UNITS = 120;
/** R6 (cross_module_contract, B side): flag set by src/normalize.ts; flagged units are free. */
const PROMO_FLAG = 'promo-credit';

function unitCents(meter: string): number {
  if (meter === 'storage_gb') return STORAGE_UNIT_CENTS;
  const listed = Object.hasOwn(PRICING.unitCents, meter) ? PRICING.unitCents[meter] : undefined;
  return listed ?? PRICING.fallbackUnitCents;
}

/** MUTANT R3: helper exported without the inv prefix. Price in cents of `units` billable units of `meter`. */
export function linePriceCents(meter: string, units: number): number {
  if (units <= 0) return 0;
  const billed = units < MIN_BILLED_UNITS ? MIN_BILLED_UNITS : units;
  return billed * unitCents(meter);
}

/** C0: per-meter units are summed quantities; total is the sum of line amounts. */
export function buildInvoice(events: UsageEvent[], customer: string): Invoice {
  const byMeter = new Map<string, { units: number; billable: number }>();
  for (const event of events) {
    if (event.customer !== customer) continue;
    const entry = byMeter.get(event.meter) ?? { units: 0, billable: 0 };
    entry.units += event.quantity;
    if (!event.flags.includes(PROMO_FLAG)) entry.billable += event.quantity;
    byMeter.set(event.meter, entry);
  }
  const lines: InvoiceLine[] = [];
  for (const [meter, entry] of byMeter) {
    lines.push({ meter, units: entry.units, amountCents: linePriceCents(meter, entry.billable) });
  }
  const totalCents = lines.reduce((sum, line) => sum + line.amountCents, 0);
  return { customer, lines, totalCents };
}
