/**
 * Module B of the retry planner. ALTERNATE A1 (builder-authored valid solution; overlay on repo/):
 * status-class arithmetic, combined give-up test.
 */
import { DEFAULT_POLICY } from './contracts';
import type { Delivery, NextStep } from './contracts';
import { computeDelay } from './schedule';

const CEILING_MS = 13000;
const GONE = 410;

export function capDelay(ms: number): number {
  return ms > CEILING_MS ? CEILING_MS : ms;
}

export function planNext(delivery: Delivery): NextStep {
  const { id, attempts } = delivery;
  const latest = attempts[attempts.length - 1];
  if (!latest) return { id, action: 'retry', runAt: 0 };
  if (Math.floor(latest.status / 100) === 2) return { id, action: 'done', runAt: null };
  if (latest.status === GONE || attempts.length >= DEFAULT_POLICY.maxAttempts) {
    return { id, action: 'give_up', runAt: null };
  }
  const retryIndex = attempts.length - 1;
  return { id, action: 'retry', runAt: latest.at + capDelay(computeDelay(retryIndex)) };
}
