# Limitations

M5 source documentation; all runtime and live validation remains deferred.

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
- **Clause inheritance (M2, `docs/DESIGN.md` §7).** Entity cues and state cues include the inherited heading
  and list introduction. An inherited prohibition cue can establish evidence when its own negation is
  excused and no other marker exists; a state cue anywhere in that inherited clause with any `not`/`never`
  gives `unknown`. A marker word anywhere on a line marks every anchor on that line. A line that is not
  a list introduction (no trailing `:`) does not mark the list below it, a disclosed false-evidence risk.
- Small corpus (6 dev, 12 held-out), one model, one temperature; projected precision, not power.
- The `late_clarification` trap is a late-placed override: the required value arrives last, while the
  obsolete value appears only in a marked clause. It is not two contradictory unmarked instructions.
- Dev tasks T03–T06 share a small projection scaffold and isolated policy helpers. This limits domain
  variety and does not establish performance on larger refactors or wider software tasks. Calibration
  and independent held-out tasks remain necessary.

## Guessability, attribution and reporting

Exactly 1 of 3 spec-blind passes is a diagnostic, not a gate failure. At least 2 of 3 makes a non-
`do_not_touch` requirement guessable; the G-C count uses 42 dev requirements, not all 48. The protected
file requirement's probe pass rate is baseline compliance. At most one residual guessable pattern may
remain after one redesign, and that pattern is banned from held-out authoring. A changed requirement
is still treated as guessable without a separately authorized re-probe. No probes have executed.

Precision/recall against custodian blind semantic labels use decided lexical pairs only. Unknown
coverage is separate, gated at at most 25%, and shown by channel/trap kind. A missing artifact,
failed prerequisite or marked-only anchor remains unknown. Kept-without-evidence can be guessing,
recall, paraphrase or a lexical miss; it does not establish a mechanism or a causal handoff loss.

The report publishes failed-with-evidence, failed-without-lexical-evidence, attribution-unknown,
single/local-not-done, kept-without-evidence, contract mismatch and protected-file failures as
operational diagnostics. Tool/handoff flags include malformed handoff, refused writes, visibility
leak and self-originated anchors. Budget/infrastructure statuses include cap hit, completion/wall
limit, unknown usage, reservation overrun, crash, model mismatch, integrity stop and burned set.
Per-run records and requirement IDs are retained, including excluded and ungraded attempts. No
undefined denominator is replaced by zero. No real failure count or effect estimate exists yet.

## Integrity boundaries

Hash chains detect edits relative to their recorded head, including footer edits. Without an
externally pinned head an attacker can rewrite an entire chain. Verification recomputes scores from
the pinned task and delivered handoff events; it does not reexecute tests, authenticate a provider,
validate custodian semantic labels, or independently prove consent. `hls verify` reports whether a
score existed to recompute. The read-only viewer checks report structure/editions and renders escaped
React text; it is not a substitute for CLI journal verification. Opening arbitrary report JSON cannot
make it measured evidence. Source and snapshot digests must be checked against an external freeze
and the actual grader receipts during deferred validation.

The ordinary CLI has no default owner-consent verifier or Docker authorization. A trusted runtime
host must supply those activation ports; file existence and builder lineage cannot substitute for
them. Held-out import handles only manifest metadata. Future T2 execution needs the custodian's
authenticated loader; builder lineage has neither read nor authored held-out content here.

Live prices/model remain unverified. Actual USD needs the approved matching price table; unknown
provider usage retains a full reservation, so ledger charges can exceed reported token-based costs.
Dirty construction has spent $0; the portfolio's ceiling is not approval for any tranche. No live
activation, prereg freeze, custodian labels, held-out results or publication exists. There are no
measured deviations to list; a later amendment must be disclosed rather than relabelled confirmatory.
