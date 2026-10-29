# Task recipe

Written in M3 with `tasks/dev/T01` (feature) and `tasks/dev/T02` (bugfix) as worked examples. **Nothing in
this recipe has been executed**: the oracle, mutant and alternate expectations are checked by reading only
(docs/DEFERRED-VALIDATION.md DV-M3-xx). The recipe is frozen before custodian held-out authoring (after
gate G-C); G-C may extend the banned-pattern list at the end. Builder lineage writes dev tasks only.

## 1. Task folder (`tasks/<split>/<id>/`)

| Path | Content |
|---|---|
| `task.json` | `TaskSchema` (`src/core/contracts.ts`): ids, shape, title, author lineage, modules A/B, protected interface, public tests, slices, slot-assignment record, 8 requirements |
| `spec.md` | the whole spec, top-level `# ` sections only, first line a heading (empty preamble) |
| `brief.md` | the C0-level objective only (§6) |
| `repo/` | the starter: two writable modules, one protected interface file, public smoke tests; 100–300 lines in total |
| `hidden/` | `C0.test.ts`, `R1.test.ts` … `R8.test.ts`, plus `_c0.ts` (typed calls + `assertC0`) and `_rpc.ts` (§8) |
| `oracle/` | overlay on `repo/`: the reference solution (only the changed files) |
| `mutants/R<n>/` | overlay on `repo/ ⊕ oracle/`: one file breaking only R<n>; `mutants/MUTANTS.md` explains each (files at `mutants/` root are not overlays) |
| `static.json` | `StaticConfigSchema`: sha256 of the protected file, forbidden identifiers |
| `alternates/A1`, `alternates/A2` | overlays on `repo/`: two further valid solutions, written differently from the oracle and from each other |

Modules export functions whose arguments and return values are JSON-serialisable (they cross the D17
JSON-RPC boundary). Functions are pure: no clock, randomness, I/O or global state. Prefer returning
values to throwing.

## 2. Trap kinds and requirement order

Each task has exactly one requirement per kind. Dev tasks use the canonical order below so the kind of
R<n> is fixed before the slot hash is computed (§3); the custodian may keep or change the order for
held-out tasks but must fix it before computing the slot hash.

| Id | Kind | What it plants | T01 | T02 |
|---|---|---|---|---|
| R1 | `negative_constraint` | something the natural implementation does that must be excluded | strip `x-hook-signature` | exclude `healthcheck_ping` |
| R2 | `literal_constant` | an exact literal with no starter default | `x-relay-lane: retry-q7` | `vcpu_seconds_v3` |
| R3 | `naming_convention` | a name produced by a stated convention | `relay.retry.scheduled` | `invLinePriceCents` |
| R4 | `override_default` | a value replacing a default declared in the protected file | `baseDelayMs: 1500` (default 240) | clamp 64000 (default 10000) |
| R5 | `late_clarification` | a value stated last in the spec, superseding an earlier generic line | `retryCeiling: 13000` (default 9000) | storage 342 (default 290) |
| R6 | `cross_module_contract` | an agreement between the modules, stated on one side | zero-based `computeDelay` | `promo-credit` flag |
| R7 | `do_not_touch` | the protected interface file stays byte-identical | `src/contracts.ts` | `src/types.ts` |
| R8 | `edge_case` | a special input or boundary | 410 gives up at once | 1–119 units billed as 120 |

Pair R7 with R4/R5: the tempting shortcut for an override is to edit the default in the protected file.

## 3. Slot assignment (rule `docs/TASK-RECIPE.md#slot-assignment v1`) {#slot-assignment}

1. Fix the kind order (§2) and a seed **before** authoring requirement text. Dev seed: `1` for every dev
   task. Hash input: `<taskId>:<seed>`, e.g. `T01:1` (UTF-8, no newline).
2. `d = sha256(input)` as 64 lower-case hex characters (`printf '%s' 'T01:1' | sha256sum`).
3. `L = [local_A, local_A, local_B, local_B, transfer_A_to_B, transfer_A_to_B, transfer_B_to_A, transfer_B_to_A]`
   (0-indexed).
4. Fisher–Yates with digest bytes: for `s = 0 … 6`, let `i = 7 − s`, `b` = the byte at hex characters
   `2s, 2s+1` of `d`, `j = b mod (i + 1)`; swap `L[i]` and `L[j]`.
