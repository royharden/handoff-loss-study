# Agent instructions: handoff-loss-study (product repo)

This repository is the product only. Agent-only material (plans, transcripts, registries, scratch,
receipts) lives outside it and must never be committed here.

## Rules

1. **Spend is $0.** No live model call, no paid API, no credential use without the owner's signed
   approval for that tranche (`docs/DESIGN.md` "Live gate"). Never read or print credential files.
2. **Builder lineage never authors held-out data**, expected answers or semantic/gold labels. Builder
   self-test pairs (`fixtures/carry-conformance/builder-selftest.json`) test matcher mechanics only and
   carry no semantic label (the `CarryPairSchema` refuses one).
3. **Held-out data never enters this repo.** Only `heldout.manifest.json` (sha256 per file) does.
4. **Erasable TypeScript only**: no `enum`, `namespace` or parameter properties; `import type` for
   type-only imports; extensionless relative specifiers (bundler resolution); zod schemas with
   `z.infer` types. `src/core` imports no network, process or provider SDK module.
5. **The carry matcher is closed** (`src/score/evidence.ts`): its cue/marker lists and clause rules change
   only before the matcher-hash freeze; afterwards a change is a new matcher edition with new sealed pairs.
6. **Honest status.** Never write a measured number by hand; results tables come from `hls report`. Do not
   mark a deferred check as passed. Update `docs/DEFERRED-VALIDATION.md` and `docs/STATIC-REVIEW.md`.
7. **Containers**: only after the owner approves Docker; register host ports/containers first, label every
   owned container `hls.owner=<run_id>`, `hls.app=handoff-loss-study`, and clean up only owned resources.

## Layout

See `docs/DESIGN.md`. Source: `src/{core,tasks,score,runner,providers,sandbox,store,stats,report}`, CLI
`cli/hls.ts`, viewer `viewer/`, tasks `tasks/dev/T01..T06`, fixtures `fixtures/`, tests `tests/`.
