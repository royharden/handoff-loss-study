# Data

Completed for M3 (originality, licence, custody, G-A status). M6 adds the custodian disclosure and the
owner spot-check record.

## Sources and licence

All task material is original synthetic TypeScript and prose written for this study and released under
the MIT licence (see `LICENSE`). Published benchmarks (CooperBench, TeamBench, Handoff Debt, The Handoff
Tax, MAST, ctxbench) are cited as design references only; nothing is copied, adapted or downloaded from
them, and no third-party code, dataset or document was used to write the tasks.

### Originality declaration (builder, dev corpus)

| Task | Shape | Domain | Author (builder lineage) | Date | Declaration |
|---|---|---|---|---|---|
| T01 | feature | webhook retry planner (`src/schedule.ts`, `src/dispatch.ts`, protected `src/contracts.ts`) | 0847_Claude_Opus55_Sub_S42CoderM3 | 2026-10-27 | Original synthetic content written for this study; MIT. Names, headers, numbers and the relay scenario are invented. |
| T02 | bugfix | metered invoice builder (`src/normalize.ts`, `src/invoice.ts`, protected `src/types.ts`) | 0847_Claude_Opus55_Sub_S42CoderM3 | 2026-10-27 | Original synthetic content written for this study; MIT. Meters, prices, feeds and customers are invented. |

Each declaration covers the whole task folder: `task.json`, `spec.md`, `brief.md`, `repo/`, `hidden/`,
`oracle/`, `mutants/`, `static.json`, `alternates/`. The declaration is the builder's statement; it is not
the owner's confirmation required by G-A.

## Custody model

| Material | Author | Where it lives | Who may read it |
|---|---|---|---|
| Dev tasks T01–T06 | builder lineage (S42-INT and its subagents) | `tasks/dev/` in this repo | everyone; workers see only their policy's view (D16) |
| Builder matcher self-test pairs (D19a) | builder lineage | `fixtures/carry-conformance/builder-selftest.json` | everyone; they test matcher mechanics, not meaning |
| Public custodian carry pairs (40, D19b) | independent custodian | this repo, once written | everyone |
| Sealed custodian carry pairs (40, D19b) | independent custodian | outer shell `heldout-sealed\carry-sealed\` | custodian until the single G-I evaluation |
| Held-out tasks H01–H12 (D25) | independent custodian, after the recipe freeze | outer shell `heldout-sealed\tasks\` | custodian; Roy's spot-check of two tasks |
| `heldout.manifest.json` | custodian | this repo (sha256 per held-out file), before the prereg freeze | everyone |
| Blind labels on the 120-pair T1 sample (D19c) | independent custodian | outer shell, then committed after G-C | custodian until G-C |

- The custodian is appointed by the owner and comes from a model family different from the builder's
  and the worker model's (PLAN.md §6).
- Builder lineage never authors held-out data, expected answers, semantic labels or gold labels, and never
  reads `heldout-sealed\`.
- Any integrity stop in T2 burns the held-out set (D25).
- Dev expectations are spot-checked by the custodian against prose for two dev tasks before G-I.

## Gate G-A (data admission)

**G-A: PENDING – needs Roy.** Open conditions:

1. Two complete dev prototypes meeting gate conditions 1–8 **by execution** (oracle passes all 9 groups,
   untouched starter fails all 9, each mutant fails exactly its own group). T01 and T02 exist and meet the
   pure-data conditions by reading (M3 static review); the execution checks are deferred
   (`npm run validate:dev`, docs/DEFERRED-VALIDATION.md).
2. Roy appoints the independent custodian (ROY-DECISIONS-REQUEST Q2).
3. This file declares originality and licence: **done** for T01/T02 (above); T03–T06 in M6.
4. Roy confirms rights and originality in writing (Q2).

If G-A fails, S42 is skipped, not downgraded. No task is admitted and nothing executes before G-A.

## Development corpus completion — 2026-10-27
T03 (refactor, parcel manifest), T04 (refactor, support ticket projection), T05 (feature, inventory transfer), T06 (bugfix, subscription credit statement) are original synthetic development tasks authored by 0910_Codex_gpt-61-sol_N20CodexInt42 under MIT. Each includes starter, spec/brief, builder-written dev expectations, oracle, eight isolated mutant overlays and two alternate solutions. Their schema, clause, anchor and C0 expectations are source-inspection claims only; no task has executed. These four tasks share a projection scaffold; generalization across wider software domains remains limited.

Custodian appointment, rights confirmation and owner spot-checks are PENDING. Claude and Codex successor builders and their children are all builder lineage. No semantic/gold labels or held-out tasks have been authored by this construction team. See CUSTODIAN-PACKET.md for the three independent phases and heldout.schema.json for metadata shape. G-A/G-I/G-C remain unpassed.
