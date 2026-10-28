import { expect, it } from 'vitest';
import { resolve, join } from 'node:path';
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { TEST_GROUP_IDS } from '../src/core/ids';
import type { RepoPath } from '../src/core/ids';
import { LocalUnsafeSandbox } from '../src/sandbox/local';
import { snapshotOf, treeDigest } from '../src/sandbox/port';

it('discovers authored hidden groups independently of the host tests-only config', async () => {
  // Regression: inheriting the host config excluded hidden/ and marked every oracle group failed.
  const hidden = new Map<RepoPath, Uint8Array>(TEST_GROUP_IDS.map((group) => [
    `${group}.test.ts`, new TextEncoder().encode("import { it, expect } from 'vitest'; it('authored harness smoke', () => expect(1).toBe(1));"),
  ]));
  const root = resolve('.');
  const sandbox = new LocalUnsafeSandbox({ provider: 'null', origin: 'fixture', repoRoot: root,
    hidden, vitestEntry: resolve('node_modules/vitest/vitest.mjs'), timeoutMs: 30_000 });
  const results = await sandbox.grade(snapshotOf(new Map()), treeDigest(hidden));
  expect(Object.values(results.groups).every((group) => group.passed)).toBe(true);
}, 300_000);

it('waits for each timed-out worker to close before cleaning its owned cwd', async () => {
  // Regression: resolving immediately after kill raced Windows cwd handles and threw EPERM.
  const root = resolve('.'); const base = resolve('.hls-tmp'); mkdirSync(base, { recursive: true });
  const fixture = mkdtempSync(join(base, 'timeout-test-'));
  const entry = join(fixture, 'hang.mjs');
  writeFileSync(entry, 'setInterval(() => {}, 1000);\n');
  try {
    const hidden = new Map<RepoPath, Uint8Array>();
    const sandbox = new LocalUnsafeSandbox({ provider: 'null', origin: 'fixture', repoRoot: root,
      hidden, vitestEntry: entry, timeoutMs: 150 });
    const result = await sandbox.grade(snapshotOf(new Map()), treeDigest(hidden));
    expect(Object.values(result.groups).every((group) => !group.passed && group.failure === 'timeout')).toBe(true);
  } finally { rmSync(fixture, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); }
}, 30_000);
