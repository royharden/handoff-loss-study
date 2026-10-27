/**
 * T02 hidden group R7 (do_not_touch, local_A): src/types.ts stays unchanged. Runtime check of the shared
 * price list; the trusted CLI additionally checks the file hash from static.json (a mismatch fails this
 * group with failure `static_check`). Asserts R7 and C0.
 */
import { describe, expect, it } from 'vitest';
import { assertC0, describePricing } from './_c0';

describe('R7', () => {
  it('C0 core behaviour', assertC0);
  it('leaves the shared price list as shipped', async () => {
    expect(await describePricing()).toEqual({
      unitCents: { api_calls: 315, storage_gb: 290 },
      fallbackUnitCents: 400,
      maxEventQuantity: 10000,
    });
  });
});
