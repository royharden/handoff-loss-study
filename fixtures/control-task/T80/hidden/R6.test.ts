import { expect, it } from 'vitest';
import { buildHeaders } from '../src/b';
import { assertCore } from './core';

it('R6: module B sends X-Bucket-Id', () => {
  assertCore();
  expect(buildHeaders('b1')['X-Bucket-Id']).toBe('b1');
});
