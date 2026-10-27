import { readFileSync, readdirSync, lstatSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { PreregManifestSchema, HeldoutManifestSchema, BOOTSTRAP_RESAMPLES, BOOTSTRAP_SEED } from '../core/contracts';
import type { PreregManifest } from '../core/contracts';
import { canonicalize } from '../core/canonical';
import { hashCanonical, sha256Hex } from '../core/hash';

/** Explicit public source roots only. Never recurse through arbitrary workspace or sealed files. */
export function sourceHash(root: string, roots: readonly string[]): string {
  const files: { path: string; sha256: string }[] = [];
  function visit(path: string): void {
    const stat = lstatSync(path);
    if (stat.isSymbolicLink()) throw new Error('source hash refuses symlinks');
    if (stat.isDirectory()) { for (const child of readdirSync(path).sort()) visit(join(path, child)); }
    else files.push({ path: relative(root, path).replaceAll('\\', '/'), sha256: sha256Hex(readFileSync(path)) });
  }
  for (const path of roots) visit(join(root, path));
  return hashCanonical(files.sort((a, b) => a.path.localeCompare(b.path, 'en')));
}
export function validatePrereg(raw: unknown, pins: { analysisCodeSha256: string; promptsSha256: string; matcherSha256: string; heldoutManifestSha256: string; runOrder: unknown }): PreregManifest {
  const m = PreregManifestSchema.parse(raw);
  for (const key of ['analysisCodeSha256', 'promptsSha256', 'matcherSha256', 'heldoutManifestSha256'] as const) if (m[key] !== pins[key]) throw new Error(`prereg pin mismatch: ${key}`);
  if (m.runOrder.sha256 !== hashCanonical(pins.runOrder)) throw new Error('prereg run-order hash mismatch');
  if (m.runOrder.runCount !== 216 || m.bootstrap.resamples !== BOOTSTRAP_RESAMPLES || m.bootstrap.seed !== BOOTSTRAP_SEED) throw new Error('prereg requires 216 held-out runs, 10000 bootstrap draws, seed 42001');
  if (m.priceTable.model !== m.model || !Number.isFinite(Date.parse(m.frozenAt))) throw new Error('prereg model/time mismatch');
  if (m.sampling.temperature !== 1 || m.sampling.maxOutput !== 2048) throw new Error('prereg sampling differs from the pinned live adapter (temperature 1, maxOutput 2048)');
  if (m.allowance.ceilingTokens !== 150000 || m.allowance.ceilingBinds !== (Math.ceil(2 * m.allowance.devSingleP75 / 10000) * 10000 > 150000)) throw new Error('prereg allowance ceiling mismatch');
  if (m.amendments.length !== 0) throw new Error('initial freeze cannot contain retrospective amendments');
  return m;
}
export function freezePrereg(destination: string, manifest: PreregManifest): string {
  const parsed = PreregManifestSchema.parse(manifest);
  writeFileSync(destination, canonicalize(parsed) + '\n', { flag: 'wx' });
  return hashCanonical(parsed);
}
/** Custodian supplies this manifest; importing it reads no held-out task, answer or sealed label. */
export function importHeldoutManifest(raw: unknown, destination: string): string {
  const m = HeldoutManifestSchema.parse(raw);
  if (!m.custodian.name.trim() || !m.custodian.modelFamily.trim() || !Number.isFinite(Date.parse(m.sealedAt))) throw new Error('custodian identity/seal time required');
  for (const f of m.files) {
    if (f.kind === 'task_file' && !/^tasks\/H(0[1-9]|1[0-2])\//.test(f.path)) throw new Error('heldout task manifest path outside H01..H12');
    if (f.kind === 'carry_sealed' && !f.path.startsWith('carry-sealed/')) throw new Error('sealed carry manifest path outside carry-sealed');
  }
  const taskIds = new Set(m.files.filter((f) => f.kind === 'task_file').map((f) => f.path.split('/')[1]));
  if (taskIds.size !== 0 && taskIds.size !== 12) throw new Error('a task-bearing heldout manifest must cover all twelve held-out tasks; carry-only instrument manifests are allowed before G-I');
  writeFileSync(destination, canonicalize(m) + '\n', { flag: 'wx' });
  return hashCanonical(m);
}
