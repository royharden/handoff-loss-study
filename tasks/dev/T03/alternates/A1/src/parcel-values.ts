/** Extract the parcel manifest normalizer: module A.
 * Pure JSON-compatible functions; callers retain ownership of their inputs.
 * This module exports each operation separately so consumers can compose them.
 */
import type { Entry, Summary, LinkedRecord, Defaults } from './parcel-contract';
import { DEFAULTS, describeContract as sharedContract } from './parcel-contract';

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

/** manifest policy operation: routingLane.
 * Returns a fresh value and leaves caller-owned input intact.
 * The service spec supplies the consumer-specific policy.
 */
export function routingLane(): string {
  return 'parcel-lane-z8';
}

/** manifest policy operation: eventName.
 * Returns a fresh value and leaves caller-owned input intact.
 * The service spec supplies the consumer-specific policy.
 */
export function eventName(): string {
  return 'parcel.manifest.ready';
}

/** manifest policy operation: emptyLabel.
 * Returns a fresh value and leaves caller-owned input intact.
 * The service spec supplies the consumer-specific policy.
 */
export function emptyLabel(ids: readonly string[]): string {
  return ids.length === 0 ? 'empty-manifest-z8' : ids.join(',');
}
