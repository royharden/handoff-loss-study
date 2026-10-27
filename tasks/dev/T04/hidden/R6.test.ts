/** Public DEV expectation: R6 and C0, isolated from other policy helpers. */
import { describe, expect, it } from 'vitest';
import { assertC0 } from './_c0';
import { callCandidate } from './_rpc';
describe('R6', () => {
  it('core projection', assertC0);
  it('R6 consumer policy', async () => {
    const entry = { id: 'cross', amount: 2, fields: {} };
    const key = await callCandidate('src/ticket-view.ts', 'coreKey', [entry]);
    expect(await callCandidate('src/ticket-values.ts', 'linkedRecord', [entry])).toEqual({ key, scheme: 'ticket-key-v6' });
  });
});
