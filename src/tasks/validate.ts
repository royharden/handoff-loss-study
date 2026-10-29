/**
 * Task admission gate `hls validate` (PLAN.md §3).
 *
 * Pure-data conditions (TypeScript, using the §4 matcher's own clause/marker/cue functions):
 *   (4) every secret anchor absent from every file, file name and path in repo/ (incl. public tests);
 *   (5) every entity anchor present in repo/ (a file path or file content);
 *   (6) every anchor in spec.md and in its named source slice;
 *   (6b) every secret anchor has an occurrence in an UNMARKED clause of its source slice alone and of
 *        spec.md as a whole (slice sections start with their own heading by construction of the
 *        section split; text before the first heading is reported under cond. 8);
 *   (6c) every declared decoy occurrence anywhere in spec.md lies in a MARKED clause;
 *   (6d) every do_not_touch requirement: entity_cue = positive on its slice alone and on spec.md;
 *   (6e) brief.md: no secret anchor, no decoy, and entity_cue = negative for every entity anchor (no
 *        anchor+cue clause);
 *   (6f) decoys: >= 3 digits or >= 4 characters, differ from every anchor and every other decoy, and do
 *        not occur inside any anchor;
 *   (7) anchors unique across requirements; decoys != anchors;
 *   (8) slices A u B = spec exactly: no preamble, no duplicate or unknown headings, no overlap, every
 *       top-level section in exactly one slice.
 * Execution conditions (via SandboxPort plus the trusted-CLI protected-file hash check of static.json;
 * deferred in Dirty Mode): (1) oracle passes all 9 groups;
 * (2) untouched repo fails all 9; (3) mutant matrix (./coupling); (9) held-out only: every alternate
 * passes all groups.
 *
 * Anchors, decoys and texts are compared after §4.1 normalisation with the §4.3 token-boundary rule.
 * 6b and 6d skip an anchor that already fails cond. 6 (6b/6d refine 6), so a planted bad task trips one
 * condition. Builder choices are listed in docs/DESIGN.md §7.
 */
import type { GroupResults, Requirement, SandboxPort } from '../core/contracts';
import { TEST_GROUP_IDS } from '../core/ids';
import type { ModuleId, RequirementId } from '../core/ids';
import { snapshotOf, overlay, treeDigest } from '../sandbox/port';
import type { FileTree, SnapshotOrigin } from '../sandbox/port';
import { sha256Hex } from '../core/hash';
import { decoyConflict, entityCueCheck, proseDocument, secretGroupStatus } from '../score/evidence';
import { codePointLength, containsToken, normalizeNeedle, normalizeText } from '../score/normalize';
import { couplingMatrix } from './coupling';
import type { CouplingMatrixRow } from './coupling';
import { treeText } from './load';
import type { LoadedTask } from './load';

export const GATE_CONDITIONS = ['1', '2', '3', '4', '5', '6', '6b', '6c', '6d', '6e', '6f', '7', '8', '9'] as const;
export type GateCondition = (typeof GATE_CONDITIONS)[number];
export const PURE_CONDITIONS: readonly GateCondition[] = ['4', '5', '6', '6b', '6c', '6d', '6e', '6f', '7', '8'];
export const EXECUTION_CONDITIONS: readonly GateCondition[] = ['1', '2', '3', '9'];

export type ConditionStatus = 'pass' | 'fail' | 'deferred' | 'not_applicable';

export interface ConditionResult {
  readonly condition: GateCondition;
  readonly status: ConditionStatus;
  readonly findings: readonly string[];
}

export interface ValidateReport {
  readonly taskId: string;
  readonly dir: string;
  readonly schemaIssues: readonly string[];
  readonly conditions: readonly ConditionResult[];
  readonly couplingMatrix: readonly CouplingMatrixRow[] | null;
  /** Admitted only if there is no schema issue and every condition passed or is not applicable. */
  readonly admitted: boolean;
}

function result(condition: GateCondition, findings: string[]): ConditionResult {
  return { condition, status: findings.length === 0 ? 'pass' : 'fail', findings };
}

function secretAnchors(r: Requirement): string[][] {
  return r.anchors.filter((a) => a.type === 'secret').map((a) => a.alternates);
}

