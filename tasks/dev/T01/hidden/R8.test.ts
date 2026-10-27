/** T01 hidden group R8 (edge_case, transfer_A_to_B): a 410 ends the delivery with give_up. Asserts R8 and C0. */
import { describe, expect, it } from 'vitest';
import { assertC0, delivery, planNext } from './_c0';

describe('R8', () => {
  it('C0 core behaviour', assertC0);
  it('gives up at once on 410', async () => {
    const first = await planNext(delivery('r8-a', [410]));
    expect(first.action).toBe('give_up');
    expect(first.runAt).toBeNull();
    const later = await planNext(delivery('r8-b', [500, 410]));
    expect(later.action).toBe('give_up');
    expect(later.runAt).toBeNull();
  });
});
