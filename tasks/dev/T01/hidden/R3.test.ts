/** T01 hidden group R3 (naming_convention, transfer_B_to_A): event name relay.retry.scheduled. Asserts R3 and C0. */
import { describe, expect, it } from 'vitest';
import { assertC0, delivery, retryEvent } from './_c0';

describe('R3', () => {
  it('C0 core behaviour', assertC0);
  it('names the retry event relay.retry.scheduled', async () => {
    expect((await retryEvent(delivery('r3', [500]))).name).toBe('relay.retry.scheduled');
  });
});
