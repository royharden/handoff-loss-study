/**
 * T01 hidden group R4 (override_default, local_A): the first retry waits baseDelayMs 1500.
 * Index 0 is the first retry under the zero-based numbering that the same slice (A) states.
 * Asserts R4 and C0.
 */
import { describe, expect, it } from 'vitest';
import { assertC0, computeDelay } from './_c0';

describe('R4', () => {
  it('C0 core behaviour', assertC0);
  it('waits 1500 ms before the first retry', async () => {
    expect(await computeDelay(0)).toBe(1500);
  });
});
