/** Build the inventory transfer summary: module B.
 * Pure JSON-compatible functions; callers retain ownership of their inputs.
 * This module exports each operation separately so consumers can compose them.
 */
import type { Entry, Summary, LinkedRecord, Defaults } from './inventory-contract';
import { DEFAULTS, describeContract as sharedContract } from './inventory-contract';
import { coreKey as peerKey } from './inventory-values';
import { summarize } from './inventory-values';

/** Stable extraction shared with the peer module. */
export function coreKey(entry: Entry): string {
  return entry.id;
}

/** Render only core count and total, leaving policy decisions to helpers. */
export function displaySummary(entries: readonly Entry[]): string {
  const summary = summarize(entries);
  return `${summary.count}:${summary.total}`;
}

/** Report the shared contract without changing its defaults. */
export function describeContract(): Defaults {
  return sharedContract();
}

/** transfer policy operation: publicFields.
 * Returns a fresh value and leaves caller-owned input intact.
 * The service spec supplies the consumer-specific policy.
 */
export function publicFields(fields: Record<string, string>): Record<string, string> {
  return { ...fields };
}

/** transfer policy operation: baseQuota.
 * Returns a fresh value and leaves caller-owned input intact.
 * The service spec supplies the consumer-specific policy.
 */
export function baseQuota(): number {
  return 4937;
}

/** transfer policy operation: linkedRecord.
 * Returns a fresh value and leaves caller-owned input intact.
 * The service spec supplies the consumer-specific policy.
 */
export function linkedRecord(entry: Entry): LinkedRecord {
  return { key: peerKey(entry), scheme: 'inventory-key-v8' };
}
