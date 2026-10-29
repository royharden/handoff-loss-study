import { expect, it } from 'vitest';
import { DEFAULT_RUN_LIMITS } from '../src/core/contracts';
import type { ProviderPort } from '../src/core/contracts';
import { BudgetMeter } from '../src/runner/budget';
import { LedgerProvider, ProviderAttemptError } from '../src/providers/ledger';
import { MockProvider, mockStepsForArm } from '../src/providers/mock';
it('makes one reserved retry and reports its consumed reservation', async () => {
  let calls = 0; const replay = new MockProvider(mockStepsForArm('single'));
  const provider: ProviderPort = { name: 'mock', complete: (args) => { calls += 1; return calls === 1 ? Promise.reject(new ProviderAttemptError('rate_limit', true)) : replay.complete(args); } };
  const meter = new BudgetMeter({ allowanceTokens: 150000, r: 1, limits: { ...DEFAULT_RUN_LIMITS } });
  const ledger = new LedgerProvider(provider, meter); const reserved: number[] = [];
  const result = await ledger.complete({ messages: [], tools: [], maxOutput: 10, signal: new AbortController().signal }, { reservation: (r) => { reserved.push(r.reservedTokens); }, request: () => {}, response: () => {}, error: () => {} });
  expect(calls).toBe(2); expect(result.retries).toBe(1); expect(meter.spent).toBe(reserved[0]); expect(meter.completions).toBe(2);
});
