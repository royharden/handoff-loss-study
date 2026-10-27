# handoff-loss-study

> **Status: under construction. NOTHING in this repository has ever been installed, run, type-checked,
> linted, tested or built.** Results: **NOT YET MEASURED.** No live model call has been made and the
> approved spend is **$0**.

## The question

On one authored set of small TypeScript tasks with planted, spec-only requirements, one pinned model and
the same pooled all-attempt token allowance per cell:

1. Does splitting the work **by role** (planner → implementer) or **by context** (two module workers
   with separate spec slices) keep fewer requirements than a **single** worker?
2. Does a **fixed-field brief** keep more than **free prose**?
3. For every lost requirement, did **lexical evidence** of it reach the worker who had to implement it?

Public label: **lexical carry / implementation outcome decomposition**, an operational evidence
partition, not a causal claim. Null results are valid; every run will be published. This is a small
replication plus a decomposition of an area that CooperBench, TeamBench, Handoff Debt, The Handoff Tax,
MAST and ctxbench already measure.

Six cells: `single`, `role/free_summary`, `role/fixed_brief`, `role/full_trace`, `context/free_summary`,
`context/fixed_brief`; plus `null_worker` and `oracle` baseline rows. Design summary:
[docs/DESIGN.md](docs/DESIGN.md).

## What exists

| Milestone | Content | State |
|---|---|---|
| M1 | Scaffold, core contracts (`src/core`), docs skeleton | source written; never run |
| M2 | Task loader, data-gate checks, carry scorer, keyless fixtures, `hls` CLI | not started |
| M3 | Dev prototypes T01, T02 and the task recipe | not started |
| M4 | Worker loop, policies, channels, budget, providers, sandbox/grader sources | not started |
| M5 | Store, verify, statistics, report, plan/run/prereg, viewer | not started |
| M6 | Dev corpus T03–T06, custodian packet, final docs | not started |

M1 contents: `src/core/{canonical,hash,ids,contracts,handoff-schema}.ts` (zod schemas for tasks,
requirements, anchors, usage, run events and records, group results, handoffs, approvals and the
prereg / held-out manifests; canonical JSON; sha256 via `node:crypto`), `tests/core.test.ts`
(written, never run), configs, and the documentation skeleton under `docs/`.

## Construction mode

Built in **Dirty Mode** (owner instruction, 2026-10-27): static construction only. The only checks
performed are `node --check` (syntax, with Node's type stripping) on each `.ts` file, JSON parsing, and
source review by builder-lineage review agents (recorded in [docs/STATIC-REVIEW.md](docs/STATIC-REVIEW.md);
these are not independent review). Every runtime check is listed with its exact later command in
[docs/DEFERRED-VALIDATION.md](docs/DEFERRED-VALIDATION.md).

### Commands that have never run

`npm ci` (there is no lockfile yet; dependency versions in `package.json` are unverified),
`npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm run build:viewer`, and every
`hls` / `npm run` study command (`demo`, `selftest`, `fixture`, `validate:dev`, `check:*`, `verify`,
`plan`, `study`, `report`). Most `npm run` aliases point at `cli/hls.ts` subcommands that later
milestones add; until then they fail.

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

Owner decisions pending: **spend/model** (which model and what dollar cap per tranche; currently $0),
**independent custodian** (who authors the carry-conformance pairs, blind labels and held-out tasks, plus a
rights/originality confirmation), **Docker** (building the sandbox images and a one-time networked
install), and **publication** (repo visibility and any write-up). Also pending: when to close Dirty Mode
and start the validation phase.

## Licence

MIT, see [LICENSE](LICENSE). Task corpus: original synthetic TypeScript, see [docs/DATA.md](docs/DATA.md).
