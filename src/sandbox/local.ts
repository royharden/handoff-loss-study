/**
 * LocalUnsafeSandbox (PLAN.md §5): grades AUTHORED code only (oracle, untouched starter, mutants,
 * alternates, fixtures) on the host with the project's own vitest, for the admission gate conditions
 * 1–3 and 9. It is "unsafe" because there is no container boundary, which is acceptable only for code the
 * builder or custodian wrote. Model output is graded exclusively by the D17 Docker pair (M4).
 *
 * Refusals (constructor):
 *   - a live provider (`anthropic`): this sandbox never runs anything connected to a live run;
 *   - origin `model_output`;
 *   - a work root outside `<repo>/.hls-tmp/` (gitignored scratch; inside the repo so hidden tests resolve
 *     `vitest` from the project's node_modules).
 * At grade time it refuses a hidden bundle whose digest differs from the one requested.
 *
 * Mechanics: write the snapshot to a fresh temp dir, copy hidden/ to <dir>/hidden, run
 * `node <vitestEntry> run hidden/<G>.test.ts --root <dir>` once per group G in C0, R1..R8 with a minimal
 * environment (PATH only, no credentials) and a timeout; exit code 0 = pass. Remove the temp dir.
 *
 * NEVER EXECUTED during Dirty Mode construction (docs/DEFERRED-VALIDATION.md DV-M2-05). Not reachable from
 * `hls selftest` or `hls demo`; `hls validate --execute` loads it with a dynamic import.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { GroupResultsSchema } from '../core/contracts';
import type { GroupResult, GroupResults, SandboxPort, SourceSnapshot } from '../core/contracts';
import type { Sha256Hex } from '../core/hash';
import { TEST_GROUP_IDS } from '../core/ids';
import type { ProviderName, RepoPath, TestGroupId } from '../core/ids';
import { assertKeylessProvider } from '../providers/port';
import { treeDigest } from './port';
import type { FileTree, SnapshotOrigin } from './port';

export interface LocalUnsafeSandboxOptions {
  /** Provider of the run this grading belongs to; `anthropic` is refused. */
  readonly provider: ProviderName;
  /** `model_output` is refused (D17). */
  readonly origin: SnapshotOrigin;
  /** Repository root (contains package.json and node_modules). */
  readonly repoRoot: string;
  /** Hidden test files keyed by path relative to hidden/ (e.g. `R1.test.ts`). */
  readonly hidden: FileTree;
  /** Path to vitest's CLI entry, e.g. <repo>/node_modules/vitest/vitest.mjs. */
  readonly vitestEntry: string;
  readonly timeoutMs?: number;
}

export class LocalSandboxRefusedError extends Error {
  constructor(message: string) {
    super(`LocalUnsafeSandbox: ${message}`);
    this.name = 'LocalSandboxRefusedError';
  }
}

function writeTree(root: string, tree: FileTree): void {
  for (const [p, bytes] of tree) {
    const target = resolve(root, ...p.split('/'));
    if (!target.startsWith(root + sep)) throw new LocalSandboxRefusedError(`path escapes the work dir: ${p}`);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, bytes);
  }
}

