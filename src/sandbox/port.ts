/**
 * SandboxPort (PLAN.md §5, D17). The interface lives in src/core/contracts.ts (docs/DESIGN.md M1 choice
 * 4); this module re-exports it and adds snapshot helpers shared by the local sandbox (M2), the gate
 * (src/tasks/validate.ts) and the Docker pair (M4).
 *
 * Snapshot digest: sha256 of the canonical JSON of the sorted list of [path, sha256(bytes)] pairs, so the
 * digest is independent of read order and of the platform's path separator.
 *
 * Pure module apart from hashing (node:crypto via core).
 */
export type { GroupResult, GroupResults, SandboxPort, SourceSnapshot } from '../core/contracts';
export { GroupResultsSchema } from '../core/contracts';
import type { SourceSnapshot } from '../core/contracts';
import { hashCanonical, sha256Hex } from '../core/hash';
import type { Sha256Hex } from '../core/hash';
import type { RepoPath } from '../core/ids';

export type FileTree = ReadonlyMap<RepoPath, Uint8Array>;

/** Shared port error contract; callers need not import an executable sandbox adapter. */
export function isSandboxIntegrityError(error: unknown): error is Error & { readonly integrityStop: true } {
  return error instanceof Error && 'integrityStop' in error && error.integrityStop === true;
}

/** Where a graded snapshot came from. Model output is graded only by the Docker pair (D17). */
export type SnapshotOrigin = 'oracle' | 'untouched' | 'mutant' | 'alternate' | 'fixture' | 'model_output';

export function treeDigest(tree: FileTree): Sha256Hex {
  const entries = [...tree.entries()]
    .map(([path, bytes]) => [path, sha256Hex(bytes)] as const)
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([p, h]) => [p, h]);
  return hashCanonical(entries);
}

export function snapshotOf(tree: FileTree): SourceSnapshot {
  return { digest: treeDigest(tree), files: new Map(tree) };
}

/** Overlay `top` on `base` (files in `top` replace or add; nothing is deleted). */
export function overlay(base: FileTree, top: FileTree): Map<RepoPath, Uint8Array> {
  const out = new Map(base);
  for (const [p, b] of top) out.set(p, b);
  return out;
}
