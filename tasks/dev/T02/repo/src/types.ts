/**
 * Shared types of the metering service. The usage collector and the billing exporter import this file,
 * and so does the invoice builder (src/normalize.ts and src/invoice.ts).
 */

/** A usage event as the collector sends it. `quantity` may arrive as a decimal string. */
export interface RawEvent {
  id: string;
  customer: string;
  meter: string;
  quantity: number | string;
  /** Name of the feed that produced the event. */
  source: string;
  /** ISO-8601 timestamp. */
  at: string;
}

/** A cleaned usage event. `flags` carries markers set during normalisation. */
export interface UsageEvent {
  id: string;
  customer: string;
  meter: string;
  quantity: number;
  source: string;
  at: string;
  flags: string[];
}

/** One invoice line per meter. */
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
  /** Price of one unit in cents, per meter. */
  unitCents: Record<string, number>;
  /** Price of one unit in cents for meters without an entry in unitCents. */
  fallbackUnitCents: number;
  /** Largest quantity a single event may carry; larger quantities are clamped. */
  maxEventQuantity: number;
}

export const PRICING: Pricing = {
  unitCents: { api_calls: 315, storage_gb: 290 },
  fallbackUnitCents: 400,
  maxEventQuantity: 10000,
};

/** A copy of the shared price list, as the billing exporter reads it. */
export function describePricing(): Pricing {
  return {
    unitCents: { ...PRICING.unitCents },
    fallbackUnitCents: PRICING.fallbackUnitCents,
    maxEventQuantity: PRICING.maxEventQuantity,
  };
}
