import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { importHeldoutManifest, validatePrereg } from '../src/store/prereg';
describe('M5 sealed custody and prereg pins', () => {
  it('refuses incomplete prereg metadata and missing pins rather than claiming freeze', () => { expect(() => validatePrereg({}, { analysisCodeSha256: '', promptsSha256: '', matcherSha256: '', heldoutManifestSha256: '', runOrder: [] })).toThrow(); });
  it('imports only manifest metadata, requires all 12 task namespaces and refuses overwrites', () => {
    const root = mkdtempSync(join(tmpdir(), 'hls-manifest-')); const destination = join(root, 'heldout.manifest.json');
    // Manifest digests are mechanical test strings, no task/spec/solution/label content is authored.
    const manifest = { schemaVersion: 1, custodian: { name: 'SYNTHETIC metadata fixture', modelFamily: 'non-builder custodian placeholder' }, sealedAt: '2026-10-27T00:00:00Z', files: Array.from({ length: 12 }, (_, i) => ({ kind: 'task_file', path: `tasks/H${String(i + 1).padStart(2, '0')}/task.json`, bytes: 0, sha256: '0'.repeat(64) })) };
    try { expect(importHeldoutManifest(manifest, destination)).toMatch(/^[0-9a-f]{64}$/); expect(() => importHeldoutManifest(manifest, destination)).toThrow(); writeFileSync(join(root, 'unrelated.txt'), 'not opened'); expect(() => importHeldoutManifest({ ...manifest, files: manifest.files.slice(1) }, join(root, 'bad.json'))).toThrow(); }
    finally { rmSync(root, { recursive: true, force: true }); }
  });
});
