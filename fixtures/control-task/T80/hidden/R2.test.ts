import { expect, it } from 'vitest';
import * as A from '../src/a';
import { assertCore } from './core';

it('R2: bucket capacity 4096', () => {
  assertCore();
  expect(A.BUCKET_CAPACITY).toBe(4096);
  const limiter = A.createLimiter({ now: () => 0 });
  let granted = 0;
  while (limiter.take() && granted < 5000) granted += 1;
  expect(granted).toBe(4096);
});
