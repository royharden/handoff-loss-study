/** Repair the subscription credit statement: module B.
 * Pure JSON-compatible functions; callers retain ownership of their inputs.
 * This module exports each operation separately so consumers can compose them.
 */
import type { Entry, Summary, LinkedRecord, Defaults } from './credit-contract';
import { DEFAULTS, describeContract as sharedContract } from './credit-contract';
import { summarize } from './credit-values';

/** Stable extraction shared with the peer module. */
export function coreKey(entry: Entry): string {
  return entry.id;
}

/** Render only core count and total, leaving policy decisions to helpers. */
export function displaySummary(entries: readonly Entry[]): string {
  const summary = summarize(entries);
  return `${summary.count}:${summary.total}`;
}

/** statement policy operation: publicFields.
 * Returns a fresh value and leaves caller-owned input intact.
 * The service spec supplies the consumer-specific policy.
 */
export function publicFields(fields: Record<string, string>): Record<string, string> {
  return { ...fields };
}

/** statement policy operation: routingLane.
 * Returns a fresh value and leaves caller-owned input intact.
 * The service spec supplies the consumer-specific policy.
 */
export function routingLane(): string {
  return 'credit-lane-p2';
}

/** statement policy operation: baseQuota.
 * Returns a fresh value and leaves caller-owned input intact.
 * The service spec supplies the consumer-specific policy.
 */
export function baseQuota(): number {
  return 5749;
}

/** statement policy operation: emptyLabel.
 * Returns a fresh value and leaves caller-owned input intact.
 * The service spec supplies the consumer-specific policy.
 */
export function emptyLabel(ids: readonly string[]): string {
  return ids.length === 0 ? 'empty-statement-p2' : ids.join(',');
}
