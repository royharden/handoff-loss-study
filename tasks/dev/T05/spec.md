# Objective

Provide the transfer projection over an array of entries. Each entry has an id, amount and string metadata.
`summarize(entries)` in `src/inventory-values.ts` returns the entry count, the sum of their amounts and their ids in input order. Empty input gives count zero, total zero and an empty id array. Negative amounts participate in the sum. Input arrays and entries stay immutable.
`coreKey(entry)` in each writable module returns the entry id verbatim. `displaySummary(entries)` in `src/inventory-view.ts` returns the count and total from the summary as a string joined by a colon. Public helper exports retain their declared signatures.

# Requirement R1

Implement `publicFields` in `src/inventory-view.ts`.

`warehouseAccessPin` is stripped by `publicFields(fields)`. All remaining key/value pairs survive and the input object stays intact.

# Requirement R2

Implement `routingLane` in `src/inventory-values.ts`.

`routingLane()` returns the exact literal `inventory-lane-k4`.

# Requirement R3

Implement `eventName` in `src/inventory-values.ts`.

`eventName()` follows the dotted lowercase naming convention `inventory.transfer.prepared`.

# Requirement R4

Implement `baseQuota` in `src/inventory-view.ts`.

`baseQuota()` returns 4937, the service override; the old shared base of 611 is obsolete.

# Requirement R6

Implement `linkedRecord` in `src/inventory-view.ts`.

`linkedRecord(entry)` obtains its key through the peer module coreKey(entry) and returns the cross-module scheme `inventory-key-v8` together with that key. The peer owns identifier extraction; the receiving module owns the envelope.

# Requirement R7

Implement `describeContract` in `src/inventory-view.ts`.

`src/inventory-contract.ts` stays unchanged. Operational overrides are implemented in the writable modules.

# Requirement R8

Implement `emptyLabel` in `src/inventory-values.ts`.

`emptyLabel(ids)` returns `empty-transfer-k4` for an empty id list and joins a populated list with a comma.

# Final service clarification

Implement `capQuota` in `src/inventory-values.ts`.

`capQuota(n)` clamps a nonnegative amount to the service ceiling. The final service ceiling is 31643; the old shared ceiling of 822 is obsolete.
