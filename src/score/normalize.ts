/**
 * §4.1 normalisation and §4.3 token-boundary occurrences (PLAN.md, frozen matcher).
 *
 * `normalizeText` is applied identically to carrier text, anchors, decoys, cues and markers. Steps, in
 * order (each is deterministic and idempotent):
 *   1. line breaks: CRLF, CR, U+0085, U+2028, U+2029 -> LF (line breaks are kept, they are clause
 *      boundaries, §4.4);
 *   2. quote fold (before NFKC, because NFKC turns U+2033 DOUBLE PRIME into two primes):
 *      ‘ ’ ‛ ′ -> '   and   “ ” ″ -> "
 *   3. Unicode NFKC (folds full-width and compatibility characters, NBSP and other spaces -> space);
 *   4. quote fold again (NFKC never produces curly quotes, but this keeps the step order-proof);
 *   5. strip every backtick;
 *   6. strip markdown emphasis only where `**`/`__`/`*`/`_` delimit a span at word boundaries: the opening
 *      delimiter is not preceded by [A-Za-z0-9_] and is followed by a non-space, the closing delimiter is
 *      preceded by a non-space and not followed by [A-Za-z0-9_]. Underscores inside identifiers such as
 *      `retry_ceiling` are therefore kept, and `_retry_ceiling_` becomes `retry_ceiling`;
 *   7. `n't` -> ` not` when preceded by a letter (don't -> do not, mustn't -> must not);
 *   8. `cannot` -> `can not` (whole word, case of the letters kept);
 *   9. collapse runs of spaces/tabs within a line to one space (line breaks kept).
 * Identifiers and literals stay case-sensitive. Marker and cue words are matched case-insensitively as
 * whole words by `findPhraseSpans`.
 *
 * Pure module: no I/O.
 */

/** Characters that make up an identifier token for the §4.3 boundary rule. */
const WORD_CHAR = /^[A-Za-z0-9_]$/;

export function isWordChar(ch: string | undefined): boolean {
  return ch !== undefined && WORD_CHAR.test(ch);
}

const LINE_BREAKS = /\r\n|\r|\u0085| | /g;
const SINGLE_QUOTES = /[‘’‛′]/g;
const DOUBLE_QUOTES = /[“”″]/g;
const BACKTICKS = /`/g;
const STRONG_STAR = /(?<![A-Za-z0-9_*])\*\*(?=[^\s*])([^\n]*?[^\s*])\*\*(?![A-Za-z0-9_*])/g;
const STRONG_UNDERSCORE = /(?<![A-Za-z0-9_])__(?=[^\s_])([^\n]*?[^\s_])__(?![A-Za-z0-9_])/g;
const EM_STAR = /(?<![A-Za-z0-9_*])\*(?=[^\s*])([^\n*]*?[^\s*])\*(?![A-Za-z0-9_*])/g;
const EM_UNDERSCORE = /(?<![A-Za-z0-9_])_(?=[^\s_])([^\n]*?[^\s_])_(?![A-Za-z0-9_])/g;
const N_APOSTROPHE_T = /(?<=[A-Za-z])n't(?![A-Za-z0-9_])/gi;
const CANNOT = /(?<![A-Za-z0-9_])(can)(not)(?![A-Za-z0-9_])/gi;
const SPACE_RUNS = /[ \t]+/g;

export function foldQuotes(text: string): string {
  return text.replace(SINGLE_QUOTES, "'").replace(DOUBLE_QUOTES, '"');
}

export function stripEmphasis(text: string): string {
  return text
    .replace(STRONG_STAR, '$1')
    .replace(STRONG_UNDERSCORE, '$1')
    .replace(EM_STAR, '$1')
    .replace(EM_UNDERSCORE, '$1');
}

/** §4.1 normalisation (see module comment for the exact step order). */
export function normalizeText(input: string): string {
  let text = input.replace(LINE_BREAKS, '\n');
  text = foldQuotes(text);
  text = text.normalize('NFKC');
  text = foldQuotes(text);
  text = text.replace(BACKTICKS, '');
  text = stripEmphasis(text);
  text = text.replace(N_APOSTROPHE_T, ' not');
  text = text.replace(CANNOT, '$1 $2');
  text = text.replace(SPACE_RUNS, ' ');
  return text;
}

/** Normalise an anchor, decoy or cue: §4.1 plus trimming of surrounding whitespace. */
export function normalizeNeedle(input: string): string {
  return normalizeText(input).trim();
}

/**
 * §4.3: start offsets of every occurrence of `needle` in `text` (both already normalised) that starts
 * and ends at a token boundary: the characters immediately before and after the occurrence are not
 * [A-Za-z0-9_]. Matching is case-sensitive and on the unsplit text; occurrences may overlap.
 */
export function findTokenOccurrences(text: string, needle: string): number[] {
  const out: number[] = [];
  if (needle.length === 0) return out;
  let from = 0;
  for (;;) {
    const at = text.indexOf(needle, from);
    if (at < 0) break;
    if (!isWordChar(text[at - 1]) && !isWordChar(text[at + needle.length])) out.push(at);
    from = at + 1;
  }
  return out;
}

export function containsToken(text: string, needle: string): boolean {
  return findTokenOccurrences(text, needle).length > 0;
}

export interface PhraseSpan {
  /** The phrase from the closed list that matched (lower-case, as listed). */
  readonly phrase: string;
  readonly start: number;
  readonly end: number;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const PHRASE_PATTERNS = new Map<string, RegExp>();

function phrasePattern(phrase: string): RegExp {
  let re = PHRASE_PATTERNS.get(phrase);
  if (re === undefined) {
    re = new RegExp(`(?<![A-Za-z0-9_])${escapeRegExp(phrase)}(?![A-Za-z0-9_])`, 'gi');
    PHRASE_PATTERNS.set(phrase, re);
  }
  return re;
}

/**
 * Whole-word, case-insensitive occurrences of each listed phrase in `text` (already normalised).
 * "Whole word" uses the same [A-Za-z0-9_] boundary as §4.3, so `not` does not match inside `nothing`
 * and `old` does not match inside `older`.
 */
export function findPhraseSpans(text: string, phrases: readonly string[]): PhraseSpan[] {
  const out: PhraseSpan[] = [];
  for (const phrase of phrases) {
    for (const m of text.matchAll(phrasePattern(phrase))) {
      const start = m.index ?? 0;
      out.push({ phrase, start, end: start + m[0].length });
    }
  }
  return out.sort((a, b) => a.start - b.start || a.end - b.end);
}

/** Count of Unicode code points (used by the decoy distinctiveness rule, gate cond. 6f). */
export function codePointLength(text: string): number {
  return [...text].length;
}
