import type { JsonValue, RequestSegment, SourceSnapshot, ToolCall, ToolSpec } from '../core/contracts';
import type { WorkerRole } from '../core/ids';
import { isSandboxIntegrityError, snapshotOf } from '../sandbox/port';
import { PathRefusal } from './workspace';
import type { WorkerPolicy } from './policies/single';

export interface PublicTestPort {
  /** Must run candidate bytes in the offline episode container, with public tests only. */
  run(snapshot: SourceSnapshot, worker: WorkerRole, signal: AbortSignal): Promise<readonly { text: string; path: string | null; ownSource: boolean }[]>;
}
const object = (properties: Record<string, JsonValue>, required: string[] = []): Record<string, JsonValue> => ({ type: 'object', properties, required, additionalProperties: false });
const string: JsonValue = { type: 'string' };
export const TOOL_SPECS: readonly ToolSpec[] = [
  { name: 'list_files', description: 'List visible private workspace paths.', inputSchema: object({}) },
  { name: 'read_file', description: 'Read a visible file.', inputSchema: object({ path: string }, ['path']) },
  { name: 'write_file', description: 'Replace an allowed module file.', inputSchema: object({ path: string, text: string }, ['path', 'text']) },
  { name: 'edit_file', description: 'Replace one unique exact string in an allowed module.', inputSchema: object({ path: string, oldText: string, newText: string }, ['path', 'oldText', 'newText']) },
  { name: 'run_public_tests', description: 'Run public smoke tests in the offline episode container.', inputSchema: object({}) },
  { name: 'submit_handoff', description: 'Submit the only outbound handoff as raw text. Fixed brief requires exactly the documented seven JSON fields.', inputSchema: object({ text: string }, ['text']) },
  { name: 'finish', description: 'Finish this worker; no repair round.', inputSchema: object({}) },
];
export interface ToolOutcome { segments: RequestSegment[]; outcome: 'ok' | 'error' | 'refused'; handoff?: string; finish?: boolean; refusal?: PathRefusal; }
function fields(call: ToolCall, allowed: readonly string[], required: readonly string[] = []): Record<string, JsonValue> {
  if (call.input === null || Array.isArray(call.input) || typeof call.input !== 'object') throw new Error('tool input must be object');
  if (Object.keys(call.input).some((k) => !allowed.includes(k))) throw new Error('unexpected tool field');
  if (required.some((k) => typeof call.input[k] !== 'string')) throw new Error('required string absent');
  return call.input;
}
export function toolsFor(policy: WorkerPolicy): readonly ToolSpec[] { return TOOL_SPECS.filter((t) => (t.name !== 'submit_handoff' || policy.canHandoff) && (t.name !== 'run_public_tests' || policy.canTest) && (!['write_file', 'edit_file'].includes(t.name) || policy.workspace.writable.size > 0)); }
export async function executeTool(policy: WorkerPolicy, call: ToolCall, tests: PublicTestPort | undefined, signal: AbortSignal): Promise<ToolOutcome> {
  let path: string | null = null;
  const segment = (text: string, own = false, origin: 'own_file_read' | 'edit_echo' | 'own_listing' | 'own_test_output' = 'own_file_read'): RequestSegment => ({ text, provenance: own ? { kind: 'self', origin, callId: call.id } : { kind: 'tool_result', callId: call.id, path } });
  try {
    if (!toolsFor(policy).some((s) => s.name === call.name)) throw new Error('tool not allowed in this phase');
    switch (call.name) {
      case 'list_files': {
        fields(call, []);
        return { outcome: 'ok', segments: policy.workspace.list().map((p) => segment(p, policy.workspace.ownWrites.has(p), 'own_listing')) };
      }
      case 'read_file': {
        const input = fields(call, ['path'], ['path']); path = input['path'] as string;
        return { outcome: 'ok', segments: [segment(policy.workspace.read(path), policy.workspace.ownWrites.has(path))] };
      }
      case 'write_file':
      case 'edit_file': {
        const edit = call.name === 'edit_file';
        const input = fields(call, edit ? ['path', 'oldText', 'newText'] : ['path', 'text'], edit ? ['path', 'oldText', 'newText'] : ['path', 'text']);
        path = input['path'] as string;
        let text = input['text'] as string;
        if (edit) { const old = input['oldText'] as string; if (old.length === 0) throw new Error('empty edit'); const prior = policy.workspace.read(path); if (prior.split(old).length !== 2) throw new Error('edit must match exactly once'); text = prior.replace(old, input['newText'] as string); }
        if (Buffer.byteLength(text) > 512_000) throw new Error('file size limit');
        policy.workspace.write(path, text);
        return { outcome: 'ok', segments: [segment('write accepted', true, 'edit_echo')] };
      }
      case 'run_public_tests': {
        fields(call, []); if (!tests) throw new Error('public test executor unavailable; no tests were run');
        const frames = await tests.run(snapshotOf(policy.workspace.tree()), policy.role, signal);
        return { outcome: 'ok', segments: frames.map((frame) => { path = frame.path; return segment(frame.text, frame.ownSource && frame.path !== null && policy.workspace.ownWrites.has(frame.path), 'own_test_output'); }) };
      }
      case 'submit_handoff': { const input = fields(call, ['text'], ['text']); return { outcome: 'ok', handoff: input['text'] as string, segments: [segment('handoff received')] }; }
      case 'finish': fields(call, []); return { outcome: 'ok', finish: true, segments: [segment('finished')] };
    }
  } catch (error) {
    if (isSandboxIntegrityError(error)) throw error;
    return { outcome: error instanceof PathRefusal ? 'refused' : 'error', ...(error instanceof PathRefusal ? { refusal: error } : {}), segments: [segment(error instanceof Error ? error.message : 'tool failed')] };
  }
}
