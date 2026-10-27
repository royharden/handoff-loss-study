# Sandbox

> Skeleton (M1). Completed in M4. **No image has been built and no container has run** (owner decision on
> Docker pending).

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

## TODO(M4)

- Read roots and write roots per policy and phase (single, planner, implementer, context A/B phase 1 and
  phase 2, spec-blind).
- Statement: no evaluator, credential, home-directory or Docker-socket mount; no shell tool.
- Container lifecycle and cleanup check (`docker ps -a --filter label=hls.app=handoff-loss-study` empty).
