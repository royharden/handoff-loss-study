/**
 * Visibility audit by segment provenance (PLAN.md D16).
 *
 * Every stored request payload is audited. Each text segment carries a provenance tag: `system`,
 * `initial_view`, `handoff`, `tool_result` or `self` (replayed assistant turns are always `self`). A
 * secret anchor in a non-`self` segment is permitted only if it is in the worker's legitimate material:
 * the whole spec (single, planner), its own slice (context worker), or a handoff it received. Otherwise
 * the finding is `visibility_leak` (the run is excluded by prereg rule and listed; in T2 an integrity
 * stop). Anchors in `self` segments are never leaks; when the worker had no legitimate source for that
 * anchor they are logged as `self_originated_anchor` (guessing / recall evidence). A self segment with an
 * anchor the worker legitimately had is not logged (builder choice, docs/DESIGN.md §7).
 *
 * Anchors are matched with the §4.3 token-boundary rule on §4.1-normalised text. Entity anchors are
 * present in the repository by design (D12) and are not audited. A whole anchor group is permitted when
 * any of its alternates occurs in a permitted text.
 *
 * Pure module: no I/O.
 */
import type { ProviderMessage, RequestSegment, Requirement, SegmentProvenance } from '../core/contracts';
import type { ModuleId, RequirementId, WorkerRole } from '../core/ids';
import { containsToken, normalizeNeedle, normalizeText } from './normalize';

export interface AuditedAnchor {
  readonly requirement: RequirementId;
  readonly alternates: readonly string[];
}

export interface VisibilityContext {
  readonly worker: WorkerRole;
  readonly anchors: readonly AuditedAnchor[];
  /** Raw texts the worker may legitimately hold (spec / own slice / received handoffs). */
  readonly permittedTexts: readonly string[];
  /** Handoff ids delivered to this worker at the time of the request. */
  readonly receivedHandoffIds: ReadonlySet<string>;
}

export type VisibilityFindingKind = 'visibility_leak' | 'self_originated_anchor';

export interface VisibilityFinding {
  readonly finding: VisibilityFindingKind;
  readonly worker: WorkerRole;
  readonly callIndex: number;
  readonly requirement: RequirementId;
  /** The alternate that was seen. */
  readonly anchor: string;
  readonly provenance: SegmentProvenance;
}

/** Secret anchor groups of a task's requirements (entity anchors are not audited, D12). */
export function auditedAnchors(requirements: readonly Pick<Requirement, 'id' | 'anchors'>[]): AuditedAnchor[] {
  const out: AuditedAnchor[] = [];
  for (const r of requirements) {
    for (const a of r.anchors) if (a.type === 'secret') out.push({ requirement: r.id, alternates: a.alternates });
  }
  return out;
}

export interface WorkerView {
  readonly spec: string | null;
  readonly slices: Readonly<Record<ModuleId, string>> | null;
}

/** D16 legitimate material per worker (handoff texts are added by the caller). */
export function legitimateViewTexts(worker: WorkerRole, view: WorkerView): string[] {
  switch (worker) {
    case 'single':
    case 'planner':
      return view.spec === null ? [] : [view.spec];
    case 'context_A':
      return view.slices === null ? [] : [view.slices.A];
    case 'context_B':
      return view.slices === null ? [] : [view.slices.B];
    case 'implementer':
    case 'spec_blind':
      return [];
  }
}

interface ProvenancedText {
  readonly provenance: SegmentProvenance;
  readonly text: string;
}

function segmentsOf(message: ProviderMessage): ProvenancedText[] {
  if (message.role === 'assistant') {
    const parts = [message.text, ...message.toolCalls.map((c) => JSON.stringify(c.input))];
    return [{ provenance: { kind: 'self', origin: 'assistant_turn', callId: null }, text: parts.join('\n') }];
  }
  return message.segments.map((s: RequestSegment) => ({ provenance: s.provenance, text: s.text }));
}

/** Audit one stored request (all messages of one provider call). */
export function auditRequest(ctx: VisibilityContext, callIndex: number, messages: readonly ProviderMessage[]): VisibilityFinding[] {
  const permitted = ctx.permittedTexts.map(normalizeText);
  const groupPermitted = (alternates: readonly string[]): boolean =>
    alternates.some((alt) => {
      const needle = normalizeNeedle(alt);
      return permitted.some((t) => containsToken(t, needle));
    });
  const findings: VisibilityFinding[] = [];
  const seen = new Set<string>();
  for (const message of messages) {
    for (const seg of segmentsOf(message)) {
      const text = normalizeText(seg.text);
      for (const group of ctx.anchors) {
        const hit = group.alternates.find((alt) => containsToken(text, normalizeNeedle(alt)));
        if (hit === undefined) continue;
        const ok = groupPermitted(group.alternates);
        let finding: VisibilityFindingKind | null = null;
        if (seg.provenance.kind === 'self') {
          if (!ok) finding = 'self_originated_anchor';
        } else if (seg.provenance.kind === 'handoff') {
          if (!ctx.receivedHandoffIds.has(seg.provenance.handoffId) || !ok) finding = 'visibility_leak';
        } else if (!ok) {
          finding = 'visibility_leak';
        }
        if (finding === null) continue;
        const key = `${finding}|${group.requirement}|${hit}|${JSON.stringify(seg.provenance)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        findings.push({ finding, worker: ctx.worker, callIndex, requirement: group.requirement, anchor: hit, provenance: seg.provenance });
      }
    }
  }
  return findings;
}
