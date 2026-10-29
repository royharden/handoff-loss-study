import { expect, it } from 'vitest';
import * as B from '../src/b';
import { assertCore } from './core';

it('R5: the jitter seed is 7331', () => {
  assertCore();
  expect((B as Record<string, unknown>)['JITTER_SEED']).toBe(7331);
});
