/** Extract the support ticket projection: module B.
 * Pure JSON-compatible functions; callers retain ownership of their inputs.
 * This module exports each operation separately so consumers can compose them.
 */
import type { Entry, Summary, LinkedRecord, Defaults } from './ticket-contract';
import { DEFAULTS, describeContract as sharedContract } from './ticket-contract';
import { summarize } from './ticket-values';

/** Stable extraction shared with the peer module. */
export function coreKey(entry: Entry): string {
  return entry.id;
}

/** Render only core count and total, leaving policy decisions to helpers. */
export function displaySummary(entries: readonly Entry[]): string {
  const summary = summarize(entries);
  return `${summary.count}:${summary.total}`;
}

/** projection policy operation: publicFields.
 * Returns a fresh value and leaves caller-owned input intact.
 * The service spec supplies the consumer-specific policy.
 */
export function publicFields(fields: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const key of Object.keys(fields)) {
    if (key === 'agentPrivateMemo') continue;
    result[key] = fields[key] ?? '';
  }
  return result;
}

/** projection policy operation: routingLane.
 * Returns a fresh value and leaves caller-owned input intact.
 * The service spec supplies the consumer-specific policy.
 */
export function routingLane(): string {
  return 'support-lane-m6';
}

/** projection policy operation: eventName.
 * Returns a fresh value and leaves caller-owned input intact.
 * The service spec supplies the consumer-specific policy.
 */
export function eventName(): string {
  return 'support.ticket.projected';
}

/** projection policy operation: emptyLabel.
 * Returns a fresh value and leaves caller-owned input intact.
 * The service spec supplies the consumer-specific policy.
 */
export function emptyLabel(ids: readonly string[]): string {
  return ids.length === 0 ? 'empty-projection-m6' : ids.join(',');
}
