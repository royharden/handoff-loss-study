/**
 * Zero-cost carrier baselines (PLAN.md D18, §4.10).
 *
 * - Verbatim forward: the whole source slice forwarded unchanged. It must score `evidence` on every
 *   eligible edge; gate conditions 6b–6d guarantee that for admitted tasks.
 * - Extractive: a deterministic, model-free selection of source lines under the same length bound as the
 *   free/fixed channels (D15: <= 0.5 x source tokens, both measured with the D7 byte bound). It has no
 *   target score; it is reported next to the model channels.
 *
 * Extractive rule (builder, fixed here): walk the source lines in order; a line is a candidate if it is a
 * markdown heading or it contains a salient token (a digit, a backtick, an identifier with an inner
 * capital, underscore, dot, slash or hyphen, or a quoted string); add each candidate line whose inclusion
 * keeps the output within the bound, skip the rest. Output lines are joined with "\n".
 *
 * Pure module: no I/O.
 */
import { handoffTokenBound } from '../core/handoff-schema';
import { R_T0 } from '../core/contracts';

const encoder = new TextEncoder();

export function utf8Bytes(text: string): number {
  return encoder.encode(text).length;
}

/** D7 byte bound: tokens(text) <= ceil(r x bytes(text)). */
export function byteBoundTokens(text: string, r: number = R_T0): number {
  if (!Number.isFinite(r) || r <= 0) throw new RangeError('r must be a positive finite number');
  return Math.ceil(r * utf8Bytes(text));
}

export function verbatimForward(sourceText: string): string {
  return sourceText;
}

const HEADING = /^ {0,3}#{1,6}(?: |$)/;
const SALIENT = /\d|`|[A-Za-z0-9][._/-][A-Za-z0-9]|[a-z][A-Z]|[A-Za-z]_[A-Za-z0-9]|"[^"]+"|'[^']+'/;

export function isExtractiveCandidate(line: string): boolean {
  if (line.trim().length === 0) return false;
  return HEADING.test(line) || SALIENT.test(line);
}

export interface ExtractiveResult {
  readonly text: string;
  readonly sourceTokens: number;
  readonly tokenBound: number;
  readonly outputTokens: number;
  readonly keptLines: number;
  readonly skippedCandidates: number;
}

export function extractiveSummary(sourceText: string, r: number = R_T0): ExtractiveResult {
  const sourceTokens = byteBoundTokens(sourceText, r);
  const tokenBound = handoffTokenBound(sourceTokens);
  const kept: string[] = [];
  let skipped = 0;
  for (const line of sourceText.replace(/\r\n?/g, '\n').split('\n')) {
    if (!isExtractiveCandidate(line)) continue;
    const next = kept.length === 0 ? line : `${kept.join('\n')}\n${line}`;
    if (byteBoundTokens(next, r) <= tokenBound) kept.push(line);
    else skipped += 1;
  }
  const text = kept.join('\n');
  return { text, sourceTokens, tokenBound, outputTokens: byteBoundTokens(text, r), keptLines: kept.length, skippedCandidates: skipped };
}