5. `R(k+1)` gets `L[k]`.
6. Fix-up: if the `cross_module_contract` requirement holds a local slot, swap its slot with that of the
   lowest-numbered requirement holding a transfer slot. (Counts stay 2/2/2/2.)
7. A slot fixes `sourceSlice` (the slice whose text states the requirement) and `responsibleWriter` (the
   module whose code implements it): `local_A` A/A, `local_B` B/B, `transfer_A_to_B` A/B, `transfer_B_to_A` B/A.
8. Record `input`, `sha256` and this rule id in `task.json.slotAssignment`. Never re-roll a seed to get a
   preferred assignment; the PLAN §10 demo names whichever requirement holds a transfer slot.

Worked traces (computed with `sha256sum` by the builder; re-derivation through product code is deferred):

**T01**, `T01:1` → `b55696fdc517d203fb9b01a1e3e4655d317ac9df2844fd78910e9801af986b90`
(LA = local_A, LB = local_B, AB = transfer_A_to_B, BA = transfer_B_to_A)

| s | i | byte | j | L after swap |
|---|---|---|---|---|
| 0 | 7 | b5 = 181 | 5 | LA LA LB LB AB BA BA AB |
| 1 | 6 | 56 = 86 | 2 | LA LA BA LB AB BA LB AB |
| 2 | 5 | 96 = 150 | 0 | BA LA BA LB AB LA LB AB |
| 3 | 4 | fd = 253 | 3 | BA LA BA AB LB LA LB AB |
| 4 | 3 | c5 = 197 | 1 | BA AB BA LA LB LA LB AB |
| 5 | 2 | 17 = 23 | 2 | (no-op) |
| 6 | 1 | d2 = 210 | 0 | AB BA BA LA LB LA LB AB |

R6 (`cross_module_contract`) drew `local_A`; fix-up swaps it with R1 (lowest transfer). Result: R1 LA, R2 BA,
R3 BA, R4 LA, R5 LB, R6 AB, R7 LB, R8 AB. R6 is a transfer slot, as the PLAN §10 demo needs.

**T02**, `T02:1` → `3d3916d4e6b06320fc34d5ac4210186f8ad1b69cbca83a5ea3c18f0a11b2b4b3`

| s | i | byte | j | L after swap |
|---|---|---|---|---|
| 0 | 7 | 3d = 61 | 5 | LA LA LB LB AB BA BA AB |
| 1 | 6 | 39 = 57 | 1 | LA BA LB LB AB BA LA AB |
| 2 | 5 | 16 = 22 | 4 | LA BA LB LB BA AB LA AB |
| 3 | 4 | d4 = 212 | 2 | LA BA BA LB LB AB LA AB |
| 4 | 3 | e6 = 230 | 2 | LA BA LB BA LB AB LA AB |
| 5 | 2 | b0 = 176 | 2 | (no-op) |
| 6 | 1 | 63 = 99 | 1 | (no-op) |

No fix-up (R6 drew AB). Result: R1 LA, R2 BA, R3 LB, R4 BA, R5 LB, R6 AB, R7 LA, R8 AB.

## 4. The carry matcher, as an author must respect it (PLAN.md §4)

The lists below are copied from PLAN.md §4.4–4.6 and match `src/score/evidence.ts` (M2) as written. The
matcher hash is recorded at the D19b freeze; if the frozen lists differ from this section, the frozen
matcher wins and this section is corrected.

- **Normalisation (§4.1):** NFKC; curly quotes folded to `'`/`"`; spaces collapsed, line breaks kept;
  markdown emphasis stripped only at word boundaries (`retry_ceiling` keeps its underscore); backticks
  stripped; `n't` → ` not`; `cannot` → `can not`. Identifiers and literals are case-sensitive; markers and
  cues match case-insensitively as whole words.
- **Occurrence (§4.3):** an anchor or decoy alternate matches the unsplit normalised text only at token
  boundaries: the characters just before and after are not `[A-Za-z0-9_]` (`13` does not match in `1379`).
- **Clause (§4.4):** boundaries are a line break, `;`, a markdown list-item start, and (fixed brief) each
  JSON string value. `.`, `,` and `:` are **not** boundaries. A clause inherits its nearest preceding heading
  of any level and the list-intro line (a line ending in `:`) directly above its list.
