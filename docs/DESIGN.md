# Design

Summary of the plan of record (S42 PLAN.md, frozen 2026-10-27). D-numbers refer to its decision table.
**Nothing described here has run yet.** State per component: written (M1) or not yet written (later milestone).

## 1. Study

- **Cells (D2):** `single`; role split `role/{free_summary,fixed_brief,full_trace}` (planner → implementer,
  no reviewer, no repair, D3); context split `context/{free_summary,fixed_brief}` (two module workers with
  authored spec slices; phase 1 exchanges one handoff each, phase 2 works in disjoint private workspaces,
  mechanical merge, no repair round, D4). Every worker, and the spec-blind probe, also receives `brief.md`
  (the C0-level objective only).
- **Matched quantity (D5–D8):** one pooled token allowance per run (input + cached + output, replayed history
  every call, retries included); no per-phase allowances. Reservation per call
  `ceil(r × bytes) + 64 × messages + max_output`; dispatch only if `spent + reservation ≤ C`. Per run: 40
  completions, `max_output` 2,048, 15 min wall, 90k-token request ceiling. `C_dev = 150,000`; held-out C is
  `min(150k, ceil_10k(2 × P75 dev single totals))`, frozen in the prereg.
- **Corpus (D10–D12):** 6 dev tasks (builder) + 12 held-out tasks (independent custodian, after recipe
  freeze); 8 requirements per task, one per trap kind; core group C0 that no mutant touches; each R group
  asserts its requirement and C0; slot assignment by precommitted hash (2/2/2/2).
- **Carry evidence (D13, §4):** a closed lexical matcher with three checks (`secret_anchor`, `entity_cue`,
  `decoy_conflict`) and three states (`evidence`, `no_evidence`, `unknown`); "when in doubt, unknown".
- **Classes (D14):** `kept` (+ `kept_without_lexical_evidence` / `kept_attribution_unknown` flags),
  `single_not_done`, `failed_with_evidence`, `failed_without_lexical_evidence`, `attribution_unknown`,
  `local_not_done`.
- **Statistics (D20):** task-cluster percentile bootstrap (10,000 resamples, seed 42001); primary contrasts
  H1 `role/fixed_brief − single`, H2 `context/fixed_brief − single`, H3 `role/free_summary − role/fixed_brief`,
  H4 `context/free_summary − context/fixed_brief`; projected precision; exact McNemar on repeat 0 exploratory.

## 2. Layout

| Path | Responsibility | Milestone |
|---|---|---|
| `src/core/canonical.ts` | canonical JSON (sorted keys; rejects -0, NaN, ±Infinity, undefined, non-plain objects) | M1 written |
| `src/core/hash.ts` | sha256 (node:crypto), canonical hash, hash-chain link/head | M1 written |
| `src/core/ids.ts` | closed vocabularies: task/requirement/group ids, cells, arms, workers, tranches, editions, providers, tools, run ids, repo paths | M1 written |
| `src/core/handoff-schema.ts` | fixed-brief schema (7 fields, strict), handoff records per channel, length bound | M1 written |
| `src/core/contracts.ts` | Task/Requirement/Anchor/Coupling, static.json, Usage, Reservation (D7), run limits, GroupResults, segment provenance (D16), provider port data, ProviderPort/SandboxPort/RunnerPort, evidence states and classes, carry pairs, RunEvent, RunRecord, Approval, PreregManifest, HeldoutManifest | M1 written |
| `src/tasks/{load,validate,coupling}.ts` | task loading; admission gate conditions 4–8 and 6b–6f in TS; 1–3, 9 via SandboxPort | M2 written |
| `src/score/{normalize,evidence,classify,visibility,extractive,retention}.ts`, `src/score/fixture.ts` | the §4 matcher, classification, visibility audit, extractive baseline; scripted-fixture scorer and `expected.json` schema | M2 written |
| `src/providers/{port,null,scripted}.ts`, `{mock,anthropic,ledger,prices}.ts` | provider adapters; `port.ts` re-exports the core `ProviderPort` | M2 written (port, null, scripted), M4 |
| `src/sandbox/{port,local}.ts`, `{docker,relay,grader/*}.ts` | LocalUnsafeSandbox (authored code only); D17 two-container grader sources | M2 written (port, local), M4 |
| `src/runner/**` | episode loop, closed tools, workspaces, budget meter, merge, policies, channels | M4 |
| `src/store`, `src/stats`, `src/report` | hash-chained JSONL store and verify; bootstrap/McNemar/precision; tables, markdown, JSON, HTML | M5 |
| `cli/hls.ts` | the `hls` CLI | M2 written (validate, selftest, fixture, check carry-selftest/visibility, demo, score), M4–M5 (rest) |
| `viewer/` | Vite + React 18 offline results viewer | M5 |
| `tasks/dev/T01..T06` | dev corpus (builder) | M3, M6 |
| `fixtures/` | `scripted/` (18 paths), `expected.json` (hand traces), `control-task/T80` (valid gate fixture), `bad-tasks/` (12 planted), `carry-conformance/builder-selftest.json` (63 pairs) | M2 written |
| `docker/*.Dockerfile` | episode, candidate and grader image sources (never built during construction) | M4 |

