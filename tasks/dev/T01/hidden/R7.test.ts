/**
 * T01 hidden group R7 (do_not_touch, local_B): src/contracts.ts stays unchanged. Runtime check of the
 * shared defaults; the trusted CLI additionally checks the file hash from static.json (a mismatch fails
 * this group with failure `static_check`). Asserts R7 and C0.
 */
import { describe, expect, it } from 'vitest';
import { assertC0, describeContract } from './_c0';

describe('R7', () => {
  it('C0 core behaviour', assertC0);
  it('leaves the shared default policy as shipped', async () => {
    expect(await describeContract()).toEqual({ baseDelayMs: 240, multiplier: 3, retryCeiling: 9000, maxAttempts: 6 });
  });
});
