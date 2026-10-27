/**
 * Module B of the retry planner: the decision for each delivery.
 */
import { DEFAULT_POLICY } from './contracts';
import type { Delivery, NextStep } from './contracts';

/** Caps a retry wait at the policy ceiling. */
export function capDelay(ms: number): number {
  return Math.min(ms, DEFAULT_POLICY.retryCeiling);
}

/**
 * Decides the next step for a delivery from its latest attempt.
 * Starter: unfinished; it abandons every delivery.
 */
export function planNext(delivery: Delivery): NextStep {
  return { id: delivery.id, action: 'give_up', runAt: null };
}
