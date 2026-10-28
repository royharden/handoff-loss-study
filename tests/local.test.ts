import { expect, it } from 'vitest';
import { resolve } from 'node:path';
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
