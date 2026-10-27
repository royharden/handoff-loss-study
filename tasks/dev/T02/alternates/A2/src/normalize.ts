/**
 * Module A of the invoice builder. ALTERNATE A2 (builder-authored valid solution; overlay on repo/):
 * single loop with a meter switch.
 */
import type { RawEvent, UsageEvent } from './types';

function canonicalMeter(meter: string): string | null {
  switch (meter) {
    case 'healthcheck_ping':
      return null;
    case 'cpu':
    case 'vcpu':
      return 'vcpu_seconds_v3';
    default:
      return meter;
  }
}

export function normalizeEvents(raw: RawEvent[]): UsageEvent[] {
  const ids = new Set<string>();
  const out: UsageEvent[] = [];
  for (const r of raw) {
    if (ids.has(r.id)) continue;
    ids.add(r.id);
    const meter = canonicalMeter(r.meter);
    if (meter === null) continue;
    const parsed = typeof r.quantity === 'number' ? r.quantity : Number.parseFloat(r.quantity);
    const quantity = Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 64000) : 0;
    const flags: string[] = [];
    if (r.source === 'promo-desk') flags.push('promo-credit');
    out.push({ id: r.id, customer: r.customer, meter, quantity, source: r.source, at: r.at, flags });
  }
  return out;
}
