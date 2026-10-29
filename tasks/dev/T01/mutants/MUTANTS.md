# T01 mutants

Each `R<n>/` is an overlay applied on top of `repo/ ⊕ oracle/`. It replaces exactly one file with a copy of
the oracle file (for R7: of the starter `src/contracts.ts`) that differs in one line, marked `MUTANT R<n>`.
No mutant touches a C0 code path (`_c0.ts` assertions: growth ratio, done/retry/give_up at
`maxAttempts`, header forwarding, event `deliveryId`). Expected: each mutant fails exactly its own group;
no declared couplings.

| Mutant | File | One-line change | Breaks | Why the other groups still pass |
|---|---|---|---|---|
| R1 | `src/schedule.ts` | signature filter removed | R1 | R2 reads only the lane header; C0 reads `content-type`, `x-tenant` |
| R2 | `src/schedule.ts` | lane header line removed | R2 | no other group reads `x-relay-lane` |
| R3 | `src/schedule.ts` | event name `RetryScheduled` | R3 | C0 reads only `deliveryId` |
| R4 | `src/schedule.ts` | base = `DEFAULT_POLICY.baseDelayMs` (240) | R4 | C0 checks ratios; R5 raw wait 240·3⁴ = 19440 > 13000 still capped; R6 compares with the candidate's own `computeDelay` |
| R5 | `src/dispatch.ts` | cap = `DEFAULT_POLICY.retryCeiling` (9000) | R5 | R6 waits 1500 and 4500 stay below 9000; C0 checks only `runAt ≥ at` |
| R6 | `src/dispatch.ts` | `computeDelay(used)` (one-based index) | R6 | R5 raw wait 1500·3⁵ is still capped at 13000; C0 checks only `runAt ≥ at` |
| R7 | `src/contracts.ts` | `retryCeiling: 13000` in the shared default | R7 (runtime + static hash) | oracle dispatch uses its own 13000 constant; nothing else reads `retryCeiling` |
| R8 | `src/dispatch.ts` | 410 branch removed | R8 | C0 and the other groups send no 410 |
