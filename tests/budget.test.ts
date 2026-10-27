import { describe, expect, it } from 'vitest';
import { DEFAULT_RUN_LIMITS } from '../src/core/contracts';
import { BudgetMeter } from '../src/runner/budget';
const args = { messages: [], tools: [], maxOutput: 10, signal: new AbortController().signal };
describe('D7 pooled budget', () => {
  it('counts UTF-8 bytes and overhead, and never silently clamps an overrun', () => {
    const meter = new BudgetMeter({ allowanceTokens: 1000, r: 1, limits: { ...DEFAULT_RUN_LIMITS } });
    const reservation = meter.reserve(args, 'é'); expect(reservation.reservedTokens).toBe(12);
    expect(() => meter.settle(reservation, { input: 13, output: 0, cacheRead: 0, cacheWrite: 0, reasoning: 0, source: 'provider_reported' })).toThrow('reservation_overrun');
    expect(meter.spent).toBe(13); expect(() => meter.reserve(args, '')).toThrow('reservation_overrun');
  });
  it('books unknown usage in full and stops; failed attempts consume a fresh retry reservation', () => {
    const meter = new BudgetMeter({ allowanceTokens: 1000, r: 1, limits: { ...DEFAULT_RUN_LIMITS } });
    const first = meter.reserve(args, 'abc'); meter.failedAttempt(first);
    const second = meter.reserve(args, 'abc'); expect(() => meter.settle(second, null)).toThrow('usage_unknown'); expect(meter.spent).toBe(26);
  });
  it('refuses a request ceiling violation before dispatch', () => {
    const meter = new BudgetMeter({ allowanceTokens: 150000, r: 1, limits: { ...DEFAULT_RUN_LIMITS } });
    expect(() => meter.reserve(args, 'x'.repeat(90000))).toThrow('cap_hit'); expect(meter.completions).toBe(0);
  });
});
