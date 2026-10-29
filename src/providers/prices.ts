import type { PriceTable, Usage } from '../core/contracts';
/** Planning assumption only, unverified against the live API/pricing; approval day must replace it. */
export const PROVISIONAL_PRICES: PriceTable = { model: 'claude-haiku-5-5', currency: 'USD', inputPerMTok: 1, outputPerMTok: 5, cacheReadPerMTok: 0.1, cacheWritePerMTok: 1.25, checkedAt: '2026-10-27T00:00:00Z', source: 'PLAN-FINAL.md provisional planning assumption; NOT price verification' };
export function costUsd(usage: Usage, prices: PriceTable): number { return (usage.input * prices.inputPerMTok + usage.output * prices.outputPerMTok + usage.cacheRead * prices.cacheReadPerMTok + usage.cacheWrite * prices.cacheWritePerMTok) / 1_000_000; }
export function worstCaseUsd(tokens: number, prices: PriceTable): number {
  if (!Number.isFinite(tokens) || tokens < 0) throw new Error('invalid token bound');
  return tokens * Math.max(prices.inputPerMTok, prices.outputPerMTok, prices.cacheReadPerMTok, prices.cacheWritePerMTok) / 1_000_000;
}
