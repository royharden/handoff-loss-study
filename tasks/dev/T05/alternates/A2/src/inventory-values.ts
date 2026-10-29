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
  return entries.reduce<Summary>((acc, entry) => ({
    count: acc.count + 1, total: acc.total + entry.amount, ids: acc.ids.concat(entry.id),
  }), { count: 0, total: 0, ids: [] });
}

/** transfer policy operation: routingLane.
 * Returns a fresh value and leaves caller-owned input intact.
 * The service spec supplies the consumer-specific policy.
 */
export function routingLane(): string {
  return 'inventory-lane-k4';
}

/** transfer policy operation: eventName.
 * Returns a fresh value and leaves caller-owned input intact.
 * The service spec supplies the consumer-specific policy.
 */
export function eventName(): string {
  return 'inventory.transfer.prepared';
}

/** transfer policy operation: capQuota.
 * Returns a fresh value and leaves caller-owned input intact.
 * The service spec supplies the consumer-specific policy.
 */
export function capQuota(n: number): number {
  return n > 31643 ? 31643 : n;
}

/** transfer policy operation: emptyLabel.
 * Returns a fresh value and leaves caller-owned input intact.
 * The service spec supplies the consumer-specific policy.
 */
export function emptyLabel(ids: readonly string[]): string {
  return ids.length === 0 ? 'empty-transfer-k4' : ids.join(',');
}
