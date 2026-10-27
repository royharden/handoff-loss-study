# Vendored code

Rule (PLAN.md D26): code reused from another project (for example S20, S16, S39, S3) is **copied, then
passed through this repo's own conformance tests** before use. No runtime dependency on another app, on
A-Mail, or on M11 (S42 ports only mirror M11 field names). Every copied file gets one row below in the
same commit that adds it; a row without a passing conformance test is not admitted.

| File in this repo | Source project / path | Source revision | Licence | Modifications | Conformance test | Added by |
|---|---|---|---|---|---|---|

(No vendored code yet.)
