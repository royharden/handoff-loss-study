# Limitations

> Skeleton (M1). Completed in M5/M6.

## Construction

- **None of this code has executed.** It was built in Dirty Mode (static checks only). Every runtime claim
  waits for `docs/DEFERRED-VALIDATION.md`.
- Review during construction is builder lineage, not independent.

## Design (carried from the plan of record)

- **Operational partition, not causation.** "Lexical carry / implementation outcome decomposition" says
  whether lexical evidence of a requirement reached the responsible writer; it does not say why a
  requirement was lost.
- **Lexical matcher limits (§4.8).** Possible false `evidence` (a risk to gate G-I): negation on a different
  line without a heading/list-intro link; negating words outside the closed marker list (`avoid`, `no`,
  `without`, `forbidden`, `neither … nor`, `stop using`); a prohibition cue with a different object ("Do not
  worry about src/contracts.ts"). Likely `unknown` where the requirement was carried (a recall/coverage risk
  to gate G-C): override wording that leaves the decoy unmarked; ordinary uses of marker words on the same
  line; long unwrapped paragraphs; a required alternative on the same line as a negation; paraphrase without
  the anchor (`no_evidence`).
- **Matcher builder choices (M2, `docs/DESIGN.md` §7).** Each resolves away from `evidence` and so can lower
  recall/raise `unknown` coverage (a G-C risk): an entity cue only in a heading or list intro gives `unknown`;
  a state cue with any `not`/`never` in its clause gives `unknown`; a marker word anywhere on a line marks
  every anchor on that line. One choice keeps a disclosed false-evidence risk: a line that is not a list
  intro (no trailing `:`) does not mark the list below it.
- Small corpus (6 dev, 12 held-out), one model, one temperature; projected precision, not power.

TODO(M5/M6): guessability diagnostics (requirements passing exactly 1 of 3 spec-blind runs), unknown
coverage per channel, any deviation rows.
