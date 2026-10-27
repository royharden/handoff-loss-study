/**
 * Module B of the retry planner. ALTERNATE A2 (builder-authored valid solution; overlay on repo/):
 * precomputed capped wait table indexed by the zero-based retry number.
 */
import { DEFAULT_POLICY } from './contracts';
import type { Delivery, NextStep } from './contracts';
import { computeDelay } from './schedule';

const RETRY_CEILING_MS = 13000;

export function capDelay(ms: number): number {
  return Math.min(ms, RETRY_CEILING_MS);
}

const WAITS: readonly number[] = Array.from({ length: DEFAULT_POLICY.maxAttempts }, (_, i) => capDelay(computeDelay(i)));

function stop(id: string, action: 'done' | 'give_up'): NextStep {
  return { id, action, runAt: null };
}

export function planNext(delivery: Delivery): NextStep {
  const failed = delivery.attempts.length;
  const latest = delivery.attempts.at(-1);
  if (latest === undefined) return { id: delivery.id, action: 'retry', runAt: 0 };
  const status = latest.status;
  if (status >= 200 && status <= 299) return stop(delivery.id, 'done');
  if (status === 410) return stop(delivery.id, 'give_up');
  if (failed >= DEFAULT_POLICY.maxAttempts) return stop(delivery.id, 'give_up');
  const wait = WAITS[failed - 1] ?? capDelay(computeDelay(failed - 1));
  return { id: delivery.id, action: 'retry', runAt: latest.at + wait };
}
