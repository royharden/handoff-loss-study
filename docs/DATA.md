# Data

Construction records for M3/M6; current status: **rights NOT confirmed; local-only use; Roy
confirmation PENDING**. Independence remains **PENDING - Roy**. G-A/G-I/G-C have not passed.

## Sources and licence

Builders declare the development tasks to be original synthetic TypeScript/prose written for this
study. Those are builder declarations, not owner-confirmed rights. The existing MIT `LICENSE` and
package metadata are retained as construction artifacts; no release or public license adoption is
authorized. Published benchmarks (CooperBench, TeamBench, Handoff Debt, The Handoff Tax, MAST, ctxbench)
are design references; the builder declaration is that no third-party task material was copied,
adapted or downloaded.

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

- Round 2 permits an eligible non-builder delegated stand-in, disclosed as **delegated stand-in,
  not human-independent**. No such seat is appointed by this document. Builder lineage (including
  this INT, DLs and their children) is excluded. Human independence remains **PENDING - Roy**;
  custody/model-family requirements must be reconciled with the frozen plan before activation.
- Builder lineage never authors held-out data, expected answers, semantic labels or gold labels, and never
  reads `heldout-sealed\`.
- Any integrity stop in T2 burns the held-out set (D25).
- Dev expectations are spot-checked by the custodian against prose for two dev tasks before G-I.

## Gate G-A (data admission)

**G-A: PENDING for study activation; local dev admission checks PASS.** Open conditions:

1. Two complete dev prototypes meeting gate conditions 1–8 **by execution** (oracle passes all 9 groups,
   untouched starter fails all 9, each mutant fails exactly its own group). T01 and T02 exist and meet the
   pure-data conditions by reading (M3 static review); the execution checks now PASS locally for all six dev tasks (current DEFERRED-VALIDATION.md overlay).
2. Roy appoints the independent custodian (ROY-DECISIONS-REQUEST Q2).
3. This file declares originality and licence: **done** for T01/T02 (above); T03–T06 in M6.
4. Roy confirms rights and originality in writing (Q2).

If G-A fails, S42 is skipped, not downgraded. Scoped keyless development validation is permitted under Round 2; it does not authorize a live study run or satisfy independent custody/rights.

## Development corpus completion — 2026-10-27
T03 (refactor, parcel manifest), T04 (refactor, support ticket projection), T05 (feature, inventory transfer), T06 (bugfix, subscription credit statement) are original synthetic development tasks authored by 0910_Codex_gpt-61-sol_N20CodexInt42 with MIT recorded as their proposed construction license, still awaiting Roy rights confirmation. Each includes starter, spec/brief, builder-written dev expectations, oracle, eight isolated mutant overlays and two alternate solutions. Their schema, pure-data conditions, oracle/starter/mutant matrices, both alternates and public smoke tests now pass local execution checks; this does not confirm rights or independent semantics. These four tasks share a projection scaffold; generalization across wider software domains remains limited.

Custodian appointment, rights confirmation and owner spot-checks are PENDING. Claude and Codex successor builders and their children are all builder lineage. No semantic/gold labels or held-out tasks have been authored by this construction team. See CUSTODIAN-PACKET.md for the three independent phases and heldout.schema.json for metadata shape. G-A/G-I/G-C remain unpassed.


## Round 2 local validation overlay — 2026-10-27
Scripts-disabled install and clean offline install, strict types/lint, 21 unit-test files /219 tests
and viewer build pass. All six authored task matrices,12 alternates,18 public smoke variants and
SYNTHETIC runner/store/verify/report pass. Detailed scopes and pending checks are in
DEFERRED-VALIDATION.md. Public development hidden/ files remain builder-authored expectations,
never independent held-out evidence. Rights NOT confirmed; local-only use; Roy confirmation PENDING.

### Round 2 runtime update
All six dev tasks pass local validator admission, with all12 alternates and18 public smoke variants
passing. G-A condition1 (two executed prototypes) is met locally. Overall G-A/G-I/G-C remain pending
independent custody/stand-in and rights confirmation, plus Docker/live prerequisites where required.
Rights NOT confirmed; local-only use; Roy confirmation PENDING. Builders remain ineligible to supply
sealed data or semantic/gold labels. No held-out material was authored or read.
