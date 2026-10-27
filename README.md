# handoff-loss-study

> **Status: source construction complete in Dirty Mode; runtime unverified. No dependency install,
> application execution, typecheck, lint, tests or builds have run.** Results: **NOT YET MEASURED.** No live model call has been made and the
> spent amount is **$0**. The owner approved a **$40 total ceiling**, with no key, account or live-run authorization.

## The question

On one authored set of small TypeScript tasks with planted, spec-only requirements, one pinned model and
the same pooled all-attempt token allowance per cell:

1. Does splitting the work **by role** (planner → implementer) or **by context** (two module workers
   with separate spec slices) keep fewer requirements than a **single** worker?
2. Does a **fixed-field brief** keep more than **free prose**?
3. For every lost requirement, did **lexical evidence** of it reach the worker who had to implement it?

Public label: **lexical carry / implementation outcome decomposition**, an operational evidence
partition, not a causal claim. Null results are valid; authorized publication must include every run. This is a small
replication plus a decomposition of an area that CooperBench, TeamBench, Handoff Debt, The Handoff Tax,
MAST and ctxbench already measure.

Six cells: `single`, `role/free_summary`, `role/fixed_brief`, `role/full_trace`, `context/free_summary`,
`context/fixed_brief`; plus `null_worker` and `oracle` baseline rows. Design summary:
[docs/DESIGN.md](docs/DESIGN.md).

## What exists

| Milestone | Content | State |
|---|---|---|
| M1 | Scaffold, core contracts (`src/core`), docs skeleton | accepted for construction; runtime unverified |
| M2 | Task loader, data-gate checks, carry scorer, keyless fixtures, `hls` CLI | accepted for construction; runtime unverified |
| M3 | Dev prototypes T01, T02 and the task recipe | accepted for construction; runtime unverified |
| M4 | Worker loop, policies, channels, budget, providers, sandbox/grader sources | accepted for construction; runtime unverified |
| M5 | Store, verify, statistics, report, plan/run/prereg, viewer | accepted for construction; runtime unverified |
| M6 | Dev corpus T03–T06, custodian packet, manifest schema | accepted for construction; runtime unverified |

M1 contents: `src/core/{canonical,hash,ids,contracts,handoff-schema}.ts` (zod schemas for tasks,
requirements, anchors, usage, run events and records, group results, handoffs, approvals and the
prereg / held-out manifests; canonical JSON; sha256 via `node:crypto`), `tests/core.test.ts`
(written, never run), configs, and product documentation under `docs/`.

The runner exposes closed file/test/handoff tools, isolated role/context views, pooled all-attempt
reservations and a two-container candidate/grader boundary. Stored runs include source snapshots,
gzipped hash-chained events and a footer; verification recomputes scores and visibility from stored
inputs. Reports provide paired task-cluster statistics and a local React viewer with run/requirement
drilldown. All of this is source construction, not evidence of successful execution.

## Construction mode

Built in **Dirty Mode** (owner instruction, 2026-10-27): static construction only. The only checks
performed are `node --check` (syntax, with Node's type stripping) on each `.ts` file, JSON parsing, and
source review by builder-lineage review agents (recorded in [docs/STATIC-REVIEW.md](docs/STATIC-REVIEW.md);
these are not independent review). Every runtime check is listed with its exact later command in
[docs/DEFERRED-VALIDATION.md](docs/DEFERRED-VALIDATION.md).

### Commands that have never run

`npm install --ignore-scripts` and `npm ci` (there is no lockfile yet; dependency versions in `package.json` are unverified),
`npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm run build:viewer`, and every
`hls` / `npm run` study command (`demo`, `selftest`, `fixture`, `validate:dev`, `check:*`, `verify`,
`plan`, `study`, `report`). Study aliases route through `cli/hls.ts`; source presence does not prove
command execution or integration.

### Later validation walkthrough

These commands are instructions for the owner-authorized validation phase, **not completed checks**.
After Dirty Mode closes, use the first-install/lockfile procedure in `docs/DEFERRED-VALIDATION.md`.
From the repository root, the intended keyless journey is:

```text
npm run selftest
npm run hls -- validate tasks/dev --execute
npm run demo
npm run demo -- --provider mock
npm run verify -- results/demo
npm run report -- results/demo --out results/report
npm run plan -- --tranche T2
npm run build:viewer
```

The plain demo uses authored scripted fixtures. The explicit mock demo drives the six-cell runner
and zero-model-call null/oracle controls; both produce SYNTHETIC output, never measured evidence.
Result destinations are created exclusively, so preserve prior artifacts and choose a fresh directory
for a new synthetic run. The viewer opens the generated `report.json` through a local file selector.
Pure `validate:dev` without `--execute` leaves execution conditions deferred and does not admit tasks.

Live execution additionally needs actual owner/custodian gate evidence and a trusted runtime host
supplying the consent, container, custody and stable-state ports described in `docs/PREREG.md`.
The ordinary CLI has no default live activation host. Report paths never authorize spending or
reset consumed data editions; no provider key belongs in the viewer or Bolt.

## Safety defaults

- Dry run by default. `hls run --live` refuses unless an `approvals/<T>.json` matches the tranche, model,
  cells, tasks, repeats, token allowance, dollar cap, expiry and named approver, that approval points to
  the owner's signed decision, `HLS_LIVE_ENABLED` is set, and the ledger fits the cap. The repo ships
  with no approval files. An approval file's existence is not consent.
- `.env.example` holds empty placeholders only. Never commit a `.env`.
- Model output is graded only in offline, network-less containers (two-container grader, see
  [docs/SANDBOX.md](docs/SANDBOX.md)); no image has been built.
- Held-out tasks are never in this repo; only their sha256 manifest will be.

## Owner decisions pending

Owner decisions pending: **model and live access** (the $40 ceiling is approved; no live tranche or key is supplied),
**independent custodian** (who authors the carry-conformance pairs, blind labels and held-out tasks, plus a
rights/originality confirmation), **Docker** (building the sandbox images and a one-time networked
install), and **publication** (repo visibility and any write-up). Also pending: when to close Dirty Mode
and start the validation phase.

The development corpus contains two feature, two refactor and two bugfix tasks. T03–T06 share a small
projection scaffold, which limits domain variety. Dev `hidden/` directories contain builder-authored
development expectations, not independently authored held-out data. The appointed custodian must supply
the sealed pairs, blind labels and held-out tasks described in [docs/CUSTODIAN-PACKET.md](docs/CUSTODIAN-PACKET.md).
No held-out content is included and G-A/G-I/G-C have not passed.

## Licence

MIT, see [LICENSE](LICENSE). Task corpus: original synthetic TypeScript, see [docs/DATA.md](docs/DATA.md).
