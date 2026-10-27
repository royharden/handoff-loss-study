/**
 * Scripted provider (PLAN.md §5): replays a fixed list of completions in order (fixture replay with
 * synthetic usage). It ignores the request content, never touches the network and throws when the script
 * is exhausted, so a fixture can never silently run longer than authored.
 *
 * Keyless, SYNTHETIC only. No I/O.
 */
import { z } from 'zod';
import { ProviderCompletionSchema } from './port';
import type { ProviderCompleteArgs, ProviderCompletion, ProviderPort } from './port';

export const ScriptSchema = z.array(ProviderCompletionSchema);

export class ScriptExhaustedError extends Error {
  constructor(length: number) {
    super(`ScriptedProvider: script of ${length} completion(s) is exhausted`);
    this.name = 'ScriptExhaustedError';
  }
}

export class ScriptedProvider implements ProviderPort {
  readonly name = 'scripted' as const;
  readonly #script: readonly ProviderCompletion[];
  #next = 0;

  constructor(script: readonly unknown[]) {
    this.#script = ScriptSchema.parse(script);
  }

  get consumed(): number {
    return this.#next;
  }

  get remaining(): number {
    return this.#script.length - this.#next;
  }

  complete(args: ProviderCompleteArgs): Promise<ProviderCompletion> {
    if (args.signal.aborted) return Promise.reject(new Error('ScriptedProvider: aborted'));
    const c = this.#script[this.#next];
    if (c === undefined) return Promise.reject(new ScriptExhaustedError(this.#script.length));
    this.#next += 1;
    return Promise.resolve(c);
  }
}
