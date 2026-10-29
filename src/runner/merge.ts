import type { Task } from '../core/contracts';
import type { FileTree } from '../sandbox/port';
/** Mechanical, no repair: take exactly A from A and B from B; all other starter bytes remain. */
export function mergeModules(task: Task, starter: FileTree, a: FileTree, b: FileTree): Map<string, Uint8Array> {
  const merged = new Map([...starter].map(([p, bytes]) => [p, new Uint8Array(bytes)]));
  for (const [module, tree] of [['A', a], ['B', b]] as const) { const path = task.modules[module].path; const bytes = tree.get(path); if (!bytes) throw new Error(`missing module ${module}`); merged.set(path, new Uint8Array(bytes)); }
  return merged;
}
