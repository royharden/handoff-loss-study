import type { StudyReport } from '../stats/aggregate';
export function display(value: number | null, digits = 4): string { return value === null ? 'undefined' : value.toFixed(digits); }
export function reportTable(report: StudyReport): string[][] {
  return [['cell', 'runs', 'graded', 'excluded', 'retention', 'full success', 'evidence', 'unknown', 'cap hits', 'tokens', 'USD'], ...report.rows.map((r) => [r.arm, String(r.runs), String(r.graded), String(r.excluded), display(r.retention), display(r.fullSuccess), display(r.evidenceRate), display(r.unknownRate), display(r.capHitRate), String(r.tokens), display(r.usd)])];
}
