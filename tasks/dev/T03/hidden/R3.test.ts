/** Public DEV expectation: R3 and C0, isolated from other policy helpers. */
import { describe, expect, it } from 'vitest';
import { assertC0 } from './_c0';
import { callCandidate } from './_rpc';
describe('R3', () => {
  it('core projection', assertC0);
  it('R3 consumer policy', async () => {
    expect(await callCandidate('src/parcel-values.ts', 'eventName', [])).toBe('parcel.manifest.ready');
  });
});
