# Independent custodian packet

Status: **PENDING — needs Roy to appoint**. This document supplies instructions and schemas only. It contains no held-out tasks, hidden held-out answers, semantic labels or gold data. Builder lineage includes the original Claude builder, its children, the Codex successor and its children. None may fill the custodian role or author those materials.

Roy must name a custodian, confirm original synthetic MIT rights, and spot-check two tasks. The appointed session must be independent of the builder lineage and satisfy Roy's model-family decision for the selected worker model. The successor adds GPT to the actual builder lineage; do not reuse the earlier recommendation that a GPT session is automatically independent. Roy himself may perform the custody work. Appointment and rights evidence remain outside the public product repo.

## Inputs

Read `docs/TASK-RECIPE.md`, `docs/DATA.md`, `docs/DESIGN.md`, `docs/LIMITATIONS.md`, `src/core/contracts.ts`, `heldout.schema.json` and the public dev examples T01/T02. The closed lexical matcher is `src/score/{normalize,evidence}.ts`; its hash must freeze before sealed carry pairs open. The recipe freezes after calibration G-C, before held-out task authoring. Current public development examples and their builder-written hidden/ files are development data, never held-out validation.

## Phase 1 — before G-I and every live call

1. Author 40 public development carry-conformance pairs and 40 sealed pairs with independently determined semantic labels and expected lexical states. Use the published matcher rules, not hypothetical semantic capability. Cover anchor boundaries, polarity, cues, malformed handoffs, marked decoys and conservative unknowns. Builder mechanics pairs are not semantic validation and do not replace this set.
2. Spot-check two development tasks' hidden assertions against their prose and return discrepancies. The builder repairs dev sources; record this independent spot-check separately from construction review.
3. Put sealed carry pairs only in the outer `heldout-sealed/carry-sealed/` folder. Supply a manifest with path, byte length and SHA-256, and retain a custody record. Public dev pairs may be supplied as a separate public artifact, never by opening the sealed bundle.
4. Freeze the matcher hash before sealed labels open. The sealed evaluation occurs once before G-I can pass: every expected lexical state must match, with zero false evidence against semantic labels. Failure stops activation. Tuning after opening consumes this edition; a changed matcher needs freshly authored sealed pairs. No builder repair of sealed data.

## Phase 2 — after T1

Blind-label the precommitted 120-pair sample without seeing checker output. The selection rule is seeded, balanced by channel and trap kind, and hashed before T1. Return labels through custody procedures. Calibration computes evidence precision/recall on decided pairs, overall and for secret anchors, requiring at least 0.90. Unknown coverage must be at most 25%; report it separately. Empty denominators are undefined, never a passing perfect score. No hand-authored result tables.

## Phase 3 — after G-C and recipe freeze

Author 12 original synthetic TypeScript held-out tasks: four feature, four refactor, four bugfix. Each task follows the eight trap kinds, hashed 2/2/2/2 slot assignment and exact source-slice/brief rules. Provide starter, spec, brief, C0 and R1–R8 tests, oracle, isolated mutants, protected-file static config and two alternate valid solutions per task. Incorporate any banned guessable patterns from calibration. All hidden expectations, alternates and held-out requirements are custodian-authored.

Seal these files under the outer `heldout-sealed/tasks/H01..H12/`, never `tasks/heldout` in this product repo. Use `HeldoutManifestSchema` in `src/core/contracts.ts` and the matching `heldout.schema.json`: unique relative POSIX paths rooted in `tasks/` or `carry-sealed/`, exact bytes and SHA-256, custodian name/family and sealing timestamp. Only `heldout.manifest.json` enters the product repo before preregistration. No placeholder manifest with invented hashes ships.

## Checks and disclosure

After Roy closes Dirty Mode and authorizes setup, the operator can use `hls validate <task-directory> --execute` and `hls heldout import <manifest-file>` as documented by CLI help. Pure-data inspection is insufficient for admission: oracle all-pass, untouched all-fail, single-target mutant matrix and alternate solutions require real execution. Return failures to the named custodian; builders never edit held-out files.

Before T2: freeze the manifest, recipe, model/sampling, six-cell order, allowance, reservation ratio, prices, analysis, prompts, image digests and exclusions in preregistration. Check the actual command options at activation; source alone is not an execution receipt. An integrity stop in T2 burns the held-out set. Preserve aborted records; no silent rerun, retuning or replacement of labels.

Access: the custodian alone authors sealed content; reviewers/operators receive the minimum explicit grant required for their stage. Workers see only policy-authorized brief/spec slices/handoffs/starter code, never task metadata, hidden tests, oracle, mutants or custody labels. Publication requires Roy's separate approval after verification and secret review. No rights confirmation, appointment or result is inferred from this packet.
