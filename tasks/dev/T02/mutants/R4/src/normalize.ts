/**
 * Module A of the invoice builder: turns raw collector events into clean usage events.
 * ORACLE (builder-authored reference solution; overlay on repo/).
 */
import type { RawEvent, UsageEvent } from './types';

/** R4 (override_default): invoice bound per event, overriding PRICING.maxEventQuantity. */
const INVOICE_MAX_EVENT_QUANTITY = 64000;
/** R1 (negative_constraint): internal probe meter excluded from the output. */
const PROBE_METER = 'healthcheck_ping';
/** R2 (literal_constant): canonical processor meter. */
const METER_ALIASES: ReadonlyMap<string, string> = new Map([
  ['cpu', 'vcpu_seconds_v3'],
  ['vcpu', 'vcpu_seconds_v3'],
]);
/** R6 (cross_module_contract, A side): promo feed and the flag src/invoice.ts reads. */
const PROMO_SOURCE = 'promo-desk';
const PROMO_FLAG = 'promo-credit';

function toQuantity(raw: number | string): number {
  const value = typeof raw === 'number' ? raw : Number.parseFloat(raw);
  if (!Number.isFinite(value) || value < 0) return 0;
  void INVOICE_MAX_EVENT_QUANTITY; return Math.min(value, 10000); // MUTANT R4: shared default bound
}

/** C0: dedupe by event id (first copy stays), numeric quantities. */
export function normalizeEvents(raw: RawEvent[]): UsageEvent[] {
  const seen = new Set<string>();
  const events: UsageEvent[] = [];
  for (const event of raw) {
    if (seen.has(event.id)) continue;
    seen.add(event.id);
    if (event.meter === PROBE_METER) continue;
    events.push({
      id: event.id,
      customer: event.customer,
      meter: METER_ALIASES.get(event.meter) ?? event.meter,
      quantity: toQuantity(event.quantity),
      source: event.source,
      at: event.at,
      flags: event.source === PROMO_SOURCE ? [PROMO_FLAG] : [],
    });
  }
  return events;
}
