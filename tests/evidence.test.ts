/**
 * M2 carry matcher tests (PLAN.md §4.1–§4.7). WRITTEN, NEVER RUN (Dirty Mode construction).
 * Deferred command: `npx vitest run tests/evidence.test.ts` (docs/DEFERRED-VALIDATION.md DV-M2-06).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CarryPairSchema } from '../src/core/contracts';
import type { Anchor } from '../src/core/contracts';
import {
  MARKERS,
  carrierDocuments,
  combineChecks,
  decoyConflict,
  edgeEvidence,
  entityCueCheck,
  fixedBriefArtifact,
  pairLexicalState,
  proseDocument,
  secretAnchorCheck,
  secretGroupStatus,
} from '../src/score/evidence';
import { findPhraseSpans, findTokenOccurrences, normalizeText } from '../src/score/normalize';

const secret = (...alternates: string[]): Anchor => ({ type: 'secret', alternates });
const entity = (...alternates: string[]): Anchor => ({ type: 'entity', alternates });

describe('§4.1 normalizeText', () => {
  it('folds curly quotes and n\u2019t', () => {
    expect(normalizeText('Don\u2019t')).toBe('Do not');
    expect(normalizeText('\u201Cx\u201D')).toBe('"x"');
    expect(normalizeText('mustn\'t')).toBe('must not');
  });
  it('rewrites cannot keeping case', () => {
    expect(normalizeText('Cannot go')).toBe('Can not go');
  });
  it('applies NFKC (full-width digits)', () => {
    expect(normalizeText('\uff11\uff13')).toBe('13');
  });
  it('strips backticks and emphasis at word boundaries only', () => {
    expect(normalizeText('`x` **13000** _retry_ceiling_ *a*')).toBe('x 13000 retry_ceiling a');
    expect(normalizeText('retry_ceiling_ms')).toBe('retry_ceiling_ms');
    expect(normalizeText('2*3*4')).toBe('2*3*4');
    expect(normalizeText('* item')).toBe('* item');
  });
  it('collapses spaces/tabs but keeps line breaks', () => {
    expect(normalizeText('a \t  b\r\nc')).toBe('a b\nc');
  });
  it('keeps Unicode line terminators as clause boundaries', () => {
    // Regression: literal U+2028/U+2029 in the source regex prevented TypeScript/esbuild parsing.
    expect(normalizeText('a\u0085b\u2028c\u2029d\re')).toBe('a\nb\nc\nd\ne');
  });
  it('is idempotent on the self-test carriers', () => {
    const s = 'Don\u2019t:\n- set `retryCeiling` to **13000**';
    expect(normalizeText(normalizeText(s))).toBe(normalizeText(s));
  });
});

describe('§4.3 token boundaries', () => {
  it('rejects matches inside identifiers and numbers', () => {
    expect(findTokenOccurrences('1379', '13')).toEqual([]);
    expect(findTokenOccurrences('clockPort.nowMs', 'clockPort.now')).toEqual([]);
    expect(findTokenOccurrences('use clockPort.now.', 'clockPort.now')).toEqual([4]);
    expect(findTokenOccurrences('"13000"', '13000')).toEqual([1]);
  });
  it('matches markers as whole words, case-insensitively', () => {
    expect(findPhraseSpans('Nothing older', MARKERS)).toEqual([]);
    expect(findPhraseSpans('NEVER e.g. 1', MARKERS).map((s) => s.phrase)).toEqual(['never', 'e.g.']);
  });
});

describe('§4.4 clauses and inheritance', () => {
  it('splits at line breaks and ";" but not at "." "," ":"', () => {
    const doc = proseDocument('a, b. c: d; e\nf');
    expect(doc.clauses.map((c) => c.text)).toEqual(['a, b. c: d', ' e', 'f']);
  });
  it('inherits the nearest heading of any level and a list intro ending in ":"', () => {
    const doc = proseDocument('# Old\n## New\nx\nNever:\n- y');
    const x = doc.clauses.find((c) => c.text === 'x');
    const y = doc.clauses.find((c) => c.text === '- y');
    expect(x?.context).toEqual(['## New']);
    expect(y?.context).toEqual(['## New', 'Never:']);
  });
  it('treats every prohibitions[] element as marked for secrets and decoys', () => {
    const a = fixedBriefArtifact(
      JSON.stringify({ objective: 'o', requirements: [], decisions_overrides: [], prohibitions: ['13000'], interfaces: [], open_items: [], files_touched: [] }),
    );
    const docs = carrierDocuments(a);
    expect(secretGroupStatus(docs, ['13000'])).toBe('marked_only');
    expect(decoyConflict(docs, ['13000'])).toBe(false);
  });
  it('excludes full-trace tool_result, tool_call and system messages', () => {
    const docs = carrierDocuments({
      channel: 'full_trace',
      messages: [
        { kind: 'system', text: '9000' },
        { kind: 'tool_call', text: '9000' },
        { kind: 'tool_result', text: '9000' },
        { kind: 'assistant', text: 'ok' },
      ],
    });
    expect(docs).toHaveLength(1);
    expect(decoyConflict(docs, ['9000'])).toBe(false);
  });
});

describe('§4.6 checks', () => {
  it('combines groups: all hit -> positive; absent without marked-only -> negative; else unknown', () => {
    expect(combineChecks(['positive', 'positive'])).toBe('positive');
    expect(combineChecks(['positive', 'negative'])).toBe('negative');
    expect(combineChecks(['negative', 'unknown'])).toBe('unknown');
    expect(combineChecks(['positive', 'unknown'])).toBe('unknown');
    expect(combineChecks([])).toBe('unknown');
  });
  it('secret_anchor uses only secret anchors', () => {
    const docs = [proseDocument('Capacity is 4096.')];
    expect(secretAnchorCheck(docs, [secret('4096'), entity('src/x.ts')])).toBe('positive');
  });
  it('entity_cue: positive, unknown and negative cases', () => {
    const check = (text: string) => entityCueCheck([proseDocument(text)], [entity('src/contracts.ts')]);
    expect(check('Do not modify src/contracts.ts.')).toBe('positive');
    expect(check('Keep src/contracts.ts unchanged.')).toBe('positive');
    expect(check('src/contracts.ts is not protected.')).toBe('unknown');
    expect(check('do not leave src/contracts.ts as is')).toBe('unknown');
    expect(check('src/contracts.ts is no longer protected.')).toBe('unknown');
    expect(check('Module A imports src/contracts.ts.')).toBe('negative');
  });
  it('M2-R1: inherits entity cues and state-cue negation from headings and list intros', () => {
    // SOURCE: frozen PLAN-FINAL.md §4.4 inheritance and §4.6.2 entity_cue; review M2-R1.
    // Catches own-clause-only cue/state checks that misclassified builder pairs B44, B62 and B63.
    const check = (text: string) => entityCueCheck([proseDocument(text)], [entity('src/contracts.ts')]);
    expect(check('Do not modify these files:\n- src/contracts.ts')).toBe('positive');
    expect(check('# Do not modify\nsrc/contracts.ts')).toBe('positive');
    expect(check('# Protected files\nDo not modify src/contracts.ts.')).toBe('unknown');
    expect(check('Protected files:\n- Do not modify src/contracts.ts.')).toBe('unknown');
  });
});

describe('§4.7 edge evidence', () => {
  const requirement = { kind: 'override_default' as const, anchors: [secret('13000')], decoys: ['9000'] };
  it('forces unknown on a missing artifact', () => {
    const e = edgeEvidence({ requirement, artifacts: [], prerequisiteFailed: false });
    expect(e).toMatchObject({ state: 'unknown', unknownReason: 'missing_artifact', channel: null });
  });
  it('forces unknown on a failed prerequisite', () => {
    const e = edgeEvidence({ requirement, artifacts: [{ channel: 'free_summary', text: 'Set 13000.' }], prerequisiteFailed: true });
    expect(e).toMatchObject({ state: 'unknown', unknownReason: 'prerequisite_failed' });
  });
  it('forces unknown when the anchor is only in marked clauses', () => {
    const e = edgeEvidence({ requirement, artifacts: [{ channel: 'free_summary', text: 'The old 13000 is wrong.' }], prerequisiteFailed: false });
    expect(e).toMatchObject({ state: 'unknown', unknownReason: 'check_unknown' });
  });
  it('positive + unmarked decoy -> unknown(decoy_conflict); positive alone -> evidence; negative -> no_evidence', () => {
    expect(edgeEvidence({ requirement, artifacts: [{ channel: 'free_summary', text: 'Use 13000.\nDefault 9000.' }], prerequisiteFailed: false }).unknownReason).toBe('decoy_conflict');
    expect(edgeEvidence({ requirement, artifacts: [{ channel: 'free_summary', text: 'Use 13000.' }], prerequisiteFailed: false }).state).toBe('evidence');
    expect(edgeEvidence({ requirement, artifacts: [{ channel: 'free_summary', text: 'Use 9000.' }], prerequisiteFailed: false }).state).toBe('no_evidence');
  });
});

describe('builder self-test pairs (D19a, fixtures/carry-conformance/builder-selftest.json)', () => {
  const file = JSON.parse(readFileSync(new URL('../fixtures/carry-conformance/builder-selftest.json', import.meta.url), 'utf8')) as { pairs: unknown[] };
  const pairs = file.pairs.map((p) => CarryPairSchema.parse(p));
  it('has at least 40 builder pairs and no semantic labels', () => {
    expect(pairs.length).toBeGreaterThanOrEqual(40);
    for (const p of pairs) {
      expect(p.set).toBe('builder_selftest');
      expect(p.semanticLabel).toBeUndefined();
    }
  });
  for (const p of pairs) {
    it(`${p.id} -> ${p.expectedLexicalState}`, () => {
      expect(pairLexicalState(p)).toBe(p.expectedLexicalState);
    });
  }
});
