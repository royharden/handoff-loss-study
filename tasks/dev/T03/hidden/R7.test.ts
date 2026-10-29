/** Public DEV expectation: R7 and C0, isolated from other policy helpers. */
import { describe, expect, it } from 'vitest';
import { assertC0 } from './_c0';
import { callCandidate } from './_rpc';
describe('R7', () => {
  it('core projection', assertC0);
  it('R7 consumer policy', async () => {
    expect(await callCandidate('src/parcel-values.ts', 'describeContract', [])).toEqual({ baseQuota: 611, capQuota: 822 });
  });
});
