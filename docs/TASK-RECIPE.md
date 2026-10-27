# Task recipe

> Skeleton (M1). Filled in M3 with T01/T02 as worked examples; frozen before custodian held-out authoring
> (after gate G-C). G-C may extend the banned-pattern list.

## Task folder (`tasks/<split>/<id>/`)

`task.json` (schema: `TaskSchema` in `src/core/contracts.ts`), `spec.md` (whole spec, partitioned into
slices A and B by top-level `#` sections), `brief.md` (C0-level objective only), `repo/` (starter: two
writable modules, one protected interface file, public smoke tests), `hidden/` (group C0 and R1..R8; each
R group asserts its requirement and C0), `oracle/`, `mutants/R<n>/` (break only R<n>, never C0),
`static.json` (`StaticConfigSchema`), `alternates/A1`, `alternates/A2`.

## Sections to write (M3)

- **Trap kinds** — one each of `negative_constraint`, `literal_constant`, `naming_convention`,
  `override_default`, `late_clarification`, `cross_module_contract`, `do_not_touch`, `edge_case`.
- **Slot assignment** — hash input `<taskId>:<seed>`, sha256, and the deterministic rule mapping the digest
  to 2 × `local_A`, 2 × `local_B`, 2 × `transfer_A_to_B`, 2 × `transfer_B_to_A` (`cross_module_contract`
  always on a transfer slot). TODO(M3): exact rule text and rule id `docs/TASK-RECIPE.md#slot-assignment v1`.
- **Anchors** — `secret` (absent from every repo file, name and path) vs `entity` (present; do_not_touch uses
  `entity_cue`). State each secret anchor at least once in an **unmarked** clause of its slice (cond. 6b);
  state decoys only in **marked** clauses (cond. 6c); give every do_not_touch entity a positive cue clause
  (cond. 6d).
- **Cue and marker lists** — copied from the frozen matcher (`src/score/evidence.ts`, M2) with its hash.
- **Decoys** — distinctive (≥ 3 digits or ≥ 4 characters), differ from every anchor and decoy, never inside
  an anchor (cond. 6f).
- **`brief.md` rule** — no secret anchor, no decoy, no entity anchor + cue clause (cond. 6e).
- **C0 rule**, **couplings** (`declared` / `prerequisite`), **knobs** for dev tuning, **alternates**.
- **Banned patterns for held-out** — TODO(G-C): trap patterns found guessable in dev.