- **Markers (§4.5), 13:** `not`, `never`, `wrong`, `old`, `obsolete`, `example`, `no longer`, `previous`,
  `previously`, `formerly`, `deprecated`, `e.g.`, `instead of` (plus `cannot` and every `n't`, via the
  folds). A clause is marked if it, its inherited heading or its list intro holds a marker.
- **Prohibition cues (§4.6.2):** `do not`, `never`, `must not`. **State cues:** `unchanged`, `read-only`,
  `frozen`, `protected`, `leave … as is`. `entity_cue` is positive only when the entity anchor and a cue
  are in the same clause, the clause holds no marker except the `not`/`never` inside a matched prohibition
  cue, and a clause with a state cue holds no `not`/`never` at all.

### How to state anchors and decoys

1. **Every secret anchor once in an unmarked clause of its own slice** (cond. 6b). Write it as a positive
   statement: "`x-hook-signature` is stripped from the forwarded headers", not "never forward
   `x-hook-signature`". For a negative constraint, the anchor is the excluded thing and the verb carries
   the exclusion (`stripped`, `excluded`, `dropped`), never a marker word.
2. **Keep the whole anchor clause marker-free**, including its heading and any list intro. Watch the
   everyday words: `not`, `old`, `previous`, `example`/`e.g.`, `instead of`, every contraction (`don't`,
   `isn't`), `cannot`. Split a sentence with `;` when a marked remark must sit beside an anchor:
   "waits `baseDelayMs: 1500`, set in `src/schedule.ts`; the library default of 240 is wrong for webhook
   receivers." gives one unmarked clause (anchor) and one marked clause (decoy).
3. **Decoys only in marked clauses** (cond. 6c), or not in `spec.md` at all. The usual decoy is the starter
   default; mention it, if at all, in a clause with `old`, `obsolete` or `wrong`.
4. **Decoys distinctive** (cond. 6f): ≥ 3 digits or ≥ 4 characters, different from every anchor and every
   other decoy, never a substring of an anchor. Keep the decoy out of every other spec sentence (T02 avoids
   300-ish numbers and HTTP codes for the same reason).
5. **Anchors distinctive and unique** (cond. 7 and M6): no anchor repeated across the eight requirements or
   across the six dev tasks; prefer identifiers, exact literals and numbers of ≥ 3 digits. Give equivalent
   spellings as `alternates` (`13000`, `13,000`, `13_000`); any one alternate counts.
6. **Secret anchors absent from `repo/`** (cond. 4): no file content, file name or path in the starter or the
   public tests may contain any alternate, even inside a longer token. Check with
   `grep -rnF '<alternate>' repo/` and `find repo/ | grep -F '<alternate>'`. Watch accidental hits (T01
   avoids `attempts.length - 1` in the starter by using `attempts.at(-1)`; its smoke test avoids
   `computeDelay(0)`).
7. **Entity anchors present in `repo/`** (cond. 5) and stated with a cue in one clause of their slice
   (cond. 6d): "`src/contracts.ts` stays unchanged: the delivery workers share it."
8. **Headings and slices** (cond. 6b, 8): every slice is a set of whole top-level `# ` sections; every section
   starts with its own heading; headings carry no marker; slices A ∪ B is the whole spec with no overlap.
   A slice may be non-contiguous (T01 interleaves A and B sections so the late clarifications come last).

### `late_clarification` (reviewer note)

The spec states the generic rule early ("Each retry wait is capped by the retry ceiling of the
dispatcher.") and the value last ("…: `retryCeiling: 13000`, applied in `src/dispatch.ts`."). The old value
appears in the spec **only** in a marked clause ("The old `retryCeiling` of 9000 is obsolete.") and
otherwise only as the starter default in the protected file. The trap is therefore a **late-placed
override**: a reader who stops early, or a sender who summarises the early rule, ends up with the starter
default. It is not a contradiction inside the spec, because an unmarked old value would break cond. 6c and
the verbatim-forward invariant (D18). Reviewers should read the late clarification as "the value arrives
last", not "the spec says two things".

## 5. C0 rule

- C0 is the task's core behaviour; `brief.md` states it in full. The untouched starter must fail C0 (so it
  fails all nine groups, cond. 2): feature shape — the core function is unfinished; bugfix shape — the
  core bug is present.
