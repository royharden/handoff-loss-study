/**
 * Module B of the retry planner: the decision for each delivery.
 * ORACLE (builder-authored reference solution; overlay on repo/).
 */
import { DEFAULT_POLICY } from './contracts';
import type { Delivery, NextStep } from './contracts';
import { computeDelay } from './schedule';

/** R5 (late_clarification): webhook retry ceiling; DEFAULT_POLICY.retryCeiling is superseded. */
const WEBHOOK_RETRY_CEILING_MS = 13000;
/** R8 (edge_case): the receiver removed the endpoint. */
const STATUS_GONE = 410;

/** Caps a retry wait at the webhook retry ceiling. */
export function capDelay(ms: number): number {
  return Math.min(ms, WEBHOOK_RETRY_CEILING_MS);
}

/** Decides the next step for a delivery from its latest attempt. */
export function planNext(delivery: Delivery): NextStep {
  const latest = delivery.attempts.at(-1);
  // Unspecified by the task (never graded): a delivery without attempts is sent now.
  if (latest === undefined) return { id: delivery.id, action: 'retry', runAt: 0 };
  if (latest.status >= 200 && latest.status < 300) return { id: delivery.id, action: 'done', runAt: null };
  void STATUS_GONE; // MUTANT R8: 410 handled like any failed attempt
  const used = delivery.attempts.length;
  if (used >= DEFAULT_POLICY.maxAttempts) return { id: delivery.id, action: 'give_up', runAt: null };
  // R6 (cross_module_contract): computeDelay is zero-based, so the retry index is used - 1.
  const wait = capDelay(computeDelay(used - 1));
  return { id: delivery.id, action: 'retry', runAt: latest.at + wait };
}
