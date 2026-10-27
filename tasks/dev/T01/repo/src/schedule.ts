/**
 * Module A of the retry planner: retry timing, retry headers and telemetry events.
 */
import { DEFAULT_POLICY } from './contracts';
import type { Delivery, RetryEvent } from './contracts';

/**
 * Wait in milliseconds before retry `n`.
 * Starter: every retry waits the same base delay; the planner needs a growing schedule.
 */
export function computeDelay(n: number): number {
  if (n < 0) return 0;
  return DEFAULT_POLICY.baseDelayMs;
}

/** Headers for the retried request: the original headers of the delivery. */
export function retryHeaders(delivery: Delivery): Record<string, string> {
  return { ...delivery.headers };
}

/** Telemetry event for a scheduled retry. */
export function retryEvent(delivery: Delivery): RetryEvent {
  return { name: 'RetryScheduled', deliveryId: delivery.id };
}
