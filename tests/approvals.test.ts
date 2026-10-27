import { describe, it, expect } from 'vitest';
import { assertLiveApproval } from '../src/store/approval';
import { PriceTableSchema } from '../src/core/contracts';
import { hashCanonical } from '../src/core/hash';
import { planTranche } from '../cli/study';
const prices = PriceTableSchema.parse({ model: 'fixture-model', currency: 'USD', inputPerMTok: 1, outputPerMTok: 5, cacheReadPerMTok: 0.1, cacheWritePerMTok: 1.25, checkedAt: '2026-10-27T00:00:00Z', source: 'synthetic approval test, never consent' });
const plan = planTranche('T0', { prices, maxUsd: 10 });
const approval = { schemaVersion: 1, tranche: 'T0', model: plan.model, cells: plan.cells, tasks: plan.tasks, repeats: 1, specBlindRunsPerTask: 0, maxTokens: plan.maxTokens, maxUsd: 10, issuedAt: '2026-10-26T00:00:00Z', expiresAt: '2026-10-28T00:00:00Z', approver: { name: 'SYNTHETIC named approver', decisionRef: 'SYNTHETIC test decision, not Roy consent', decisionSha256: hashCanonical('synthetic') }, priceTableSha256: hashCanonical(prices) };
describe('M5 live refusal paths (no dispatch)', () => {
  it('rejects absent/expired approval, missing identity/reference, hard switch and overspend', () => {
    const now = new Date('2026-10-27T00:00:00Z');
    expect(() => assertLiveApproval(undefined, plan, prices, 0, '1', now)).toThrow();
    expect(() => assertLiveApproval(approval, plan, prices, 0, undefined, now)).toThrow();
    expect(() => assertLiveApproval(approval, plan, prices, 9, '1', now)).toThrow();
    expect(() => assertLiveApproval(approval, plan, prices, 0, '1', new Date('2026-10-29T00:00:00Z'))).toThrow();
    for (const key of ['name', 'decisionRef']) expect(() => assertLiveApproval({ ...approval, approver: { ...approval.approver, [key]: ' ' } }, plan, prices, 0, '1', now)).toThrow();
  });
  it('exactly matches every owner-approved scope dimension', () => {
    const now = new Date('2026-10-27T00:00:00Z');
    for (const changed of [{ tranche: 'T1' }, { model: 'other' }, { cells: ['single'] }, { tasks: ['T02'] }, { repeats: 2 }, { maxTokens: 1 }, { maxUsd: 11 }, { specBlindRunsPerTask: 3 }, { priceTableSha256: hashCanonical('other') }]) expect(() => assertLiveApproval({ ...approval, ...changed }, plan, prices, 0, '1', now)).toThrow();
    expect(assertLiveApproval(approval, plan, prices, 0, '1', now).model).toBe(plan.model);
  });
});
