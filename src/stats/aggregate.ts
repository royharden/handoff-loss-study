import { assertSingleEdition, PRIMARY_CONTRASTS, usageTotalTokens } from '../core/contracts';
import type { RunRecord, PriceTable } from '../core/contracts';
import { STUDY_CELLS } from '../core/ids';
import { clusterContrast, mean } from './cluster';
import type { TaskCluster } from './cluster';
import { exactMcnemar } from './mcnemar';
import { projectedPrecision } from './precision';
import type { VerifiedRun } from '../store/load';

export function ratio(numerator: number, denominator: number): number | null { return denominator === 0 ? null : numerator / denominator; }
export function taskClusters(records: readonly RunRecord[]): TaskCluster[] {
  const tasks = new Map<string, Record<string, number[]>>();
  for (const r of records) {
    if (r.exclusion !== null || r.retention === null) continue;
    const cells = tasks.get(r.taskId) ?? {};
    (cells[r.arm] ??= []).push(r.retention);
    tasks.set(r.taskId, cells);
  }
  return [...tasks].sort(([a], [b]) => a.localeCompare(b)).map(([taskId, cells]) => ({ taskId, cells }));
}
function dollars(r: RunRecord, prices?: PriceTable): number | null {
  if (r.edition === 'SYNTHETIC') return 0;
  if (prices === undefined || prices.model !== r.model.requested) return null;
  const u = r.usageTotals;
  return (u.input * prices.inputPerMTok + u.output * prices.outputPerMTok + u.cacheRead * prices.cacheReadPerMTok + u.cacheWrite * prices.cacheWritePerMTok) / 1e6;
}
export function aggregate(records: readonly RunRecord[], prices?: PriceTable, diagnostics: readonly VerifiedRun['diagnostics'][] = [], devRecords: readonly RunRecord[] = []) {
  const edition = assertSingleEdition(records);
  if (new Set(records.map((r) => r.runId)).size !== records.length) throw new Error('duplicate run IDs');
  // Repeated task IDs across tranches are different experiments; never silently pool calibration and heldout.
  if (new Set(records.map((r) => r.tranche)).size > 1) throw new Error('report one tranche at a time');
  const matcherEditions = new Set(records.map((r) => r.digests.matcher).filter((x) => x !== null));
  if (matcherEditions.size > 1) throw new Error('mixed matcher editions');
  const clusters = taskClusters(records);
  if (devRecords.some((r) => r.tranche !== 'T1' || r.edition !== edition)) throw new Error('precision projection requires same-edition T1 calibration records');
  const projectionClusters = records[0]?.tranche === 'T1' ? clusters : taskClusters(devRecords);
  const rows = [...STUDY_CELLS, 'null_worker', 'oracle', 'spec_blind'].map((arm) => {
    const all = records.filter((r) => r.arm === arm);
    const included = all.filter((r) => r.exclusion === null);
    const graded = included.filter((r) => r.retention !== null);
    const scores = graded.flatMap((r) => r.requirements);
    const eligible = scores.filter((s) => s.eligibleEdge);
    const failedEdges = eligible.filter((s) => !s.passed);
    const costs = all.map((r) => dollars(r, prices));
    return {
      arm, runs: all.length, excluded: all.length - included.length, graded: graded.length,
      retention: mean(clusters.flatMap((t) => { const m = mean(t.cells[arm] ?? []); return m === null ? [] : [m]; })),
      fullSuccess: ratio(graded.filter((r) => r.retention === 1).length, graded.length),
      evidenceRate: ratio(eligible.filter((s) => s.evidence?.state === 'evidence').length, eligible.length),
      unknownRate: ratio(eligible.filter((s) => s.evidence?.state === 'unknown').length, eligible.length),
      failedWithEvidence: ratio(failedEdges.filter((s) => s.class === 'failed_with_evidence').length, failedEdges.length),
      failedWithoutEvidence: ratio(failedEdges.filter((s) => s.class === 'failed_without_lexical_evidence').length, failedEdges.length),
      failedUnknown: ratio(failedEdges.filter((s) => s.class === 'attribution_unknown').length, failedEdges.length),
      keptWithoutEvidence: scores.filter((s) => s.flags.includes('kept_without_lexical_evidence')).length,
      capHitRate: ratio(all.filter((r) => r.status === 'cap_hit').length, all.length),
      tokens: all.reduce((sum, r) => sum + usageTotalTokens(r.usageTotals), 0),
      wallMs: all.reduce((sum, r) => sum + r.wallMs, 0),
      usd: costs.some((x) => x === null) ? null : costs.reduce<number>((sum, x) => sum + (x ?? 0), 0),
      flags: Object.fromEntries([...new Set(all.flatMap((r) => r.flags))].sort().map((flag) => [flag, all.filter((r) => r.flags.includes(flag)).length])),
    };
  });
  const contrasts = PRIMARY_CONTRASTS.map((h) => {
    const result = clusterContrast(clusters, { [h.minuend]: 1, [h.subtrahend]: -1 });
    const differences = projectionClusters.flatMap((t) => { const a = mean(t.cells[h.minuend] ?? []); const b = mean(t.cells[h.subtrahend] ?? []); return a === null || b === null ? [] : [a - b]; });
    let b = 0; let c = 0;
    for (const task of clusters) {
      const a = records.find((r) => r.taskId === task.taskId && r.arm === h.minuend && r.repeat === 0 && r.exclusion === null && r.retention !== null);
      const d = records.find((r) => r.taskId === task.taskId && r.arm === h.subtrahend && r.repeat === 0 && r.exclusion === null && r.retention !== null);
      if (a !== undefined && d !== undefined) { if (a.retention === 1 && d.retention !== 1) b += 1; if (a.retention !== 1 && d.retention === 1) c += 1; }
    }
    return { ...h, ...result, omittedTasks: clusters.length - result.tasks, projectedPrecision: projectedPrecision(differences), exploratoryMcnemar: { b, c, p: exactMcnemar(b, c), outcome: 'full_success_repeat_0' } };
  });
  const scores = records.filter((r) => r.exclusion === null).flatMap((r) => r.requirements.map((s) => ({ arm: r.arm, ...s })));
  const breakdown = [...new Set(scores.map((s) => `${s.arm}|${s.kind}|${s.slot}`))].sort().map((key) => {
    const group = scores.filter((s) => `${s.arm}|${s.kind}|${s.slot}` === key);
    return { key, count: group.length, retention: ratio(group.filter((s) => s.passed).length, group.length), unknown: ratio(group.filter((s) => s.evidence?.state === 'unknown').length, group.filter((s) => s.eligibleEdge).length) };
  });
  return { schemaVersion: 1 as const, edition, banner: edition === 'SYNTHETIC' ? 'SYNTHETIC — NOT A MEASUREMENT' : edition === 'LIVE' ? 'MEASURED LIVE RECORDS — verification is integrity, not replication' : 'NOT YET MEASURED', tranche: records[0]?.tranche ?? null, runs: records.length, rows, contrasts, interaction: clusterContrast(clusters, { 'role/free_summary': 1, 'role/fixed_brief': -1, 'context/free_summary': -1, 'context/fixed_brief': 1 }), breakdown, diagnostics, exclusions: records.filter((r) => r.exclusion !== null).map((r) => ({ runId: r.runId, exclusion: r.exclusion })), records };
}
export type StudyReport = ReturnType<typeof aggregate>;
