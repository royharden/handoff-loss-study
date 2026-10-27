/**
 * Null provider (PLAN.md §5, D18): every completion is an immediate `finish` tool call with zero usage.
 * A null worker therefore never edits the starter repository, and its retention must be 0 because the
 * untouched repository fails C0 and every R group conjoins C0 (D11, gate cond. 2).
 *
 * Keyless, SYNTHETIC only. No I/O.
 */
import type { ProviderCompleteArgs, ProviderCompletion, ProviderPort } from './port';
import { ZERO_USAGE } from './port';

export class NullProvider implements ProviderPort {
  readonly name = 'null' as const;
  #calls = 0;

  get calls(): number {
    return this.#calls;
  }

  complete(args: ProviderCompleteArgs): Promise<ProviderCompletion> {
    if (args.signal.aborted) return Promise.reject(new Error('NullProvider: aborted'));
    this.#calls += 1;
    return Promise.resolve({
      message: { text: '', toolCalls: [{ id: `null-finish-${this.#calls}`, name: 'finish', input: {} }] },
      usage: { ...ZERO_USAGE },
      requestedModel: null,
      observedModel: null,
      latencyMs: 0,
      retries: 0,
      stopReason: 'tool_use',
    });
  }
}
