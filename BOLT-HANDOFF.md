# Bolt infrastructure handoff: handoff-loss-study

## Target and readiness

- Repository / branch / prepared revision: local Git only (no remote), branch `master`; no revision prepared for import.
- App root: repository root.
- Database: **none** (Not required). Results are committed gzipped hash-chained JSONL plus `results.json` / `results.md`.
- Target: Not required.
- Existing baseline / applied migrations: Not required (no database).
- Hosting: optional static hosting of the offline results viewer (`viewer/`, built to `viewer/dist`). The study runner is a **local-only CLI** and is not hostable.
- Publication: prepare only; repo visibility and any write-up are owner decisions (pending).
- Bolt action: inspect and prepare only.
- Status: **construction accepted; partial local validation passed under the Round 2 Dirty Mode exception**. Dependencies installed with scripts disabled; strict types, lint, 21 unit-test files / 219 tests and viewer build passed. Six dev matrices,12 alternates,18 public smoke variants and the SYNTHETIC runner/verify/report passed; Docker, study custody/rights and live tranches remain pending. Infrastructure Not required.
- Owner prerequisites: no secret for the viewer. The local runner still needs genuine access/model decisions, custody/rights evidence and sandbox validation before any measured result. Rights NOT confirmed; local-only use; independence and Roy confirmation PENDING.

## Build and connection

| Item | Exact command or configuration name |
|---|---|
| Runtime / package manager | Node >= 22, npm. `package-lock.json` committed; scripts-disabled clean offline install passed. |
| Frozen install / dev | `npm ci --ignore-scripts && npm run build:viewer`. No dev server is part of the study. |
| Build / output | `npm run build:viewer` → `viewer/dist` (static files). `npm run build` = typecheck + viewer build. |
| Type/lint/tests | `npm run typecheck`, `npm run lint`: PASS; unit suite: 21 files / 219 tests PASS. Scope and remaining checks: `docs/DEFERRED-VALIDATION.md`. |
| Client file / public env names | Not required (the viewer opens a user-selected report.json generated from local results; no public env). |
| Missing config behavior | Viewer shows a SYNTHETIC/measured banner and an empty state when no results exist. |

## Database

Not required.

## Functions

Not required. No edge functions, no Supabase stubs.

## Server secrets to enter through settings

Not required for the viewer. The local runner's only secret, `ANTHROPIC_API_KEY`, is read on the owner's
machine and only in live mode (disabled by default); it must never be entered into Bolt. The named
placeholder is `<PLACEHOLDER_API_KEY>`; `<PLACEHOLDER_MODEL_PIN>` denotes the future exact model in the
runner price/approval/prereg configuration. Both are documentation-only, unresolved, and confer no
activation authority. Never read credential or .env files to fill them.

## Auth, storage, and external steps

- Auth: Not required.
- Buckets: Not required. Result files larger than 50 MB move to a separately authorised release asset.
- Realtime: Not required.
- Scheduled/long jobs: Not required (the runner is a local CLI; its sandbox uses local Docker, not Bolt).
- Outside services: the live model provider (model/access/tranche approval pending; $40 total ceiling approved, $0 spent). Never put the local runner's key in the viewer or Bolt settings.

## Acceptance checks and receipts

| Check | Expected result | Outcome / receipt |
|---|---|---|
| Local install / viewer build | scripts-disabled install and viewer build | install, clean offline `npm ci --ignore-scripts` and `build:viewer` PASS; import not authorized or performed |
| Viewer renders results | banner shows edition; text escaped | build PASS; browser rendering pending |

## One prompt after GitHub import

### Inspect and prepare only

> Read BOLT-HANDOFF.md and inspect the imported source at the intended branch/revision. This app needs no
> database, functions, auth, storage or secrets. This is an inspection/preparation prompt, usable only
> after the owner authorizes import and the relevant validation. A lockfile now exists. Use
> `npm ci --ignore-scripts && npm run build:viewer` and report whether the
> static viewer builds from `viewer/`. Do not create cloud resources, enter secrets, run the study CLI or
> publish. Do not describe unexecuted checks as complete.

The CLI, provider adapter and Docker sandbox remain local. Static viewer hosting cannot run the study,
prove container isolation or satisfy the independent custody gates. There are no migrations, functions,
buckets, authentication providers, public environment values or cloud resources to provision. Owner
publication approval and a remote are absent; this file grants neither. The local dependency install,
strict types, lint, unit suite and viewer build passed. Local authored task admission checks pass. Browser rendering, container behavior, custody and every measured tranche remain pending in docs/DEFERRED-VALIDATION.md.
No human independence, rights confirmation or public license adoption follows from the local checks.
