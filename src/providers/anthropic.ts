/** Source only, LIVE disabled by default. Uses one fetch attempt; no SDK or implicit retry. */
import { ApprovalSchema, ProviderCompletionSchema, reservationTokens } from '../core/contracts';
import type { Approval, JsonValue, PriceTable, ProviderCompleteArgs, ProviderCompletion, ProviderMessage, ProviderPort, Usage } from '../core/contracts';
import type { StudyCell, TaskId } from '../core/ids';
import { hashCanonical } from '../core/hash';
import { ProviderAttemptError } from './ledger';
import { costUsd, worstCaseUsd } from './prices';

export interface LiveScope { tranche: 'T0' | 'T1' | 'T2'; model: string; cells: readonly StudyCell[]; tasks: readonly TaskId[]; repeats: number; specBlindRunsPerTask: number; maxTokens: number; maxUsd: number; }
export interface AnthropicOptions {
  approval: Approval; scope: LiveScope; prices: PriceTable; r: number;
  /** Must validate Roy's actual signed record, not approval-file existence. No default verifier. */
  verifyRoyDecision: (approval: Approval) => Promise<boolean>;
  /** Durable tranche-wide atomic reserve/settle. Unknown transport usage retains the full USD bound. */
  spend: { reserve: (boundUsd: number, maxUsd: number) => Promise<string>; settle: (id: string, actualUsd: number) => Promise<void> };
}
const equalSet = (a: readonly string[], b: readonly string[]): boolean => a.length === b.length && [...a].sort().every((x, i) => x === [...b].sort()[i]);
export function validateLiveGate(options: AnthropicOptions, now = Date.now()): Approval {
  if (process.env['HLS_LIVE_ENABLED'] !== '1') throw new Error('live disabled: HLS_LIVE_ENABLED is unset');
  const a = ApprovalSchema.parse(options.approval); const s = options.scope;
  if (a.tranche !== s.tranche || a.model !== s.model || a.repeats !== s.repeats || a.specBlindRunsPerTask !== s.specBlindRunsPerTask || a.maxTokens !== s.maxTokens || a.maxUsd !== s.maxUsd || !equalSet(a.cells, s.cells) || !equalSet(a.tasks, s.tasks)) throw new Error('approval scope mismatch');
  if (now < Date.parse(a.issuedAt) || now >= Date.parse(a.expiresAt)) throw new Error('approval expired or not yet issued');
  if (!a.approver.name.trim() || !a.approver.decisionRef.trim()) throw new Error('Roy signed decision reference required');
  if (a.priceTableSha256 !== hashCanonical(options.prices) || options.prices.model !== s.model) throw new Error('price table mismatch');
  if (!(s.maxUsd > 0) || !(s.maxTokens > 0) || !Number.isFinite(options.r) || options.r <= 0) throw new Error('live allowance unavailable');
  return a;
}
function content(message: ProviderMessage): JsonValue[] {
  if (message.role === 'assistant') return [...(message.text ? [{ type: 'text', text: message.text }] : []), ...message.toolCalls.map((c) => ({ type: 'tool_use', id: c.id, name: c.name, input: c.input }))];
  const text = message.segments.map((s) => s.text).join('\n');
  return message.role === 'tool' ? [{ type: 'tool_result', tool_use_id: message.toolCallId, is_error: message.isError, content: text }] : [{ type: 'text', text }];
}
export function anthropicBody(args: ProviderCompleteArgs, model: string): Record<string, JsonValue> {
  const messages: { role: 'user' | 'assistant'; content: JsonValue[] }[] = [];
  for (const message of args.messages) {
    if (message.role === 'system') continue;
    const role = message.role === 'assistant' ? 'assistant' : 'user';
    const previous = messages[messages.length - 1];
    if (previous?.role === role) previous.content.push(...content(message)); else messages.push({ role, content: content(message) });
  }
  return { model, temperature: 1, max_tokens: args.maxOutput, system: args.messages.filter((m) => m.role === 'system').flatMap((m) => m.role === 'system' ? m.segments.map((s) => s.text) : []).join('\n'), messages, tools: args.tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.inputSchema })) };
}
function count(value: unknown): number | null { return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null; }
/** Strict recorded-shape mapper. Missing input/output counts become usage_unknown, never zero. */
export function mapAnthropicResponse(raw: unknown, requestedModel: string, latencyMs: number): ProviderCompletion {
  if (raw === null || typeof raw !== 'object') throw new ProviderAttemptError('malformed_response', false);
  const data = raw as Record<string, unknown>;
  if (!Array.isArray(data['content']) || typeof data['model'] !== 'string') throw new ProviderAttemptError('malformed_response', false);
  const text: string[] = []; const toolCalls: ProviderCompletion['message']['toolCalls'] = [];
  for (const value of data['content']) {
    if (!value || typeof value !== 'object') throw new ProviderAttemptError('malformed_response', false);
    const block = value as Record<string, unknown>;
    if (block['type'] === 'text' && typeof block['text'] === 'string') text.push(block['text']);
    else if (block['type'] === 'tool_use') toolCalls.push({ id: block['id'] as string, name: block['name'] as 'finish', input: block['input'] as JsonValue });
    else throw new ProviderAttemptError('malformed_response', false); // hosted tools/thinking are not part of this adapter
  }
  const u = data['usage'] && typeof data['usage'] === 'object' ? data['usage'] as Record<string, unknown> : {};
  const input = count(u['input_tokens']); const output = count(u['output_tokens']);
  const read = u['cache_read_input_tokens'] === undefined ? 0 : count(u['cache_read_input_tokens']);
  const write = u['cache_creation_input_tokens'] === undefined ? 0 : count(u['cache_creation_input_tokens']);
  const known = input !== null && output !== null && read !== null && write !== null;
  const usage: Usage = { input: input ?? 0, output: output ?? 0, cacheRead: read ?? 0, cacheWrite: write ?? 0, reasoning: 0, source: known ? 'provider_reported' : 'unknown' };
  const reason = data['stop_reason'];
  return ProviderCompletionSchema.parse({ message: { text: text.join('\n'), toolCalls }, usage, requestedModel, observedModel: data['model'], latencyMs, retries: 0, stopReason: ['end_turn', 'tool_use', 'max_tokens', 'refusal'].includes(String(reason)) ? reason : 'other' });
}
/** Applied while the loaded key is in adapter scope, before any response can reach events/storage. */
export function redactLoadedSecret(value: unknown, secret: string): unknown {
  if (!secret) return value;
  if (typeof value === 'string') return value.split(secret).join('[REDACTED]');
  if (Array.isArray(value)) return value.map((item) => redactLoadedSecret(item, secret));
  if (value !== null && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key.split(secret).join('[REDACTED]'), redactLoadedSecret(item, secret)]));
  return value;
}
export class AnthropicProvider implements ProviderPort {
  readonly name = 'anthropic' as const;
  readonly options: AnthropicOptions;
  constructor(options: AnthropicOptions) { this.options = options; validateLiveGate(options); }
  serialize(args: ProviderCompleteArgs): string { return JSON.stringify(anthropicBody(args, this.options.scope.model)); }
  async complete(args: ProviderCompleteArgs): Promise<ProviderCompletion> {
    const approval = validateLiveGate(this.options);
    if (!(await this.options.verifyRoyDecision(approval))) throw new Error('Roy signed consent not verified');
    const body = this.serialize(args);
    const tokens = reservationTokens({ requestBytes: Buffer.byteLength(body), messageCount: args.messages.length, maxOutput: args.maxOutput, r: this.options.r, perMessageOverheadTokens: 64 });
    if (tokens > 90_000 || args.maxOutput > 2048) throw new Error('request ceiling exceeded');
    const bound = worstCaseUsd(tokens, this.options.prices);
    const spendId = await this.options.spend.reserve(bound, approval.maxUsd);
    // The sole credential lookup occurs after all approvals and tranche spend reservation succeed.
    const key = process.env['ANTHROPIC_API_KEY'];
    if (!key) { await this.options.spend.settle(spendId, 0); throw new Error('ANTHROPIC_API_KEY unavailable'); }
    const started = Date.now();
    let response: Response;
    try { response = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'content-type': 'application/json', 'anthropic-version': '2023-06-01', 'x-api-key': key }, body, signal: args.signal, redirect: 'error' }); }
    catch { throw new ProviderAttemptError(args.signal.aborted ? 'timeout' : 'other', args.signal.aborted); }
    if (!response.ok) throw new ProviderAttemptError(response.status === 429 ? 'rate_limit' : response.status >= 500 ? 'server_error' : 'other', response.status === 429 || response.status >= 500);
    let result: ProviderCompletion;
    try { const raw: unknown = redactLoadedSecret(await response.json(), key); result = mapAnthropicResponse(raw, this.options.scope.model, Date.now() - started); }
    catch { throw new ProviderAttemptError('malformed_response', false); }
    if (result.usage.source === 'provider_reported') await this.options.spend.settle(spendId, costUsd(result.usage, this.options.prices));
    return result;
  }
}
