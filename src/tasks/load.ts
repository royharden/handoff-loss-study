/**
 * Task loader (PLAN.md §3). Reads one `tasks/<split>/<id>/` directory:
 *   task.json (TaskSchema), spec.md, brief.md, repo/ (starter), and when present static.json, hidden/,
 *   oracle/, mutants/R<n>/, alternates/<name>/.
 *
 * Loading separates two kinds of schema problems so the gate can report them precisely:
 *   - structural (field types, the per-requirement refinements of RequirementSchema): the task cannot be
 *     loaded at all -> TaskLoadError;
 *   - task-level refinements of TaskSchema (counts, slot totals, slice overlap ...): returned as
 *     `schemaIssues` and reported by `hls validate` next to the gate conditions.
 *
 * Text files are read as UTF-8 with CRLF/CR folded to LF (`.gitattributes` keeps them LF; the fold makes
 * hashes and slicing stable if a checkout ignores it). Symlinks anywhere in a tree are refused.
 */
import { existsSync, lstatSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { StaticConfigSchema, TaskSchema } from '../core/contracts';
import type { StaticConfig, Task } from '../core/contracts';
import { RequirementIdSchema } from '../core/ids';
import type { ModuleId, RepoPath, RequirementId } from '../core/ids';
import type { FileTree } from '../sandbox/port';

export class TaskLoadError extends Error {
  readonly dir: string;
  constructor(dir: string, message: string) {
    super(`${dir}: ${message}`);
    this.name = 'TaskLoadError';
    this.dir = dir;
  }
}

export interface SpecSection {
  /** The exact top-level heading line (trailing whitespace removed), e.g. "# Retry policy". */
  readonly heading: string;
  /** Heading line through the line before the next top-level heading, LF-terminated as in spec.md. */
  readonly text: string;
}

export interface SpecSections {
  /** Text before the first top-level heading (must be blank, gate cond. 8). */
  readonly preamble: string;
  readonly sections: readonly SpecSection[];
}

export interface LoadedTask {
  readonly dir: string;
  readonly task: Task;
  readonly schemaIssues: readonly string[];
  readonly spec: string;
  readonly brief: string;
  readonly sections: SpecSections;
  /** Slice texts assembled from the sections named in task.slices, in spec order. */
  readonly sliceText: Readonly<Record<ModuleId, string>>;
  readonly repo: FileTree;
  readonly staticConfig: StaticConfig | null;
  readonly hidden: FileTree | null;
  readonly oracle: FileTree | null;
  readonly mutants: ReadonlyMap<RequirementId, FileTree>;
  readonly alternates: ReadonlyMap<string, FileTree>;
}

const TOP_LEVEL_HEADING = /^# /;

export function toLf(text: string): string {
  return text.replace(/\r\n?/g, '\n');
}

/**
 * Split spec.md at top-level (`# `) heading lines. Deeper headings stay inside their section. Sections
 * are exact substrings, so preamble + every section text, concatenated, reproduces the LF spec.
 */
export function splitTopLevelSections(spec: string): SpecSections {
  const text = toLf(spec);
  const starts: number[] = [];
  let offset = 0;
  for (const line of text.split('\n')) {
    if (TOP_LEVEL_HEADING.test(line)) starts.push(offset);
    offset += line.length + 1;
  }
  const first = starts[0] ?? text.length;
  const sections: SpecSection[] = starts.map((start, i) => {
    const end = starts[i + 1] ?? text.length;
    const body = text.slice(start, end);
    const lineEnd = body.indexOf('\n');
    return { heading: (lineEnd < 0 ? body : body.slice(0, lineEnd)).trimEnd(), text: body };
  });
  return { preamble: text.slice(0, first), sections };
}

/** Concatenate the sections whose headings are listed, in spec order. */
export function assembleSlice(sections: SpecSections, headings: readonly string[]): string {
  const wanted = new Set(headings.map((h) => h.trimEnd()));
  return sections.sections
    .filter((s) => wanted.has(s.heading))
    .map((s) => s.text)
    .join('');
}

/** Read a directory tree into repo-relative POSIX paths. Refuses symlinks. */
export function readTree(root: string): Map<RepoPath, Uint8Array> {
  const out = new Map<RepoPath, Uint8Array>();
  const walk = (dir: string, prefix: string): void => {
    const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const e of entries) {
      const abs = join(dir, e.name);
      const rel = prefix === '' ? e.name : `${prefix}/${e.name}`;
      if (lstatSync(abs).isSymbolicLink()) throw new TaskLoadError(root, `symlink refused: ${rel}`);
      if (e.isDirectory()) walk(abs, rel);
      else if (e.isFile()) out.set(rel, new Uint8Array(readFileSync(abs)));
    }
  };
  walk(root, '');
  return out;
}

