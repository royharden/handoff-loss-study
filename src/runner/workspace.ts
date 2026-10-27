import { RepoPathSchema } from '../core/ids';
import type { RepoPath } from '../core/ids';
import type { FileTree } from '../sandbox/port';

export class PathRefusal extends Error {
  readonly reason: 'outside_view' | 'out_of_module' | 'path_traversal' | 'absolute_path' | 'symlink' | 'protected_file';
  readonly requestedPath: string;
  constructor(path: string, reason: PathRefusal['reason']) { super(`path refused: ${reason}`); this.reason = reason; this.requestedPath = path; }
}
/** Detached regular-file bytes only: no host paths, filesystem traversal or symlink following. */
export class WorkerWorkspace {
  readonly readable: ReadonlySet<string>;
  readonly writable: ReadonlySet<string>;
  readonly protectedPaths: ReadonlySet<string>;
  readonly ownWrites = new Set<string>();
  readonly #files = new Map<RepoPath, Uint8Array>();
  constructor(source: FileTree, readable: readonly string[], writable: readonly string[], protectedPaths: readonly string[] = [], symlinks: readonly string[] = []) {
    if (symlinks.length) throw new PathRefusal(symlinks[0] ?? '', 'symlink');
    this.readable = new Set(readable); this.writable = new Set(writable); this.protectedPaths = new Set(protectedPaths);
    for (const path of this.readable) { this.path(path); const bytes = source.get(path); if (bytes) this.#files.set(path, new Uint8Array(bytes)); }
  }
  path(raw: string): RepoPath {
    if (/^[A-Za-z]:|^[/\\]|\\|\0/.test(raw)) throw new PathRefusal(raw, 'absolute_path');
    if (raw.split('/').some((part) => part === '..' || part === '.' || part === '')) throw new PathRefusal(raw, 'path_traversal');
    if (!RepoPathSchema.safeParse(raw).success) throw new PathRefusal(raw, 'outside_view');
    return raw;
  }
  list(): string[] { return [...this.#files.keys()].sort(); }
  read(raw: string): string { const path = this.path(raw); if (!this.readable.has(path)) throw new PathRefusal(raw, 'outside_view'); const bytes = this.#files.get(path); if (!bytes) throw new Error('file absent'); return new TextDecoder().decode(bytes); }
  write(raw: string, text: string): void {
    const path = this.path(raw);
    if (this.protectedPaths.has(path)) throw new PathRefusal(raw, 'protected_file');
    if (!this.readable.has(path)) throw new PathRefusal(raw, 'outside_view');
    if (!this.writable.has(path)) throw new PathRefusal(raw, 'out_of_module');
    this.#files.set(path, new TextEncoder().encode(text)); this.ownWrites.add(path);
  }
  tree(): Map<RepoPath, Uint8Array> { return new Map([...this.#files].map(([p, b]) => [p, new Uint8Array(b)])); }
}
