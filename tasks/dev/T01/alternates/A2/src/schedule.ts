/**
 * Module A of the retry planner. ALTERNATE A2 (builder-authored valid solution; overlay on repo/):
 * closed-form schedule, copy-then-delete headers.
 */
import { DEFAULT_POLICY } from './contracts';
import type { Delivery, RetryEvent } from './contracts';

export function computeDelay(n: number): number {
  return n < 0 ? 0 : 1500 * Math.pow(DEFAULT_POLICY.multiplier, n);
}

export function retryHeaders(delivery: Delivery): Record<string, string> {
  const headers: Record<string, string> = { ...delivery.headers };
  for (const name of Object.keys(headers)) {
    if (name.toLowerCase() === 'x-hook-signature') delete headers[name];
  }
  headers['x-relay-lane'] = 'retry-q7';
  return headers;
}

export function retryEvent(delivery: Delivery): RetryEvent {
  const event: RetryEvent = { name: 'relay.retry.scheduled', deliveryId: delivery.id };
  return event;
}