function entityAnchors(r: Requirement): string[][] {
  return r.anchors.filter((a) => a.type === 'entity').map((a) => a.alternates);
}

function anyToken(text: string, alternates: readonly string[]): boolean {
  return alternates.some((alt) => containsToken(text, normalizeNeedle(alt)));
}

function label(alternates: readonly string[]): string {
  return alternates.map((a) => JSON.stringify(a)).join(' | ');
}

function anchorInSpecAndSlice(t: LoadedTask, slice: ModuleId, alternates: readonly string[]): { spec: boolean; slice: boolean } {
  return { spec: anyToken(normalizeText(t.spec), alternates), slice: anyToken(normalizeText(t.sliceText[slice]), alternates) };
}

// ---------------------------------------------------------------------------------------------
// Pure-data conditions
// ---------------------------------------------------------------------------------------------

export function cond4(t: LoadedTask): ConditionResult {
  const findings: string[] = [];
  const files = [...t.repo.entries()].map(([path, bytes]) => ({ path, pathN: normalizeText(path), text: normalizeText(treeText(bytes)) }));
  for (const testPath of t.task.publicTests) {
    if (!t.repo.has(testPath)) findings.push(`public test ${testPath} is not in repo/ (absence of anchors cannot be checked)`);
  }
  for (const r of t.task.requirements) {
    for (const alts of secretAnchors(r)) {
      for (const f of files) {
        if (anyToken(f.pathN, alts)) findings.push(`${r.id}: secret anchor ${label(alts)} in repo path ${f.path}`);
        if (anyToken(f.text, alts)) findings.push(`${r.id}: secret anchor ${label(alts)} in repo file ${f.path}`);
      }
    }
  }
  return result('4', findings);
}

export function cond5(t: LoadedTask): ConditionResult {
  const findings: string[] = [];
  const files = [...t.repo.entries()].map(([path, bytes]) => ({ pathN: normalizeText(path), text: normalizeText(treeText(bytes)) }));
  for (const r of t.task.requirements) {
    for (const alts of entityAnchors(r)) {
      if (!files.some((f) => anyToken(f.pathN, alts) || anyToken(f.text, alts))) {
        findings.push(`${r.id}: entity anchor ${label(alts)} is not present in repo/`);
      }
    }
  }
  return result('5', findings);
}

/** Anchors (requirement, alternates) failing cond. 6; 6b/6d skip them. */
function cond6Failures(t: LoadedTask): Set<string> {
  const failed = new Set<string>();
  for (const r of t.task.requirements) {
    for (const a of r.anchors) {
      const where = anchorInSpecAndSlice(t, r.sourceSlice, a.alternates);
      if (!where.spec || !where.slice) failed.add(`${r.id}|${a.alternates.join('\u0000')}`);
    }
  }
  return failed;
}

export function cond6(t: LoadedTask): ConditionResult {
  const findings: string[] = [];
  for (const r of t.task.requirements) {
    for (const a of r.anchors) {
      const where = anchorInSpecAndSlice(t, r.sourceSlice, a.alternates);
      if (!where.spec) findings.push(`${r.id}: ${a.type} anchor ${label(a.alternates)} not in spec.md`);
      if (!where.slice) findings.push(`${r.id}: ${a.type} anchor ${label(a.alternates)} not in source slice ${r.sourceSlice}`);
    }
  }
  return result('6', findings);
}

export function cond6b(t: LoadedTask): ConditionResult {
  const findings: string[] = [];
  const skip = cond6Failures(t);
  const specDocs = [proseDocument(t.spec)];
  for (const r of t.task.requirements) {
    const sliceDocs = [proseDocument(t.sliceText[r.sourceSlice])];
    for (const alts of secretAnchors(r)) {
      if (skip.has(`${r.id}|${alts.join('\u0000')}`)) continue;
      const inSlice = secretGroupStatus(sliceDocs, alts);
      const inSpec = secretGroupStatus(specDocs, alts);
      if (inSlice !== 'hit') findings.push(`${r.id}: secret anchor ${label(alts)} has no unmarked occurrence in slice ${r.sourceSlice} (${inSlice})`);
      if (inSpec !== 'hit') findings.push(`${r.id}: secret anchor ${label(alts)} has no unmarked occurrence in spec.md (${inSpec})`);
    }
  }
  return result('6b', findings);
}

