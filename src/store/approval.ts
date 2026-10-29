import { ApprovalSchema } from '../core/contracts';
import type { Approval, PriceTable } from '../core/contracts';
import type { LiveTranche, StudyCell } from '../core/ids';
import { hashCanonical } from '../core/hash';

export interface LivePlanScope { readonly tranche: LiveTranche; readonly model: string; readonly cells: readonly StudyCell[]; readonly tasks: readonly string[]; readonly repeats: number; readonly specBlindRunsPerTask: number; readonly maxTokens: number; readonly maxUsd: number; readonly boundUsd: number }
function sameSet(a: readonly string[], b: readonly string[]): boolean { return a.length === b.length && new Set(a).size === a.length && [...a].sort().join('\n') === [...b].sort().join('\n'); }
export function assertLiveApproval(raw: unknown, plan: LivePlanScope, prices: PriceTable, spentUsd: number, enabled: string | undefined, now = new Date()): Approval {
  if (enabled !== '1') throw new Error('live refused: HLS_LIVE_ENABLED must equal 1');
  const a = ApprovalSchema.parse(raw);
  const issued = Date.parse(a.issuedAt); const expires = Date.parse(a.expiresAt);
  if (!Number.isFinite(issued) || !Number.isFinite(expires) || issued > now.getTime() || expires <= now.getTime()) throw new Error('live refused: approval not current');
  if (a.approver.name.trim().length === 0 || a.approver.decisionRef.trim().length === 0) throw new Error('live refused: named approver and Roy signed decision reference required');
  if (a.tranche !== plan.tranche || a.model !== plan.model || !sameSet(a.cells, plan.cells) || !sameSet(a.tasks, plan.tasks) || a.repeats !== plan.repeats || a.specBlindRunsPerTask !== plan.specBlindRunsPerTask || a.maxTokens !== plan.maxTokens || a.maxUsd !== plan.maxUsd) throw new Error('live refused: approval scope mismatch');
  if (a.priceTableSha256 !== hashCanonical(prices)) throw new Error('live refused: price table hash mismatch');
  if (!Number.isFinite(spentUsd) || spentUsd < 0 || !Number.isFinite(plan.boundUsd) || spentUsd + plan.boundUsd > a.maxUsd) throw new Error('live refused: ledger spend + bound exceeds approved maxUsd');
  return a;
}
