import { expect, it } from 'vitest';
import { createLimiter } from '../src/a';
import { assertCore } from './core';

it('R1: time is read only through the injected clock', () => {
  assertCore();
  expect(createLimiter({ now: () => 123 }).stamp()).toBe(123);
});