export function cond6c(t: LoadedTask): ConditionResult {
  const findings: string[] = [];
  const specDocs = [proseDocument(t.spec)];
  for (const r of t.task.requirements) {
    for (const d of r.decoys) {
      if (decoyConflict(specDocs, [d])) findings.push(`${r.id}: decoy ${JSON.stringify(d)} occurs in an unmarked clause of spec.md`);
    }
  }
  return result('6c', findings);
}

export function cond6d(t: LoadedTask): ConditionResult {
  const findings: string[] = [];
  const skip = cond6Failures(t);
  const specDocs = [proseDocument(t.spec)];
  for (const r of t.task.requirements) {
    if (r.kind !== 'do_not_touch') continue;
    const entities = r.anchors.filter((a) => a.type === 'entity');
    if (entities.some((a) => skip.has(`${r.id}|${a.alternates.join('\u0000')}`))) continue;
    const inSlice = entityCueCheck([proseDocument(t.sliceText[r.sourceSlice])], entities);
    const inSpec = entityCueCheck(specDocs, entities);
    if (inSlice !== 'positive') findings.push(`${r.id}: entity_cue on slice ${r.sourceSlice} is ${inSlice}, not positive`);
    if (inSpec !== 'positive') findings.push(`${r.id}: entity_cue on spec.md is ${inSpec}, not positive`);
  }
  return result('6d', findings);
}

export function cond6e(t: LoadedTask): ConditionResult {
  const findings: string[] = [];
  const briefN = normalizeText(t.brief);
  const briefDocs = [proseDocument(t.brief)];
  for (const r of t.task.requirements) {
    for (const alts of secretAnchors(r)) {
      if (anyToken(briefN, alts)) findings.push(`${r.id}: brief.md contains secret anchor ${label(alts)}`);
    }
    for (const d of r.decoys) {
      if (anyToken(briefN, [d])) findings.push(`${r.id}: brief.md contains decoy ${JSON.stringify(d)}`);
    }
    for (const a of r.anchors.filter((x) => x.type === 'entity')) {
      const c = entityCueCheck(briefDocs, [a]);
      if (c !== 'negative') findings.push(`${r.id}: brief.md has an entity anchor + cue clause for ${label(a.alternates)} (entity_cue ${c})`);
    }
  }
  return result('6e', findings);
}

export function cond6f(t: LoadedTask): ConditionResult {
  const findings: string[] = [];
  const anchorsN = t.task.requirements.flatMap((r) => r.anchors.flatMap((a) => a.alternates.map(normalizeNeedle)));
  const decoys = t.task.requirements.flatMap((r) => r.decoys.map((d) => ({ id: r.id, raw: d, n: normalizeNeedle(d) })));
  for (const d of decoys) {
    const digits = (d.n.match(/[0-9]/g) ?? []).length;
    if (digits < 3 && codePointLength(d.n) < 4) findings.push(`${d.id}: decoy ${JSON.stringify(d.raw)} is not distinctive (needs >= 3 digits or >= 4 characters)`);
    if (anchorsN.includes(d.n)) findings.push(`${d.id}: decoy ${JSON.stringify(d.raw)} equals an anchor`);
    if (decoys.filter((x) => x.n === d.n).length > 1) findings.push(`${d.id}: decoy ${JSON.stringify(d.raw)} is not unique`);
    const inside = anchorsN.filter((a) => a !== d.n && a.includes(d.n));
    if (inside.length > 0) findings.push(`${d.id}: decoy ${JSON.stringify(d.raw)} occurs inside anchor(s) ${inside.map((a) => JSON.stringify(a)).join(', ')}`);
  }
  return result('6f', findings);
}

