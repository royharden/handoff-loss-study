import { expect, it } from 'vitest';
import { anthropicBody, mapAnthropicResponse, redactLoadedSecret } from '../src/providers/anthropic';
it('maps cache usage at full token weight and never invents missing usage', () => {
  const response = { model: 'pinned', content: [{ type: 'tool_use', id: 't1', name: 'finish', input: {} }], usage: { input_tokens: 10, output_tokens: 2, cache_read_input_tokens: 5, cache_creation_input_tokens: 3 }, stop_reason: 'tool_use' };
  expect(mapAnthropicResponse(response, 'pinned', 0).usage).toEqual({ input: 10, output: 2, cacheRead: 5, cacheWrite: 3, reasoning: 0, source: 'provider_reported' });
  expect(mapAnthropicResponse({ ...response, usage: {} }, 'pinned', 0).usage.source).toBe('unknown');
});
it('sends tools as custom schemas and does not enable thinking or hosted tools', () => { const body = anthropicBody({ messages: [], tools: [], maxOutput: 2048, signal: new AbortController().signal }, 'pinned'); expect(body['temperature']).toBe(1); expect(body['thinking']).toBeUndefined(); expect(body['max_tokens']).toBe(2048); });
it('redacts an exact loaded secret before a completion can enter events', () => { const fake = 'fake-only-fixture-secret'; const value = redactLoadedSecret({ content: [{ type: 'text', text: `echo ${fake}` }], tool: { [fake]: fake } }, fake); expect(JSON.stringify(value)).not.toContain(fake); expect(JSON.stringify(value)).toContain('[REDACTED]'); });
