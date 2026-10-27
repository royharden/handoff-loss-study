/**
 * The closed carry matcher (PLAN.md §4.2–§4.7, D13). FROZEN BY HASH before the custodian's sealed pairs
 * are opened (D19b); after the freeze any change here or in ./normalize is a new matcher edition that
 * needs new sealed pairs. Design rule: **when in doubt, `unknown`** (false `evidence` is the error G-I
 * allows none of).
 *
 * Pipeline: carrier artifact -> carrier documents (§4.2) -> clauses with inherited context (§4.4) ->
 * anchor/decoy occurrences at token boundaries on the unsplit normalised text (§4.3) -> marked/unmarked
 * (§4.5) -> the three checks (§4.6) -> evidence state per eligible edge (§4.7).
 *
 * Builder interpretation choices (each resolves away from `evidence`; listed in docs/DESIGN.md §7):
 *   I1 Clause boundaries (§4.4) apply inside every carrier document, including each fixed-brief JSON
 *      string value; a JSON string value is its own document, so headings/list intros never cross values.
 *   I2 A list-item start is always a line start, so it coincides with the line boundary. A line is in a
 *      list if it is a list item, or an indented line below one; its list intro is the first line above
 *      the list (skipping list items, indented continuation lines and blank lines) when that line ends in
 *      `:`. A heading line ends the upward search (no intro).
 *   I3 The inherited heading of a line is the nearest heading line strictly above it (any level).
 *   I4 An occurrence that overlaps several clauses is marked if any of them is marked; an occurrence
 *      overlapping no clause (it consists only of `;`) counts as marked.
 *   I5 entity_cue: the cue must occur in the anchor occurrence's own clause for `positive`; markers and
 *      `not`/`never` are looked for in the clause together with its inherited heading and list intro (as
 *      §4.5 does for marking), while the state cue that triggers the negation rule must be in the clause
 *      itself. A cue present only in the inherited heading or
 *      list intro gives `unknown`; an anchor inside a `prohibitions[]` element that does not meet the
 *      positive rules gives `unknown` (the element itself carries prohibition meaning).
 *   I6 Several entity anchors on one do_not_touch requirement combine like secret groups (all positive ->
 *      positive; some negative and none unknown -> negative; otherwise unknown). Each anchor is positive
 *      if any alternate occurrence is positive, else unknown if any is unknown, else negative.
 *   I7 `secret_anchor` uses only `secret` anchors and `entity_cue` only `entity` anchors; for
 *      do_not_touch P = entity_cue, otherwise P = secret_anchor. A requirement with no anchor of the
 *      needed type gives P = unknown.
 *   I8 Full-trace carrier messages are exactly kinds `assistant`, `handoff`, `spec_text` (§4.2 lists
 *      these); `system`, `tool_call` and `tool_result` messages are not carriers.
 *
 * Pure module: no I/O.
 */
import { z } from 'zod';
import { parseFixedBrief, TraceMessageSchema } from '../core/handoff-schema';
import type { CarrierChannel, FixedBrief, Handoff, TraceMessage } from '../core/handoff-schema';
import type { Anchor, CarryPair, CheckResult, EdgeEvidence, EvidenceState, RequirementKind, UnknownReason } from '../core/contracts';
import { findPhraseSpans, findTokenOccurrences, normalizeNeedle, normalizeText } from './normalize';
import type { PhraseSpan } from './normalize';

export const MATCHER_EDITION = 'hls-carry-matcher/1';

// ---------------------------------------------------------------------------------------------
// Closed lists (§4.5, §4.6.2). Lower-case; matched case-insensitively as whole words.
// ---------------------------------------------------------------------------------------------

/** Codex's six markers plus S42-INT's seven (§4.5): 13 in total. `cannot` is folded to `can not` (§4.1). */
export const MARKERS = [
  'not',
  'never',
  'wrong',
  'old',
  'obsolete',
  'example',
  'no longer',
  'previous',
  'previously',
  'formerly',
  'deprecated',
  'e.g.',
  'instead of',
] as const;

/** Markers that may be excused when they sit inside a matched prohibition cue (§4.6.2). */
export const NEGATION_MARKERS = ['not', 'never'] as const;

export const PROHIBITION_CUES = ['do not', 'never', 'must not'] as const;

/** Single-phrase state cues; `leave … as is` is matched by LEAVE_AS_IS (§4.6.2). */
export const STATE_CUES = ['unchanged', 'read-only', 'frozen', 'protected'] as const;

