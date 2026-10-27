/**
 * M2 admission gate tests (PLAN.md §3). WRITTEN, NEVER RUN.
 * Deferred command: `npx vitest run tests/validate.test.ts` (docs/DEFERRED-VALIDATION.md DV-M2-06).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { GroupResult, GroupResults, SandboxPort } from '../src/core/contracts';
import { TEST_GROUP_IDS } from '../src/core/ids';
import type { TestGroupId } from '../src/core/ids';
import { ExpectedFileSchema } from '../src/score/fixture';
import { couplingRow } from '../src/tasks/coupling';
import { assembleSlice, loadTask, splitTopLevelSections } from '../src/tasks/load';
import { applyProtectedFileCheck, failedConditions, validateExecution, validatePure } from '../src/tasks/validate';

const fixtures = new URL('../fixtures/', import.meta.url);
const expected = ExpectedFileSchema.parse(JSON.parse(readFileSync(new URL('expected.json', fixtures), 'utf8')));
const dirOf = (rel: string): string => fileURLToPath(new URL(rel, fixtures));

function results(failing: readonly TestGroupId[]): GroupResults {
  const groups = Object.fromEntries(
    TEST_GROUP_IDS.map((g): [TestGroupId, GroupResult] => [g, failing.includes(g) ? { passed: false, failure: 'assertion', durationMs: 1 } : { passed: true, failure: null, durationMs: 1 }]),
  ) as Record<TestGroupId, GroupResult>;
  return { snapshotDigest: '0'.repeat(64), hiddenBundleDigest: '0'.repeat(64), graderImageDigest: null, sandbox: 'local_unsafe', groups };
}

describe('spec sections and slices', () => {
  it('splits at top-level headings only and reproduces the spec', () => {
    const spec = '# A\nx\n## sub\ny\n# B\nz\n';
    const s = splitTopLevelSections(spec);
    expect(s.preamble).toBe('');
    expect(s.sections.map((x) => x.heading)).toEqual(['# A', '# B']);
    expect(s.preamble + s.sections.map((x) => x.text).join('')).toBe(spec);
    expect(assembleSlice(s, ['# B'])).toBe('# B\nz\n');
  });
});

describe('pure-data gate conditions on fixtures', () => {
  it('control task T80 passes every pure condition', () => {
    const t = loadTask(dirOf(expected.controlTask.dir.replace(/^fixtures\//, '')));
    expect(t.schemaIssues).toEqual([]);
    expect(failedConditions({ conditions: validatePure(t) })).toEqual([]);
  });
  for (const [dir, want] of Object.entries(expected.badTasks)) {
    it(`${dir} trips exactly ${want.expectedPureFailures.join(', ') || 'no pure condition'}`, () => {
      const t = loadTask(dirOf(`bad-tasks/${dir}`));
      expect(failedConditions({ conditions: validatePure(t) })).toEqual(want.expectedPureFailures);
      expect(t.schemaIssues.length > 0).toBe(want.schemaIssues);
    });
  }
});

describe('coupling matrix (cond. 3)', () => {
  const t = loadTask(dirOf('control-task/T80'));
  it('accepts a mutant that fails only its own group', () => {
    expect(couplingRow(t.task, 'R2', results(['R2'])).ok).toBe(true);
  });
  it('rejects an undeclared second group and any C0 failure', () => {
    expect(couplingRow(t.task, 'R2', results(['R2', 'R8'])).undeclared).toEqual(['R8']);
    expect(couplingRow(t.task, 'R2', results(['C0', 'R2'])).ok).toBe(false);
  });
  it('accepts a coupling declared on either side', () => {
    const coupled = { requirements: t.task.requirements.map((r) => (r.id === 'R8' ? { ...r, couplings: [{ group: 'R2' as const, kind: 'declared' as const }] } : r)) };
    expect(couplingRow(coupled, 'R2', results(['R2', 'R8'])).ok).toBe(true);
  });
});

describe('trusted-CLI protected-file check (D17, static.json)', () => {
  const t = loadTask(dirOf('control-task/T80'));
  it('leaves results alone when the protected file is unchanged', () => {
    expect(applyProtectedFileCheck(t, t.repo, results([])).groups.R7.passed).toBe(true);
  });
  it('fails the do_not_touch group with static_check when the protected file changed', () => {
    const tree = new Map(t.repo);
    tree.set('src/contracts.ts', new TextEncoder().encode('// edited
'));
    const r = applyProtectedFileCheck(t, tree, results([]));
    expect(r.groups.R7).toEqual({ passed: false, failure: 'static_check', durationMs: 1 });
    expect(r.groups.R1.passed).toBe(true);
  });
});

describe('execution conditions through a stub SandboxPort', () => {
  it('rejects the cond. 3 bad task and admits nothing else wrongly', async () => {
    const t = loadTask(dirOf('bad-tasks/c3-mutant-breaks-two-groups'));
    let mutantIndex = 0;
    const stub = (origin: string): SandboxPort => ({
      kind: 'local_unsafe',
      grade: () => {
        if (origin === 'oracle') return Promise.resolve(results([]));
        if (origin === 'untouched') return Promise.resolve(results([...TEST_GROUP_IDS]));
        const id = t.task.requirements[mutantIndex]?.id ?? 'R1';
        mutantIndex += 1;
        return Promise.resolve(results(id === 'R2' ? ['R2', 'R8'] : [id]));
      },
    });
    const exec = await validateExecution(t, stub);
    expect(exec.conditions.filter((c) => c.status === 'fail').map((c) => c.condition)).toEqual(['3']);
  });
});
