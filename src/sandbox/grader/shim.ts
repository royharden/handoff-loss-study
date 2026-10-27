/** Candidate image entrypoint. ONLY public shim/runtime + extracted source are present. */
import { pathToFileURL } from 'node:url';
import { resolve, sep } from 'node:path';
import { lstatSync, realpathSync } from 'node:fs';
import { Frames, MAX_FRAME_BYTES, parseRequest } from './protocol';
import type { RpcResponse } from './protocol';

export function startCandidateShim(root = '/candidate'): void {
  const framing = new Frames(); let chain = Promise.resolve();
  const send = (response: RpcResponse): void => { const text = JSON.stringify(response); if (Buffer.byteLength(text) > MAX_FRAME_BYTES) throw new Error('oversize_output'); process.stdout.write(text + '\n'); };
  process.stdin.on('data', (chunk: Buffer) => {
    try {
      for (const line of framing.push(chunk)) {
        const request = parseRequest(line);
        chain = chain.then(async () => {
          try {
            const path = resolve(root, request.params.modulePath);
            if (!path.startsWith(resolve(root) + sep) || lstatSync(path).isSymbolicLink() || realpathSync(path) !== path) throw new Error('invalid module path');
            const module: unknown = await import(pathToFileURL(path).href);
            const target = (module as Record<string, unknown>)[request.params.fn];
            if (typeof target !== 'function') throw new Error('missing export');
            const value: unknown = await (target as (...args: unknown[]) => unknown)(...request.params.args);
            const encoded = JSON.stringify(value === undefined ? null : value);
            if (encoded === undefined || Buffer.byteLength(encoded) > MAX_FRAME_BYTES - 128) throw new Error('invalid result');
            send({ jsonrpc: '2.0', id: request.id, result: JSON.parse(encoded) as unknown });
          } catch { send({ jsonrpc: '2.0', id: request.id, error: { code: -32000, message: 'candidate invocation failed' } }); }
        }).catch(() => { process.exitCode = 1; process.stdin.destroy(); });
      }
    } catch { process.exitCode = 1; process.stdin.destroy(); }
  });
  process.stdin.on('end', () => { try { framing.end(); } catch { process.exitCode = 1; } });
}
// Importing the public shim is inert; the Docker image uses this explicit entry condition.
if (process.argv[2] === '--serve') startCandidateShim();