const LEAVE_AS_IS = /(?<![A-Za-z0-9_])leave(?![A-Za-z0-9_])[^\n;]*?(?<![A-Za-z0-9_])as is(?![A-Za-z0-9_])/gi;

/** Full-trace message kinds that are carriers (§4.2, I8). */
export const CARRIER_TRACE_KINDS: readonly TraceMessage['kind'][] = ['assistant', 'handoff', 'spec_text'];

/** Everything that defines the matcher's behaviour besides its code; hashed into reports. */
export const MATCHER_RULES = {
  edition: MATCHER_EDITION,
  markers: MARKERS,
  negationMarkers: NEGATION_MARKERS,
  prohibitionCues: PROHIBITION_CUES,
  stateCues: [...STATE_CUES, 'leave … as is'],
  carrierTraceKinds: CARRIER_TRACE_KINDS,
  clauseBoundaries: ['line break', ';', 'fixed_brief JSON string value', 'markdown list-item start (line start)'],
  inheritance: ['nearest preceding heading (any level)', 'list intro line ending in ":"'],
} as const;

// ---------------------------------------------------------------------------------------------
// Carrier documents and clauses (§4.2, §4.4)
// ---------------------------------------------------------------------------------------------

export interface Clause {
  /** Normalised clause text (no inherited context). */
  readonly text: string;
  /** Offsets into the document text. */
  readonly start: number;
  readonly end: number;
  /** Inherited heading line and/or list-intro line, normalised (§4.4). */
  readonly context: readonly string[];
}

export interface CarrierDoc {
  /** Normalised document text; anchors are matched on it unsplit (§4.3). */
  readonly text: string;
  readonly clauses: readonly Clause[];
  /** An element of a fixed brief's `prohibitions[]`: marked for secret anchors and decoys (§4.5). */
  readonly prohibitionElement: boolean;
}

const HEADING_LINE = /^ {0,3}#{1,6}(?: |$)/;
const LIST_ITEM_LINE = /^ *(?:[-*+]|\d{1,9}[.)]) +\S/;
const INDENTED_LINE = /^ +\S/;

function isBlank(line: string): boolean {
  return line.trim().length === 0;
}

export function isHeadingLine(line: string): boolean {
  return HEADING_LINE.test(line);
}

export function isListItemLine(line: string): boolean {
  return LIST_ITEM_LINE.test(line);
}

/** I2: index of the list-intro line for line `i`, or null. */
function listIntroIndex(lines: readonly string[], i: number): number | null {
  const own = lines[i];
  if (own === undefined) return null;
  const ownIsItem = isListItemLine(own);
  if (!ownIsItem && !INDENTED_LINE.test(own)) return null;
  let sawItem = ownIsItem;
  for (let j = i - 1; j >= 0; j -= 1) {
    const line = lines[j] ?? '';
    if (isBlank(line)) continue;
    if (isListItemLine(line)) {
      sawItem = true;
      continue;
    }
    if (isHeadingLine(line)) return null;
    if (INDENTED_LINE.test(line)) continue;
    return sawItem && line.trimEnd().endsWith(':') ? j : null;
  }
  return null;
}

/** Split already-normalised text into clauses with inherited context (§4.4, I1–I3). */
export function segmentNormalized(text: string, prohibitionElement: boolean): CarrierDoc {
  const lines = text.split('\n');
  const clauses: Clause[] = [];
  let offset = 0;
  let headingAbove: number | null = null;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? '';
    const context: string[] = [];
    if (headingAbove !== null) context.push(lines[headingAbove] ?? '');
    const intro = listIntroIndex(lines, i);
    if (intro !== null) context.push(lines[intro] ?? '');
    let pieceStart = 0;
    for (let k = 0; k <= line.length; k += 1) {
      if (k === line.length || line[k] === ';') {
        clauses.push({ text: line.slice(pieceStart, k), start: offset + pieceStart, end: offset + k, context });
        pieceStart = k + 1;
      }
    }
    if (isHeadingLine(line)) headingAbove = i;
    offset += line.length + 1;
  }
  return { text, clauses, prohibitionElement };
}

/** A prose carrier document (raw text is normalised first). */
export function proseDocument(raw: string): CarrierDoc {
  return segmentNormalized(normalizeText(raw), false);
}

export type CarrierArtifact =
  | { readonly channel: 'free_summary' | 'verbatim_forward' | 'extractive'; readonly text: string }
  | { readonly channel: 'fixed_brief'; readonly raw: string; readonly parsed: FixedBrief | null }
  | { readonly channel: 'full_trace'; readonly messages: readonly TraceMessage[] };

