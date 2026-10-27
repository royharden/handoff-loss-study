# Live approvals — none shipped

Approved live spend is **$0**. A ceiling is not consent. File existence ≠ consent.
Never place credentials, private approval transcripts or a populated `.env` in this repository.

`approvals/T0.json`, `T1.json` or `T2.json` must validate against `ApprovalSchema` in
`src/core/contracts.ts`. Required fields are schemaVersion=1, exact tranche/model/cells/tasks/repeats,
T1-only `specBlindRunsPerTask`, pooled per-run `maxTokens`, tranche-wide `maxUsd`, issuedAt/expiresAt,
named `approver` with Roy signed decisionRef and decisionSha256, and priceTableSha256. No populated
example is shipped because an example must never resemble a spending grant. A schema-valid file
does not authenticate the referenced decision. The runtime's explicit `verifyRoyDecision` callback
must inspect/validate the actual owner record; no default verifier is installed.

The repo-level hard switch must be exactly `HLS_LIVE_ENABLED=1`. Dry run is the default:
`hls run --tranche T0` prints a plan and dispatches nothing. Synthetic execution is explicitly
`hls run --tranche T0 --provider mock --execute`; it is always stamped SYNTHETIC. `--live` requires
all gates, exact approval, current `--prices <file>`, `--max-usd <approved cap>`, and for T2
`--max-tokens <frozen C>`. No key is read before authorization and dispatch reservation.

The trusted runtime host calls `studyMain(argv, repoRoot, activationPort)`. `LiveActivationPort`
supplies the decision verifier, per-run Docker consent/agent-ports authorization, immutable candidate/
grader/episode image names, owned work root, stable operator-owned `stateRoot`, and a T2 authenticated
custodian loader. Absence of a
port is a refusal, not a simulated success. Operators must close deferred K/D checks and appoint the
custodian before supplying actual activation. No installs, Docker resources, live calls or operator
callbacks have been exercised in this Dirty Mode construction.

Actual gate receipts `approvals/<T>.G-A.json`, `<T>.G-I.json`, and for T2 `<T>.G-C.json` have:
schemaVersion=1, gate, status=PASS, exact tranche, current src+cli codeSha256, nonempty evidenceRefs,
approvedBy, matching royDecisionRef, ownerConsentVerified=true and expiresAt. They attest real evidence;
the builder must not manufacture them from a source review. T1/T2 also require `calibration.json`
with reservationRatio, sourceTranche=T0, current codeSha256 and evidenceRef. Signing/key provisioning
infrastructure is not required or implemented. The operator validation port establishes actual consent.

The host must bind `stateRoot` to one stable absolute operator-owned directory outside the product
repo, separate from result destinations, for the whole app lifetime. It is not a CLI flag, `--out`
derivative, per-approval directory or per-tranche directory. A trusted host may provision that directory
once with `initializeLiveState(stateRoot)` from `src/store/live-state.ts`; this exclusively creates and
fsyncs `live-state.jsonl` with the fixed app identity/schema and $40 ceiling. The CLI never calls the
initializer and never treats an absent/malformed journal as zero spend. Keep the journal and its
exclusive `.lock` under operator control and preserve them across approvals, invocations and report
folder changes. Do not delete, replace or fork authority to reconcile a failed attempt. Restore/reconcile
operator evidence before activation if authority is missing; result folders cannot seed it. Initializer
and all operator state behavior remain unexecuted construction source, not a new approval/key ceremony.

This single hash-chained journal atomically fsyncs all-attempt reservations before dispatch. Each
reservation checks both the stored approval/tranche maxUsd and aggregate app-wide $40 ceiling, including
charges from different decisions/tranches. Unknown/failed/unsettled attempts retain their full bound;
actual settlements and overruns remain recorded. Concurrent writers, corrupt chains, stale locks,
exhausted caps and mismatched authority fail closed; no stale lock is stolen automatically.

An approval identity binds its tranche and actual decision hash, or the exact authenticated decision
reference when the existing optional hash is null. The host must use a stable canonical reference in
that case. Its canonical full approval hash (including the reference) is recorded. Reformatting an
approval or changing `--out` cannot replay it; a reference alias cannot reset a hash-bound decision.
A fresh actual dev
calibration decision can authorize another T0/T1 attempt while preserving all earlier app charges.
T2 start markers consume the immutable prereg and heldout-manifest edition before the custodian loader
runs. A different approval/output or amended prereg cannot reuse that heldout edition. Completion and
stop reasons are append-only; exceptions burn T2, and a crash leaving only a start remains consumed.
A burned/consumed heldout set requires a new custodian edition, not ledger deletion or selective retry.

The zero-provider `check carry` command also requires this existing stable `stateRoot` and an
independent authenticated `loadSealedCarryPairs` port. Before any sealed opening, the same journal
exclusively claims and fsyncs the sealed-pair digest. The digest is the once-only key across matcher,
public-pair, approval/decision and receipt-directory changes. Do not provision a new state root to
repeat a carry evaluation. A new matcher edition requires a new custodian-authored sealed set.
Started, completed, stopped, failed and interrupted evaluations all consume the sealed edition;
absence of `carry-once-result.json` never permits a retry. Controlled metadata outcomes remain in the
journal without raw errors, pairs, labels or evaluation rows. Receipt directories are separate outer
evidence destinations only; `carry-once.json` cannot initialize, replace or reset operator authority.
This does not add spending approval, keys or a new signing ceremony. Real provisioning and all
custodian/command regression executions remain deferred; construction supplies no semantic data.
