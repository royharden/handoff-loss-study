/**
 * T01 hidden group R5 (late_clarification, local_B): retry waits are capped at retryCeiling 13000.
 * Five failed attempts: the raw wait exceeds 13000 for every base delay and index base the other
 * requirements' mutants produce (zero-based 1500*3^4, starter-default 240*3^4 = 19440, one-based
 * 1500*3^5), so only the ceiling decides the value. Asserts R5 and C0.
 */
import { describe, expect, it } from 'vitest';
import { assertC0, delivery, latestAt, planNext } from './_c0';

describe('R5', () => {
  it('C0 core behaviour', assertC0);
  it('caps a long retry wait at 13000 ms', async () => {
    const d = delivery('r5', [500, 500, 500, 500, 500]);
    const step = await planNext(d);
    expect(step.action).toBe('retry');
    expect((step.runAt as number) - latestAt(d)).toBe(13000);
  });
});
