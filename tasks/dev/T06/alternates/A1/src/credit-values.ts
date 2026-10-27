/** Repair the subscription credit statement: module A.
 * Pure JSON-compatible functions; callers retain ownership of their inputs.
 * This module exports each operation separately so consumers can compose them.
 */
import type { Entry, Summary, LinkedRecord, Defaults } from './credit-contract';
import { DEFAULTS, describeContract as sharedContract } from './credit-contract';
import { coreKey as peerKey } from './credit-view';

/** Stable extraction shared with the peer module. */
export function coreKey(entry: Entry): string {
  return entry.id;
}

/** Aggregate independently of routing and service policy helpers. */
export function summarize(entries: readonly Entry[]): Summary {
  const result: Summary = { count: 0, total: 0, ids: [] };
  for (const entry of entries) {
    result.count += 1;
    result.total += entry.amount;
    result.ids.push(entry.id);
  }
  return result;
}

/** Report the shared contract without changing its defaults. */
export function describeContract(): Defaults {
  return sharedContract();
}

/** statement policy operation: eventName.
 * Returns a fresh value and leaves caller-owned input intact.
 * The service spec supplies the consumer-specific policy.
 */
export function eventName(): string {
  return 'credit.statement.ready';
}

/** statement policy operation: capQuota.
 * Returns a fresh value and leaves caller-owned input intact.
 * The service spec supplies the consumer-specific policy.
 */
export function capQuota(n: number): number {
  return Math.min(n, 42757);
}

/** statement policy operation: linkedRecord.
 * Returns a fresh value and leaves caller-owned input intact.
 * The service spec supplies the consumer-specific policy.
 */
export function linkedRecord(entry: Entry): LinkedRecord {
  return { key: peerKey(entry), scheme: 'credit-key-v9' };
}
