import type { ProviderCompleteArgs, ProviderCompletion, ProviderPort } from './port';
import { ProviderCompletionSchema } from './port';
import type { Arm } from '../core/ids';
import { ZERO_USAGE } from './port';
/** Minimal SYNTHETIC policy traversal only; never claims implementation success or a grade. */
export function mockStepsForArm(arm: Arm): ProviderCompletion[] {
  const fixed = JSON.stringify({ objective: '', requirements: [], decisions_overrides: [], prohibitions: [], interfaces: [], open_items: [], files_touched: [] });
  let seq = 0;
  const step = (name: 'finish' | 'submit_handoff'): ProviderCompletion => ({ message: { text: '', toolCalls: [{ id: `mock-${++seq}`, name, input: name === 'finish' ? {} : { text: arm.endsWith('fixed_brief') ? fixed : '' } }] }, usage: { ...ZERO_USAGE }, requestedModel: null, observedModel: null, latencyMs: 0, retries: 0, stopReason: 'tool_use' });
  if (arm.startsWith('context/')) return [step('submit_handoff'), step('submit_handoff'), step('finish'), step('finish')];
  if (arm.startsWith('role/')) return [step(arm.endsWith('full_trace') ? 'finish' : 'submit_handoff'), step('finish')];
  return [step('finish')];
}
/** Deterministic, keyless source fixture. Exhaustion is an error, never an implicit success. */
export class MockProvider implements ProviderPort {
  readonly name = 'mock' as const;
  #index = 0;
  readonly #steps: readonly ProviderCompletion[];
  constructor(steps: readonly unknown[]) { this.#steps = steps.map((step) => ProviderCompletionSchema.parse(step)); }
  complete(args: ProviderCompleteArgs): Promise<ProviderCompletion> {
    if (args.signal.aborted) return Promise.reject(new Error('mock aborted'));
    const step = this.#steps[this.#index++];
    return step === undefined ? Promise.reject(new Error('mock exhausted')) : Promise.resolve(structuredClone(step));
  }
}
