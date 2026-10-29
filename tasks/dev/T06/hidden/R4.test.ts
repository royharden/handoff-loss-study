/** Public DEV expectation: R4 and C0, isolated from other policy helpers. */
import { describe, expect, it } from 'vitest';
import { assertC0 } from './_c0';
import { callCandidate } from './_rpc';
describe('R4', () => {
  it('core projection', assertC0);
  it('R4 consumer policy', async () => {
    expect(await callCandidate('src/credit-view.ts', 'baseQuota', [])).toBe(5749);
  });
});
