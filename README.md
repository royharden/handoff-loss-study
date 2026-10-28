# handoff-loss-study

> **Status: construction complete; partial local validation passed under the Round 2 Dirty Mode exception.**
> Dependencies installed with scripts disabled; typecheck, lint, 21 unit-test files / 219 tests and viewer build passed.
> Dev tasks pass local admission checks; Docker isolation and study custody/rights gates remain pending. Results: **NOT YET MEASURED**.
> No live model call; **$0 spent** against the **$40 total testing ceiling**. No key or live access supplied.

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
| M1 | Scaffold, core contracts (`src/core`), docs skeleton | accepted for construction; see validation scope below |
| M2 | Task loader, data-gate checks, carry scorer, keyless fixtures, `hls` CLI | accepted for construction; see validation scope below |
| M3 | Dev prototypes T01, T02 and the task recipe | accepted for construction; see validation scope below |
| M4 | Worker loop, policies, channels, budget, providers, sandbox/grader sources | accepted for construction; see validation scope below |
| M5 | Store, verify, statistics, report, plan/run/prereg, viewer | accepted for construction; see validation scope below |
| M6 | Dev corpus T03–T06, custodian packet, manifest schema | accepted for construction; see validation scope below |

M1 contents: `src/core/{canonical,hash,ids,contracts,handoff-schema}.ts` (zod schemas for tasks,
requirements, anchors, usage, run events and records, group results, handoffs, approvals and the
prereg / held-out manifests; canonical JSON; sha256 via `node:crypto`), `tests/core.test.ts`
(included in the passing local unit suite), configs, and product documentation under `docs/`.

The runner exposes closed file/test/handoff tools, isolated role/context views, pooled all-attempt
reservations and a two-container candidate/grader boundary. Stored runs include source snapshots,
gzipped hash-chained events and a footer; verification recomputes scores and visibility from stored
inputs. Reports provide paired task-cluster statistics and a local React viewer with run/requirement
drilldown. The completed local checks below cover specific paths; they do not establish container isolation, independent custody or measured study results.

## Construction and local validation

Built in **Dirty Mode** (2026-10-27). Round 2 permits scoped local installation/runtime checks with
install scripts disabled; it does not authorize live calls or close Dirty Mode. The initial source
reviews remain in [docs/STATIC-REVIEW.md](docs/STATIC-REVIEW.md), attributed to builder lineage.

| Check | Current result |
|---|---|
| Dependency install | Scripts-disabled install and clean offline `npm ci --ignore-scripts` passed; lockfile committed |
| Strict types / lint | `npm run typecheck` and `npm run lint` passed |
| Unit suite | 21 files / 219 tests passed; no live provider calls |
| Static viewer build | `npm run build:viewer` passed; browser rendering remains unchecked |
| Authored task execution / synthetic CLI integration | Six dev matrices, twelve alternates, eighteen public smoke variants, positive/bad fixtures and eight-run SYNTHETIC store/verify/report passed; study gates pending |
| Docker / independent custody / live tranches | Pending; required images unavailable locally, no image pulls or live calls |

The canonical check-by-check overlay is [docs/DEFERRED-VALIDATION.md](docs/DEFERRED-VALIDATION.md).
Unit tests and a build do not establish a gate PASS, measured result or human independence.

### Keyless validation walkthrough

The keyless journey below has been exercised locally. Generated artifacts are retained in the outer operator records; choose fresh output paths for any new run. Exact scopes and gaps are recorded in DEFERRED-VALIDATION.md.
For later clean installs use `npm ci --ignore-scripts`; keep all runtime work within the current
Round 2 limits. From the repository root:

```text
npm run selftest
npm run hls -- validate tasks/dev --execute
npm run demo
npm run demo -- --provider mock
npm run verify -- <synthetic-results-directory>
npm run report -- <synthetic-results-directory> --out <report-directory>
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
- Never commit a populated `.env` or read credential files. Documentation-only placeholders are
  `<PLACEHOLDER_API_KEY>` for the future runner's `ANTHROPIC_API_KEY`, and `<PLACEHOLDER_MODEL_PIN>`
  for the exact model/price/approval/prereg pin. They grant no access and must not be executed.
- Model output is graded only in offline, network-less containers (two-container grader, see
  [docs/SANDBOX.md](docs/SANDBOX.md)); no image has been built.
- Held-out tasks are never in this repo; only their sha256 manifest will be.

## Owner decisions pending

Pending: genuine **model pin and live access**, **custody and rights/originality confirmation**, and
**publication**. Round 2 permits a non-builder delegated stand-in, disclosed as "delegated stand-in,
not human-independent"; no eligible stand-in is appointed here. This INT, its DL seats and their
children are builder lineage and cannot fill that role. Independence remains **PENDING - Roy**.
Rights are **NOT confirmed; local-only use; Roy confirmation PENDING**.

Local installs and validation are now permitted within Round 2; Docker remains limited to existing
local images on Kaiser-Pro, with RAM above 3 GB and the resource policy observed. Missing images are
deferred. No remote, push, import, publication or public license adoption is authorized.

The development corpus contains two feature, two refactor and two bugfix tasks. T03–T06 share a small
projection scaffold, which limits domain variety. Dev `hidden/` directories contain builder-authored
development expectations, not independently authored held-out data. The appointed custodian must supply
the sealed pairs, blind labels and held-out tasks described in [docs/CUSTODIAN-PACKET.md](docs/CUSTODIAN-PACKET.md).
No held-out content is included and G-A/G-I/G-C have not passed. The local task checks do not replace rights or independent custody.

## Licence

The existing [LICENSE](LICENSE) file and package metadata are retained as construction artifacts.
Rights and public license adoption are not confirmed or authorized. Local-only use; Roy confirmation
PENDING. Builder originality declarations are in [docs/DATA.md](docs/DATA.md).
