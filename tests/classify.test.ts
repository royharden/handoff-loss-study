/**
 * M2 classification tests (PLAN.md §4.9, D14) and the scripted-fixture path. WRITTEN, NEVER RUN.
 * Deferred command: `npx vitest run tests/classify.test.ts` (docs/DEFERRED-VALIDATION.md DV-M2-06).
 */
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { EdgeEvidence, Requirement } from '../src/core/contracts';
import { classify, isContractMismatch, isEligibleEdge, prerequisiteFailed, responsibleWorker, scoreRequirement } from '../src/score/classify';
import { ExpectedFileSchema, compareFixture, scoreFixture } from '../src/score/fixture';
import { retentionFromGroups } from '../src/score/retention';

const ev = (state: EdgeEvidence['state']): EdgeEvidence => ({
  state,
  unknownReason: state === 'unknown' ? 'check_unknown' : null,
  channel: 'free_summary',
  checks: { secretAnchor: 'positive', entityCue: null, decoyConflict: false },
});

const R5: Requirement = {
  id: 'R5',
  kind: 'late_clarification',
  slot: 'transfer_A_to_B',
  sourceSlice: 'A',
  responsibleWriter: 'B',
  testGroup: 'R5',
  anchors: [{ type: 'secret', alternates: ['13000'] }],
  decoys: ['9000'],
  couplings: [{ group: 'R1', kind: 'prerequisite' }],
};
const R1local: Requirement = { ...R5, id: 'R1', kind: 'negative_constraint', slot: 'local_A', responsibleWriter: 'A', testGroup: 'R1', couplings: [] };

describe('§4.9 table', () => {
  it('single and the non-split rows', () => {
    expect(classify('single', R5, true, null)).toEqual({ class: 'kept', flags: [] });
    expect(classify('single', R5, false, null)).toEqual({ class: 'single_not_done', flags: [] });
    expect(classify('spec_blind', R5, false, null).class).toBe('single_not_done');
  });
  it('split, eligible edge', () => {
    expect(classify('role/free_summary', R5, true, ev('evidence'))).toEqual({ class: 'kept', flags: [] });
    expect(classify('role/free_summary', R5, true, ev('no_evidence'))).toEqual({ class: 'kept', flags: ['kept_without_lexical_evidence'] });
    expect(classify('role/free_summary', R5, true, ev('unknown'))).toEqual({ class: 'kept', flags: ['kept_attribution_unknown'] });
    expect(classify('role/free_summary', R5, false, ev('evidence')).class).toBe('failed_with_evidence');
    expect(classify('role/free_summary', R5, false, ev('no_evidence')).class).toBe('failed_without_lexical_evidence');
    expect(classify('role/free_summary', R5, false, ev('unknown')).class).toBe('attribution_unknown');
  });
  it('context, local requirement', () => {
    expect(classify('context/fixed_brief', R1local, true, null).class).toBe('kept');
    expect(classify('context/fixed_brief', R1local, false, null).class).toBe('local_not_done');
  });
});

describe('routing', () => {
  it('eligible edges: every requirement in role splits, transfer slots in context splits, none otherwise', () => {
    expect(isEligibleEdge('role/full_trace', R1local)).toBe(true);
    expect(isEligibleEdge('context/free_summary', R1local)).toBe(false);
    expect(isEligibleEdge('context/free_summary', R5)).toBe(true);
    expect(isEligibleEdge('single', R5)).toBe(false);
  });
  it('responsible worker', () => {
    expect(responsibleWorker('role/fixed_brief', R5)).toBe('implementer');
    expect(responsibleWorker('context/fixed_brief', R5)).toBe('context_B');
    expect(responsibleWorker('single', R5)).toBe('single');
    expect(responsibleWorker('oracle', R5)).toBeNull();
  });
  it('prerequisite failure needs a graded failing prerequisite group', () => {
    expect(prerequisiteFailed(R5, { R1: false })).toBe(true);
    expect(prerequisiteFailed(R5, { R1: true })).toBe(false);
    expect(prerequisiteFailed(R5, {})).toBe(false);
  });
  it('contract mismatch = cross-module group fails while C0 passes', () => {
    const R6: Requirement = { ...R5, id: 'R6', kind: 'cross_module_contract', testGroup: 'R6', couplings: [] };
    expect(isContractMismatch(R6, { C0: true, R6: false })).toBe(true);
    expect(isContractMismatch(R6, { C0: false, R6: false })).toBe(false);
  });
  it('scoreRequirement produces a schema-valid score', () => {
    const s = scoreRequirement({ arm: 'role/free_summary', requirement: R5, groups: { C0: true, R1: true, R5: false }, artifacts: [{ channel: 'free_summary', text: 'Set 13000.' }] });
    expect(s.class).toBe('failed_with_evidence');
    expect(s.eligibleEdge).toBe(true);
  });
  it('retention needs all eight R groups', () => {
    expect(retentionFromGroups({ R1: true })).toBeNull();
    expect(retentionFromGroups({ R1: true, R2: true, R3: true, R4: true, R5: true, R6: true, R7: true, R8: false })).toBe(0.875);
  });
});

describe('scripted fixtures vs fixtures/expected.json', () => {
  const root = new URL('../fixtures/', import.meta.url);
  const expected = ExpectedFileSchema.parse(JSON.parse(readFileSync(new URL('expected.json', root), 'utf8')));
  const files = readdirSync(new URL('scripted/', root)).filter((f) => f.endsWith('.json'));
  it('covers every expected fixture (18 paths)', () => {
    expect(files).toHaveLength(Object.keys(expected.fixtures).length);
    expect(files.length).toBe(18);
  });
  for (const f of files) {
    it(f, async () => {
      const outcome = await scoreFixture(JSON.parse(readFileSync(new URL(`scripted/${f}`, root), 'utf8')));
      const want = expected.fixtures[outcome.id];
      expect(want).toBeDefined();
      if (want !== undefined) expect(compareFixture(outcome, want)).toEqual([]);
    });
  }
});