/** A fixed brief as the sender produced it; it stays raw prose if it does not parse (§4.2). */
export function fixedBriefArtifact(raw: string): CarrierArtifact {
  const parsed = parseFixedBrief(raw);
  return { channel: 'fixed_brief', raw, parsed: parsed.ok ? parsed.brief : null };
}

/** Adapter from a stored handoff record (core HandoffSchema). */
export function artifactFromHandoff(h: Handoff): CarrierArtifact {
  switch (h.channel) {
    case 'fixed_brief':
      return { channel: 'fixed_brief', raw: h.raw, parsed: h.parsed };
    case 'full_trace':
      return { channel: 'full_trace', messages: h.messages };
    case 'free_summary':
    case 'verbatim_forward':
    case 'extractive':
      return { channel: h.channel, text: h.text };
  }
}

/** §4.2: the carrier documents of one artifact. */
export function carrierDocuments(artifact: CarrierArtifact): CarrierDoc[] {
  switch (artifact.channel) {
    case 'free_summary':
    case 'verbatim_forward':
    case 'extractive':
      return [proseDocument(artifact.text)];
    case 'fixed_brief': {
      const b = artifact.parsed;
      if (b === null) return [proseDocument(artifact.raw)];
      const docs: CarrierDoc[] = [proseDocument(b.objective)];
      for (const v of b.requirements) docs.push(proseDocument(v));
      for (const v of b.decisions_overrides) docs.push(proseDocument(v));
      for (const v of b.prohibitions) docs.push(segmentNormalized(normalizeText(v), true));
      for (const v of b.interfaces) docs.push(proseDocument(v));
      for (const v of b.open_items) docs.push(proseDocument(v));
      for (const v of b.files_touched) docs.push(proseDocument(v));
      return docs;
    }
    case 'full_trace':
      return artifact.messages.filter((m) => CARRIER_TRACE_KINDS.includes(m.kind)).map((m) => proseDocument(m.text));
  }
}

// ---------------------------------------------------------------------------------------------
// Markers and marking (§4.5)
// ---------------------------------------------------------------------------------------------

export function markerSpans(normalizedText: string): PhraseSpan[] {
  return findPhraseSpans(normalizedText, MARKERS);
}

export function hasMarker(normalizedText: string): boolean {
  return markerSpans(normalizedText).length > 0;
}

/** A clause is marked if it or its inherited heading/intro has a marker, or it is a prohibitions[] element. */
export function isClauseMarked(doc: CarrierDoc, clause: Clause): boolean {
  return doc.prohibitionElement || hasMarker(clause.text) || clause.context.some(hasMarker);
}

/** I4: is the occurrence [start, end) in a marked clause? */
export function isOccurrenceMarked(doc: CarrierDoc, start: number, end: number): boolean {
  const overlapping = doc.clauses.filter((c) => c.start < end && c.end > start);
  if (overlapping.length === 0) return true;
  return overlapping.some((c) => isClauseMarked(doc, c));
}

function clauseAt(doc: CarrierDoc, offset: number): Clause | undefined {
  return doc.clauses.find((c) => c.start <= offset && offset < c.end);
}

// ---------------------------------------------------------------------------------------------
// Check 1: secret_anchor (§4.6.1)
// ---------------------------------------------------------------------------------------------

export type GroupStatus = 'hit' | 'marked_only' | 'absent';

/** One secret anchor group: hit / marked-only / absent over all documents and alternates. */
export function secretGroupStatus(docs: readonly CarrierDoc[], alternates: readonly string[]): GroupStatus {
  let seen = false;
  for (const doc of docs) {
    for (const alt of alternates) {
      const needle = normalizeNeedle(alt);
      for (const at of findTokenOccurrences(doc.text, needle)) {
        seen = true;
        if (!isOccurrenceMarked(doc, at, at + needle.length)) return 'hit';
      }
    }
  }
  return seen ? 'marked_only' : 'absent';
}

/** Three-valued combination (Codex): all positive -> positive; some negative and none unknown -> negative; else unknown. */
export function combineChecks(results: readonly CheckResult[]): CheckResult {
  if (results.length === 0) return 'unknown';
  if (results.every((r) => r === 'positive')) return 'positive';
  if (results.some((r) => r === 'negative') && !results.some((r) => r === 'unknown')) return 'negative';
  return 'unknown';
}

