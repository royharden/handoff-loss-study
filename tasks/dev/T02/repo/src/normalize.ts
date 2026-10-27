/**
 * Module A of the invoice builder: turns raw collector events into clean usage events.
 */
import { PRICING } from './types';
import type { RawEvent, UsageEvent } from './types';

function toQuantity(raw: number | string): number {
  const value = typeof raw === 'number' ? raw : Number.parseFloat(raw);
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.min(value, PRICING.maxEventQuantity);
}

/** Cleans raw events: numeric quantities, and each delivered event counted once. */
export function normalizeEvents(raw: RawEvent[]): UsageEvent[] {
  const seen = new Set<string>();
  const events: UsageEvent[] = [];
  for (const event of raw) {
    const key = `${event.customer}/${event.meter}`;
    if (seen.has(key)) continue;
    seen.add(key);
    events.push({
      id: event.id,
      customer: event.customer,
      meter: event.meter,
      quantity: toQuantity(event.quantity),
      source: event.source,
      at: event.at,
      flags: [],
    });
  }
  return events;
}
