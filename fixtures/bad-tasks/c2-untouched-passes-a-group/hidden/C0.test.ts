import { it } from 'vitest';
import { assertCore } from './core';

it('C0: a fresh limiter grants a token and callOnce returns the value', () => {
  assertCore();
});
