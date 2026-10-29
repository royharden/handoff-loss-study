# T02 mutants

Each `R<n>/` is an overlay applied on top of `repo/ ⊕ oracle/`. It replaces exactly one file with a copy of
the oracle file (for R7: of the starter `src/types.ts`) that differs only on the lines marked `MUTANT R<n>`
(R3 renames the helper at its declaration and its single call site). No mutant touches a C0 code path
(`_c0.ts` assertions: dedupe by id, numeric quantities, customer filter, per-meter summed units, total =
sum of line amounts). Expected: each mutant fails exactly its own group; no declared couplings.

| Mutant | File | Change | Breaks | Why the other groups still pass |
|---|---|---|---|---|
| R1 | `src/normalize.ts` | probe filter removed | R1 | no other group sends `healthcheck_ping` |
| R2 | `src/normalize.ts` | alias lookup removed | R2 | no other group sends `cpu`/`vcpu` |
| R3 | `src/invoice.ts` | helper exported as `linePriceCents` | R3 (the `invLinePriceCents` call is rejected) | `buildInvoice` still prices every line through the renamed helper |
| R4 | `src/normalize.ts` | clamp at 10000 | R4 | other groups send quantities ≤ 200 |
| R5 | `src/invoice.ts` | storage override removed (290 from `PRICING`) | R5 | C0 checks only the total = sum of lines; other priced groups use `api_calls` |
| R6 | `src/invoice.ts` | `promo-credit` flag ignored | R6 | no other group sends `promo-desk` events |
| R7 | `src/types.ts` | `maxEventQuantity: 64000` in the shared price list | R7 (runtime + static hash) | oracle normalize uses its own 64000 constant; nothing else reads `maxEventQuantity` |
| R8 | `src/invoice.ts` | small-line minimum removed | R8 | R3 (130), R5 (200), R6 (200) are above 120; C0 checks only the total = sum of lines |
