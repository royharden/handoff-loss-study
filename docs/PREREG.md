# Preregistration

M5 source exists for `hls prereg freeze`; it has never executed. **Not frozen.** Nothing has been measured.

## What the freeze hashes (D24)

`PreregManifestSchema` in `src/core/contracts.ts`: hypotheses H1–H4 and their contrasts, held-out allowance
C (with the P75 input and whether the 150k ceiling bound), reservation ratio r, exclusion rules, analysis
code hash, prompts hash, matcher hash, image digests (episode, candidate, grader), model id, sampling,
price table, held-out manifest hash, the seeded balanced run order, bootstrap settings. Later changes are
appended amendments, each reported as a deviation.

## Tranches (D10a)

- T0 smoke: 1 dev task × 6 cells × 1 = 6 runs at `C_dev = 150,000`.
- T1 pilot: 6 dev tasks × 6 cells × 2 repeats = 72 runs + 6 tasks × 3 spec-blind = 18; total 90.
- T2 held-out: 12 tasks × 6 cells × 3 repeats = 216 runs, once.

## Gates

G-I (instrument, before any live call), G-C (calibration, after T1, before T2): see plan of record §6.
Each tranche needs its own owner approval. The total app ceiling is $40; no live tranche or
private access is approved, and $0 has been spent.

## Commands and immutable pins

`hls plan --tranche T0|T1|T2 [--prices <file>] [--max-usd <cap>] [--max-tokens <C>]`
prints only a dry-run plan. The balanced order uses seed 42001 by default; each repeat shuffles tasks
and cells in deterministic blocks. T1 appends the eighteen dev-only spec-blind probes. All bounds
charge every pooled token at the largest price-table rate. The bundled display prices/model are
provisional and explicitly unverified. They are not a live approval or a current-pricing claim.
T2's displayed 150,000-token default is provisional; execution must match the actual frozen C.

`hls heldout import --manifest <custodian-manifest.json>` (or a positional manifest filename)
copies validated manifest metadata only. It refuses missing task namespaces, unsafe paths and existing
destinations. No sealed task, answer, expected output or carry-label file is opened by this command.
Before G-I a carry-only instrument manifest is permitted. Once task files appear, all twelve task
namespaces are required, and prereg freeze requires twelve tasks. A later manifest is a new immutable
edition; the importer never overwrites the existing file.

`hls prereg freeze --input <complete-manifest.json> --dev-results <verified T1 directory>` validates
the twelve real T1 single-run totals against the supplied nearest-rank P75 and allowance,
validates `PreregManifestSchema`, recomputes
analysis/prompt/matcher source hashes, binds the imported held-out manifest and generated 216-run
order, and writes `prereg.manifest.json` with exclusive-create semantics. An existing freeze cannot
be overwritten. It checks the allowance formula, 150k ceiling, ceiling-binds flag, four contrasts,
bootstrap seed/draw count and model/price-table identity. Source hashes use sorted repo-relative
paths and SHA-256 file bytes; symlinks are refused. Initial freezes cannot contain retrospective
amendments. A hash is a pin, not consent or evidence that validation has executed.

Later amendments are append-only entries in the manifest's amendment list and must be published as
deviations with the prior freeze hash, timestamp and reason; they require a new immutable manifest
edition rather than editing the original file. The first-freeze command deliberately cannot repair
or replace a freeze. No amendment, approval or freeze has been authored in this construction run.

## Activation and stop rules

Live dispatch needs the exact approval described in `approvals/README.md`, hard switch `1`, actual
G-A/G-I PASS receipts pinned to current code, and G-C for T2. A runtime host injects
`LiveActivationPort` into `studyMain`: it verifies Roy's actual signed decision, confirms Docker
consent and agent-ports ownership, supplies immutable image names and a stable operator-owned `stateRoot`, and for T2 supplies a custodian
loader that authenticates manifest-listed files. There is no default consent verifier. An ordinary
CLI invocation fails closed when that port is absent. Operator-owned activation is still deferred;
construction review cannot create a gate PASS. This is not a new cryptographic signing ceremony.