export function cond7(t: LoadedTask): ConditionResult {
  const findings: string[] = [];
  const owners = new Map<string, Set<RequirementId>>();
  for (const r of t.task.requirements) {
    for (const a of r.anchors) {
      for (const alt of a.alternates) {
        const n = normalizeNeedle(alt);
        const set = owners.get(n) ?? new Set<RequirementId>();
        set.add(r.id);
        owners.set(n, set);
      }
    }
  }
  for (const [alt, set] of owners) {
    if (set.size > 1) findings.push(`anchor ${JSON.stringify(alt)} is shared by ${[...set].sort().join(', ')}`);
  }
  for (const r of t.task.requirements) {
    for (const d of r.decoys) {
      const owner = owners.get(normalizeNeedle(d));
      if (owner !== undefined) findings.push(`${r.id}: decoy ${JSON.stringify(d)} equals an anchor of ${[...owner].sort().join(', ')}`);
    }
  }
  return result('7', findings);
}

export function cond8(t: LoadedTask): ConditionResult {
  const findings: string[] = [];
  if (t.sections.preamble.trim().length > 0) findings.push('spec.md has text before its first top-level heading (it belongs to no slice)');
  const specHeadings = t.sections.sections.map((s) => s.heading);
  const seen = new Set<string>();
  for (const h of specHeadings) {
    if (seen.has(h)) findings.push(`spec.md heading ${JSON.stringify(h)} occurs more than once`);
    seen.add(h);
  }
  const a = new Set(t.task.slices.A.headings.map((h) => h.trimEnd()));
  const b = new Set(t.task.slices.B.headings.map((h) => h.trimEnd()));
  for (const h of a) if (b.has(h)) findings.push(`heading ${JSON.stringify(h)} is in both slices (overlap)`);
  for (const h of [...a, ...b]) if (!seen.has(h)) findings.push(`slice heading ${JSON.stringify(h)} is not a top-level heading of spec.md`);
  for (const h of seen) if (!a.has(h) && !b.has(h)) findings.push(`spec.md section ${JSON.stringify(h)} is in no slice`);
  return result('8', findings);
}

export function validatePure(t: LoadedTask): ConditionResult[] {
  return [cond4(t), cond5(t), cond6(t), cond6b(t), cond6c(t), cond6d(t), cond6e(t), cond6f(t), cond7(t), cond8(t)];
}

// ---------------------------------------------------------------------------------------------
// Execution conditions (1-3, 9) via SandboxPort
// ---------------------------------------------------------------------------------------------

/** Execution conditions when no sandbox is used (Dirty Mode, or `hls validate` without --execute). */
export function deferredExecution(t: LoadedTask): ConditionResult[] {
  const reason = ['needs execution: hls validate --execute (docs/DEFERRED-VALIDATION.md)'];
  return [
    { condition: '1', status: 'deferred', findings: reason },
    { condition: '2', status: 'deferred', findings: reason },
    { condition: '3', status: 'deferred', findings: reason },
    t.task.split === 'heldout'
      ? { condition: '9', status: 'deferred', findings: reason }
      : { condition: '9', status: 'not_applicable', findings: ['held-out only'] },
  ];
}

export type SandboxFactory = (origin: SnapshotOrigin) => SandboxPort;

/**
 * D17 static check run by the trusted CLI outside any sandbox: a protected file (static.json) whose bytes
 * differ from the recorded sha256, or that is missing, fails every do_not_touch group with `static_check`
 * (docs/TASK-RECIPE.md "Static checks"). Forbidden identifiers need the TypeScript compiler API and are
 * checked in M4 (docs/DEFERRED-VALIDATION.md DV-M2-14).
 */
export function applyProtectedFileCheck(t: LoadedTask, tree: FileTree, results: GroupResults): GroupResults {
  if (t.staticConfig === null) return results;
  const changed = t.staticConfig.protectedFiles.some((f) => {
    const bytes = tree.get(f.path);
    return bytes === undefined || sha256Hex(bytes) !== f.sha256;
  });
  if (!changed) return results;
  const groups = { ...results.groups };
  for (const r of t.task.requirements) {
    if (r.kind === 'do_not_touch') groups[r.testGroup] = { passed: false, failure: 'static_check', durationMs: groups[r.testGroup].durationMs };
  }
  return { ...results, groups };
}

function failedGroups(r: GroupResults): string[] {
  return TEST_GROUP_IDS.filter((g) => !r.groups[g].passed);
}

