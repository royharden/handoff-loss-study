import { expect, it } from 'vitest';
import * as B from '../src/b';
import { assertCore } from './core';

it('R4: retryCeiling overrides the default to 13000', () => {
  assertCore();
  expect(B.retryCeiling).toBe(13000);
});
