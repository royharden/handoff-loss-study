import { expect } from 'vitest';
import { callCandidate } from './_rpc';
export async function assertC0(): Promise<void> {
  const entries = [{ id: 'alpha', amount: 8, fields: {} }, { id: 'beta', amount: -3, fields: {} }];
  expect(await callCandidate('src/credit-values.ts', 'summarize', [entries])).toEqual({ count: 2, total: 5, ids: ['alpha', 'beta'] });
  expect(await callCandidate('src/credit-values.ts', 'summarize', [[]])).toEqual({ count: 0, total: 0, ids: [] });
  expect(await callCandidate('src/credit-view.ts', 'displaySummary', [entries])).toBe('2:5');
  for (const path of ["src/credit-values.ts", "src/credit-view.ts"]) {
    expect(await callCandidate(path, 'coreKey', [entries[0]])).toBe('alpha');
  }
}
