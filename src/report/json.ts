import { canonicalize } from '../core/canonical';
import type { StudyReport } from '../stats/aggregate';
/** Null means undefined; never substitute a measured zero for an absent denominator. */
export function reportJson(report: StudyReport): string { return canonicalize(report) + '\n'; }
