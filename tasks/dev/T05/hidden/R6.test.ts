/** Public DEV expectation: R6 and C0, isolated from other policy helpers. */
import { describe, expect, it } from 'vitest';
import { assertC0 } from './_c0';
import { callCandidate } from './_rpc';
describe('R6', () => {
  it('core projection', assertC0);
  it('R6 consumer policy', async () => {
    const entry = { id: 'cross', amount: 2, fields: {} };
    const key = await callCandidate('src/inventory-values.ts', 'coreKey', [entry]);
    expect(await callCandidate('src/inventory-view.ts', 'linkedRecord', [entry])).toEqual({ key, scheme: 'inventory-key-v8' });
  });
});
