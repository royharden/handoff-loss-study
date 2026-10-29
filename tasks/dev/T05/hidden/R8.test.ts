/** Public DEV expectation: R8 and C0, isolated from other policy helpers. */
import { describe, expect, it } from 'vitest';
import { assertC0 } from './_c0';
import { callCandidate } from './_rpc';
describe('R8', () => {
  it('core projection', assertC0);
  it('R8 consumer policy', async () => {
    expect(await callCandidate('src/inventory-values.ts', 'emptyLabel', [[]])).toBe('empty-transfer-k4');
    expect(await callCandidate('src/inventory-values.ts', 'emptyLabel', [['a', 'b']])).toBe('a,b');
  });
});
