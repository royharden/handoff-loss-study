/**
 * ProviderPort (PLAN.md §5, D9). The interface and its data schemas live in src/core/contracts.ts
 * (docs/DESIGN.md M1 choice 4); this module re-exports them and adds the keyless guard.
 *
 * Keyless providers: `null`, `scripted` (M2), `mock` (M4). The only live adapter, `anthropic` (M4), ships
 * disabled and is never imported by this module or by anything on the selftest/demo path.
 */
export type { ProviderCompleteArgs, ProviderCompletion, ProviderMessage, ProviderPort, ToolCall, ToolSpec, Usage } from '../core/contracts';
export { ProviderCompletionSchema, ProviderMessageSchema, UsageSchema, sumUsage, usageTotalTokens } from '../core/contracts';
import type { ProviderPort } from '../core/contracts';
import type { ProviderName } from '../core/ids';

export const KEYLESS_PROVIDERS: readonly ProviderName[] = ['null', 'scripted', 'mock'];

export class LiveProviderRefusedError extends Error {
  constructor(context: string, provider: ProviderName) {
    super(`${context}: refusing live provider '${provider}' (keyless path; SYNTHETIC only)`);
    this.name = 'LiveProviderRefusedError';
  }
}

export function isKeylessProvider(name: ProviderName): boolean {
  return KEYLESS_PROVIDERS.includes(name);
}

/** Throw unless the provider is keyless. Used by selftest, demo and the local sandbox. */
export function assertKeylessProvider(context: string, provider: Pick<ProviderPort, 'name'> | ProviderName): void {
  const name = typeof provider === 'string' ? provider : provider.name;
  if (!isKeylessProvider(name)) throw new LiveProviderRefusedError(context, name);
}

/** Zero synthetic usage (provider_reported: the keyless provider reports exactly zero tokens). */
export const ZERO_USAGE = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, reasoning: 0, source: 'provider_reported' } as const;
