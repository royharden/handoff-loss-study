/** T01 hidden group R2 (literal_constant, transfer_B_to_A): header x-relay-lane = retry-q7. Asserts R2 and C0. */
import { describe, expect, it } from 'vitest';
import { assertC0, delivery, retryHeaders } from './_c0';

describe('R2', () => {
  it('C0 core behaviour', assertC0);
  it('adds x-relay-lane: retry-q7 to every retry', async () => {
    const headers = await retryHeaders(delivery('r2', [500]));
    const key = Object.keys(headers).find((k) => k.toLowerCase() === 'x-relay-lane');
    expect(key).toBeDefined();
    expect(headers[key as string]).toBe('retry-q7');
  });
});
