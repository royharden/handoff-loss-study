# Deferred validation

Every check that needs execution (install, type-check, lint, tests, builds, containers, live calls) and
therefore could not run during Dirty Mode construction. **None of these has run; none is reported as
passed.** Each later milestone appends its rows. Owner-question numbers (Q#) refer to the owner decision
request kept outside this repo: Q1 spend/model, Q2 independent custodian + rights, Q3 Docker, Q4
publication, Q5 calibration-failure policy, Q6 close Dirty Mode / start validation.

Classes: **K** keyless local check (no spend, needs an install), **D** Docker check, **L** live (spend).

| ID | Class | What | Why deferred | Exact later command | Needs owner? (Q#) |
|---|---|---|---|---|---|
| DV-M1-01 | K | Dependency versions pinned in `package.json` exist and resolve together (zod 3.24.2, typescript 5.8.3, tsx 4.19.2, vitest 3.1.1, eslint 9.24.0, @eslint/js 9.24.0, typescript-eslint 8.29.0, @types/node 22.14.0, react / react-dom 18.3.1, @types/react 18.3.18, @types/react-dom 18.3.5, vite 6.2.6, @vitejs/plugin-react 4.3.4, @anthropic-ai/sdk 0.39.0). **Versions are unverified until install.** | Dirty Mode: no installs, no network | `npm install --ignore-scripts` (first install creates `package-lock.json`; commit it), then `npm ci` | Yes, Q6 (and network) |
| DV-M1-02 | K | Strict type-check of `src/`, `tests/`, configs (incl. `erasableSyntaxOnly`, `verbatimModuleSyntax`, `noUncheckedIndexedAccess`; zod 3 `discriminatedUnion` members are plain objects) | No `tsc` in Dirty Mode | `npm run typecheck` | Yes, Q6 |
| DV-M1-03 | K | ESLint flat config loads; rules: no enum/namespace/parameter properties, `consistent-type-imports`, no network/provider/process import or `fetch` in `src/core` | No eslint in Dirty Mode | `npm run lint` | Yes, Q6 |
| DV-M1-04 | K | Canonical JSON and hash unit tests: key order, -0 / NaN / ±Infinity / undefined / sparse / cycle / non-plain rejection, `parseCanonical`, `sha256("abc") = ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad`, empty-string vector, chain links; contract smoke tests (D7 reservation, D6 allowance, Usage, fixed brief, run ids, edition mixing, approval) | No vitest in Dirty Mode | `npx vitest run tests/core.test.ts` | Yes, Q6 |
| DV-M1-05 | K | `vitest.config.ts` loads and picks up `tests/**/*.test.ts` only | No vitest in Dirty Mode | `npm test` | Yes, Q6 |
| DV-M1-06 | K | `npm run` aliases resolve to working `cli/hls.ts` subcommands (`demo`, `selftest`, `fixture`, `validate tasks/dev`, `check <name>`, `verify`, `plan`, `run`, `report`). `cli/hls.ts` does not exist in M1; M2/M4/M5 add the subcommands (contract in `docs/DESIGN.md` §4) | CLI not yet written; no tsx in Dirty Mode | `npm run hls -- --help`, then each alias after M5 | Yes, Q6 |
| DV-M1-07 | K | Viewer build script (`vite build --config viewer/vite.config.ts`) — config file is written in M5 | Viewer not yet written; no vite in Dirty Mode | `npm run build:viewer` | Yes, Q6 |
| DV-M1-08 | K | `node --check` was run on Node v24.18.0 (type stripping on by default). The declared engine is Node ≥ 22; on Node 22 releases without default type stripping, `node --check file.ts` may fail as a tooling limit, not a code defect. Product execution uses `tsx`, not Node type stripping | Static-only check environment | `node --version && npm run typecheck` on the validation machine | Yes, Q6 |
| DV-M1-09 | K | Zod refinements behave as designed at the pinned version: refinements on dirty input (e.g. Reservation formula guard), `superRefine` on `discriminatedUnion` (HandoffSchema, RunRecordSchema), recursive `JsonValueSchema` | Needs runtime | `npx vitest run tests/core.test.ts` plus M2 contract tests | Yes, Q6 |
| DV-M3-01 | K | Admission gate on the dev prototypes T01/T02: oracle (`repo ⊕ oracle`) passes C0 and R1..R8; untouched starter fails all 9; each mutant `repo ⊕ oracle ⊕ mutants/R<n>` fails exactly its own group (no declared couplings; `mutants/MUTANTS.md` gives the expected matrix); pure-data conds 4–8 and 6b–6f by product code (builder checked them by grep/reading only) | No vitest/tsx in Dirty Mode; `src/tasks/validate.ts` (M2) never run | `npm run validate:dev` (then `npx tsx cli/hls.ts validate tasks/dev/T01 --execute`, same for T02) | Yes, Q6 |
| DV-M3-02 | K | Alternates `alternates/A1`, `alternates/A2` of T01 and T02 pass all 9 groups | No vitest in Dirty Mode | `npm run check:alternates` | Yes, Q6 |
| DV-M3-03 | K | `hidden/_rpc.ts`: in-process fallback under `LocalUnsafeSandbox` imports `<snapshot root>/<modulePath>` via `import.meta.url`, JSON-round-trips args/results, rejects missing functions with `CandidateCallError`; the D17 grader (M4) installs `globalThis.__hlsCallCandidate` with the same signature before hidden groups load | Helper never executed; grader client not yet written (M4) | `npm run validate:dev` (local path); M4 `npm run check:containment` (grader path) | Yes, Q6 (Q3 for the grader path) |
| DV-M3-04 | K | Slot assignment re-derived by product code from `slotAssignment.input` per `docs/TASK-RECIPE.md#slot-assignment v1` equals the recorded slots (T01: R1 local_A, R2/R3 transfer_B_to_A, R4 local_A, R5/R7 local_B, R6/R8 transfer_A_to_B; T02: R1/R7 local_A, R2/R4 transfer_B_to_A, R3/R5 local_B, R6/R8 transfer_A_to_B). Builder computed the digests with `sha256sum` and the shuffle by hand and by bash arithmetic only | No product code for the rule exists yet (no module owns it in M2's scope) | add the rule to `src/tasks/validate.ts`, then `npm run validate:dev` | Yes, Q6 |
| DV-M3-05 | K | `static.json` protected-file hashes (T01 `src/contracts.ts` 41aaaccd…241174, T02 `src/types.ts` bccd5a77…c37f7a) are sha256 of the LF bytes; they hold only if `.gitattributes` keeps `tasks/**` LF on checkout (this machine has `core.autocrlf=true`). Recompute after a fresh clone | Hash computed with `sha256sum` on the working copy before commit | `git ls-files --eol tasks/dev && sha256sum tasks/dev/T01/repo/src/contracts.ts tasks/dev/T02/repo/src/types.ts` | No |
| DV-M3-06 | K | Static-check attribution: protected-file hash mismatch fails the `do_not_touch` group (R7 in T01/T02) with `static_check`; a forbidden identifier fails every group. Proposed in `docs/TASK-RECIPE.md` §8; not yet implemented by M2/M4 | Design proposal; owner modules (M2 validate, M4 grader) decide | review `src/tasks/validate.ts` / grader against TASK-RECIPE §8, then `npm run validate:dev` | No |
| DV-M3-07 | K | Verbatim-forward of each source slice scores `evidence` on every eligible edge of T01/T02 (gate conds 6b–6d hold by the builder's grep/clause reading in M3) | Matcher never executed | `npm run fixture` / `hls selftest` (M2 DV row for verbatim-forward) | Yes, Q6 |
| DV-M3-08 | K | Public smoke tests (`repo/tests/smoke.test.ts`) pass on the oracle and both alternates (they may fail on the starter by design) and reveal no requirement | No vitest in Dirty Mode | `npx vitest run --root <repo ⊕ oracle tree>` via `hls validate --execute` | Yes, Q6 |
| DV-M3-09 | K | Task source type-checks under strict TS when the candidate container compiles it (tasks/ is excluded from the root typecheck); the starters need no lockfile but the candidate image must provide vitest for the public tests | No tsc in Dirty Mode; candidate image is M4 | M4 image build, then `tsc --noEmit` inside the candidate image on `repo ⊕ oracle` | Yes, Q3/Q6 |
| DV-M3-10 | K | G-A condition 1: two complete dev prototypes meet gate conditions 1–8 by execution | Needs DV-M3-01 | `npm run validate:dev` | Yes, Q2/Q6 |
| DV-M2-01 | K | `hls selftest` passes: 63 builder carry pairs, 18 scripted fixtures vs `fixtures/expected.json`, control task T80 + 12 planted bad tasks (pure-data conditions), verbatim-forward = `evidence` for every requirement of T80 and of every `tasks/dev/*` task present, SYNTHETIC/LIVE mixing throws, live provider refused, null provider finishes. Record the printed matcher source sha256 (not yet frozen; D19b freeze is later) | No tsx in Dirty Mode; nothing has run | `npm run selftest` | Yes, Q6 |
| DV-M2-02 | K | Builder matcher self-test pairs (D19a mechanics only; `check:carry` stays reserved for the 80 custodian pairs) | No tsx | `npm run check:carry-selftest` | Yes, Q6 |
| DV-M2-03 | K | Scripted fixtures: each of the 18 §12 M2 paths scores to its hand-traced expectation | No tsx | `npm run fixture` | Yes, Q6 |
| DV-M2-04 | K | Gate execution conditions 1–3 on authored code: control T80 admitted; bad task T91 (`c2-untouched-passes-a-group`) rejected by cond. 2 only; T92 (`c3-mutant-breaks-two-groups`) rejected by cond. 3 only; `validate-report.json` holds the coupling matrix. The ten pure-data bad tasks have no hidden/oracle/mutants and fail 1–3 for missing directories when executed (recorded in `expected.json`) | Needs vitest (install) and process execution | `npx tsx cli/hls.ts validate fixtures/control-task/T80 --execute` (expect exit 0) and `npx tsx cli/hls.ts validate fixtures/bad-tasks/c2-untouched-passes-a-group --execute` / `.../c3-mutant-breaks-two-groups --execute` (expect exit 1, failing 2 resp. 3 only) | Yes, Q6 |
| DV-M2-05 | K | `LocalUnsafeSandbox` mechanics: temp dirs under `.hls-tmp/local-sandbox/` resolve `vitest` and `../src/*` from the project; vitest 3.1.1 CLI entry is `node_modules/vitest/vitest.mjs`; `run hidden/<G>.test.ts --root <dir>` exit code 0 = pass; timeout kill works on Windows and Linux; temp dir removed; minimal env (PATH only). Refuses `anthropic` and `model_output` (code read) | Never executed; spawns processes | the DV-M2-04 commands, then `ls .hls-tmp/local-sandbox` (expect empty) | Yes, Q6 |
| DV-M2-06 | K | Unit tests `tests/{evidence,classify,visibility,validate,selftest}.test.ts` | No vitest | `npx vitest run tests/evidence.test.ts tests/classify.test.ts tests/visibility.test.ts tests/validate.test.ts tests/selftest.test.ts` | Yes, Q6 |
| DV-M2-07 | K | Visibility audit fixtures (`visibility-leak` -> leak + exclusion; `self-originated-anchor` -> logged, not a leak) | No tsx | `npm run check:visibility` | Yes, Q6 |
| DV-M2-08 | K | Keyless demo prints SYNTHETIC rows (role/free_summary R5 failed_without_lexical_evidence; role/fixed_brief R5 failed_with_evidence; context/fixed_brief R6 attribution_unknown) and constructs only null/scripted providers | No tsx | `npm run demo` | Yes, Q6 |
| DV-M2-09 | K | Verbatim forward = `evidence` on every eligible edge of T01/T02 (M3) and T03–T06 (M6): covered by `hls selftest` once those tasks exist; also `hls validate tasks/dev` pure conditions | Tasks written in parallel/later; no tsx | `npm run selftest` and `npm run validate:dev` | Yes, Q6 |
| DV-M2-10 | K | Strict type-check and lint of M2 sources: zod 3 `z.record(enum, …)` partial typing, `TaskSchema.innerType()`, `matchAll` index typing, literal inference through `Promise.resolve`, the new eslint keyless-path `no-restricted-imports` block (incl. `patterns` for `@anthropic-ai/sdk/*` in `src/core`) | No tsc/eslint | `npm run typecheck && npm run lint` | Yes, Q6 |
| DV-M2-11 | K | `.gitattributes` (`* text=auto eol=lf`) keeps task files LF: `git ls-files --eol fixtures tasks` shows `i/lf w/lf`; T80 hidden R7 hash `808e8d34…b1b8` matches `src/contracts.ts` on Windows and Linux checkouts | Needs a fresh checkout on both OSes | `git ls-files --eol fixtures` then DV-M2-04 | Yes, Q6 |
| DV-M2-12 | K | `JsonValueSchema` now rejects `-0` (M1 review note 4); recursive union with a refinement parses tool inputs as before | No vitest | `npx vitest run tests/core.test.ts` (case "JsonValueSchema (M2: -0 rejected …)") | Yes, Q6 |
| DV-M2-13 | K | CLI entry detection (`invokedDirectly`, case-insensitive on Windows) runs `main` under `tsx cli/hls.ts` and does not run it when tests import `main` | No tsx | `npm run hls -- --help` (prints help, exit 0) | Yes, Q6 |
| DV-M2-14 | K | Gate execution applies the trusted-CLI protected-file check (static.json sha256 mismatch or missing file fails every `do_not_touch` group with `static_check`; `applyProtectedFileCheck` in `src/tasks/validate.ts`). Forbidden identifiers (TypeScript compiler API, D17) are NOT yet checked by the gate: M4 adds them and must route their `static_check` failures through the same function | Never executed; compiler-API check is M4 | `npx vitest run tests/validate.test.ts`, then DV-M2-04 and `npm run validate:dev` (T01/T02 R7 mutants fail R7 with `static_check`) | Yes, Q6 |

## M6 dev corpus and custody sources

| ID | Class | What | Why deferred | Exact later command | Needs owner? |
|---|---|---|---|---|---|
| DV-M6-01 | K | T03–T06 oracle, untouched, isolated mutant matrix, protected file checks, pure-data gate and strict candidate types | Source inspection does not execute candidate code | `npx tsx cli/hls.ts validate tasks/dev --execute --report validate-report.json` | Q6 |
| DV-M6-02 | K | All six dev tasks' A1/A2 alternate solutions pass all groups | No tests in Dirty Mode | `npm run check:alternates` | Q6 |
| DV-M6-03 | K | Product matcher verbatim-forward and exact seed/hash slot assignment agree for all 48 requirements | Source-only checks and independent SHA-256 calculations do not execute product matcher | `npm run selftest` and `npm run validate:dev` | Q6 |
| DV-M6-04 | K | Six-cell mock walkthrough on T01, full store/verify/report/viewer chain and fixture expectations | No mock/application execution in Dirty Mode | `npx tsx cli/hls.ts demo --provider mock` then `npm run verify -- results/demo` | Q6 |
| DV-M6-05 | K | Custodian appointment, original synthetic MIT rights, two-dev-task expected-answer spot-check | Builder cannot supply independent labels or appoint its own child | Roy appointment and rights record, then appointed custodian follows `docs/CUSTODIAN-PACKET.md` | Q2 |
| DV-M6-06 | L | Independent conformance, calibration and held-out study; 12 tasks authored only after recipe freeze | No custodian, live access or execution grant; all gates remain pending | Custodian packet phases 1–3; freeze matcher before sealed evaluation, recipe after G-C, prereg before T2 | Q1/Q2/Q3/Q5/Q6 |

T03–T06 are public development sources, with a shared projection scaffold and deliberately isolated policy helpers. Their oracle/test agreement has not been proved by execution. Domain variety and guessability need calibration; no held-out or measured claim follows from construction.


## M4 runner, providers and sandbox

Construction is source/static only. No dependency install, typecheck, lint, test, model call, image build,
container, application or public smoke-test execution has occurred for this package. Recorded-shape
Anthropic fixtures are hand-authored and unverified against the live API. Provisional prices are not
an approval-day price check. No approval files or credentials are supplied.

| ID | Later command/action | Required evidence |
| --- | --- | --- |
| DV-M4-01 | `npm run typecheck && npm run lint` | Strict interface/type and lint results after authorised install |
| DV-M4-02 | `npm test -- tests/tools.test.ts tests/budget.test.ts tests/ledger.test.ts tests/anthropic-mapping.test.ts tests/channels.test.ts tests/policies.test.ts` | Closed tools, all six policies, byte reservations, retries and unknown/overrun stops |
| DV-M4-03 | `npm run check:budget` | Reservation bound calibration, cached input/replay/retry accounting; tranche stop on overrun |
| DV-M4-04 | `npm run check:containment` | Real traversal/symlink/peer-root/hidden-file refusal and visibility audit |
| DV-M4-05 | With explicit Docker consent and registered agent-ports owner, build the three `docker/*.Dockerfile` files and pin resulting image digests | No candidate hidden mounts; non-root, offline, read-only/resource flags; dependencies and image assumptions verified |
| DV-M4-06 | Authorised D-class two-container attacks: stdout spoofing/noise/oversize, hanging exports, process exit, fork/memory abuse, hidden-path/credential/socket reads | Each affected group fails; grader-only result-file authority; owner-labelled cleanup verified |
| DV-M4-07 | Authorised Docker public smoke tests | Public tests run without hidden material; summary only, no unknown-source code echo |
| DV-M4-08 | Owner-approved live mapping/price check (Q1) | Signed decision verifier, durable atomic spend port, exact pinned/observed model, API shape, usage and approval-day prices |
| DV-M4-09 | SYNTHETIC six-cell mock run and cap-hit/crash snapshot regression | Events sequential; both context handoffs frozen before exchange; cap-hit grades final edits; no fabricated grades |

The portable runner accepts explicit ports for public tests, Docker ownership/consent, Roy decision
verification, and durable tranche spending. Missing ports fail closed; their real operational wiring and
cross-process behavior remain unverified. `reservation_overrun`, `usage_unknown` and integrity stops
must stop the calling tranche; a caller must not continue dispatching later runs after these results.


## M5 records, analysis, viewer and stable custody

Construction is source/static only. No install, test, build, app execution, Docker, live dispatch,
credential read, prereg freeze execution or held-out content read occurred. Syntax checks are not
TypeScript typechecking. Review of TSX is source inspection only. Source tests are written, never run.

| ID | Later command / action | Current status |
| --- | --- | --- |
| M5-K1 | `npm run typecheck` and `npm run lint` | DEFERRED |
| M5-K2 | `npm run check:stats`; `npm test -- tests/stats.test.ts` | DEFERRED |
| M5-K3 | `npm test -- tests/store.test.ts tests/verify.test.ts tests/approvals.test.ts tests/prereg.test.ts tests/live-state.test.ts tests/carry-custody.test.ts` | DEFERRED |
| M5-K4 | `npm run demo -- --provider mock`; `npm run verify -- results/demo` | DEFERRED |
| M5-K5 | One-byte event/footer/evidence/snapshot tamper must fail verification; restore from test-owned copies | DEFERRED |
| M5-K6 | `npm run report -- results/demo`; inspect report JSON/Markdown/HTML and all zero denominators | DEFERRED |
| M5-K7 | `npm run plan -- --tranche T0`; repeat T1/T2 and inspect 6/90/216 counts and price bound | DEFERRED |
| M5-K8 | `npm run study -- --live` must refuse nonzero without approval and make no dispatch | DEFERRED |
| M5-K9 | `npm run build`; open viewer and malicious-text/mixed-edition report fixtures; text must remain escaped | DEFERRED |
| M5-K10 | Crash/concurrent/stale locks, app/approval/tranche caps, unsettled/failed requests and corruption checks for trusted LiveStateJournal | DEFERRED |
| M5-K11 | Sealed carry stable claim: two receipt directories, changed matcher/decision with same sealed digest, loader failure/interruption before results, missing authority and receipt-write failure; loader reached at most once | DEFERRED, metadata-only regression source |
| M5-L1 | Appoint custodian; actual G-A/G-I evidence; approve prices/model/spend; supply owner consent/Docker ports | PENDING OWNER, no fabricated receipts |
| M5-L2 | T0 calibration then T1; actual G-C, allowance freeze, manifest import and prereg freeze | PENDING previous gates |
| M5-L3 | Authenticated custodian loader, approved image digests/lane and once-only T2 | PENDING previous gates |

Missing operator activation ports are intentional fail-closed runtime dependencies. All keyless paths,
store/statistics/report/viewer sources are present; actual type/runtime correctness remains unverified.
Run counts 6/90/216 exclude zero-model-call null/oracle controls, which are graded and stored separately.
Gzipped transcript verification also rejects a changed uncompressed companion. The deferred spend
tests cover unsettled/failed requests, duplicate settlements, corruption, missing/malformed authority,
app-wide sums across different approvals/tranches, changed-output T2 replay after start/burn, changed
approval/prereg heldout reuse, stale locks and actual overrun charges. No regression has executed.
Trusted operator stateRoot provisioning and persistence/recovery must be verified before activation;
there is no report-folder fallback and no real state was created during construction.

M5-R2 source extends the same stable journal with exclusive, fsynced sealed-digest claims before
`loadSealedCarryPairs`. Completion, conformance stop, loader/validation/write failure and a crash
with only the start all retain consumption. Carry finish entries use closed metadata outcome codes;
raw custodian errors, pairs, labels and evaluation rows never enter operator state. The new command
regressions narrowly replace the public-pair parser with a metadata-only stub and supply no sealed
content or gold labels; they test custody, not semantic conformance. New matcher editions need new
custodian-authored sealed digests. Actual state provisioning, real loader authentication, filesystem
durability/concurrency and custodian G-I evaluation remain deferred. No test has executed.
