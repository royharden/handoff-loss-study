/** Extract the support ticket projection: module A.
 * Pure JSON-compatible functions; callers retain ownership of their inputs.
 * This module exports each operation separately so consumers can compose them.
 */
import type { Entry, Summary, LinkedRecord, Defaults } from './ticket-contract';
import { DEFAULTS, describeContract as sharedContract } from './ticket-contract';
import { coreKey as peerKey } from './ticket-view';

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

/** projection policy operation: baseQuota.
 * Returns a fresh value and leaves caller-owned input intact.
 * The service spec supplies the consumer-specific policy.
 */
export function baseQuota(): number {
  return 3823;
}

/** projection policy operation: capQuota.
 * Returns a fresh value and leaves caller-owned input intact.
 * The service spec supplies the consumer-specific policy.
 */
export function capQuota(n: number): number {
  return Math.min(n, 29531);
}

/** projection policy operation: linkedRecord.
 * Returns a fresh value and leaves caller-owned input intact.
 * The service spec supplies the consumer-specific policy.
 */
export function linkedRecord(entry: Entry): LinkedRecord {
  return { key: peerKey(entry), scheme: 'ticket-key-v6' };
}