The trusted host supplies one absolute `stateRoot` outside the product repo for the entire app,
independent of `--out`, work roots, tranche and approval. It provisions `live-state.jsonl` once via
`initializeLiveState` (operator API only; never called by the CLI). Missing roots/journals, malformed
headers/chains, symlinks, exhausted caps and concurrent/stale locks fail closed. The journal is never
automatically created, cleared, replaced, or reconstructed from result folders. The host must preserve
this authority across invocations and grant changes; choosing a fresh state root is not reconciliation.
No real state has been provisioned in this construction run.

`hls check carry --public <custodian-public.json> --freeze <pre-opening-freeze.json>
--receipt-dir <outer-shell directory>` uses that same injected, pre-provisioned `stateRoot`, even
though it makes no provider call. After verifying the freeze/public pins, it atomically claims the
**sealed-pair SHA-256 alone** in the fsynced operator journal before the custodian loader runs.
Matcher/public-pair hashes and the receipt destination are recorded metadata, not reset keys. A new
matcher, public set, decision reference or receipt directory cannot reopen the same sealed digest;
a new matcher edition requires new independent custodian sealed pairs. Missing authority refuses;
the command never initializes state or reconstructs it from `carry-once.json`.

The carry claim remains consumed after PASS, conformance failure, loader/validation/write failure,
or a process crash before a result/finish exists. The stable journal retains closed metadata outcome
codes; it never stores pairs, semantic labels, evaluation rows or raw custodian/schema exception text.
Receipt markers and result directories are presentation evidence only and must be separate from the
operator state root. A finish-write failure still leaves the durable claim consumed. This custody
boundary has regression source only; neither custodian conformance nor crash/fsync behavior has run.

One hash-chained, fsynced journal records every approval/tranche start, every request reservation and
settlement, and completion/stop/burn reasons. Every request atomically checks its stored approval/tranche
cap and the app-wide $40 ceiling before provider dispatch. Different approvals and tranches share the
app total. An unsettled/failed/unknown request retains its full bound; a known settlement records actual
cost, including overruns, and further reservations refuse when a cap is exceeded. Result directories
are evidence destinations, never spending or once-only authority.

A start is exclusively persisted before held-out opening or dispatch. T2 keys both immutable prereg
and held-out manifest hashes: a changed output, approval or amended prereg cannot reopen a consumed
held-out set. Exceptions after start durably retain their reason and mark T2 burned; even a process
crash with only the start marker consumes the edition and keeps unsettled charges. A consumed edition
cannot be silently retried, even if no result file exists. A fresh actual owner-approved dev calibration
grant can use T0/T1 without resetting prior app charges; a prior approval/tranche cannot be replayed.
T1/T2 need calibrated r from T0, and T2
checks the frozen allowance, prices, matcher, prompts, analysis source, order, images and manifest.
T2 results/reports and sealed carry-check receipts must use an outer-shell destination outside the
product repo. Result transcripts are authoritative gzipped hash-chained JSONL with a byte-identical
uncompressed companion; verification checks both, every event, footer, evidence and snapshot.

Stop conditions from the plan are:

1. A run reaches its pooled token allowance or a tranche its approved dollar cap: keep all artifacts.
2. Self-test or verification failure: no live work until fixed; gate receipts must be renewed.
3. Sandbox/grader integrity violation: halt; T2 burns the held-out set.
4. Instrument crashes exceed 10% in T0/T1: stop and fix. T2 crashes count; no selective retries.
5. G-C failure: no T2, bring the failure to Roy.
6. Changed/unavailable observed model: stop and report editions separately.
7. Reservation overrun: stop the tranche; T2 burns the set.
8. Unconfirmed cleanup: no further runs.

Exclusions are explicit `visibility_leak`, `usage_unknown`, `reservation_overrun`, `model_mismatch`
or `integrity_stop`. Excluded runs remain in report records; cap hits and ordinary implementation
failures remain outcomes. The viewer shows requirement classes, unknown reasons, handoff flags,
budget/status failures and exclusions. A burned held-out edition needs a new custodian-authored set;
an intentional same-set rerun is exploratory, requires a new owner decision and cannot silently
reuse this runner's once-only tranche path.
