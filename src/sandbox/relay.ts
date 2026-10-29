import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import type { GroupFailure } from '../core/contracts';
import { Frames, INVOCATION_TIMEOUT_MS, MAX_FRAME_BYTES, parseRequest, parseResponse } from './grader/protocol';
export interface RelayResult { failure: GroupFailure | null; }
/** Host-enforced protocol. Candidate stdout is accepted ONLY as response to a pending grader call. */
export function relayPair(candidate: ChildProcessWithoutNullStreams, grader: ChildProcessWithoutNullStreams, wallMs = 60_000): Promise<RelayResult> {
  return new Promise((resolve) => {
    let done = false; let candidateAlive = true; let outputBytes = 0; let pending: { id: number; timer: ReturnType<typeof setTimeout> } | null = null;
    const candidateFrames = new Frames(); const graderFrames = new Frames(); const seen = new Set<number>();
    const finish = (failure: GroupFailure | null): void => { if (done) return; done = true; clearTimeout(wall); if (pending) clearTimeout(pending.timer); resolve({ failure }); };
    const wall = setTimeout(() => finish('timeout'), wallMs);
    const guarded = (fn: () => void): void => { try { fn(); } catch (e) { finish(e instanceof Error && e.message === 'oversize_output' ? 'oversize_output' : 'protocol_noise'); } };
    grader.stdout.on('data', (chunk: Buffer) => guarded(() => { if (done) return; for (const line of graderFrames.push(chunk)) { const req = parseRequest(line); if (pending || seen.has(req.id) || !candidateAlive) throw new Error('protocol_noise'); seen.add(req.id); pending = { id: req.id, timer: setTimeout(() => finish('timeout'), INVOCATION_TIMEOUT_MS) }; candidate.stdin.write(JSON.stringify(req) + '\n'); } }));
    candidate.stdout.on('data', (chunk: Buffer) => guarded(() => { if (done) return; outputBytes += chunk.length; if (outputBytes > 4 * 1024 * 1024) throw new Error('oversize_output'); for (const line of candidateFrames.push(chunk)) { const response = parseResponse(line); if (!pending || response.id !== pending.id) throw new Error('protocol_noise'); clearTimeout(pending.timer); pending = null; grader.stdin.write(JSON.stringify(response) + '\n'); } }));
    for (const child of [candidate, grader]) {
      let errorBytes = 0; child.stderr.on('data', (chunk: Buffer) => { errorBytes += chunk.length; if (errorBytes > MAX_FRAME_BYTES) finish('oversize_output'); });
      child.once('error', () => finish(child === candidate ? 'candidate_exit' : 'grader_error'));
      child.stdin.on('error', () => finish(child === candidate ? 'candidate_exit' : 'grader_error'));
    }
    candidate.once('close', () => { candidateAlive = false; if (!done) finish('candidate_exit'); });
    grader.once('close', (code) => guarded(() => { candidateFrames.end(); graderFrames.end(); finish(code === 0 && !pending ? null : 'grader_error'); }));
  });
}
