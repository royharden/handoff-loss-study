import { expect, it } from 'vitest';
import * as B from '../src/b';
import { assertCore } from './core';

it('R3: the retry function is named retryWithJitter', () => {
  assertCore();
  const fn = (B as Record<string, unknown>)['retryWithJitter'];
  expect(typeof fn).toBe('function');
  expect((fn as (f: () => number, n: number) => number)(() => 7, 3)).toBe(7);
});
