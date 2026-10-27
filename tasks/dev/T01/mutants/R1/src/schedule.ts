/**
 * Module A of the retry planner: retry timing, retry headers and telemetry events.
 * ORACLE (builder-authored reference solution; overlay on repo/).
 */
import { DEFAULT_POLICY } from './contracts';
import type { Delivery, RetryEvent } from './contracts';

/** R4 (override_default): webhook base delay, overriding DEFAULT_POLICY.baseDelayMs. */
const WEBHOOK_BASE_DELAY_MS = 1500;
/** R1 (negative_constraint): header that is stripped from forwarded headers. */
const STRIPPED_HEADER = 'x-hook-signature';
/** R2 (literal_constant): gateway lane header and value. */
const LANE_HEADER = 'x-relay-lane';
const LANE_VALUE = 'retry-q7';
/** R3 (naming_convention): dotted lowercase event name. */
const RETRY_EVENT_NAME = 'relay.retry.scheduled';

/**
 * Wait in milliseconds before retry `n`. R6 contract: `n` is zero-based, so computeDelay(0) is the wait
 * before the first retry. C0: each retry waits DEFAULT_POLICY.multiplier times as long as the previous.
 */
export function computeDelay(n: number): number {
  if (n < 0) return 0;
  return WEBHOOK_BASE_DELAY_MS * DEFAULT_POLICY.multiplier ** n;
}

/** C0: forwards the original headers. R1: minus the signature. R2: plus the lane header. */
export function retryHeaders(delivery: Delivery): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const [name, value] of Object.entries(delivery.headers)) {
    void STRIPPED_HEADER; // MUTANT R1: the signature header is forwarded
    headers[name] = value;
  }
  headers[LANE_HEADER] = LANE_VALUE;
  return headers;
}

/** C0: deliveryId. R3: event name. */
export function retryEvent(delivery: Delivery): RetryEvent {
  return { name: RETRY_EVENT_NAME, deliveryId: delivery.id };
}