export async function validateExecution(t: LoadedTask, sandboxFor: SandboxFactory): Promise<{ conditions: ConditionResult[]; matrix: CouplingMatrixRow[] | null }> {
  if (t.hidden === null) {
    const missing = ['hidden/ is missing'];
    return {
      conditions: [
        { condition: '1', status: 'fail', findings: missing },
        { condition: '2', status: 'fail', findings: missing },
        { condition: '3', status: 'fail', findings: missing },
        t.task.split === 'heldout' ? { condition: '9', status: 'fail', findings: missing } : { condition: '9', status: 'not_applicable', findings: ['held-out only'] },
      ],
      matrix: null,
    };
  }
  const bundle = treeDigest(t.hidden);
  const grade = async (origin: SnapshotOrigin, tree: FileTree): Promise<GroupResults> =>
    applyProtectedFileCheck(t, tree, await sandboxFor(origin).grade(snapshotOf(tree), bundle));
  const conditions: ConditionResult[] = [];

  const c1: string[] = [];
  if (t.oracle === null) c1.push('oracle/ is missing');
  else {
    const failed = failedGroups(await grade('oracle', overlay(t.repo, t.oracle)));
    if (failed.length > 0) c1.push(`oracle fails ${failed.join(', ')}`);
  }
  conditions.push(result('1', c1));

  const untouched = await grade('untouched', t.repo);
  const c2 = TEST_GROUP_IDS.filter((g) => untouched.groups[g].passed).map((g) => `untouched repo passes ${g}`);
  conditions.push(result('2', c2));

  const c3: string[] = [];
  let matrix: CouplingMatrixRow[] | null = null;
  if (t.oracle === null) c3.push('oracle/ is missing (mutants overlay the oracle)');
  else {
    const results = new Map<RequirementId, GroupResults>();
    for (const r of t.task.requirements) {
      const m = t.mutants.get(r.id);
      if (m === undefined) {
        c3.push(`mutants/${r.id} is missing`);
        continue;
      }
      results.set(r.id, await grade('mutant', overlay(overlay(t.repo, t.oracle), m)));
    }
    matrix = couplingMatrix(t.task, results);
    for (const row of matrix) {
      if (!row.ownGroupFailed) c3.push(`mutant ${row.mutant} does not fail its own group ${row.ownGroup}`);
      if (row.c0Failed) c3.push(`mutant ${row.mutant} fails C0`);
      if (row.undeclared.length > 0) c3.push(`mutant ${row.mutant} fails undeclared group(s) ${row.undeclared.join(', ')}`);
    }
  }
  conditions.push(result('3', c3));

  if (t.task.split === 'heldout') {
    const c9: string[] = [];
    if (t.alternates.size === 0) c9.push('no alternates/ for a held-out task');
    for (const [name, alt] of t.alternates) {
      const failed = failedGroups(await grade('alternate', overlay(t.repo, alt)));
      if (failed.length > 0) c9.push(`alternate ${name} fails ${failed.join(', ')}`);
    }
    conditions.push(result('9', c9));
  } else {
    conditions.push({ condition: '9', status: 'not_applicable', findings: ['held-out only'] });
  }
  return { conditions, matrix };
}

export function buildReport(t: LoadedTask, pure: readonly ConditionResult[], execution: readonly ConditionResult[], matrix: CouplingMatrixRow[] | null): ValidateReport {
  const order = new Map<GateCondition, number>(GATE_CONDITIONS.map((c, i): [GateCondition, number] => [c, i]));
  const conditions = [...pure, ...execution].sort((x, y) => (order.get(x.condition) ?? 0) - (order.get(y.condition) ?? 0));
  const admitted = t.schemaIssues.length === 0 && conditions.every((c) => c.status === 'pass' || c.status === 'not_applicable');
  return { taskId: t.task.id, dir: t.dir, schemaIssues: t.schemaIssues, conditions, couplingMatrix: matrix, admitted };
}

/** Conditions that failed (status `fail`), in gate order. */
export function failedConditions(report: Pick<ValidateReport, 'conditions'>): GateCondition[] {
  return report.conditions.filter((c) => c.status === 'fail').map((c) => c.condition);
}
