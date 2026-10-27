/** Trusted grader process: internal Unix socket bridges vitest workers to stdio; stdout is RPC only. */
import { createServer } from 'node:net';
import type { Socket } from 'node:net';
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { Frames, parseRequest, parseResponse } from './protocol';

export async function gradeEntry(group: string): Promise<void> {
  if (!/^(C0|R[1-8])$/.test(group)) throw new Error('invalid group');
  let hostId = 0;
  const clients = new Set<Socket>();
  const pending = new Map<number, { socket: Socket; clientId: number }>();
  const queue: { socket: Socket; request: ReturnType<typeof parseRequest> }[] = [];
  const pump = (): void => { if (pending.size) return; const next = queue.shift(); if (!next) return; const id = hostId++; pending.set(id, { socket: next.socket, clientId: next.request.id }); process.stdout.write(JSON.stringify({ ...next.request, id }) + '\n'); };
  const server = createServer((socket) => {
    clients.add(socket);
    const frames = new Frames();
    socket.on('data', (chunk: Buffer) => { try { for (const line of frames.push(chunk)) { queue.push({ socket, request: parseRequest(line) }); pump(); } } catch { socket.destroy(); } });
    socket.on('close', () => { clients.delete(socket); });
  });
  const frames = new Frames();
  process.stdin.on('data', (chunk: Buffer) => { try { for (const line of frames.push(chunk)) { const response = parseResponse(line); const request = pending.get(response.id); if (!request) throw new Error('unexpected RPC'); pending.delete(response.id); request.socket.write(JSON.stringify({ ...response, id: request.clientId }) + '\n'); pump(); } } catch { process.exitCode = 1; server.close(); for (const client of clients) client.destroy(); } });
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen('/tmp/hls-grader-rpc.sock', resolve); });
  // Logs never share the RPC stream. Report lives only in grader-private tmpfs then /results.
  const child = spawn('/usr/local/bin/node', ['/runtime/node_modules/vitest/vitest.mjs', 'run', `/hidden/${group}.test.ts`, '--root', '/hidden', '--config', '/runtime/grader/vitest.config.ts', '--reporter=json', '--outputFile=/tmp/vitest-result.json'], { stdio: ['ignore', 'ignore', 'ignore'], shell: false, env: { PATH: '/usr/local/bin:/usr/bin:/bin', NODE_ENV: 'test', CI: '1' } });
  const result = await new Promise<number | null>((resolve) => { child.once('error', () => resolve(null)); child.once('close', resolve); });
  let passed = false;
  try { const report: unknown = JSON.parse(readFileSync('/tmp/vitest-result.json', 'utf8')); if (report && typeof report === 'object') { const r = report as Record<string, unknown>; passed = result === 0 && r['success'] === true && typeof r['numTotalTests'] === 'number' && r['numTotalTests'] > 0 && r['numFailedTests'] === 0; } } catch { passed = false; }
  writeFileSync('/results/result.json', JSON.stringify({ group, passed, failure: passed ? null : result === null ? 'grader_error' : 'assertion' }), { flag: 'wx' });
  for (const client of clients) client.destroy(); server.close(); process.stdin.destroy();
}
if (process.argv[2] === '--group') { const group = process.argv[3]; if (!group) throw new Error('group absent'); await gradeEntry(group); }
