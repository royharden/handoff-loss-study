/** Extract the parcel manifest normalizer: module B.
 * Pure JSON-compatible functions; callers retain ownership of their inputs.
 * This module exports each operation separately so consumers can compose them.
 */
import type { Entry, Summary, LinkedRecord, Defaults } from './parcel-contract';
import { DEFAULTS, describeContract as sharedContract } from './parcel-contract';
import { coreKey as peerKey } from './parcel-values';
import { summarize } from './parcel-values';

/** Stable extraction shared with the peer module. */
export function coreKey(entry: Entry): string {
  return entry.id;
}

/** Render only core count and total, leaving policy decisions to helpers. */
export function displaySummary(entries: readonly Entry[]): string {
  const summary = summarize(entries);
  return `${summary.count}:${summary.total}`;
}

/** manifest policy operation: publicFields.
 * Returns a fresh value and leaves caller-owned input intact.
 * The service spec supplies the consumer-specific policy.
 */
export function publicFields(fields: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(fields).filter(([key]) => key !== 'internalDockCode'));
}

/** manifest policy operation: baseQuota.
 * Returns a fresh value and leaves caller-owned input intact.
 * The service spec supplies the consumer-specific policy.
 */
export function baseQuota(): number {
  return 2711;
}

/** manifest policy operation: capQuota.
 * Returns a fresh value and leaves caller-owned input intact.
 * The service spec supplies the consumer-specific policy.
 */
export function capQuota(n: number): number {
  return n > 18421 ? 18421 : n;
}

/** manifest policy operation: linkedRecord.
 * Returns a fresh value and leaves caller-owned input intact.
 * The service spec supplies the consumer-specific policy.
 */
export function linkedRecord(entry: Entry): LinkedRecord {
  return { key: peerKey(entry), scheme: 'parcel-key-v4' };
}
