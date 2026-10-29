import { expect, it } from 'vitest';
import { inspectFixed } from '../src/runner/channels/fixed';
import { checkHandoffLength } from '../src/runner/channels/free';
import { fullTrace } from '../src/runner/channels/trace';
it('keeps malformed brief raw and enforces the half-source bound', () => { expect(inspectFixed('{', 'x'.repeat(100), 1).parsed.ok).toBe(false); expect(checkHandoffLength('x'.repeat(51), 'x'.repeat(100), 1).fits).toBe(false); });
it('keeps tool result bytes but tags them outside the carry carrier', () => { const trace = fullTrace([{ role: 'tool', toolCallId: 'read-1', isError: false, segments: [{ provenance: { kind: 'tool_result', callId: 'read-1', path: 'src/a.ts' }, text: 'decoy' }] }]); expect(trace).toEqual([{ kind: 'tool_result', text: 'decoy', toolCallId: 'read-1' }]); });
