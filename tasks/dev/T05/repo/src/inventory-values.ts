/** Build the inventory transfer summary: module A.
 * Pure JSON-compatible functions; callers retain ownership of their inputs.
 * This module exports each operation separately so consumers can compose them.
 */
import type { Entry, Summary, LinkedRecord, Defaults } from './inventory-contract';
import { DEFAULTS, describeContract as sharedContract } from './inventory-contract';

/** Stable extraction shared with the peer module. */
export function coreKey(entry: Entry): string {
  return entry.id;
}

/** Aggregate independently of routing and service policy helpers. */
export function summarize(entries: readonly Entry[]): Summary {
  // The initial projection has not yet been connected to the feature.
  return { count: 0, total: 0, ids: [] };
}

/** transfer policy operation: routingLane.
 * Returns a fresh value and leaves caller-owned input intact.
 * The service spec supplies the consumer-specific policy.
 */
export function routingLane(): string {
  return 'unrouted';
}

/** transfer policy operation: eventName.
 * Returns a fresh value and leaves caller-owned input intact.
 * The service spec supplies the consumer-specific policy.
 */
export function eventName(): string {
  return 'GenericEvent';
}

/** transfer policy operation: capQuota.
 * Returns a fresh value and leaves caller-owned input intact.
 * The service spec supplies the consumer-specific policy.
 */
export function capQuota(n: number): number {
  return Math.min(n, DEFAULTS.capQuota);
}

/** transfer policy operation: emptyLabel.
 * Returns a fresh value and leaves caller-owned input intact.
 * The service spec supplies the consumer-specific policy.
 */
export function emptyLabel(ids: readonly string[]): string {
  return ids.join(',');
}
