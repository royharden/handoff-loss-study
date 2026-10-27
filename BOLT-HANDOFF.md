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
- Status: **source construction accepted in Dirty Mode; runtime unverified**; see README milestone states and docs/STATIC-REVIEW.md. Infrastructure Not required. Nothing has been installed, built or run.
- Owner prerequisites: none for the viewer. The local runner additionally needs owner decisions on spend/model, an independent custodian and Docker before any measured result can exist.

## Build and connection

| Item | Exact command or configuration name |
|---|---|
| Runtime / package manager | Node >= 22, npm. No lockfile yet (created by the first networked install, then committed). |
| Frozen install / dev | `npm ci && npm run build:viewer` (after the lockfile exists). No dev server is part of the study. |
| Build / output | `npm run build:viewer` → `viewer/dist` (static files). `npm run build` = typecheck + viewer build. |
| Type/lint/tests | `npm run typecheck`, `npm run lint`, `npm test`: **never run** (see `docs/DEFERRED-VALIDATION.md`). |
| Client file / public env names | Not required (the viewer opens a user-selected report.json generated from local results; no public env). |
| Missing config behavior | Viewer shows a SYNTHETIC/measured banner and an empty state when no results exist. |

## Database

Not required.

## Functions

Not required. No edge functions, no Supabase stubs.

## Server secrets to enter through settings

Not required for the viewer. The local runner's only secret, `ANTHROPIC_API_KEY`, is read on the owner's
machine and only in live mode (disabled by default); it must never be entered into Bolt.

## Auth, storage, and external steps

- Auth: Not required.
- Buckets: Not required. Result files larger than 50 MB move to a separately authorised release asset.
- Realtime: Not required.
- Scheduled/long jobs: Not required (the runner is a local CLI; its sandbox uses local Docker, not Bolt).
- Outside services: the live model provider (model/access/tranche approval pending; $40 total ceiling approved, $0 spent). Never put the local runner's key in the viewer or Bolt settings.

## Acceptance checks and receipts

| Check | Expected result | Outcome / receipt |
|---|---|---|
| Import/install/build | `npm ci` and `npm run build:viewer` pass | pending (never run) |
| Viewer renders committed results | banner shows edition; text escaped | pending (source written in M5, never built or rendered) |

## One prompt after GitHub import

### Inspect and prepare only

> Read BOLT-HANDOFF.md and inspect the imported source at the intended branch/revision. This app needs no
> database, functions, auth, storage or secrets. This is an inspection/preparation prompt, usable only
> after the owner authorizes import and closes Dirty Mode for validation. A lockfile is absent: first
> run the separately authorized `npm install --ignore-scripts`, review and commit the generated lockfile,
> then `npm ci && npm run build:viewer` and report whether the
> static viewer builds from `viewer/`. Do not create cloud resources, enter secrets, run the study CLI or
> publish. Do not describe unexecuted checks as complete.

The CLI, provider adapter and Docker sandbox remain local. Static viewer hosting cannot run the study,
prove container isolation or satisfy the independent custody gates. There are no migrations, functions,
buckets, authentication providers, public environment values or cloud resources to provision. Owner
publication approval and a remote are absent; this file grants neither. Dependency resolution, strict
types, lint, all tests, viewer build/render, container behavior and every measured tranche remain deferred
in docs/DEFERRED-VALIDATION.md.
