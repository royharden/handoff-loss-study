/** D17 implementation source. No container starts at import or construction. */
import { spawn, execFile } from 'node:child_process';
import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import type { Node } from 'typescript';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, chmodSync, rmSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { randomUUID } from 'node:crypto';
import { GroupResultsSchema } from '../core/contracts';
import type { GroupResult, GroupResults, SandboxPort, SourceSnapshot, StaticConfig } from '../core/contracts';
import type { Sha256Hex } from '../core/hash';
import { sha256Hex } from '../core/hash';
import { TEST_GROUP_IDS } from '../core/ids';
import type { TestGroupId } from '../core/ids';
import { treeDigest } from './port';
import type { FileTree } from './port';
import { relayPair } from './relay';
import type { PublicTestPort } from '../runner/tools';
import type { WorkerRole } from '../core/ids';

export interface DockerPairOptions {
  ownerRunId: string; workRoot: string; hidden: FileTree; staticConfig: StaticConfig;
  doNotTouchGroups: readonly TestGroupId[];
  /** Trusted, public starter src/*.ts allowlist, never evaluator paths. */
  candidatePaths: readonly string[];
  candidateImage: string; graderImage: string;
  /** Must check owner consent, agent-ports registration and actual lane ownership before each start. */
  authorizeContainers: (ownerRunId: string) => Promise<boolean>;
  timeoutMs?: number;
}
export class SandboxIntegrityError extends Error {
  readonly integrityStop = true;
  constructor(message: string) { super(message); this.name = 'SandboxIntegrityError'; }
}
export function dockerArgs(options: { ownerRunId: string; name: string; uid: 10001 | 10002; image: string; mounts: readonly { source: string; target: '/candidate' | '/hidden' | '/results'; readOnly: boolean }[]; command: readonly string[] }): string[] {
  if (!/^[A-Za-z0-9_.-]{1,160}$/.test(options.ownerRunId) || !/^hls-[a-z0-9-]+$/.test(options.name)) throw new Error('invalid owner/name');
  if (!/^[A-Za-z0-9_./:-]+@sha256:[a-f0-9]{64}$/.test(options.image)) throw new Error('image must be immutable name@sha256 digest');
  const args = ['run', '--rm', '-i', '--name', options.name, '--pull', 'never', '--network', 'none', '--read-only', '--tmpfs', '/tmp:rw,noexec,nosuid,nodev,size=128m,mode=1777', '--memory', '1g', '--cpus', '1', '--pids-limit', '128', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges:true', '--user', String(options.uid), '--label', `hls.owner=${options.ownerRunId}`, '--label', 'hls.app=handoff-loss-study'];
  for (const mount of options.mounts) {
    if (mount.source.includes(',') || mount.source.includes('\n')) throw new Error('invalid mount source');
    if (options.uid === 10001 && (mount.target !== '/candidate' || !mount.readOnly)) throw new Error('candidate may mount only extracted readonly source');
    if (options.uid === 10002 && mount.target === '/candidate') throw new Error('grader cannot mount candidate');
    args.push('--mount', `type=bind,src=${resolve(mount.source)},dst=${mount.target}${mount.readOnly ? ',readonly' : ''}`);
  }
  return [...args, options.image, ...options.command];
}
function docker(args: readonly string[]): Promise<string> {
  return new Promise((resolvePromise, reject) => { execFile('docker', [...args], { env: { PATH: process.env['PATH'] ?? '', SystemRoot: process.env['SystemRoot'] ?? '' }, timeout: 10_000, maxBuffer: 64 * 1024, windowsHide: true, shell: false }, (error, stdout) => error ? reject(new Error('docker control failed')) : resolvePromise(stdout)); });
}
async function cleanupOwned(name: string, owner: string): Promise<void> {
  let raw: string;
  try { raw = await docker(['inspect', '--format', '{{json .Config.Labels}}', name]); }
  catch { try { const present = await docker(['ps', '-a', '--format', '{{.Names}}', '--filter', `name=^/${name}$`]); if (!present.trim()) return; } catch { throw new SandboxIntegrityError('container cleanup could not be confirmed'); } throw new SandboxIntegrityError('container cleanup ownership could not be confirmed'); }
  const labels: unknown = JSON.parse(raw);
  if (!labels || typeof labels !== 'object' || (labels as Record<string, unknown>)['hls.owner'] !== owner || (labels as Record<string, unknown>)['hls.app'] !== 'handoff-loss-study') throw new SandboxIntegrityError('refusing cleanup: owner label mismatch');
  try { await docker(['rm', '-f', name]); } catch { throw new SandboxIntegrityError('owned container cleanup failed'); }
}
function cleanupRoot(root: string, workRoot: string, error: Error): void {
  if (!root.startsWith(resolve(workRoot) + sep)) throw error;
  rmSync(root, { recursive: true, force: true });
}
async function cleanupPair(names: readonly string[], owner: string, root: string, workRoot: string): Promise<void> {
  const cleaned = await Promise.allSettled(names.map((name) => cleanupOwned(name, owner)));
  if (cleaned.some((result) => result.status === 'rejected')) throw new SandboxIntegrityError('pair cleanup unconfirmed; tranche must stop');
  cleanupRoot(root, workRoot, new SandboxIntegrityError('cleanup root escape'));
}
function writeTree(root: string, tree: FileTree): void {
  for (const [path, bytes] of tree) {
    if (!path || path.includes('\\') || path.includes(':') || path.split('/').some((p) => p === '.' || p === '..' || p === '')) throw new Error('unsafe snapshot path');
    const target = resolve(root, ...path.split('/')); if (!target.startsWith(resolve(root) + sep)) throw new Error('snapshot escape');
    mkdirSync(dirname(target), { recursive: true, mode: 0o755 }); writeFileSync(target, bytes, { flag: 'wx', mode: 0o444 });
  }
}
export async function staticCandidateChecks(snapshot: SourceSnapshot, config: StaticConfig): Promise<{ protectedChanged: boolean; forbiddenIdentifier: boolean }> {
  const protectedChanged = config.protectedFiles.some((file) => { const bytes = snapshot.files.get(file.path); return !bytes || sha256Hex(bytes) !== file.sha256; });
  const ts = await import('typescript');
  const forbidden = new Set(config.forbiddenIdentifiers.map((f) => f.identifier));
  for (const [path, bytes] of snapshot.files) {
    if (!path.endsWith('.ts')) continue;
    const source = ts.createSourceFile(path, new TextDecoder().decode(bytes), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    let bad = false;
    const visit = (node: Node): void => { if (ts.isIdentifier(node) && forbidden.has(node.text)) bad = true; ts.forEachChild(node, visit); };
    visit(source); if (bad) return { protectedChanged, forbiddenIdentifier: true };
  }
  return { protectedChanged, forbiddenIdentifier: false };
}
export class DockerPairSandbox implements SandboxPort {
  readonly kind = 'docker_pair' as const;
  readonly options: DockerPairOptions;
  constructor(options: DockerPairOptions) {
    if (!/^[A-Za-z0-9_.-]+@sha256:[a-f0-9]{64}$/.test(options.graderImage) && !/^[A-Za-z0-9_./:-]+@sha256:[a-f0-9]{64}$/.test(options.graderImage)) throw new Error('grader image digest required');
    this.options = options;
    if (!options.doNotTouchGroups.length || options.doNotTouchGroups.some((g) => g === 'C0' || !TEST_GROUP_IDS.includes(g))) throw new Error('trusted do_not_touch groups required');
  }
  async grade(snapshot: SourceSnapshot, hiddenBundleDigest: Sha256Hex): Promise<GroupResults> {
    const o = this.options;
    if (treeDigest(snapshot.files) !== snapshot.digest || treeDigest(o.hidden) !== hiddenBundleDigest) throw new SandboxIntegrityError('source/hidden digest mismatch');
    const groups = {} as Record<TestGroupId, GroupResult>;
    const checks = await staticCandidateChecks(snapshot, o.staticConfig);
    if (checks.forbiddenIdentifier) {
      for (const group of TEST_GROUP_IDS) groups[group] = { passed: false, failure: 'static_check', durationMs: null };
    } else {
      const extracted = new Map<string, Uint8Array>();
      for (const path of o.candidatePaths) {
        if (!/^src\/[A-Za-z0-9_./-]+\.ts$/.test(path) || path.split('/').some((p) => ['..', '.', 'hidden', 'oracle', 'mutants', 'predicates', 'node_modules'].includes(p))) throw new Error('candidate source allowlist contains forbidden path');
        const bytes = snapshot.files.get(path); if (!bytes) throw new Error('allowlisted candidate source missing'); extracted.set(path, bytes);
      }
      if (!extracted.size) throw new Error('empty candidate source');
      for (const group of TEST_GROUP_IDS) {
        if (checks.protectedChanged && o.doNotTouchGroups.includes(group)) { groups[group] = { passed: false, failure: 'static_check', durationMs: null }; continue; }
        if (!(await o.authorizeContainers(o.ownerRunId))) throw new SandboxIntegrityError('Docker consent/lane ownership unavailable');
        const started = Date.now(); mkdirSync(o.workRoot, { recursive: true });
        const root = mkdtempSync(join(resolve(o.workRoot), 'pair-')); const source = join(root, 'source'); const hidden = join(root, 'hidden'); const results = join(root, 'results');
        for (const path of [source, hidden, results]) mkdirSync(path, { mode: 0o755 }); chmodSync(results, 0o777);
        writeTree(source, extracted); writeTree(hidden, o.hidden);
        const id = randomUUID(); const candidateName = `hls-c-${id}`; const graderName = `hls-g-${id}`;
        const start = (args: string[]): ChildProcessWithoutNullStreams => spawn('docker', args, { stdio: ['pipe', 'pipe', 'pipe'], env: { PATH: process.env['PATH'] ?? '', SystemRoot: process.env['SystemRoot'] ?? '' }, shell: false, windowsHide: true });
        let candidate: ChildProcessWithoutNullStreams | null = null; let grader: ChildProcessWithoutNullStreams | null = null;
        try {
          candidate = start(dockerArgs({ ownerRunId: o.ownerRunId, name: candidateName, uid: 10001, image: o.candidateImage, mounts: [{ source, target: '/candidate', readOnly: true }], command: ['node', '--import', 'tsx', '/runtime/grader/shim.ts', '--serve'] }));
          grader = start(dockerArgs({ ownerRunId: o.ownerRunId, name: graderName, uid: 10002, image: o.graderImage, mounts: [{ source: hidden, target: '/hidden', readOnly: true }, { source: results, target: '/results', readOnly: false }], command: ['node', '--import', 'tsx', '/runtime/grader/entry.ts', '--group', group] }));
          const relay = await relayPair(candidate, grader, o.timeoutMs ?? 60_000);
          let verdict: GroupResult = { passed: false, failure: relay.failure ?? 'grader_error', durationMs: Date.now() - started };
          // Sole verdict authority is this grader-only mounted file. Candidate stdout is NEVER parsed as a verdict.
          if (relay.failure === null) { const raw: unknown = JSON.parse(readFileSync(join(results, 'result.json'), 'utf8')); if (raw && typeof raw === 'object') { const record = raw as Record<string, unknown>; if (record['group'] === group && typeof record['passed'] === 'boolean' && (record['failure'] === null || record['failure'] === 'assertion' || record['failure'] === 'grader_error')) verdict = { passed: record['passed'], failure: record['failure'] as GroupResult['failure'], durationMs: Date.now() - started }; } }
          groups[group] = verdict;
        } catch { groups[group] = { passed: false, failure: 'grader_error', durationMs: Date.now() - started }; }
        finally {
          candidate?.kill(); grader?.kill();
          await cleanupPair([candidateName, graderName], o.ownerRunId, root, o.workRoot);
        }
      }
    }
    return GroupResultsSchema.parse({ snapshotDigest: snapshot.digest, hiddenBundleDigest, graderImageDigest: o.graderImage.slice(o.graderImage.indexOf('@') + 1), sandbox: this.kind, groups });
  }
}

export interface DockerPublicOptions { ownerRunId: string; workRoot: string; episodeImage: string; publicTests: FileTree; authorizeContainers: (ownerRunId: string) => Promise<boolean>; timeoutMs?: number; }
export class DockerPublicTestPort implements PublicTestPort {
  readonly options: DockerPublicOptions;
  constructor(options: DockerPublicOptions) { this.options = options; }
  async run(snapshot: SourceSnapshot, _worker: WorkerRole, signal: AbortSignal): Promise<readonly { text: string; path: string | null; ownSource: boolean }[]> {
    const o = this.options;
    if (signal.aborted || !(await o.authorizeContainers(o.ownerRunId))) throw new Error('public test container authorization unavailable');
    if (treeDigest(snapshot.files) !== snapshot.digest) throw new Error('public snapshot mismatch');
    mkdirSync(o.workRoot, { recursive: true }); const root = mkdtempSync(join(resolve(o.workRoot), 'public-')); const source = join(root, 'source'); mkdirSync(source);
    const tree = new Map(snapshot.files);
    for (const [path, bytes] of o.publicTests) { if (!/^[A-Za-z0-9_./-]+\.test\.ts$/.test(path)) throw new Error('public test allowlist invalid'); tree.set(path, bytes); }
    writeTree(source, tree); const name = `hls-p-${randomUUID()}`;
    try {
      const args = dockerArgs({ ownerRunId: o.ownerRunId, name, uid: 10001, image: o.episodeImage, mounts: [{ source, target: '/candidate', readOnly: true }], command: ['node', '--import', 'tsx', '/runtime/grader/public.ts', '--tests', ...o.publicTests.keys()] });
      const text = await new Promise<string>((resolvePromise, reject) => {
        const child = spawn('docker', args, { stdio: ['ignore', 'pipe', 'pipe'], shell: false, windowsHide: true, env: { PATH: process.env['PATH'] ?? '', SystemRoot: process.env['SystemRoot'] ?? '' } });
        let output = ''; let bytes = 0; let settled = false;
        const finish = (error: Error | null): void => { if (settled) return; settled = true; clearTimeout(timer); signal.removeEventListener('abort', abort); child.kill(); if (error) reject(error); else resolvePromise(output); };
        const abort = (): void => finish(new Error('public tests aborted'));
        const timer = setTimeout(() => finish(new Error('public tests timeout')), o.timeoutMs ?? 30_000);
        signal.addEventListener('abort', abort, { once: true }); child.once('error', () => finish(new Error('public container failed')));
        child.stdout.on('data', (chunk: Buffer) => { bytes += chunk.length; if (bytes > 4096) finish(new Error('public output oversized')); else output += chunk.toString('utf8'); });
        child.stderr.on('data', (chunk: Buffer) => { bytes += chunk.length; if (bytes > 4096) finish(new Error('public output oversized')); });
        child.once('close', (code) => finish(code === 0 ? null : new Error('public container failed')));
      });
      const parsed: unknown = JSON.parse(text); if (!parsed || typeof parsed !== 'object') throw new Error('public result malformed');
      const r = parsed as Record<string, unknown>;
      if (typeof r['passed'] !== 'boolean' || !Number.isInteger(r['total']) || !Number.isInteger(r['failed'])) throw new Error('public result malformed');
      return [{ text: JSON.stringify({ passed: r['passed'], total: r['total'], failed: r['failed'] }), path: null, ownSource: false }];
    } finally {
      await cleanupOwned(name, o.ownerRunId);
      cleanupRoot(root, o.workRoot, new Error('public cleanup root escape'));
    }
  }
}
