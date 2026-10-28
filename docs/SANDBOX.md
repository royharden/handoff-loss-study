# Sandbox

> M4 source constructed in Dirty Mode. **No image has been built and no container has run.**
> Containment, protocol, cleanup and runtime behavior remain unverified; see DEFERRED-VALIDATION.md (M4 section).

## Boundary (D17)

- **Candidate container:** fresh, offline; holds only the extracted candidate source, the public shim and
  runtime dependencies. No hidden test, predicate, oracle or mutant is mounted. Serves the candidate's
  exported functions over JSON-RPC on stdio.
- **Grader container:** separate, offline; holds the hidden vitest groups and an RPC client.
- **Trusted CLI** relays JSON-RPC between the two stdio streams and enforces size/time limits. Verdicts come
  only from the grader container's results file; candidate stdout never supplies a verdict; protocol noise,
  oversized output, exit or timeout fails the affected invocation.
- Static checks (protected-file hashes, forbidden identifiers via the TS compiler API) run in the trusted CLI.
- Every container: `--network none`, read-only root, tmpfs `/tmp`, `--memory 1g --cpus 1 --pids-limit 128
  --cap-drop ALL`, non-root uid (episode/candidate 10001, grader 10002), `--pull never`, labels
  `hls.owner=<run_id>`, `hls.app=handoff-loss-study`.
- `LocalUnsafeSandbox` runs authored code only (oracle, fixtures) and refuses a live provider.

## Worker views and tool policy

Worker workspaces are detached regular-file byte maps created from the loader's symlink-refusing
`repo/` tree. They contain no host directory handle. Paths are exact POSIX allowlist entries;
absolute paths, traversal, backslashes, symlink records and out-of-module writes are refused and logged.
Every initial view includes the title and `brief.md`. Task requirement metadata, hidden tests,
oracle/mutant/alternate files, evaluator predicates and static-check configuration never enter a prompt.

| Policy / phase | Initial instruction text | Readable file roots | Writable files |
| --- | --- | --- | --- |
| single | Full spec + common brief | Public starter `repo/` only | Exactly module A and module B |
| role planner / phase 1 | Full spec + common brief | Public starter `repo/` only | None |
| role implementer / phase 2 | Delivered handoff + common brief, no spec | Public starter `repo/` only | Exactly module A and module B |
| context A / phase 1 | A slice + common brief | A module and protected interface only | None; phase-1 tools exclude writes/tests |
| context B / phase 1 | B slice + common brief | B module and protected interface only | None; phase-1 tools exclude writes/tests |
| context A / phase 2 | A slice, B's frozen handoff + common brief | Its private A module and protected interface only | Exactly A module |
| context B / phase 2 | B slice, A's frozen handoff + common brief | Its private B module and protected interface only | Exactly B module |
| spec-blind (dev only) | Task title + common brief, no spec/slice | Public starter `repo/` only | Exactly module A and module B |

There is no shell tool. The closed tools are list/read/write/edit, public smoke tests, submit handoff,
and finish. A planner cannot write. Context phase-2 maps are separate clones; they have no peer source
bytes and cannot read the peer module. Both phase-1 handoffs freeze before either is exchanged. The
merge selects A only from A and B only from B; protected/public starter files remain starter bytes.
There is no coordinator-model merge or repair round. Public tests for a context worker receive only
that private snapshot plus the trusted public tests; an unavailable peer module may make them fail.

Every provider payload is audited before dispatch. Initial-view, received-handoff and system segments
retain provenance; own assistant turns and reads of own writes are `self`. Public-test output exposes
fixed pass/count fields only, so source echoes never silently become third-party instruction. Missing
public-test ports return an explicit tool error, never a fabricated pass.

## Grading and lifecycle