const decoder = new TextDecoder('utf-8');

export function treeText(bytes: Uint8Array): string {
  return toLf(decoder.decode(bytes));
}

function readText(dir: string, name: string): string {
  const p = join(dir, name);
  if (!existsSync(p)) throw new TaskLoadError(dir, `missing ${name}`);
  return toLf(readFileSync(p, 'utf8'));
}

function optionalTree(dir: string, name: string): Map<RepoPath, Uint8Array> | null {
  const p = join(dir, name);
  return existsSync(p) && lstatSync(p).isDirectory() ? readTree(p) : null;
}

function subTrees(dir: string, name: string): Map<string, Map<RepoPath, Uint8Array>> {
  const out = new Map<string, Map<RepoPath, Uint8Array>>();
  const p = join(dir, name);
  if (!existsSync(p)) return out;
  for (const e of readdirSync(p, { withFileTypes: true })) {
    if (e.isDirectory()) out.set(e.name, readTree(join(p, e.name)));
  }
  return out;
}

function issueText(issues: readonly { path: (string | number)[]; message: string }[]): string[] {
  return issues.map((i) => (i.path.length > 0 ? `${i.path.join('.')}: ${i.message}` : i.message));
}

export function loadTask(dir: string): LoadedTask {
  let raw: unknown;
  try {
    raw = JSON.parse(readText(dir, 'task.json'));
  } catch (err) {
    if (err instanceof TaskLoadError) throw err;
    throw new TaskLoadError(dir, `task.json is not valid JSON: ${err instanceof Error ? err.message : String(err)}`);
  }
  const structural = TaskSchema.innerType().safeParse(raw);
  if (!structural.success) throw new TaskLoadError(dir, `task.json structure: ${issueText(structural.error.issues).join('; ')}`);
  const full = TaskSchema.safeParse(raw);
  const schemaIssues = full.success ? [] : issueText(full.error.issues);
  const task = structural.data;

  const spec = readText(dir, 'spec.md');
  const brief = readText(dir, 'brief.md');
  const sections = splitTopLevelSections(spec);
  const repoPath = join(dir, 'repo');
  if (!existsSync(repoPath)) throw new TaskLoadError(dir, 'missing repo/');
  let staticConfig: StaticConfig | null = null;
  if (existsSync(join(dir, 'static.json'))) {
    const parsed = StaticConfigSchema.safeParse(JSON.parse(readText(dir, 'static.json')));
    if (!parsed.success) throw new TaskLoadError(dir, `static.json: ${issueText(parsed.error.issues).join('; ')}`);
    staticConfig = parsed.data;
  }
  const mutants = new Map<RequirementId, FileTree>();
  for (const [name, tree] of subTrees(dir, 'mutants')) {
    const id = RequirementIdSchema.safeParse(name);
    if (!id.success) throw new TaskLoadError(dir, `mutants/${name} is not a requirement id`);
    mutants.set(id.data, tree);
  }
  return {
    dir,
    task,
    schemaIssues,
    spec,
    brief,
    sections,
    sliceText: { A: assembleSlice(sections, task.slices.A.headings), B: assembleSlice(sections, task.slices.B.headings) },
    repo: readTree(repoPath),
    staticConfig,
    hidden: optionalTree(dir, 'hidden'),
    oracle: optionalTree(dir, 'oracle'),
    mutants,
    alternates: subTrees(dir, 'alternates'),
  };
}

/** A task directory itself, or every immediate subdirectory holding a task.json (sorted). */
export function findTaskDirs(root: string): string[] {
  if (existsSync(join(root, 'task.json'))) return [root];
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(join(root, e.name, 'task.json')))
    .map((e) => join(root, e.name))
    .sort();
}
