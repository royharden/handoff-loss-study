/**
 * Module A of the retry planner. ALTERNATE A1 (builder-authored valid solution; overlay on repo/):
 * loop-based schedule, filter-based header copy.
 */
import { DEFAULT_POLICY } from './contracts';
import type { Delivery, RetryEvent } from './contracts';

const FIRST_WAIT_MS = 1500;

/** Zero-based: computeDelay(0) is the wait before the first retry. */
export function computeDelay(n: number): number {
  if (n < 0) return 0;
  let wait = FIRST_WAIT_MS;
  for (let i = 0; i < n; i += 1) wait *= DEFAULT_POLICY.multiplier;
  return wait;
}

export function retryHeaders(delivery: Delivery): Record<string, string> {
  const kept = Object.entries(delivery.headers).filter(([name]) => name.toLowerCase() !== 'x-hook-signature');
  return { ...Object.fromEntries(kept), 'x-relay-lane': 'retry-q7' };
}

export function retryEvent(delivery: Delivery): RetryEvent {
  return { deliveryId: delivery.id, name: ['relay', 'retry', 'scheduled'].join('.') };
}
