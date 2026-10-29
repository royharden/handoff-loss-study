// Shared C0 assertions: every R group conjoins C0 (PLAN.md D11). Builder gate fixture T80.
import { expect } from 'vitest';
import { createLimiter } from '../src/a';
import { callOnce } from '../src/b';

export function assertCore(): void {
  const limiter = createLimiter({ now: () => 5 });
  expect(limiter.take()).toBe(true);
  expect(callOnce(() => 42)).toBe(42);
}
