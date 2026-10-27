/**
 * Retention and per-run score summaries (PLAN.md §7 primary metric, §4.10 other measures).
 *
 * Primary metric: ret = passed R groups / 8 (each R group also asserts C0, D11). `retentionOf` in core
 * works on full GroupResults; `retentionFromGroups` works on a pass map and returns null unless all eight
 * R groups were graded (a partial pass map has no retention).
 *
 * Pure module: no I/O.
 */
import { RequirementClassSchema, retentionOf } from '../core/contracts';
import type { RequirementClass, RequirementScore } from '../core/contracts';
import { REQUIREMENT_IDS } from '../core/ids';
import type { RequirementId } from '../core/ids';
import type { GroupPassMap } from './classify';

export { retentionOf };

export function retentionFromGroups(groups: GroupPassMap): number | null {
  let passed = 0;
  for (const id of REQUIREMENT_IDS) {
    const v = groups[id];
    if (v === undefined) return null;
    if (v) passed += 1;
  }
  return passed / 8;
}

export interface RunScoreSummary {
  readonly retention: number | null;
  /** All eight R groups passed (null when not fully graded). */
  readonly fullSuccess: boolean | null;
  readonly classCounts: Readonly<Record<RequirementClass, number>>;
  readonly keptWithoutLexicalEvidence: number;
  readonly keptAttributionUnknown: number;
  readonly contractMismatches: readonly RequirementId[];
}

export function summarizeScores(
  scores: readonly RequirementScore[],
  groups: GroupPassMap,
  contractMismatches: readonly RequirementId[],
): RunScoreSummary {
  const classCounts = Object.fromEntries(RequirementClassSchema.options.map((c) => [c, 0])) as Record<RequirementClass, number>;
  let kwle = 0;
  let kau = 0;
  for (const s of scores) {
    classCounts[s.class] += 1;
    if (s.flags.includes('kept_without_lexical_evidence')) kwle += 1;
    if (s.flags.includes('kept_attribution_unknown')) kau += 1;
  }
  const retention = retentionFromGroups(groups);
  return {
    retention,
    fullSuccess: retention === null ? null : retention === 1,
    classCounts,
    keptWithoutLexicalEvidence: kwle,
    keptAttributionUnknown: kau,
    contractMismatches: [...contractMismatches],
  };
}