`DockerPairSandbox` checks protected hashes and forbidden identifiers in the trusted host CLI using
the TypeScript compiler API. A protected mismatch fails only trusted `doNotTouchGroups`; a forbidden
identifier fails every group. Neither check executes candidate code. A supplied digest-pinned candidate
image has only Node/tsx plus `shim.ts` and the public protocol; the extracted `/candidate` mount is a
trusted public `src/*.ts` allowlist. There is **no evaluator, credential, home-directory or Docker-socket
mount**. The candidate image has no hidden test, predicate, oracle or mutant source. The grader mounts
`/hidden` read-only and its own `/results` writable; candidate source is absent there.

Each group gets a fresh candidate/grader pair. The grader's Vitest setup sends exported-function calls
over an internal Unix socket to its trusted entry process, which serialises calls onto stdio. The host
relay validates JSON-RPC shape, request/response ID pairing, UTF-8 framing, 64 KiB frames, a 5-second
per-invocation timeout, a group wall timeout, bounded stderr and a 4 MiB candidate-output lifetime cap.
Noise, oversize output, candidate exit or timeout fails the affected group. Candidate output supplies
function values only. The trusted host accepts a verdict solely from `/results/result.json`, mounted
only into the grader. Candidate stdout is never a verdict input.

Container starts require an injected authorization/agent-ports ownership check. Names are unique and
labels identify the exact owner run. No ports are published. The common argv adds every D17 limit,
non-root UID, immutable image digest, `--pull never`, and `no-new-privileges`. Cleanup inspects labels
before removing only that owned name; it confirms absent auto-removed containers via `docker ps`.
Both pair members receive cleanup attempts. An unconfirmed cleanup or ownership/digest violation is an
integrity stop, and burns a T2 set. Normal candidate protocol failures remain failed group outcomes.

The public smoke-test port uses a separate episode image and only an extracted private snapshot plus
trusted public tests. It returns a fixed JSON summary. It has the same ownership/consent and offline
resource limits, but its output never contributes hidden verdicts. Source execution is confined to
containers; `LocalUnsafeSandbox` remains authored-code-only and rejects model output.

## Activation and deferred checks

Live calls are disabled by default. The Anthropic adapter requires the hard switch, exact unexpired
approval scope, named approver/Roy signed-decision reference checked by an explicit verifier, matching
price-table hash, and an atomic durable tranche-spend reservation. The only key lookup is
`ANTHROPIC_API_KEY` after those checks; exact loaded key values are redacted from response strings and
tool input fields before completion mapping/events. Network/transport errors expose generic messages.
The adapter sends one fetch attempt, with no SDK retries; only the budgeted ledger may retry once.
Cached input, replayed history and failed attempts consume the pooled allowance. Unknown usage books
the reservation and halts; an overrun is never clamped and stops the tranche.

Run `npm run check:containment`, `npm run check:budget`, the M4 test source files, real image builds and
D-class spoof/hang/cleanup checks only after Dirty Mode ends and the applicable consent is granted.
Later cleanup evidence must include
`docker ps -a --filter label=hls.app=handoff-loss-study --filter label=hls.owner=<run_id>`.
No such validation is claimed here. Docker builds/install commands in Dockerfiles are deferred source,
not evidence that any image/dependency is available.


## Operator ledger identity (Round 2)
The trusted host supplies `LiveActivationPort.agentPorts` with the actual agent-ports claim's
`project`, `instance` and `owner`. Live dispatch validates the required non-placeholder identity
before opening the stable journal or creating provider effects. Candidate, grader and public-test
arguments include `agentports.project`, `agentports.instance`, `agentports.owner`, plus existing
`hls.owner` / `hls.app` labels. Label validation is syntactic; `authorizeContainers` must still
verify real consent, ledger registration and ownership before every start. No default identities
are invented. Pure argv tests pass; no image, container isolation or cleanup claim follows.

Local authored-only timeout validation confirms the direct spawned child has closed before returning
a timeout result or cleaning its cwd; unconfirmed closure fails the operation. This does not prove
termination of every Vitest descendant on timeout. Linux and full worker-tree timeout/cleanup remain
unverified. Live model output never uses this host sandbox.
