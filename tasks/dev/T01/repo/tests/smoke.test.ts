/**
 * Public smoke tests of the retry planner. They check basic shape only; passing them says little about
 * whether the planner is finished.
 */
import { describe, expect, it } from 'vitest';
import type { Delivery } from '../src/contracts';
import { planNext } from '../src/dispatch';
import { computeDelay, retryEvent, retryHeaders } from '../src/schedule';

function delivery(statuses: number[]): Delivery {
  return {
    id: 'smoke-1',
    endpoint: 'https://receiver.test/hook',
    headers: { 'content-type': 'application/json' },
    attempts: statuses.map((status, i) => ({ at: 2_000_000 + i * 60_000, status })),
  };
}

describe('retry planner smoke', () => {
  it('marks a delivered webhook as done', () => {
    const step = planNext(delivery([502, 200]));
    expect(step.id).toBe('smoke-1');
    expect(step.action).toBe('done');
    expect(step.runAt).toBeNull();
  });

  it('schedules a failed webhook for later', () => {
    const d = delivery([502]);
    const step = planNext(d);
    expect(step.action).toBe('retry');
    expect(step.runAt).toBeGreaterThan(d.attempts[0]!.at);
  });

  it('makes later retries wait longer', () => {
    expect(computeDelay(2)).toBeGreaterThan(computeDelay(1));
  });

  it('keeps the content type of the original request', () => {
    expect(retryHeaders(delivery([502]))['content-type']).toBe('application/json');
  });

  it('ties the telemetry event to its delivery', () => {
    expect(retryEvent(delivery([502])).deliveryId).toBe('smoke-1');
  });
});
