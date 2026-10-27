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
  // Legacy projection still drops the ordered id list during extraction.
  return { count: entries.length, total: entries.reduce((n, e) => n + e.amount, 0), ids: [] };
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
  return DEFAULTS.baseQuota;
}

/** projection policy operation: capQuota.
 * Returns a fresh value and leaves caller-owned input intact.
 * The service spec supplies the consumer-specific policy.
 */
export function capQuota(n: number): number {
  return Math.min(n, DEFAULTS.capQuota);
}

/** projection policy operation: linkedRecord.
 * Returns a fresh value and leaves caller-owned input intact.
 * The service spec supplies the consumer-specific policy.
 */
export function linkedRecord(entry: Entry): LinkedRecord {
  return { key: peerKey(entry), scheme: 'generic-scheme' };
}
