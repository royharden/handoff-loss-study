import { DEFAULT_RUN_LIMITS, reservationTokens, usageTotalTokens } from '../core/contracts';
import type { ProviderCompleteArgs, Reservation, RunBudget, RunStatus, Usage } from '../core/contracts';

export class BudgetStop extends Error {
  readonly status: RunStatus;
  constructor(status: RunStatus) { super(status); this.name = 'BudgetStop'; this.status = status; }
}
export class BudgetMeter {
  readonly budget: RunBudget;
  readonly started = Date.now();
  spent = 0;
  completions = 0;
  halted: RunStatus | null = null;
  #pending = new Set<Reservation>();
  constructor(budget: RunBudget) {
    // Limits may be tightened by callers, never relaxed beyond D8.
    if (!Number.isInteger(budget.allowanceTokens) || budget.allowanceTokens <= 0 || budget.allowanceTokens > 150_000 || !Number.isFinite(budget.r) || budget.r <= 0) throw new Error('invalid budget');
    for (const key of ['maxCompletions', 'maxOutput', 'wallMs', 'requestCeilingTokens', 'ledgerRetriesPerCall'] as const) {
      if (!Number.isInteger(budget.limits[key]) || budget.limits[key] < 0 || budget.limits[key] > DEFAULT_RUN_LIMITS[key]) throw new Error(`invalid limit ${key}`);
    }
    if (budget.limits.perMessageOverheadTokens !== 64) throw new Error('D7 overhead must be 64');
    this.budget = budget;
  }
  assertRunning(): void {
    if (this.halted) throw new BudgetStop(this.halted);
    if (Date.now() - this.started >= this.budget.limits.wallMs) this.stop('wall_limit');
  }
  stop(status: RunStatus): never { this.halted = status; throw new BudgetStop(status); }
  reserve(args: ProviderCompleteArgs, serializedRequest: string): Reservation {
    this.assertRunning();
    if (this.completions >= this.budget.limits.maxCompletions) this.stop('completion_limit');
    if (args.maxOutput > this.budget.limits.maxOutput || args.maxOutput <= 0) throw new Error('maxOutput exceeds budget');
    const fields = { requestBytes: Buffer.byteLength(serializedRequest), messageCount: args.messages.length, maxOutput: args.maxOutput, r: this.budget.r, perMessageOverheadTokens: 64 };
    const reservation = { ...fields, reservedTokens: reservationTokens(fields) };
    const pending = [...this.#pending].reduce((n, r) => n + r.reservedTokens, 0);
    if (reservation.reservedTokens > this.budget.limits.requestCeilingTokens || this.spent + pending + reservation.reservedTokens > this.budget.allowanceTokens) this.stop('cap_hit');
    this.#pending.add(reservation); this.completions += 1;
    return reservation;
  }
  settle(reservation: Reservation, usage: Usage | null): number {
    if (!this.#pending.delete(reservation)) throw new Error('reservation absent or already settled');
    const known = usage !== null && usage.source === 'provider_reported';
    const booked = known ? usageTotalTokens(usage) : reservation.reservedTokens;
    this.spent += booked;
    if (!known) this.stop('usage_unknown');
    if (booked > reservation.reservedTokens) this.stop('reservation_overrun');
    return booked;
  }
  /** Failed transport attempts may have consumed tokens: book full reservation before retry. */
  failedAttempt(reservation: Reservation): void {
    if (!this.#pending.delete(reservation)) throw new Error('unknown reservation');
    this.spent += reservation.reservedTokens;
  }
}
