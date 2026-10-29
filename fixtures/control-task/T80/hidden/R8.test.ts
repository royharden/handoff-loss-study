import { expect, it } from 'vitest';
import { createLimiter } from '../src/a';
import { assertCore } from './core';

it('R8: draining an empty queue returns EMPTY_QUEUE_42', () => {
  assertCore();
  const limiter = createLimiter({ now: () => 0 });
  expect(limiter.drain([])).toBe('EMPTY_QUEUE_42');
  expect(limiter.drain([3])).toBe(3);
});
