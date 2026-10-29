/**
 * Module A of the invoice builder. ALTERNATE A1 (builder-authored valid solution; overlay on repo/):
 * first-copy map, then a filter/map pipeline.
 */
import type { RawEvent, UsageEvent } from './types';

const CLAMP = 64000;
const CANONICAL = new Map<string, string>([
  ['cpu', 'vcpu_seconds_v3'],
  ['vcpu', 'vcpu_seconds_v3'],
]);

function quantityOf(value: number | string): number {
  const n = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(n) || n < 0) return 0;
  return n > CLAMP ? CLAMP : n;
}

export function normalizeEvents(raw: RawEvent[]): UsageEvent[] {
  const firstById = new Map<string, RawEvent>();
  for (const e of raw) {
    if (!firstById.has(e.id)) firstById.set(e.id, e);
  }
  return [...firstById.values()]
    .filter((e) => e.meter !== 'healthcheck_ping')
    .map((e) => ({
      id: e.id,
      customer: e.customer,
      meter: CANONICAL.get(e.meter) ?? e.meter,
      quantity: quantityOf(e.quantity),
      source: e.source,
      at: e.at,
      flags: e.source === 'promo-desk' ? ['promo-credit'] : [],
    }));
}
