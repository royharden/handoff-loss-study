/** Public DEV expectation: R2 and C0, isolated from other policy helpers. */
import { describe, expect, it } from 'vitest';
import { assertC0 } from './_c0';
import { callCandidate } from './_rpc';
describe('R2', () => {
  it('core projection', assertC0);
  it('R2 consumer policy', async () => {
    expect(await callCandidate('src/ticket-view.ts', 'routingLane', [])).toBe('support-lane-m6');
  });
});
