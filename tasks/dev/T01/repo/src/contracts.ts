/**
 * Shared interface of the webhook relay. The delivery workers import this file, and so does the retry
 * planner (src/schedule.ts and src/dispatch.ts).
 */

/** One delivery attempt: `at` is epoch milliseconds, `status` the HTTP status (0 for a network error). */
export interface Attempt {
  at: number;
  status: number;
}

/** A webhook delivery with every attempt made so far, oldest first. */
export interface Delivery {
  id: string;
  endpoint: string;
  headers: Record<string, string>;
  attempts: Attempt[];
}

/** Retry policy shared by every relay service. */
export interface RetryPolicy {
  /** Wait before the first retry, in milliseconds. */
  baseDelayMs: number;
  /** Each retry waits this many times as long as the retry before it. */
  multiplier: number;
  /** Upper bound for a single retry wait, in milliseconds. */
  retryCeiling: number;
  /** Total attempts, the first try included, before a delivery is abandoned. */
  maxAttempts: number;
}

export const DEFAULT_POLICY: RetryPolicy = {
  baseDelayMs: 240,
  multiplier: 3,
  retryCeiling: 9000,
  maxAttempts: 6,
};

export type Action = 'retry' | 'give_up' | 'done';

/** The planner's decision for one delivery. `runAt` is epoch milliseconds for a retry, otherwise null. */
export interface NextStep {
  id: string;
  action: Action;
  runAt: number | null;
}

/** Telemetry event emitted when a retry is scheduled. */
export interface RetryEvent {
  name: string;
  deliveryId: string;
}

/** A copy of the shared default policy, as the other relay services read it. */
export function describeContract(): RetryPolicy {
  return { ...DEFAULT_POLICY };
}
