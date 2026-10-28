import { ProviderCompletionSchema, sumUsage } from '../core/contracts';
import type { ProviderCompleteArgs, ProviderCompletion, ProviderPort, Reservation, Usage } from '../core/contracts';
import type { BudgetMeter } from '../runner/budget';
import { BudgetStop } from '../runner/budget';

export class ProviderAttemptError extends Error {
  readonly retryable: boolean;
  readonly kind: 'rate_limit' | 'server_error' | 'timeout' | 'malformed_response' | 'other';
  constructor(kind: ProviderAttemptError['kind'], retryable: boolean) { super(`provider ${kind}`); this.kind = kind; this.retryable = retryable; }
}
export interface LedgerObserver {
  reservation(reservation: Reservation, attempt: number, spentBefore: number): void;
  request(args: ProviderCompleteArgs, serialized: string, attempt: number): void;
  response(completion: ProviderCompletion, bookedTokens: number, attempt: number): void;
  error(error: unknown, bookedTokens: number, attempt: number): void;
}
/** All provider calls, including retries, pass through this one dispatch site. */
export class LedgerProvider {
  readonly provider: ProviderPort;
  readonly meter: BudgetMeter;
  readonly usages: Usage[] = [];
  constructor(provider: ProviderPort, meter: BudgetMeter) { this.provider = provider; this.meter = meter; }
  get usage(): Usage { return sumUsage(this.usages); }
  async complete(args: ProviderCompleteArgs, observer: LedgerObserver): Promise<ProviderCompletion> {
    for (let attempt = 0; attempt <= this.meter.budget.limits.ledgerRetriesPerCall; attempt += 1) {
      // Anthropic's exact body serializer is supplied by that adapter; mock uses the neutral body.
      const serializable = this.provider as ProviderPort & { serialize?: (a: ProviderCompleteArgs) => string };
      const serialized = serializable.serialize?.(args) ?? JSON.stringify({ messages: args.messages, tools: args.tools, maxOutput: args.maxOutput });
      const before = this.meter.spent;
      const reservation = this.meter.reserve(args, serialized);
      observer.reservation(reservation, attempt, before); observer.request(args, serialized, attempt);
      let completion: ProviderCompletion;
      try {
        const remaining = this.meter.budget.limits.wallMs - (Date.now() - this.meter.started);
        const signal = AbortSignal.any([args.signal, AbortSignal.timeout(Math.max(1, remaining))]);
        completion = ProviderCompletionSchema.parse(await this.provider.complete({ ...args, signal }));
      } catch (error) {
        this.meter.failedAttempt(reservation);
        this.usages.push({ input: reservation.reservedTokens, output: 0, cacheRead: 0, cacheWrite: 0, reasoning: 0, source: 'reserved' });
        observer.error(error, reservation.reservedTokens, attempt);
        this.meter.assertRunning();
        if (error instanceof ProviderAttemptError && error.retryable && attempt < this.meter.budget.limits.ledgerRetriesPerCall) continue;
        throw error;
      }
      this.usages.push(completion.usage.source === 'provider_reported' ? completion.usage : { input: reservation.reservedTokens, output: 0, cacheRead: 0, cacheWrite: 0, reasoning: 0, source: 'unknown' });
      try {
        const booked = this.meter.settle(reservation, completion.usage);
        observer.response({ ...completion, retries: attempt }, booked, attempt);
      } catch (error) {
        observer.response({ ...completion, retries: attempt }, this.meter.spent - before, attempt);
        throw error;
      }
      if (completion.retries !== 0) throw new BudgetStop('integrity_stop');
      return { ...completion, retries: attempt };
    }
    throw new Error('unreachable ledger retry');
  }
}