`tasks/`, `fixtures/` and `results/` are excluded from the root typecheck and lint: task repos, oracles and
mutants are compiled inside their own containers.

## 3. Contracts (M1)

- **Records are SYNTHETIC or LIVE** (`edition` discriminant). SYNTHETIC records come from the null, scripted
  or mock provider in tranche FIXTURE or DEMO; LIVE records come from the `anthropic` adapter in T0–T2 and
  carry the approval file hash and decision reference. `assertSingleEdition` refuses mixed sets.
- **Run ids** are `<tranche>.<taskId>.<armSlug>.r<repeat>`.
- **RunEvent** kinds: `run_started`, `view_delivered`, `reservation`, `request` (full message list with
  per-segment provenance for the D16 audit), `response`, `provider_error`, `tool_call`, `write_refused`,
  `handoff_correction`, `handoff_delivered`, `merge`, `visibility`, `grade`, `score`, `run_finished`.
- **Hash chain:** link = `sha256(prevHash + "\n" + canonical(event))`, starting at 64 zeros; `RunRecord`
  stores `eventCount` and `chainHead`. The store (M5) owns the file format around it.
- **Usage** = `input, output, cacheRead, cacheWrite, reasoning, source`; pooled tokens =
  `input + cacheRead + cacheWrite + output`; `reasoning` is a diagnostic subset of output.
- **Schema refinements** encode pure-data rules (8 requirements, each trap kind once, slot counts 2/2/2/2,
  slot ↔ source/writer routing, `cross_module_contract` on a transfer slot, held-out tasks custodian-only,
  builder self-test pairs without semantic labels, D7 reservation arithmetic, D6 allowance arithmetic, D20
  contrasts in the prereg). They do not replace the admission gate (`hls validate`).

### M1 interpretation choices (builder; open to review)

1. `fixed_brief` is **strict**: an extra key makes the brief malformed (one correction, then raw text as prose).
2. Slices are lists of exact top-level heading lines of `spec.md` (`task.slices.{A,B}.headings`).
3. Pooled tokens exclude `reasoning` (a subset of `output` for current providers), so nothing is counted twice.
4. Port interfaces (`ProviderPort`, `SandboxPort`, `RunnerPort`) live in `src/core/contracts.ts`; the M2/M4
   `port.ts` files re-export them rather than redefine them.
5. Requirement `testGroup` is an R group id; couplings refer only to R groups (C0 is never broken by a mutant).
6. Anchor `cue` is an optional free-text record of the cue phrase the author used; the matcher's closed cue
   list is not duplicated in core.
7. `CarryPairSchema` refuses a semantic label on builder self-test pairs and requires one on custodian pairs.
8. Tranche ids `FIXTURE`/`DEMO` mark keyless SYNTHETIC records; held-out task ids are `H01..H12`.

## 4. CLI surface (contract for M2–M5)

`hls <command>`; `npm run` aliases (D22) map one-to-one:

| npm script | hls command | Purpose |
|---|---|---|
| `demo` | `demo` | keyless SYNTHETIC walkthrough |
| `selftest` | `selftest` | all keyless self-tests |
| `fixture` | `fixture` | score every scripted fixture and compare with `fixtures/expected.json` |
| `validate:dev` | `validate tasks/dev` | admission gate on the dev corpus |
| `check:carry` | `check carry` | custodian carry-conformance pairs (80) |
| `check:carry-selftest` | `check carry-selftest` | builder matcher self-test pairs |
| `check:visibility` | `check visibility` | visibility audit fixtures |
| `check:alternates` | `check alternates` | alternate solutions pass all groups |
| `check:containment` | `check containment` | sandbox/tool containment checks |
| `check:budget` | `check budget` | reservation/ledger checks |
| `check:stats` | `check stats` | statistics worksheet checks |
| `verify` | `verify <results dir>` | recompute every class/score from stored records, no model call |
| `plan` | `plan --tranche <T>` | run counts and dollar bounds |
| `study` | `run` | dry run by default; `--live` gate below |
| `report` | `report` | generate results tables |

## 5. Live gate (D23)

`hls run --live` refuses unless all hold: an `approvals/<T>.json` that parses as `ApprovalSchema` and
matches tranche, model, cells, tasks, repeats, `maxTokens`, `maxUsd`, expiry and named approver; its
`approver.decisionRef` points to the owner's signed decision (an approval file's existence is not
consent); `HLS_LIVE_ENABLED` is set; ledger spend + bound ≤ `maxUsd`. The repo ships with no approval
files. Approved spend: $0.

## 6. Gates

G-A data admission (PENDING, owner), G-I instrument (PENDING, deferred validation + custodian sealed
pairs), G-C calibration (after T1). See PLAN.md §6; `docs/DATA.md`, `docs/PREREG.md`.

## 7. M2 interpretation choices (builder; open to review)

The matcher and gate follow PLAN.md §3–§4 exactly; where the plan leaves a mechanical detail open, the
builder chose the reading that resolves away from `evidence`. Codes I1–I8 are repeated in
`src/score/evidence.ts`.

1. **I1** Line, `;` and list-item boundaries also apply inside each fixed-brief JSON string value; a value is
   its own document, so headings and list intros never cross values.
2. **I2** List intro = the first non-list line above a list (skipping list items, indented continuation
   lines and blank lines) when it ends in `:`; a heading stops the search. List-item starts are line starts.
3. **I3** A line inherits the nearest heading strictly above it (a heading line inherits the previous one).
4. **I4** An occurrence overlapping several clauses is marked if any is marked.
5. **I5** `entity_cue`: the cue must be in the anchor's own clause for `positive`; markers and `not`/`never`
   are looked for in the clause plus its inherited heading/intro; the state cue that triggers the negation
   rule must be in the clause itself ("# Protected files" above "Do not modify src/contracts.ts." stays
   positive). Cue only in the heading/intro -> `unknown`. An anchor in a `prohibitions[]` element that fails
   the positive rules -> `unknown`.
6. **I6** Several entity anchors combine like secret groups.
7. **I7** `secret_anchor` reads only secret anchors, `entity_cue` only entity anchors.
8. **I8** Full-trace carriers are exactly `assistant`, `handoff`, `spec_text` messages.
9. Markers are whole words over `[A-Za-z0-9_]` boundaries, so a marker word inside an anchor that is a
   separate word (e.g. a path segment `/old/`) marks the clause; gate cond. 6b would then reject the task.
10. **Classes:** the non-split rows (`spec_blind`, `null_worker`, `oracle`) use the `single` row of §4.9.
    Contract mismatch reads "both modules' C0 parts pass" as "C0 passes" (one C0 group per task).
11. **Visibility (D16):** a whole anchor group is permitted when any alternate is in the worker's material;
    `self_originated_anchor` is logged only for anchors the worker had no legitimate source for.
12. **Gate:** anchors, decoys and repo text/paths are compared after §4.1 normalisation with the §4.3
    token-boundary rule (cond. 4 therefore does not flag `13000` inside `130000`); 6b and 6d skip an anchor
    that already fails cond. 6; text before the first top-level heading is reported under cond. 8; TaskSchema
    task-level refinements (e.g. its own slice-overlap check) are reported as schema issues next to the
    conditions; a coupling is accepted when declared on either requirement (`declared` or `prerequisite`).
13. **Scripted fixtures** stand in for M4 episode output: they record carriers, last-edit sequence numbers,
    group pass maps, status, scripted completions, write refusals and request payloads; everything else
    (usage, flags, exclusion, evidence, classes, retention) is derived and compared with `expected.json`.
14. `hls validate` exit codes: 0 admitted, 1 a condition failed or a schema issue, 3 nothing failed but a
    condition is deferred (always the case without `--execute`).
