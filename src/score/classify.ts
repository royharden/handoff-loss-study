/**
 * Requirement classes (PLAN.md §4.9, D14) and eligible-edge routing.
 *
 * | Arm                         | Condition          | Class                                                    |
 * |-----------------------------|--------------------|----------------------------------------------------------|
 * | single (and non-split rows) | pass / fail        | kept / single_not_done                                   |
 * | split, eligible edge        | pass               | kept (+ kept_without_lexical_evidence if no_evidence;    |
 * |                             |                    |        + kept_attribution_unknown if unknown)            |
 * | split, eligible edge        | fail, evidence     | failed_with_evidence                                     |
 * | split, eligible edge        | fail, no_evidence  | failed_without_lexical_evidence                          |
 * | split, eligible edge        | fail, unknown      | attribution_unknown                                      |
 * | context, local requirement  | pass / fail        | kept / local_not_done                                    |
 *
 * Eligible edges: in a role split every requirement crosses planner -> implementer (the implementer
 * writes both modules); in a context split only transfer slots cross (source slice != responsible
 * writer). Non-split arms (`single`, and the `spec_blind`, `null_worker`, `oracle` rows) use the single
 * row: builder choice, recorded in docs/DESIGN.md §7.
 *
 * Pure module: no I/O.
 */
import { RequirementScoreSchema, isTransferSlot } from '../core/contracts';
import type { ClassFlag, EdgeEvidence, Requirement, RequirementClass, RequirementScore } from '../core/contracts';
import type { Arm, TestGroupId, WorkerRole } from '../core/ids';
import { edgeEvidence } from './evidence';
import type { CarrierArtifact } from './evidence';

/** Pass/fail per hidden group; groups not graded are absent. */
export type GroupPassMap = Readonly<Partial<Record<TestGroupId, boolean>>>;

export type SplitKind = 'none' | 'role' | 'context';

export function splitKindOf(arm: Arm): SplitKind {
  if (arm.startsWith('role/')) return 'role';
  if (arm.startsWith('context/')) return 'context';
  return 'none';
}

/** True when the requirement had to cross a handoff edge to reach its responsible writer. */
export function isEligibleEdge(arm: Arm, req: Pick<Requirement, 'slot'>): boolean {
  const split = splitKindOf(arm);
  if (split === 'role') return true;
  if (split === 'context') return isTransferSlot(req.slot);
  return false;
}

/** The worker whose output implements the requirement (null for the zero-cost baseline rows). */
export function responsibleWorker(arm: Arm, req: Pick<Requirement, 'responsibleWriter'>): WorkerRole | null {
  switch (splitKindOf(arm)) {
    case 'role':
      return 'implementer';
    case 'context':
      return req.responsibleWriter === 'A' ? 'context_A' : 'context_B';
    case 'none':
      if (arm === 'single') return 'single';
      if (arm === 'spec_blind') return 'spec_blind';
      return null;
  }
}

export function groupPassed(groups: GroupPassMap, group: TestGroupId): boolean {
  const v = groups[group];
  if (v === undefined) throw new Error(`group ${group} has no result`);
  return v;
}

/** D11: a `prerequisite` coupling group of this requirement failed. Ungraded groups do not count. */
export function prerequisiteFailed(req: Pick<Requirement, 'couplings'>, groups: GroupPassMap): boolean {
  return req.couplings.some((c) => c.kind === 'prerequisite' && groups[c.group] === false);
}

export interface Classification {
  readonly class: RequirementClass;
  readonly flags: ClassFlag[];
}

/** §4.9 table. `evidence` is non-null exactly on eligible edges. */
export function classify(arm: Arm, req: Pick<Requirement, 'slot'>, passed: boolean, evidence: EdgeEvidence | null): Classification {
  const split = splitKindOf(arm);
  if (split === 'none') return { class: passed ? 'kept' : 'single_not_done', flags: [] };
  if (!isEligibleEdge(arm, req)) return { class: passed ? 'kept' : 'local_not_done', flags: [] };
  if (evidence === null) throw new Error('an eligible edge needs an evidence result');
  if (passed) {
    if (evidence.state === 'no_evidence') return { class: 'kept', flags: ['kept_without_lexical_evidence'] };
    if (evidence.state === 'unknown') return { class: 'kept', flags: ['kept_attribution_unknown'] };
    return { class: 'kept', flags: [] };
  }
  if (evidence.state === 'evidence') return { class: 'failed_with_evidence', flags: [] };
  if (evidence.state === 'no_evidence') return { class: 'failed_without_lexical_evidence', flags: [] };
  return { class: 'attribution_unknown', flags: [] };
}

export interface ScoreRequirementInput {
  readonly arm: Arm;
  readonly requirement: Requirement;
  readonly groups: GroupPassMap;
  /** Artifacts the responsible writer received before its last edit (ignored off eligible edges). */
  readonly artifacts: readonly CarrierArtifact[];
}

/** Score one requirement: pass/fail from its group, evidence on eligible edges, class per §4.9. */
export function scoreRequirement(input: ScoreRequirementInput): RequirementScore {
  const { arm, requirement, groups } = input;
  const passed = groupPassed(groups, requirement.testGroup);
  const eligible = isEligibleEdge(arm, requirement);
  const evidence = eligible
    ? edgeEvidence({ requirement, artifacts: input.artifacts, prerequisiteFailed: prerequisiteFailed(requirement, groups) })
    : null;
  const c = classify(arm, requirement, passed, evidence);
  return RequirementScoreSchema.parse({
    requirement: requirement.id,
    kind: requirement.kind,
    slot: requirement.slot,
    passed,
    eligibleEdge: eligible,
    evidence,
    class: c.class,
    flags: c.flags,
  });
}

/**
 * §4.10 contract mismatch: the cross-module group fails while core behaviour passes. GroupResults hold
 * one C0 group, not one per module, so "both modules' C0 parts pass" is read as "C0 passes" (builder
 * choice, docs/DESIGN.md §7).
 */
export function isContractMismatch(req: Pick<Requirement, 'kind' | 'testGroup'>, groups: GroupPassMap): boolean {
  return req.kind === 'cross_module_contract' && groups[req.testGroup] === false && groups.C0 === true;
}