export function groupStatusToCheck(s: GroupStatus): CheckResult {
  return s === 'hit' ? 'positive' : s === 'absent' ? 'negative' : 'unknown';
}

export function secretAnchorCheck(docs: readonly CarrierDoc[], anchors: readonly Anchor[]): CheckResult {
  const groups = anchors.filter((a) => a.type === 'secret');
  return combineChecks(groups.map((a) => groupStatusToCheck(secretGroupStatus(docs, a.alternates))));
}

// ---------------------------------------------------------------------------------------------
// Check 2: entity_cue (§4.6.2, I5, I6)
// ---------------------------------------------------------------------------------------------

interface CueSpans {
  readonly prohibition: readonly PhraseSpan[];
  readonly state: readonly PhraseSpan[];
}

export function cueSpans(normalizedText: string): CueSpans {
  const state: PhraseSpan[] = [...findPhraseSpans(normalizedText, STATE_CUES)];
  for (const m of normalizedText.matchAll(LEAVE_AS_IS)) {
    const start = m.index ?? 0;
    state.push({ phrase: 'leave … as is', start, end: start + m[0].length });
  }
  return { prohibition: findPhraseSpans(normalizedText, PROHIBITION_CUES), state };
}

function hasAnyCue(normalizedText: string): boolean {
  const c = cueSpans(normalizedText);
  return c.prohibition.length > 0 || c.state.length > 0;
}

/**
 * §4.6.2 conditions on a clause that holds the anchor and a cue: no marker other than a `not`/`never`
 * inside a matched prohibition cue; and if the clause contains any state cue, no `not`/`never` anywhere
 * (even inside a prohibition cue). Markers and negations are looked for in the clause and its inherited
 * heading/intro (I5); the state cue that triggers the negation rule must be in the clause itself, so a
 * heading such as "# Protected files" above "Do not modify src/contracts.ts" does not void the cue.
 */
export function cueClauseAcceptable(clause: Clause): boolean {
  const anyState = cueSpans(clause.text).state.length > 0;
  let anyNegation = false;
  for (const part of [clause.text, ...clause.context]) {
    const cues = cueSpans(part);
    for (const m of markerSpans(part)) {
      const isNegation = (NEGATION_MARKERS as readonly string[]).includes(m.phrase);
      if (isNegation) anyNegation = true;
      const excused = isNegation && cues.prohibition.some((p) => p.start <= m.start && m.end <= p.end);
      if (!excused) return false;
    }
  }
  return !(anyState && anyNegation);
}

const ALL_CUE_PHRASES: readonly string[] = [...PROHIBITION_CUES, ...STATE_CUES];

/** `<anchor>` followed only by a cue, e.g. "src/contracts.ts: unchanged" (§4.6.2 prohibitions[] rule). */
function isAnchorThenCue(element: string, anchor: string): boolean {
  if (!element.startsWith(anchor)) return false;
  const rest = element.slice(anchor.length);
  if (rest.length === 0) return true;
  if (/^[A-Za-z0-9_]/.test(rest)) return false;
  const body = rest.replace(/^[\s:,–—-]+/, '').replace(/[\s.!]+$/, '').toLowerCase();
  return ALL_CUE_PHRASES.includes(body);
}

function entityOccurrence(doc: CarrierDoc, anchor: string, at: number): CheckResult {
  if (doc.prohibitionElement) {
    const element = doc.text.trim();
    if ((element === anchor || isAnchorThenCue(element, anchor)) && !hasMarker(element)) return 'positive';
  }
  const clause = clauseAt(doc, at);
  if (clause === undefined) return 'unknown';
  if (hasAnyCue(clause.text)) return cueClauseAcceptable(clause) ? 'positive' : 'unknown';
  if (clause.context.some(hasAnyCue)) return 'unknown';
  if (doc.prohibitionElement) return 'unknown';
  return 'negative';
}

/** entity_cue for one entity anchor (any alternate). */
export function entityAnchorCheck(docs: readonly CarrierDoc[], alternates: readonly string[]): CheckResult {
  let sawUnknown = false;
  for (const doc of docs) {
    for (const alt of alternates) {
      const needle = normalizeNeedle(alt);
      for (const at of findTokenOccurrences(doc.text, needle)) {
        const r = entityOccurrence(doc, needle, at);
        if (r === 'positive') return 'positive';
        if (r === 'unknown') sawUnknown = true;
      }
    }
  }
  return sawUnknown ? 'unknown' : 'negative';
}

