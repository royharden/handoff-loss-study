/** Vitest setup inside grader ONLY. Candidate source is absent from this container. */
import { connect } from 'node:net';
import { Frames, INVOCATION_TIMEOUT_MS, parseResponse } from './protocol';
import type { RpcRequest } from './protocol';
let next = 0;
export function callCandidate(modulePath: string, fn: string, args: readonly unknown[]): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const socket = connect('/tmp/hls-grader-rpc.sock'); const frames = new Frames(); const id = next++;
    const timer = setTimeout(() => { socket.destroy(); reject(new Error('candidate timeout')); }, INVOCATION_TIMEOUT_MS);
    let done = false;
    const finish = (error: Error | null, result?: unknown): void => { if (done) return; done = true; clearTimeout(timer); socket.destroy(); if (error) reject(error); else resolve(result); };
    socket.on('connect', () => { const request: RpcRequest = { jsonrpc: '2.0', id, method: 'call', params: { modulePath, fn, args: [...args] } }; socket.write(JSON.stringify(request) + '\n'); });
    socket.on('data', (chunk: Buffer) => { try { for (const line of frames.push(chunk)) { const response = parseResponse(line); if (response.id !== id) throw new Error('RPC id mismatch'); finish(response.error ? new Error('candidate invocation failed') : null, response.result); } } catch { finish(new Error('candidate protocol failure')); } });
    socket.on('error', () => finish(new Error('candidate relay unavailable')));
    socket.on('end', () => { if (!done) finish(new Error('candidate disconnected')); });
  });
}
(globalThis as Record<string, unknown>)['__hlsCallCandidate'] = callCandidate;
