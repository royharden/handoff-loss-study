# Data

> Skeleton (M1). Completed in M3 (originality + licence declaration, custody model) and M6.

## Sources and licence

All task material is original synthetic TypeScript written for this study and released under the MIT
licence (see `LICENSE`). Published benchmarks (CooperBench, TeamBench, Handoff Debt, The Handoff Tax, MAST,
ctxbench) are cited as design references only; nothing is copied or downloaded from them.

## Custody

- **Dev corpus** (`tasks/dev/T01..T06`): builder lineage.
- **Held-out corpus** (12 tasks) and **sealed carry-conformance pairs**: an independent custodian appointed
  by the owner, from a model family different from the builder's and the worker model's. Held-out files live
  only in the sealed folder outside this repo; only `heldout.manifest.json` (sha256 per file,
  `HeldoutManifestSchema`) enters the repo, before the prereg freeze. Any integrity stop in T2 burns the set.
- Builder lineage never authors held-out data, expected answers or semantic labels.

## Gate G-A (data admission)

**PENDING — needs the owner** to appoint the custodian and confirm rights/originality in writing; also needs
two dev prototypes meeting gate conditions 1–8 by execution (deferred). If G-A fails, the study is skipped,
not downgraded.

TODO(M3): originality declaration per task; TODO(M6): custodian disclosure and owner spot-check record.