export function entityCueCheck(docs: readonly CarrierDoc[], anchors: readonly Anchor[]): CheckResult {
  const entities = anchors.filter((a) => a.type === 'entity');
  return combineChecks(entities.map((a) => entityAnchorCheck(docs, a.alternates)));
}

// ---------------------------------------------------------------------------------------------
// Check 3: decoy_conflict (§4.6.3, marker-aware)
// ---------------------------------------------------------------------------------------------

export function decoyConflict(docs: readonly CarrierDoc[], decoys: readonly string[]): boolean {
  for (const doc of docs) {
    for (const decoy of decoys) {
      const needle = normalizeNeedle(decoy);
      for (const at of findTokenOccurrences(doc.text, needle)) {
        if (!isOccurrenceMarked(doc, at, at + needle.length)) return true;
      }
    }
  }
  return false;
}

// ---------------------------------------------------------------------------------------------
// §4.7 Evidence state per eligible edge
// ---------------------------------------------------------------------------------------------

export interface EvidenceRequirement {
  readonly kind: RequirementKind;
  readonly anchors: readonly Anchor[];
  readonly decoys: readonly string[];
}

export interface EdgeEvidenceInput {
  readonly requirement: EvidenceRequirement;
  /** Carrier artifacts the responsible writer received before its last edit; empty = missing. */
  readonly artifacts: readonly CarrierArtifact[];
  /** A `prerequisite` coupling group of this requirement failed (D11). */
  readonly prerequisiteFailed: boolean;
}

function unknownEdge(reason: UnknownReason, channel: CarrierChannel | null, checks: EdgeEvidence['checks']): EdgeEvidence {
  return { state: 'unknown', unknownReason: reason, channel, checks };
}

export function edgeEvidence(input: EdgeEvidenceInput): EdgeEvidence {
  const first = input.artifacts[0];
  if (first === undefined) {
    return unknownEdge('missing_artifact', null, { secretAnchor: null, entityCue: null, decoyConflict: null });
  }
  const docs = input.artifacts.flatMap(carrierDocuments);
  const isDnt = input.requirement.kind === 'do_not_touch';
  const p = isDnt ? entityCueCheck(docs, input.requirement.anchors) : secretAnchorCheck(docs, input.requirement.anchors);
  const conflict = decoyConflict(docs, input.requirement.decoys);
  const checks: EdgeEvidence['checks'] = {
    secretAnchor: isDnt ? null : p,
    entityCue: isDnt ? p : null,
    decoyConflict: conflict,
  };
  if (input.prerequisiteFailed) return unknownEdge('prerequisite_failed', first.channel, checks);
  if (p === 'negative') return { state: 'no_evidence', unknownReason: null, channel: first.channel, checks };
  if (p === 'unknown') return unknownEdge('check_unknown', first.channel, checks);
  if (conflict) return unknownEdge('decoy_conflict', first.channel, checks);
  return { state: 'evidence', unknownReason: null, channel: first.channel, checks };
}

// ---------------------------------------------------------------------------------------------
// Carry-conformance pairs (D19): carrier text encoding per channel
// ---------------------------------------------------------------------------------------------

const TraceArraySchema = z.array(TraceMessageSchema);

/**
 * Decode a carry pair's `carrier` string: prose channels as text; `fixed_brief` as the sender's raw
 * JSON text (prose if it does not parse); `full_trace` as a JSON array of trace messages.
 */
export function artifactFromPair(pair: Pick<CarryPair, 'id' | 'channel' | 'carrier'>): CarrierArtifact {
  switch (pair.channel) {
    case 'fixed_brief':
      return fixedBriefArtifact(pair.carrier);
    case 'full_trace': {
      let value: unknown;
      try {
        value = JSON.parse(pair.carrier);
      } catch {
        throw new Error(`${pair.id}: full_trace carrier must be a JSON array of trace messages`);
      }
      return { channel: 'full_trace', messages: TraceArraySchema.parse(value) };
    }
    case 'free_summary':
    case 'verbatim_forward':
    case 'extractive':
      return { channel: pair.channel, text: pair.carrier };
  }
}

/** The lexical state the matcher assigns to a pair (no missing artifact, no prerequisite). */
export function pairLexicalState(pair: CarryPair): EvidenceState {
  return edgeEvidence({
    requirement: { kind: pair.requirementKind, anchors: pair.anchors, decoys: pair.decoys },
    artifacts: [artifactFromPair(pair)],
    prerequisiteFailed: false,
  }).state;
}
