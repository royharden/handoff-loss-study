import { z } from 'zod';
import { RepoPathSchema } from '../core/ids';
import { hashCanonical, sha256Hex } from '../core/hash';

export const SnapshotSchema = z.array(z.object({ path: RepoPathSchema, base64: z.string(), sha256: z.string().regex(/^[0-9a-f]{64}$/) }).strict());
export type StoredSnapshot = z.infer<typeof SnapshotSchema>;
export function snapshotOf(files: ReadonlyMap<string, Uint8Array>): StoredSnapshot {
  return [...files].sort(([a], [b]) => a.localeCompare(b, 'en')).map(([path, bytes]) => ({ path, base64: Buffer.from(bytes).toString('base64'), sha256: sha256Hex(bytes) }));
}
export function verifySnapshot(raw: unknown): StoredSnapshot {
  const files = SnapshotSchema.parse(raw);
  const paths = files.map((f) => f.path);
  if (new Set(paths).size !== paths.length || paths.join('\n') !== [...paths].sort((a, b) => a.localeCompare(b, 'en')).join('\n')) throw new Error('snapshot paths duplicate or unsorted');
  for (const f of files) {
    const bytes = Buffer.from(f.base64, 'base64');
    if (bytes.toString('base64') !== f.base64 || sha256Hex(bytes) !== f.sha256) throw new Error(`snapshot digest mismatch: ${f.path}`);
  }
  return files;
}
export function storedSnapshotDigest(files: StoredSnapshot): string { return hashCanonical(files.map(({ path, sha256 }) => [path, sha256]).sort(([a], [b]) => (a ?? '') < (b ?? '') ? -1 : (a ?? '') > (b ?? '') ? 1 : 0)); }
