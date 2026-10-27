# Deferred validation

Every check that needs execution (install, type-check, lint, tests, builds, containers, live calls) and
therefore could not run during Dirty Mode construction. **None of these has run; none is reported as
passed.** Each later milestone appends its rows. Owner-question numbers (Q#) refer to the owner decision
request kept outside this repo: Q1 spend/model, Q2 independent custodian + rights, Q3 Docker, Q4
publication, Q5 calibration-failure policy, Q6 close Dirty Mode / start validation.

Classes: **K** keyless local check (no spend, needs an install), **D** Docker check, **L** live (spend).

| ID | Class | What | Why deferred | Exact later command | Needs owner? (Q#) |
|---|---|---|---|---|---|
| DV-M1-01 | K | Dependency versions pinned in `package.json` exist and resolve together (zod 3.24.2, typescript 5.8.3, tsx 4.19.2, vitest 3.1.1, eslint 9.24.0, @eslint/js 9.24.0, typescript-eslint 8.29.0, @types/node 22.14.0, react / react-dom 18.3.1, @types/react 18.3.18, @types/react-dom 18.3.5, vite 6.2.6, @vitejs/plugin-react 4.3.4, @anthropic-ai/sdk 0.39.0). **Versions are unverified until install.** | Dirty Mode: no installs, no network | `npm install --ignore-scripts` (first install creates `package-lock.json`; commit it), then `npm ci` | Yes, Q6 (and network) |
| DV-M1-02 | K | Strict type-check of `src/`, `tests/`, configs (incl. `erasableSyntaxOnly`, `verbatimModuleSyntax`, `noUncheckedIndexedAccess`; zod 3 `discriminatedUnion` members are plain objects) | No `tsc` in Dirty Mode | `npm run typecheck` | Yes, Q6 |
| DV-M1-03 | K | ESLint flat config loads; rules: no enum/namespace/parameter properties, `consistent-type-imports`, no network/provider/process import or `fetch` in `src/core` | No eslint in Dirty Mode | `npm run lint` | Yes, Q6 |
| DV-M1-04 | K | Canonical JSON and hash unit tests: key order, -0 / NaN / ±Infinity / undefined / sparse / cycle / non-plain rejection, `parseCanonical`, `sha256("abc") = ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad`, empty-string vector, chain links; contract smoke tests (D7 reservation, D6 allowance, Usage, fixed brief, run ids, edition mixing, approval) | No vitest in Dirty Mode | `npx vitest run tests/core.test.ts` | Yes, Q6 |
| DV-M1-05 | K | `vitest.config.ts` loads and picks up `tests/**/*.test.ts` only | No vitest in Dirty Mode | `npm test` | Yes, Q6 |
| DV-M1-06 | K | `npm run` aliases resolve to working `cli/hls.ts` subcommands (`demo`, `selftest`, `fixture`, `validate tasks/dev`, `check <name>`, `verify`, `plan`, `run`, `report`). `cli/hls.ts` does not exist in M1; M2/M4/M5 add the subcommands (contract in `docs/DESIGN.md` §4) | CLI not yet written; no tsx in Dirty Mode | `npm run hls -- --help`, then each alias after M5 | Yes, Q6 |
| DV-M1-07 | K | Viewer build script (`vite build --config viewer/vite.config.ts`) — config file is written in M5 | Viewer not yet written; no vite in Dirty Mode | `npm run build:viewer` | Yes, Q6 |
| DV-M1-08 | K | `node --check` was run on Node v24.18.0 (type stripping on by default). The declared engine is Node ≥ 22; on Node 22 releases without default type stripping, `node --check file.ts` may fail as a tooling limit, not a code defect. Product execution uses `tsx`, not Node type stripping | Static-only check environment | `node --version && npm run typecheck` on the validation machine | Yes, Q6 |
| DV-M1-09 | K | Zod refinements behave as designed at the pinned version: refinements on dirty input (e.g. Reservation formula guard), `superRefine` on `discriminatedUnion` (HandoffSchema, RunRecordSchema), recursive `JsonValueSchema` | Needs runtime | `npx vitest run tests/core.test.ts` plus M2 contract tests | Yes, Q6 |
