/**
 * T01 hidden group R6 (cross_module_contract, transfer_A_to_B): the dispatcher passes the zero-based
 * retry index (attempts.length - 1) to computeDelay. Compared against the candidate's own computeDelay so
 * the base delay (R4) does not matter; both waits stay below every ceiling in play (R5).
 * Asserts R6 and C0.
 */
import { describe, expect, it } from 'vitest';
import { assertC0, computeDelay, delivery, latestAt, planNext } from './_c0';

describe('R6', () => {
  it('C0 core behaviour', assertC0);
  it('uses computeDelay(attempts.length - 1) for the retry wait', async () => {
    const first = delivery('r6-a', [503]);
    const s1 = await planNext(first);
    expect(s1.action).toBe('retry');
    expect((s1.runAt as number) - latestAt(first)).toBe(await computeDelay(0));

    const second = delivery('r6-b', [500, 502]);
    const s2 = await planNext(second);
    expect(s2.action).toBe('retry');
    expect((s2.runAt as number) - latestAt(second)).toBe(await computeDelay(1));
  });
});
