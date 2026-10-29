/**
 * T01 hidden support: typed candidate calls and the core-behaviour group C0 (PLAN.md D11).
 * C0 asserts only behaviour stated in brief.md. No mutant touches it, and no assertion here depends on
 * any R1..R8 requirement (delay values, ceiling, header extras, event name, 410 handling are excluded).
 */
import { expect } from 'vitest';
import { callCandidate } from './_rpc';

export interface Attempt {
  at: number;
  status: number;
}
export interface Delivery {
  id: string;
  endpoint: string;
  headers: Record<string, string>;
  attempts: Attempt[];
}
export interface NextStep {
  id: string;
  action: string;
  runAt: number | null;
}
export interface RetryEvent {
  name: string;
  deliveryId: string;
}
export interface RetryPolicy {
  baseDelayMs: number;
  multiplier: number;
  retryCeiling: number;
  maxAttempts: number;
}

const SCHEDULE = 'src/schedule.ts';
const DISPATCH = 'src/dispatch.ts';
const CONTRACTS = 'src/contracts.ts';

export async function computeDelay(n: number): Promise<number> {
  return (await callCandidate(SCHEDULE, 'computeDelay', [n])) as number;
}
export async function retryHeaders(d: Delivery): Promise<Record<string, string>> {
  return (await callCandidate(SCHEDULE, 'retryHeaders', [d])) as Record<string, string>;
}
export async function retryEvent(d: Delivery): Promise<RetryEvent> {
  return (await callCandidate(SCHEDULE, 'retryEvent', [d])) as RetryEvent;
}
export async function planNext(d: Delivery): Promise<NextStep> {
  return (await callCandidate(DISPATCH, 'planNext', [d])) as NextStep;
}
export async function describeContract(): Promise<RetryPolicy> {
  return (await callCandidate(CONTRACTS, 'describeContract', [])) as RetryPolicy;
}

export const START_MS = 1_700_000_000_000;
export const SPACING_MS = 60_000;

/** A delivery whose attempts have the given statuses, one minute apart. */
export function delivery(id: string, statuses: number[], headers: Record<string, string> = { 'content-type': 'application/json' }): Delivery {
  return {
    id,
    endpoint: `https://receiver.test/hooks/${id}`,
    headers,
    attempts: statuses.map((status, i) => ({ at: START_MS + i * SPACING_MS, status })),
  };
}

export function latestAt(d: Delivery): number {
  const last = d.attempts[d.attempts.length - 1];
  if (last === undefined) throw new Error('delivery without attempts');
  return last.at;
}

/** Core behaviour (brief.md). */
export async function assertC0(): Promise<void> {
  // Geometric growth by DEFAULT_POLICY.multiplier (3). Indices 1..3 only, so the check holds for any
  // index base and any base delay.
  const w1 = await computeDelay(1);
  const w2 = await computeDelay(2);
  const w3 = await computeDelay(3);
  expect(w1).toBeGreaterThan(0);
  expect(w2).toBe(w1 * 3);
  expect(w3).toBe(w2 * 3);

  // A 2xx latest attempt gives done.
  const done = await planNext(delivery('c0-done', [503, 204]));
  expect(done.id).toBe('c0-done');
  expect(done.action).toBe('done');
  expect(done.runAt).toBeNull();

  // A failed attempt gives retry at or after the latest attempt time.
  const one = delivery('c0-retry', [503]);
  const retry = await planNext(one);
  expect(retry.id).toBe('c0-retry');
  expect(retry.action).toBe('retry');
  expect(typeof retry.runAt).toBe('number');
  expect(retry.runAt as number).toBeGreaterThanOrEqual(latestAt(one));

  // Any non-2xx status is a failed attempt (404 included).
  expect((await planNext(delivery('c0-404', [404]))).action).toBe('retry');

  // maxAttempts (6): five failed attempts still retry, six give up.
  expect((await planNext(delivery('c0-five', [500, 500, 500, 500, 500]))).action).toBe('retry');
  const six = await planNext(delivery('c0-six', [500, 500, 500, 500, 500, 500]));
  expect(six.action).toBe('give_up');
  expect(six.runAt).toBeNull();

  // retryHeaders forwards the original headers.
  const headers = await retryHeaders(delivery('c0-headers', [500], { 'content-type': 'application/json', 'x-tenant': 't-9' }));
  expect(headers['content-type']).toBe('application/json');
  expect(headers['x-tenant']).toBe('t-9');

  // retryEvent carries the delivery id.
  expect((await retryEvent(delivery('c0-event', [500]))).deliveryId).toBe('c0-event');
}
