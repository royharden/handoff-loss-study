import { expect } from 'vitest';
import { callCandidate } from './_rpc';
export async function assertC0(): Promise<void> {
  const entries = [{ id: 'alpha', amount: 8, fields: {} }, { id: 'beta', amount: -3, fields: {} }];
  expect(await callCandidate('src/inventory-values.ts', 'summarize', [entries])).toEqual({ count: 2, total: 5, ids: ['alpha', 'beta'] });
  expect(await callCandidate('src/inventory-values.ts', 'summarize', [[]])).toEqual({ count: 0, total: 0, ids: [] });
  expect(await callCandidate('src/inventory-view.ts', 'displaySummary', [entries])).toBe('2:5');
  for (const path of ["src/inventory-values.ts", "src/inventory-view.ts"]) {
    expect(await callCandidate(path, 'coreKey', [entries[0]])).toBe('alpha');
  }
}
