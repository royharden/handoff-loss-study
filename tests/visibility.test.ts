/**
 * M2 visibility audit tests (PLAN.md D16). WRITTEN, NEVER RUN.
 * Deferred command: `npx vitest run tests/visibility.test.ts` (docs/DEFERRED-VALIDATION.md DV-M2-06).
 */
import { describe, expect, it } from 'vitest';
import type { ProviderMessage, SegmentProvenance } from '../src/core/contracts';
import { auditRequest, auditedAnchors, legitimateViewTexts } from '../src/score/visibility';
import type { VisibilityContext } from '../src/score/visibility';

const anchors = auditedAnchors([
  { id: 'R5', anchors: [{ type: 'secret', alternates: ['13000', '13_000'] }] },
  { id: 'R7', anchors: [{ type: 'entity', alternates: ['src/contracts.ts'] }] },
]);

const ctx = (over: Partial<VisibilityContext>): VisibilityContext => ({
  worker: 'implementer',
  anchors,
  permittedTexts: [],
  receivedHandoffIds: new Set<string>(),
  ...over,
});

const toolMsg = (provenance: SegmentProvenance, text: string): ProviderMessage => ({
  role: 'tool',
  toolCallId: 'c1',
  isError: false,
  segments: [{ provenance, text }],
});

describe('D16 visibility audit', () => {
  it('audits secret anchors only (entity anchors are in the repo by design)', () => {
    expect(anchors.map((a) => a.requirement)).toEqual(['R5']);
  });
  it('flags an anchor in a tool_result the worker had no legitimate source for', () => {
    const f = auditRequest(ctx({}), 1, [toolMsg({ kind: 'tool_result', callId: 'c1', path: 'x' }, 'ceiling 13000')]);
    expect(f.map((x) => x.finding)).toEqual(['visibility_leak']);
    expect(f[0]?.anchor).toBe('13000');
  });
  it('permits the anchor once a received handoff carried any alternate', () => {
    const f = auditRequest(ctx({ permittedTexts: ['use 13_000'], receivedHandoffIds: new Set(['h1']) }), 1, [
      toolMsg({ kind: 'tool_result', callId: 'c1', path: 'x' }, 'ceiling 13000'),
      { role: 'user', segments: [{ provenance: { kind: 'handoff', handoffId: 'h1' }, text: 'use 13_000' }] },
    ]);
    expect(f).toEqual([]);
  });
  it('flags a handoff segment that was never delivered to this worker', () => {
    const f = auditRequest(ctx({}), 2, [{ role: 'user', segments: [{ provenance: { kind: 'handoff', handoffId: 'h9' }, text: '13000' }] }]);
    expect(f.map((x) => x.finding)).toEqual(['visibility_leak']);
  });
  it('never flags self segments as leaks; logs self_originated_anchor when unpermitted', () => {
    const f = auditRequest(ctx({ worker: 'spec_blind' }), 3, [
      toolMsg({ kind: 'self', origin: 'own_file_read', callId: 'c2' }, 'export const x = 13000;'),
      { role: 'assistant', text: 'I will use 13000', toolCalls: [] },
    ]);
    expect(f.map((x) => x.finding)).toEqual(['self_originated_anchor', 'self_originated_anchor']);
  });
  it('does not log self segments when the worker legitimately had the anchor', () => {
    const f = auditRequest(ctx({ worker: 'single', permittedTexts: ['spec says 13000'] }), 3, [{ role: 'assistant', text: '13000', toolCalls: [] }]);
    expect(f).toEqual([]);
  });
  it('legitimate material per worker', () => {
    const view = { spec: 'S', slices: { A: 'SA', B: 'SB' } };
    expect(legitimateViewTexts('planner', view)).toEqual(['S']);
    expect(legitimateViewTexts('context_B', view)).toEqual(['SB']);
    expect(legitimateViewTexts('implementer', view)).toEqual([]);
    expect(legitimateViewTexts('spec_blind', view)).toEqual([]);
  });
});