- No mutant touches a C0 code path, and **no C0 assertion may depend on any R1..R8 requirement**: assert
  ratios, membership, sums and relations, never a value a requirement changes (T01 checks the growth
  ratio on indices 1–3 so neither the base delay nor the index base matters; T02 checks totals as the sum
  of line amounts, never a price).
- C0 must also not fail plausible partial solutions for a reason outside the brief (T01 accepts
  `runAt ≥ latest attempt time`, not an exact delay).
- Every `R<n>.test.ts` runs `assertC0` and its own assertions; a group passes only if both pass.

## 6. `brief.md` rule

`brief.md` is a verbatim subset of the spec's objective section (T01, T02: the body of `# Objective`). It
holds no secret anchor, no decoy and no entity anchor + cue clause (cond. 6e). It goes to every worker in
every cell and to the spec-blind probe (D3).

## 7. Isolating requirements in the hidden groups

Each R group must fail only under its own mutant (cond. 3). Choose inputs so that no other requirement can
change the observed value, and say why in the test header:

- give each requirement its own function, field, meter or input value where possible;
- when two requirements meet in one value, pick inputs where only one decides it (T01 R5 uses five failed
  attempts so the raw wait exceeds 13000 under every other mutant; T02 R3/R5/R6 use ≥ 120 units so the
  R8 minimum is inactive);
- compare against the candidate's own function where a requirement is relative (T01 R6 compares the
  dispatcher's wait with the candidate's `computeDelay`, so R4's base value does not matter);
- check the protected file through an exported reader (`describeContract`, `describePricing`) so R7 has
  a runtime signal besides the static hash.

Declare a coupling in `task.json` only when isolation is impossible; mark it `prerequisite` when a
failed group makes the dependent requirement unattributable (D11). T01 and T02 declare none.

## 8. Hidden groups and the candidate-call helper

- Files: `hidden/C0.test.ts`, `hidden/R1.test.ts` … `hidden/R8.test.ts` (one vitest file per group, one
  `describe('<group>')` each), `hidden/_c0.ts`, `hidden/_rpc.ts`. `_rpc.ts` is byte-identical across tasks.
- Hidden tests call the candidate only through `callCandidate(modulePath, fn, args)` in `_rpc.ts`
  (repo-relative module path, exported function name, JSON-serialisable positional arguments; resolves with
  the JSON result; rejects with `CandidateCallError` on a missing module/function, a throw, a
  non-serialisable result or a relay failure).
- Transport: the D17 grader (M4, `src/sandbox/grader/client.ts`) must install a function with that
  signature on `globalThis.__hlsCallCandidate` before hidden groups load. Without an installer (only under
  `LocalUnsafeSandbox`, authored code) the helper imports `<snapshot root>/<modulePath>` in process and
  JSON-round-trips arguments and result. No candidate source exists in the grader container, so the
  fallback cannot grade model output.
- Static checks: a `static.json` protected-file hash mismatch is reported against the `do_not_touch` group
  (failure `static_check`); a forbidden identifier in candidate source is a `static_check` failure of every
  group. These attributions are the recipe's proposal to M2/M4 (`src/tasks/validate.ts`, the D17 grader);
  until those modules adopt them they are not implemented.
- Forbidden identifiers used in T01/T02: `eval`, `Function`, `process`, `require`, `globalThis`.

## 9. Knobs for dev tuning (G-C band 0.40–0.85 single retention)

Spec length and number of distractor sentences; how late a late clarification sits; whether a decoy is
mentioned (marked) or left only in the starter; how natural the tempting shortcut is (e.g. a starter
helper that already uses the default, T01 `capDelay`); how far a transfer requirement's text sits from
the receiving module's own section; anchor style (identifier vs number vs phrase such as `zero-based`).
A retuned requirement keeps its kind and slot.

## 10. Alternates

`alternates/A1` and `A2` are complete overlays on `repo/` that pass all nine groups by a different route
(T01 A1 loop schedule + filter headers, A2 closed form + precomputed wait table; T02 A1 pipeline +
`Math.max` minimum, A2 switch-based normaliser + copied price map). They guard against hidden tests that
accept only the oracle's structure. Dev alternates are builder-written and checked by
`npm run check:alternates` (deferred); held-out alternates are the custodian's (cond. 9).

## 11. Banned patterns for held-out authoring

None yet. G-C adds the trap pattern (kind + anchor style) of any dev requirement still guessable after one
redesign (passes ≥ 2 of 3 spec-blind runs), and the custodian must not use it.