function runGroup(nodeBin: string, args: readonly string[], cwd: string, timeoutMs: number): Promise<GroupResult> {
  const started = Date.now();
  return new Promise((resolvePromise, reject) => {
    const child = spawn(nodeBin, [...args], {
      cwd,
      // Windows Node/OpenSSL needs SystemRoot for OS entropy. Copy only named non-secret OS paths.
      env: { PATH: process.env['PATH'] ?? '', SystemRoot: process.env['SystemRoot'] ?? '',
        WINDIR: process.env['WINDIR'] ?? '', TEMP: process.env['TEMP'] ?? '', TMP: process.env['TMP'] ?? '',
        NODE_ENV: 'test', CI: '1' },
      stdio: ['ignore', 'ignore', 'ignore'],
      shell: false,
      windowsHide: true,
    });
    let settled = false;
    let timedOut = false;
    let spawnFailed = false;
    let closeDeadline: ReturnType<typeof setTimeout> | undefined;
    const finish = (r: GroupResult): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearTimeout(closeDeadline);
      resolvePromise(r);
    };
    const timer = setTimeout(() => {
      timedOut = true;
      // A kill request is not termination confirmation. Keep the cwd alive until close.
      child.kill('SIGKILL');
      closeDeadline = setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(new LocalSandboxRefusedError('worker termination unconfirmed; grading stopped'));
      }, 2_000);
    }, timeoutMs);
    child.on('error', () => { spawnFailed = true; });
    child.on('close', (code) => {
      finish(timedOut ? { passed: false, failure: 'timeout', durationMs: Date.now() - started }
        : spawnFailed ? { passed: false, failure: 'grader_error', durationMs: Date.now() - started }
        : code === 0 ? { passed: true, failure: null, durationMs: Date.now() - started }
        : { passed: false, failure: 'assertion', durationMs: Date.now() - started });
    });
  });
}

export class LocalUnsafeSandbox implements SandboxPort {
  readonly kind = 'local_unsafe' as const;
  readonly #opts: LocalUnsafeSandboxOptions;
  readonly #workRoot: string;

  constructor(opts: LocalUnsafeSandboxOptions) {
    assertKeylessProvider('LocalUnsafeSandbox', opts.provider);
    if (opts.origin === 'model_output') throw new LocalSandboxRefusedError('model output is graded only by the Docker pair (D17)');
    this.#opts = opts;
    this.#workRoot = resolve(opts.repoRoot, '.hls-tmp', 'local-sandbox');
    const rel = relative(resolve(opts.repoRoot), this.#workRoot);
    if (rel.startsWith('..') || rel === '') throw new LocalSandboxRefusedError('work root must be inside <repo>/.hls-tmp');
  }

  async grade(snapshot: SourceSnapshot, hiddenBundleDigest: Sha256Hex): Promise<GroupResults> {
    if (treeDigest(this.#opts.hidden) !== hiddenBundleDigest) throw new LocalSandboxRefusedError('hidden bundle digest mismatch');
    if (treeDigest(snapshot.files) !== snapshot.digest) throw new LocalSandboxRefusedError('snapshot digest mismatch');
    mkdirSync(this.#workRoot, { recursive: true });
    const dir = mkdtempSync(join(this.#workRoot, 'g-'));
    try {
      writeTree(dir, snapshot.files);
      const hiddenTree = new Map<RepoPath, Uint8Array>();
      for (const [p, b] of this.#opts.hidden) hiddenTree.set(`hidden/${p}`, b);
      writeTree(dir, hiddenTree);
      // The host config deliberately includes tests/ only. Never inherit it for authored hidden groups.
      const config = join(dir, 'vitest.config.mjs');
      writeFileSync(config, 'export default ' + JSON.stringify({ test: {
        include: ['hidden/**/*.test.ts'], pool: 'forks', fileParallelism: false,
        maxWorkers: 1, minWorkers: 1, testTimeout: 20_000,
      } }) + ';\n');
      const timeoutMs = this.#opts.timeoutMs ?? 60_000;
      const groups = {} as Record<TestGroupId, GroupResult>;
      for (const g of TEST_GROUP_IDS) {
        groups[g] = await runGroup(process.execPath, [this.#opts.vitestEntry, 'run', `hidden/${g}.test.ts`, '--root', dir, '--config', config, '--maxWorkers', '1', '--minWorkers', '1'], dir, timeoutMs);
      }
      return GroupResultsSchema.parse({
        snapshotDigest: snapshot.digest,
        hiddenBundleDigest,
        graderImageDigest: null,
        sandbox: 'local_unsafe',
        groups,
      });
    } finally {
      // Windows/OneDrive scanners may briefly retain a handle after the worker exits.
      // Retry only this owned temp directory; exhaustion still fails the grading operation.
      rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  }
}
