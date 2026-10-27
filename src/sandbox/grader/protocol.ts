/** Public JSON-RPC contract; this module contains no tests, predicates or expected values. */
export const MAX_FRAME_BYTES = 64 * 1024;
export const INVOCATION_TIMEOUT_MS = 5000;
export interface RpcRequest { jsonrpc: '2.0'; id: number; method: 'call'; params: { modulePath: string; fn: string; args: unknown[] }; }
export interface RpcResponse { jsonrpc: '2.0'; id: number; result?: unknown; error?: { code: number; message: string }; }
function object(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value); }
function keys(value: Record<string, unknown>, names: readonly string[]): boolean { return Object.keys(value).every((k) => names.includes(k)); }
export function parseRequest(line: string): RpcRequest {
  if (Buffer.byteLength(line) > MAX_FRAME_BYTES) throw new Error('oversize_output');
  const v: unknown = JSON.parse(line);
  if (!object(v) || !keys(v, ['jsonrpc', 'id', 'method', 'params']) || v['jsonrpc'] !== '2.0' || !Number.isSafeInteger(v['id']) || (v['id'] as number) < 0 || v['method'] !== 'call' || !object(v['params'])) throw new Error('protocol_noise');
  const p = v['params'];
  if (!keys(p, ['modulePath', 'fn', 'args']) || typeof p['modulePath'] !== 'string' || !/^src\/[A-Za-z0-9_./-]+\.ts$/.test(p['modulePath']) || p['modulePath'].split('/').some((s) => s === '.' || s === '..' || s === '') || typeof p['fn'] !== 'string' || !/^[A-Za-z_$][\w$]*$/.test(p['fn']) || !Array.isArray(p['args'])) throw new Error('protocol_noise');
  return v as unknown as RpcRequest;
}
export function parseResponse(line: string): RpcResponse {
  if (Buffer.byteLength(line) > MAX_FRAME_BYTES) throw new Error('oversize_output');
  const v: unknown = JSON.parse(line);
  if (!object(v) || !keys(v, ['jsonrpc', 'id', 'result', 'error']) || v['jsonrpc'] !== '2.0' || !Number.isSafeInteger(v['id']) || ('result' in v) === ('error' in v)) throw new Error('protocol_noise');
  if ('error' in v && (!object(v['error']) || !keys(v['error'], ['code', 'message']) || !Number.isInteger(v['error']['code']) || typeof v['error']['message'] !== 'string')) throw new Error('protocol_noise');
  return v as unknown as RpcResponse;
}
/** Incremental UTF-8 line framing with bounded pending buffer. Empty lines are noise. */
export class Frames {
  #buffer = Buffer.alloc(0);
  push(chunk: Uint8Array): string[] {
    this.#buffer = Buffer.concat([this.#buffer, Buffer.from(chunk)]);
    const lines: string[] = [];
    while (true) { const at = this.#buffer.indexOf(10); if (at < 0) break; if (at === 0) throw new Error('protocol_noise'); if (at > MAX_FRAME_BYTES) throw new Error('oversize_output'); lines.push(new TextDecoder('utf-8', { fatal: true }).decode(this.#buffer.subarray(0, at))); this.#buffer = this.#buffer.subarray(at + 1); }
    if (this.#buffer.length > MAX_FRAME_BYTES) throw new Error('oversize_output');
    return lines;
  }
  end(): void { if (this.#buffer.length) throw new Error('protocol_noise'); }
}
