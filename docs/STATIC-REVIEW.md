# Static review record

Dirty Mode construction acceptance (plan of record §11): a separate review subagent checks each static
acceptance item of a milestone by reading source and data, and fills one row per item: inspected
`file:line`, `pass`/`fail`, reviewer callsign. **A missing or empty row is not a pass.** Reviewers are
builder lineage: a pass means "accepted for Dirty Mode construction — runtime unverified", not independent
review. Runtime checks are in [DEFERRED-VALIDATION.md](DEFERRED-VALIDATION.md), never here.

Rows are pre-filled from the plan of record §12 (compound items split so each row is one checkable claim).

## M1 — Scaffold, core contracts, docs skeleton

| # | Milestone | Item | Inspected file:line | Pass/fail | Reviewer callsign |
|---|---|---|---|---|---|
| M1-1 | M1 | Every `.ts` file passes `node --check` | src/core/{canonical,hash,ids,contracts,handoff-schema}.ts, tests/core.test.ts, vitest.config.ts (node --check v24, all OK) | pass | 0844_Claude_Opus55_Sub_S42RevM1 |
| M1-2 | M1 | Every JSON file parses | package.json:1-53, tsconfig.json:1-28 (node -e JSON.parse OK) | pass | 0844_Claude_Opus55_Sub_S42RevM1 |
| M1-3 | M1 | zod schemas cover every field named in §3 (Task, Requirement incl. id/kind/slot/sourceSlice/responsibleWriter/testGroup/anchors/decoys/couplings, Anchor `{type, alternates, cue?}`, Coupling `{group, kind}`, static.json) | src/core/contracts.ts:111-120 (Anchor), :127-130 (Coupling), :133-173 (Requirement), :188-250 (Task), :254-259 (static.json) | pass | 0844_Claude_Opus55_Sub_S42RevM1 |
| M1-4 | M1 | zod schemas cover every field named in §4 (check results, evidence states, classes, diagnostic flags) | src/core/contracts.ts:572-595 (check results, states, unknown reasons, classes, flags), :597-639 (edge evidence, score) | pass | 0844_Claude_Opus55_Sub_S42RevM1 |
| M1-5 | M1 | zod schemas / types cover §5 (ProviderPort args/result, RunnerPort, SandboxPort, GroupResults, RunEvent, RunRecord, SYNTHETIC/LIVE discriminant) | src/core/contracts.ts:424-454 (GroupResults), :483-565 (segments, ProviderPort, SandboxPort, RunnerPort), :720-849 (RunEvent), :853-942 (RunRecord SYNTHETIC/LIVE, edition guard) | pass | 0844_Claude_Opus55_Sub_S42RevM1 |
| M1-6 | M1 | Usage has exactly `input, output, cacheRead, cacheWrite, reasoning, source` | src/core/contracts.ts:274-283 | pass | 0844_Claude_Opus55_Sub_S42RevM1 |
| M1-7 | M1 | Handoff schema covers D15 channels and the seven fixed-brief fields | src/core/handoff-schema.ts:21, :27-48 (7 fields, strict), :70-73 (D15 bound), :99-151 (channels) | pass | 0844_Claude_Opus55_Sub_S42RevM1 |
| M1-8 | M1 | Approval schema covers D23 (tranche, model, cells, tasks, repeats, maxTokens, maxUsd, expiry, named approver + decision reference) | src/core/contracts.ts:949-984 | pass | 0844_Claude_Opus55_Sub_S42RevM1 |
| M1-9 | M1 | Prereg manifest covers D24 (hypotheses, contrasts, C, r, exclusions, analysis code, prompts, image digests, model, sampling, price table, held-out manifest hash, seeded run order, amendments) | src/core/contracts.ts:1004-1053 | pass | 0844_Claude_Opus55_Sub_S42RevM1 |
| M1-10 | M1 | Canonical JSON sorts keys | src/core/canonical.ts:94 | pass | 0844_Claude_Opus55_Sub_S42RevM1 |
| M1-11 | M1 | Canonical JSON rejects `-0` | src/core/canonical.ts:45 | pass | 0844_Claude_Opus55_Sub_S42RevM1 |
| M1-12 | M1 | Canonical JSON rejects NaN (and ±Infinity) | src/core/canonical.ts:43-44 | pass | 0844_Claude_Opus55_Sub_S42RevM1 |
| M1-13 | M1 | Canonical JSON rejects `undefined` | src/core/canonical.ts:58-59, :79-82 | pass | 0844_Claude_Opus55_Sub_S42RevM1 |
| M1-14 | M1 | sha256 uses `node:crypto` | src/core/hash.ts:7, :149-154 | pass | 0844_Claude_Opus55_Sub_S42RevM1 |
| M1-15 | M1 | README contains no measured number | README.md:1-79 | pass | 0844_Claude_Opus55_Sub_S42RevM1 |
| M1-16 | M1 | README says which commands have never run | README.md:3-5, :50-56 | pass | 0844_Claude_Opus55_Sub_S42RevM1 |
| M1-17 | M1 | `docs/STATIC-REVIEW.md` holds one row per static acceptance item of M1–M6 | docs/STATIC-REVIEW.md:11-145 (M1 20, M2 29, M3 16, M4 19, M5 13, M6 9 rows vs PLAN.md §12) | pass | 0844_Claude_Opus55_Sub_S42RevM1 |
| M1-18 | M1 | `.env.example` holds no value | .env.example:4-5 | pass | 0844_Claude_Opus55_Sub_S42RevM1 |
| M1-19 | M1 | No import of a network/provider SDK from `src/core` | src/core/contracts.ts:15-43, handoff-schema.ts:17-18, hash.ts:7-8, ids.ts:7-8 (zod, node:crypto, local only); eslint.config.js:132-151 | pass | 0844_Claude_Opus55_Sub_S42RevM1 |
| M1-20 | M1 | Erasable TypeScript only (no enum, namespace, parameter properties); `import type` for type-only imports | src/core/*.ts (no enum/namespace/parameter property; canonical.ts:28-34 plain field); contracts.ts:41, :43 import type | pass | 0844_Claude_Opus55_Sub_S42RevM1 |

## M2 — Task loader, data-gate checks, scorer, keyless fixture path

| # | Milestone | Item | Inspected file:line | Pass/fail | Reviewer callsign |
|---|---|---|---|---|---|
| M2-1 | M2 | Every `.ts` file passes `node --check` | | | |
| M2-2 | M2 | Classification table §4.9 implemented exactly (reviewer traces each fixture to its expected class by hand) | | | |
| M2-3 | M2 | Evidence uses token-boundary matching (§4.3) | | | |
| M2-4 | M2 | Normalisation uses NFKC and the §4.1 folds (quotes, whitespace, emphasis, backticks, `n't`, `cannot`) | | | |
| M2-5 | M2 | `unknown` forced on missing artifacts | | | |
| M2-6 | M2 | `unknown` forced on failed prerequisites | | | |
| M2-7 | M2 | `unknown` forced on anchors found only in marked clauses | | | |
| M2-8 | M2 | Clause boundaries: line / `;` / JSON string / list item, with inherited heading (any level) and list intro (§4.4) | | | |
| M2-9 | M2 | Closed marker list (13 markers, §4.5) and `prohibitions[]` elements treated as marked | | | |
| M2-10 | M2 | `entity_cue` rules incl. state-cue negation and `prohibitions[]` handling (§4.6.2) | | | |
| M2-11 | M2 | Marker-aware `decoy_conflict` (§4.6.3) and group combination positive/negative/unknown (§4.6.1) | | | |
| M2-12 | M2 | Evidence state per eligible edge follows §4.7; full-trace tool-result segments excluded (§4.2) | | | |
| M2-13 | M2 | Each builder self-test pair's expected state follows from §4 by hand trace | | | |
| M2-14 | M2 | `builder-selftest.json` has ≥ 40 pairs incl. one per case listed in §12 M2 scope | | | |
| M2-15 | M2 | Visibility audit tags segment provenance and exempts `self` segments | | | |
| M2-16 | M2 | Validate cond. 4 rejects its planted bad task | | | |
| M2-17 | M2 | Validate cond. 5 rejects its planted bad task | | | |
| M2-18 | M2 | Validate cond. 6 rejects its planted bad task | | | |
| M2-19 | M2 | Validate cond. 6b rejects its planted bad task | | | |
| M2-20 | M2 | Validate cond. 6c rejects its planted bad task | | | |
| M2-21 | M2 | Validate cond. 6d rejects its planted bad task | | | |
| M2-22 | M2 | Validate cond. 6e rejects its planted bad task | | | |
| M2-23 | M2 | Validate cond. 6f rejects its planted bad task | | | |
| M2-24 | M2 | Validate cond. 7 rejects its planted bad task | | | |
| M2-25 | M2 | Validate cond. 8 rejects its planted bad task | | | |
| M2-26 | M2 | Cond. 2 and cond. 3 bad tasks exist with expected rejection recorded in `fixtures/expected.json` | | | |
| M2-27 | M2 | SYNTHETIC/live record mixing throws | | | |
| M2-28 | M2 | `fixtures/expected.json` values follow from the fixtures | | | |
| M2-29 | M2 | No network/provider import reachable from the `selftest`/`demo` path | | | |

## M3 — Dev prototypes T01, T02 and the recipe

| # | Milestone | Item | Inspected file:line | Pass/fail | Reviewer callsign |
|---|---|---|---|---|---|
| M3-1 | M3 | T01/T02 `task.json` parse (`node -e`) and match the M1 zod shape by inspection | tasks/dev/T01/task.json:1-127, tasks/dev/T02/task.json:1-124 vs src/core/contracts.ts:111-250 (ed2d994), ids.ts:18-39,150-161 (node -e JSON.parse OK; slot routing, cross_module_contract in transfer, do_not_touch entity, slotAssignment.input prefix, summaries <=500 by inspection) | pass | 0859_Claude_Opus55_Sub_S42RevM3 |
| M3-2 | M3 | All eight trap kinds present once (T01, T02) | T01/task.json:29,42,56,68,80,92,104,116; T02/task.json:29,41,53,65,77,89,101,113 (each of the 8 kinds once) | pass | 0859_Claude_Opus55_Sub_S42RevM3 |
| M3-3 | M3 | Slot counts 2/2/2/2 (T01, T02) | T01/task.json:30-117 (R1,R4 local_A; R5,R7 local_B; R6,R8 transfer_A_to_B; R2,R3 transfer_B_to_A); T02/task.json:30-114 (R1,R7 local_A; R3,R5 local_B; R6,R8 transfer_A_to_B; R2,R4 transfer_B_to_A) | pass | 0859_Claude_Opus55_Sub_S42RevM3 |
| M3-4 | M3 | `task.json` records slot-assignment hash input `<taskId>:<seed>`, its sha256 (computed with `sha256sum`), and the assignment per `docs/TASK-RECIPE.md` | T01/task.json:21-25, T02/task.json:21-25; docs/TASK-RECIPE.md:45-92 (reviewer recomputed `printf %s T0n:1 | sha256sum` = recorded digests; re-derived Fisher-Yates + T01 R6 fix-up independently; matches recorded slots) | pass | 0859_Claude_Opus55_Sub_S42RevM3 |
| M3-5 | M3 | Secret anchors absent from `repo/` (grep) | T01/repo/** and T02/repo/** incl. tests/smoke.test.ts: grep -rnF and find|grep -F on every secret alternate; no hit in contents, names or paths | pass | 0859_Claude_Opus55_Sub_S42RevM3 |
| M3-6 | M3 | Every anchor present in `spec.md` and in its named slice | T01/spec.md:12,14,18,24,28,30,34,38 (slices task.json:18-19); T02/spec.md:10,12,18,22,24,28,32,36 (slices task.json:18-19); entity anchors present as repo/src/contracts.ts, repo/src/types.ts | pass | 0859_Claude_Opus55_Sub_S42RevM3 |
| M3-7 | M3 | Slices partition the spec exactly | T01/spec.md:1,10,16,20,26,32,36 = A 4 + B 3 headings (task.json:18-19); T02/spec.md:1,8,14,20,26,34 = A 3 + B 3 (task.json:18-19); exact cover, no overlap | pass | 0859_Claude_Opus55_Sub_S42RevM3 |
| M3-8 | M3 | Cond. 6b: each secret anchor has an unmarked-clause occurrence in its slice and in `spec.md` | T01/spec.md:12,14 (clause before `;`),18,28,30,34,38; T02/spec.md:10,18,22,24 (clause before `;`),28,32,36: no 4.5 marker or n't/cannot in clause, heading or list intro (grep -iw over both specs: markers only at T01:14 second clause, T01:40, T02:30, T02:38) | pass | 0859_Claude_Opus55_Sub_S42RevM3 |
| M3-9 | M3 | Cond. 6c: every decoy occurrence in `spec.md` is in a marked clause (T01 R5 decoy marked in spec, otherwise only the starter default) | T01/spec.md:14 (240 after `;`, wrong), :40 (9000, old/obsolete), RetryScheduled absent from spec; 9000 otherwise only repo/src/contracts.ts:35; T02/spec.md:30 (10000, wrong), :38 (290, old/obsolete) | pass | 0859_Claude_Opus55_Sub_S42RevM3 |
| M3-10 | M3 | Cond. 6d: each `do_not_touch` entity has a positive `entity_cue` clause in its slice and in `spec.md` | T01/spec.md:24 (`src/contracts.ts` stays unchanged, slice B, no marker/not/never); T02/spec.md:12 (`src/types.ts` stays unchanged, slice A) | pass | 0859_Claude_Opus55_Sub_S42RevM3 |
| M3-11 | M3 | Cond. 6e: `brief.md` holds no secret anchor, decoy or entity+cue clause | T01/brief.md:1-6 = spec.md:3-8; T02/brief.md:1-4 = spec.md:3-6 (verbatim Objective body; no secret alternate, decoy or entity anchor). Non-blocking wording note on T02 brief.md:3 "only when" in review report | pass | 0859_Claude_Opus55_Sub_S42RevM3 |
| M3-12 | M3 | Cond. 6f: decoys distinctive (≥ 3 digits or ≥ 4 chars), distinct from anchors and each other, not inside an anchor | T01/task.json:62,74,86 (RetryScheduled, 240, 9000); T02/task.json:71,83 (10000, 290): >=3 digits or >=4 chars, distinct, not inside any anchor | pass | 0859_Claude_Opus55_Sub_S42RevM3 |
| M3-13 | M3 | Every slice section starts with its own heading | T01/spec.md:1,10,16,20,26,32,36; T02/spec.md:1,8,14,20,26,34 (first line a heading; all sections top-level `# `; headings marker-free) | pass | 0859_Claude_Opus55_Sub_S42RevM3 |
| M3-14 | M3 | Each mutant's diff touches only its requirement's code path and not C0 | T01 mutants R1-R4 vs oracle/src/schedule.ts:31,34,40,24; R5,R6,R8 vs oracle/src/dispatch.ts:16,29,25; R7 vs repo/src/contracts.ts:35. T02 mutants R1,R2,R4 vs oracle/src/normalize.ts:33,37,23; R3,R5,R6,R8 vs oracle/src/invoice.ts:21-22+40,16,35,24; R7 vs repo/src/types.ts:54 (diffed; one path each, no C0 path; matrix traced against hidden/*.test.ts) | pass | 0859_Claude_Opus55_Sub_S42RevM3 |
| M3-15 | M3 | Oracle visibly satisfies every R group | T01/oracle/src/schedule.ts:22-41, dispatch.ts:15-31 vs hidden/_c0.ts:75-115, R1-R8.test.ts; T02/oracle/src/normalize.ts:20-45, invoice.ts:15-44 vs hidden/_c0.ts:77-106, R1-R8.test.ts (hand-traced; starter fails C0 in both; alternates A1/A2 also traced) | pass | 0859_Claude_Opus55_Sub_S42RevM3 |
| M3-16 | M3 | Demo-script requirements exist (T01 R5 `retryCeiling: 13000` vs decoy `9000`; T01 transfer-slot requirement named for the demo) | T01/spec.md:38,40 + task.json:78-89 (R5 late_clarification `retryCeiling: 13000`, decoy 9000 marked); task.json:91-100 (R6 transfer_A_to_B, demo transfer requirement) | pass | 0859_Claude_Opus55_Sub_S42RevM3 |

## M4 — Worker loop, policies, channels, budget, providers, sandbox/grader sources

| # | Milestone | Item | Inspected file:line | Pass/fail | Reviewer callsign |
|---|---|---|---|---|---|
| M4-1 | M4 | Every `.ts` file passes `node --check` | | | |
| M4-2 | M4 | `docs/SANDBOX.md` lists read and write roots per policy and phase | | | |
| M4-3 | M4 | `docs/SANDBOX.md` states no evaluator/credential/home-dir/Docker-socket mount and no shell tool | | | |
| M4-4 | M4 | Tool layer refuses paths outside the worker's view, traversal, symlinks and out-of-module writes, and logs them | | | |
| M4-5 | M4 | Implementer and context workers have no tool or prompt path to unseen spec text | | | |
| M4-6 | M4 | Phase-2 workspaces are disjoint | | | |
| M4-7 | M4 | Every policy's initial view (single, planner, implementer, context A/B, spec-blind) includes `brief.md` | | | |
| M4-8 | M4 | Every provider dispatch site calls `budget.reserve()` first | | | |
| M4-9 | M4 | Reservation formula = D7 | | | |
| M4-10 | M4 | 90k request ceiling enforced | | | |
| M4-11 | M4 | Retry ≤ 1 per call and reserved | | | |
| M4-12 | M4 | Unknown usage books the reservation and halts the run | | | |
| M4-13 | M4 | Reservation overrun stops the tranche | | | |
| M4-14 | M4 | `anthropic` adapter refuses unless `HLS_LIVE_ENABLED` and a valid approval are present | | | |
| M4-15 | M4 | `anthropic` adapter has SDK retries off and reads the key only from `ANTHROPIC_API_KEY` | | | |
| M4-16 | M4 | Docker argv contains every D17 flag and the owner labels | | | |
| M4-17 | M4 | Candidate container mounts/Dockerfile include no hidden test, predicate, oracle or mutant path | | | |
| M4-18 | M4 | Grader verdict comes only from the grader container's results file, never candidate stdout | | | |
| M4-19 | M4 | Relay enforces size/time limits and fails the invocation on protocol noise, exit or timeout | | | |

## M5 — Store, verify, statistics, report, CLI plan/run/prereg/heldout, viewer

| # | Milestone | Item | Inspected file:line | Pass/fail | Reviewer callsign |
|---|---|---|---|---|---|
| M5-1 | M5 | Every `.ts` file passes `node --check` (`.tsx` by inspection only) | | | |
| M5-2 | M5 | McNemar exact two-sided yields 14/64 for (5,1) by reviewer arithmetic | | | |
| M5-3 | M5 | Bootstrap resamples tasks keeping all cells/repeats, with a fixed seed | | | |
| M5-4 | M5 | Zero denominators render "undefined" | | | |
| M5-5 | M5 | Hash chain covers every event and the footer | | | |
| M5-6 | M5 | `run --live` refuses with no approval | | | |
| M5-7 | M5 | `run --live` refuses a mismatched approval (tranche/model/cells/tasks/repeats/maxTokens/maxUsd) | | | |
| M5-8 | M5 | `run --live` refuses an expired approval | | | |
| M5-9 | M5 | `run --live` refuses a missing named approver or owner decision reference | | | |
| M5-10 | M5 | `run --live` refuses when `HLS_LIVE_ENABLED` is unset | | | |
| M5-11 | M5 | `run --live` refuses when spend + bound > `maxUsd` | | | |
| M5-12 | M5 | `plan` constants and code path give T0 6 / T1 90 / T2 216 and bounds from the price table | | | |
| M5-13 | M5 | Viewer escapes text (no `dangerouslySetInnerHTML` with data); source inspection only | | | |

## M6 — Dev corpus T03–T06, custodian packet, sealed folder, final docs

| # | Milestone | Item | Inspected file:line | Pass/fail | Reviewer callsign |
|---|---|---|---|---|---|
| M6-1 | M6 | Every `.ts` file passes `node --check` | | | |
| M6-2 | M6 | T03–T06 meet every M3 per-task item (M3-1 … M3-15) | | | |
| M6-3 | M6 | Dev strata 2 feature / 2 refactor / 2 bugfix | | | |
| M6-4 | M6 | 48 dev requirements with unique anchors across all six tasks | | | |
| M6-5 | M6 | Conditions 6b–6f hold for T03–T06 by reading | | | |
| M6-6 | M6 | Custodian packet contains no held-out content | | | |
| M6-7 | M6 | Custodian packet states builder lineage may not author held-out data | | | |
| M6-8 | M6 | Custodian packet states the three custodian phases with timing relative to G-I, T1 and the recipe freeze | | | |
| M6-9 | M6 | README lists exactly what has and has not run | | | |
