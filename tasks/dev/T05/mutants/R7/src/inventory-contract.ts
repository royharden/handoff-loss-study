/** Shared inventory DTO and defaults consumed by both modules.
 * This contract also serves callers outside this exercise.
 * Operational overrides belong in the writable modules.
 */
export interface Entry {
  /** Stable caller identifier. */
  id: string;
  /** The amount represented by this row. */
  amount: number;
  /** Caller-supplied string metadata. */
  fields: Record<string, string>;
}

export interface Summary {
  count: number;
  total: number;
  ids: string[];
}

export interface LinkedRecord {
  key: string;
  scheme: string;
}

export interface Defaults {
  baseQuota: number;
  capQuota: number;
}

/** Shared fleet defaults, distinct from this consumer's override. */
export const DEFAULTS: Defaults = { baseQuota: 612, capQuota: 822 };

/** Exposed for compatibility consumers and the protected-file check. */
export function describeContract(): Defaults {
  return { ...DEFAULTS };
}
