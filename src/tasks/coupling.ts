/**
 * Mutant coupling matrix (PLAN.md D11, gate cond. 3).
 *
 * Mutant R<n> (an overlay on the oracle) must fail its own requirement's group, must not fail C0 (mutants
 * never touch C0), and may fail another group G only through a declared coupling. A coupling is a relation
 * between two groups and is accepted when declared on either side (R<n>.couplings names G, or G's
 * requirement names R<n>), of kind `declared` or `prerequisite` (builder choice, docs/DESIGN.md §7). The
 * full matrix is written to validate-report.json and published.
 *
 * Pure module: no I/O.
 */
import type { GroupResults, Task } from '../core/contracts';
import { TEST_GROUP_IDS } from '../core/ids';
import type { RequirementId, TestGroupId } from '../core/ids';

export interface CouplingMatrixRow {
  readonly mutant: RequirementId;
  /** Every group the mutant failed, in C0, R1..R8 order. */
  readonly failed: readonly TestGroupId[];
  readonly ownGroup: RequirementId;
  readonly ownGroupFailed: boolean;
  readonly c0Failed: boolean;
  /** Failed groups other than the own group that no coupling covers. */
  readonly undeclared: readonly TestGroupId[];
  readonly ok: boolean;
}

/** True when requirements `a` and `b` (by their test groups) are coupled on either side. */
export function isCoupled(task: Pick<Task, 'requirements'>, a: RequirementId, b: TestGroupId): boolean {
  if (b === 'C0') return false;
  const ra = task.requirements.find((r) => r.id === a);
  const rb = task.requirements.find((r) => r.testGroup === b);
  if (ra === undefined) return false;
  if (ra.couplings.some((c) => c.group === b)) return true;
  if (rb !== undefined && rb.couplings.some((c) => c.group === ra.testGroup)) return true;
  return false;
}

export function couplingRow(task: Pick<Task, 'requirements'>, mutant: RequirementId, results: GroupResults): CouplingMatrixRow {
  const req = task.requirements.find((r) => r.id === mutant);
  const ownGroup = req?.testGroup ?? mutant;
  const failed = TEST_GROUP_IDS.filter((g) => !results.groups[g].passed);
  const ownGroupFailed = failed.includes(ownGroup);
  const c0Failed = failed.includes('C0');
  const undeclared = failed.filter((g) => g !== ownGroup && g !== 'C0' && !isCoupled(task, mutant, g));
  return { mutant, failed, ownGroup, ownGroupFailed, c0Failed, undeclared, ok: req !== undefined && ownGroupFailed && !c0Failed && undeclared.length === 0 };
}

export function couplingMatrix(task: Pick<Task, 'requirements'>, results: ReadonlyMap<RequirementId, GroupResults>): CouplingMatrixRow[] {
  return [...results.entries()].sort((x, y) => (x[0] < y[0] ? -1 : 1)).map(([m, r]) => couplingRow(task, m, r));
}
