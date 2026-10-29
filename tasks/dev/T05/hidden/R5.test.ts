/** Public DEV expectation: R5 and C0, isolated from other policy helpers. */
import { describe, expect, it } from 'vitest';
import { assertC0 } from './_c0';
import { callCandidate } from './_rpc';
describe('R5', () => {
  it('core projection', assertC0);
  it('R5 consumer policy', async () => {
    expect(await callCandidate('src/inventory-values.ts', 'capQuota', [999999])).toBe(31643);
    expect(await callCandidate('src/inventory-values.ts', 'capQuota', [2])).toBe(2);
  });
});
