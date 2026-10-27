/**
 * `hls` — the study CLI (PLAN.md D22; docs/DESIGN.md §4). M2 subcommands:
 *
 *   hls validate <task dir | dir of task dirs> [--execute] [--json] [--report <file>]
 *       Admission gate. Pure-data conditions 4-8 and 6b-6f always; execution conditions 1-3 and 9 only
 *       with --execute (LocalUnsafeSandbox: authored code only, loaded by dynamic import), otherwise
 *       reported `deferred`. Exit 0 = admitted, 1 = a condition failed or a schema issue, 3 = nothing
 *       failed but some condition is deferred (not admitted).
 *   hls selftest [--json]      every keyless self-test (carry self-test pairs, scripted fixtures, gate
 *                              fixtures, edition and keyless guards, verbatim-forward invariant)
 *   hls fixture [--json]       score fixtures/scripted/* and compare with fixtures/expected.json
 *   hls check carry-selftest   builder matcher self-test pairs (D19a)
 *   hls check visibility       the visibility-audit fixtures (D16)
 *   hls demo                   keyless SYNTHETIC walkthrough (null + scripted providers only)
 *   hls score <fixture.json>   score one scripted fixture and print the outcome as JSON
 *
 * Every output of selftest/demo/fixture/score is stamped SYNTHETIC. Nothing on these paths imports a
 * network module or a provider SDK; the only providers constructed are `null` and `scripted`.
 * Later milestones add: check carry|alternates|containment|budget|stats (M4/M5), verify, plan, run,
 * report, prereg, heldout (M5).
 *
 * WRITTEN, NEVER RUN in Dirty Mode construction (docs/DEFERRED-VALIDATION.md DV-M2-01..05).
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CarryPairSchema, EditionMixError, assertSingleEdition } from '../src/core/contracts';
import type { CarryPair } from '../src/core/contracts';
import { NullProvider } from '../src/providers/null';
import { LiveProviderRefusedError, assertKeylessProvider } from '../src/providers/port';
import type { RepoPath } from '../src/core/ids';
import type { SnapshotOrigin } from '../src/sandbox/port';
import { edgeEvidence, MATCHER_EDITION, pairLexicalState } from '../src/score/evidence';
import { ExpectedFileSchema, compareFixture, scoreFixture } from '../src/score/fixture';
import type { ExpectedFile, FixtureOutcome } from '../src/score/fixture';
import { findTaskDirs, loadTask } from '../src/tasks/load';
import { buildReport, deferredExecution, failedConditions, validateExecution, validatePure } from '../src/tasks/validate';
import type { ValidateReport } from '../src/tasks/validate';
import { sha256Hex } from '../src/core/hash';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURES = join(REPO_ROOT, 'fixtures');
const STAMP = '[SYNTHETIC]';

type Check = { readonly name: string; readonly ok: boolean; readonly detail: string };

function out(line: string): void {
  process.stdout.write(`${line}\n`);
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8')) as unknown;
}

function loadExpected(): ExpectedFile {
  return ExpectedFileSchema.parse(readJson(join(FIXTURES, 'expected.json')));
}

/** sha256 over the matcher's two source files (the hash frozen before sealed pairs open, D19b). */
function matcherSourceSha256(): string {
  const parts = ['src/score/normalize.ts', 'src/score/evidence.ts'].map((p) => `${p}\n${readFileSync(join(REPO_ROOT, p), 'utf8')}`);
  return sha256Hex(parts.join('\n'));
}

// ---------------------------------------------------------------------------------------------
// Self-test pieces
// ---------------------------------------------------------------------------------------------

function checkCarrySelftest(expected: ExpectedFile): Check[] {
  const file = readJson(join(FIXTURES, 'carry-conformance', 'builder-selftest.json')) as { pairs?: unknown };
  const raw = Array.isArray(file.pairs) ? file.pairs : [];
  const checks: Check[] = [];
  const pairs: CarryPair[] = [];
  for (const p of raw) {
    const parsed = CarryPairSchema.safeParse(p);
    if (!parsed.success) {
      checks.push({ name: 'carry-selftest schema', ok: false, detail: parsed.error.issues.map((i) => i.message).join('; ') });
      continue;
    }
    if (parsed.data.set !== 'builder_selftest') {
      checks.push({ name: `carry-selftest ${parsed.data.id}`, ok: false, detail: 'set must be builder_selftest' });
      continue;
    }
    pairs.push(parsed.data);
  }
  checks.push({ name: 'carry-selftest count >= 40', ok: pairs.length >= 40, detail: `${pairs.length} pairs` });
  const ids = new Set(pairs.map((p) => p.id));
  const expectedIds = Object.keys(expected.carrySelftest);
  checks.push({
    name: 'carry-selftest ids match expected.json',
    ok: ids.size === pairs.length && expectedIds.length === ids.size && expectedIds.every((id) => ids.has(id)),
    detail: `${ids.size} unique pair ids, ${expectedIds.length} expected`,
  });
  for (const p of pairs) {
    let got: string;
    try {
      got = pairLexicalState(p);
    } catch (err) {
      got = `error: ${err instanceof Error ? err.message : String(err)}`;
    }
    const want = expected.carrySelftest[p.id]?.state;
    const ok = got === p.expectedLexicalState && got === want;
    checks.push({ name: `carry-selftest ${p.id}`, ok, detail: ok ? got : `got ${got}, pair says ${p.expectedLexicalState}, expected.json says ${String(want)}` });
  }
  return checks;
}

async function scoreAllFixtures(): Promise<{ file: string; outcome: FixtureOutcome | null; error: string | null }[]> {
  const dir = join(FIXTURES, 'scripted');
  const files = readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
  const results: { file: string; outcome: FixtureOutcome | null; error: string | null }[] = [];
  for (const f of files) {
    try {
      results.push({ file: f, outcome: await scoreFixture(readJson(join(dir, f))), error: null });
    } catch (err) {
      results.push({ file: f, outcome: null, error: err instanceof Error ? err.message : String(err) });
    }
  }
  return results;
}

async function checkFixtures(expected: ExpectedFile): Promise<Check[]> {
  const checks: Check[] = [];
  const results = await scoreAllFixtures();
  const seen = new Set<string>();
  for (const r of results) {
    if (r.outcome === null) {
      checks.push({ name: `fixture ${r.file}`, ok: false, detail: r.error ?? 'unknown error' });
      continue;
    }
    seen.add(r.outcome.id);
    const want = expected.fixtures[r.outcome.id];
    if (want === undefined) {
      checks.push({ name: `fixture ${r.outcome.id}`, ok: false, detail: 'no entry in expected.json' });
      continue;
    }
    const diffs = compareFixture(r.outcome, want);
    checks.push({ name: `fixture ${r.outcome.id}`, ok: diffs.length === 0, detail: diffs.length === 0 ? want.path : diffs.join(' | ') });
  }
  for (const id of Object.keys(expected.fixtures)) {
    if (!seen.has(id)) checks.push({ name: `fixture ${id}`, ok: false, detail: 'expected.json entry has no fixture file' });
  }
  try {
    assertSingleEdition(results.flatMap((r) => (r.outcome === null ? [] : [{ edition: r.outcome.edition }])));
    checks.push({ name: 'fixtures are one edition (SYNTHETIC)', ok: true, detail: 'SYNTHETIC' });
  } catch (err) {
    checks.push({ name: 'fixtures are one edition (SYNTHETIC)', ok: false, detail: String(err) });
  }
  return checks;
}

function checkGateFixtures(expected: ExpectedFile): Check[] {
  const checks: Check[] = [];
  const control = loadTask(join(REPO_ROOT, expected.controlTask.dir));
  const controlFailures = failedConditions({ conditions: validatePure(control) });
  checks.push({
    name: `gate control ${expected.controlTask.taskId}`,
    ok: controlFailures.join(',') === expected.controlTask.expectedFailures.join(',') && (control.schemaIssues.length > 0) === expected.controlTask.schemaIssues,
    detail: `pure failures [${controlFailures.join(', ')}], schema issues ${control.schemaIssues.length}`,
  });
  for (const [dir, want] of Object.entries(expected.badTasks)) {
    try {
      const t = loadTask(join(FIXTURES, 'bad-tasks', dir));
      const got = failedConditions({ conditions: validatePure(t) });
      const ok =
        t.task.id === want.taskId &&
        got.join(',') === want.expectedPureFailures.join(',') &&
        (t.schemaIssues.length > 0) === want.schemaIssues;
      checks.push({ name: `gate bad task ${dir} (cond. ${want.plantedCondition})`, ok, detail: `pure failures [${got.join(', ')}], schema issues ${t.schemaIssues.length}` });
    } catch (err) {
      checks.push({ name: `gate bad task ${dir}`, ok: false, detail: err instanceof Error ? err.message : String(err) });
    }
  }
  return checks;
}

/**
 * D18 / §4.10: verbatim forward of each requirement's source slice scores `evidence`, on the control task
 * and on every dev task present under tasks/dev (T01/T02 from M3, T03–T06 from M6).
 */
function checkVerbatimForward(expected: ExpectedFile): Check[] {
  const dirs = [join(REPO_ROOT, expected.controlTask.dir), ...findTaskDirs(join(REPO_ROOT, 'tasks', 'dev'))];
  const checks: Check[] = [];
  for (const dir of dirs) {
    let t: ReturnType<typeof loadTask>;
    try {
      t = loadTask(dir);
    } catch (err) {
      checks.push({ name: `verbatim-forward ${dir}`, ok: false, detail: err instanceof Error ? err.message : String(err) });
      continue;
    }
    for (const r of t.task.requirements) {
      const e = edgeEvidence({ requirement: r, artifacts: [{ channel: 'verbatim_forward', text: t.sliceText[r.sourceSlice] }], prerequisiteFailed: false });
      checks.push({ name: `verbatim-forward ${t.task.id} ${r.id}`, ok: e.state === 'evidence', detail: e.state });
    }
  }
  return checks;
}

async function checkGuards(): Promise<Check[]> {
  const checks: Check[] = [];
  try {
    assertSingleEdition([{ edition: 'SYNTHETIC' }, { edition: 'LIVE' }]);
    checks.push({ name: 'SYNTHETIC/LIVE mixing throws', ok: false, detail: 'did not throw' });
  } catch (err) {
    checks.push({ name: 'SYNTHETIC/LIVE mixing throws', ok: err instanceof EditionMixError, detail: String(err) });
  }
  try {
    assertKeylessProvider('selftest', 'anthropic');
    checks.push({ name: 'live provider refused on keyless path', ok: false, detail: 'did not throw' });
  } catch (err) {
    checks.push({ name: 'live provider refused on keyless path', ok: err instanceof LiveProviderRefusedError, detail: String(err) });
  }
  const nullProvider = new NullProvider();
  const c = await nullProvider.complete({ messages: [], tools: [], maxOutput: 16, signal: new AbortController().signal });
  checks.push({
    name: 'null provider finishes immediately with zero usage',
    ok: c.message.toolCalls.length === 1 && c.message.toolCalls[0]?.name === 'finish' && c.usage.input + c.usage.output === 0,
    detail: c.message.toolCalls.map((t) => t.name).join(','),
  });
  return checks;
}

function report(title: string, checks: readonly Check[], json: boolean): boolean {
  const ok = checks.every((c) => c.ok);
  if (json) {
    out(JSON.stringify({ edition: 'SYNTHETIC', title, ok, checks }, null, 2));
  } else {
    out(`${STAMP} ${title}`);
    for (const c of checks) out(`  ${c.ok ? 'PASS' : 'FAIL'}  ${c.name}  (${c.detail})`);
    out(`${STAMP} ${title}: ${ok ? 'PASS' : 'FAIL'} (${checks.filter((c) => c.ok).length}/${checks.length})`);
  }
  return ok;
}

// ---------------------------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------------------------

async function cmdSelftest(json: boolean): Promise<number> {
  const expected = loadExpected();
  const checks: Check[] = [
    ...checkCarrySelftest(expected),
    ...(await checkFixtures(expected)),
    ...checkGateFixtures(expected),
    ...checkVerbatimForward(expected),
    ...(await checkGuards()),
  ];
  const ok = report(`hls selftest (matcher ${MATCHER_EDITION}, source sha256 ${matcherSourceSha256()})`, checks, json);
  return ok ? 0 : 1;
}

async function cmdFixture(json: boolean): Promise<number> {
  return report('hls fixture', await checkFixtures(loadExpected()), json) ? 0 : 1;
}

async function cmdCheck(name: string | undefined, json: boolean): Promise<number> {
  if (name === 'carry-selftest') return report('hls check carry-selftest', checkCarrySelftest(loadExpected()), json) ? 0 : 1;
  if (name === 'visibility') {
    const expected = loadExpected();
    const checks = (await checkFixtures(expected)).filter((c) => /fixture (visibility-leak|self-originated-anchor)$/.test(c.name));
    if (checks.length !== 2) checks.push({ name: 'visibility fixtures present', ok: false, detail: `${checks.length} of 2 found` });
    return report('hls check visibility', checks, json) ? 0 : 1;
  }
  out(`hls check ${name ?? ''}: not implemented in M2 (carry, alternates: M5; containment, budget: M4; stats: M5)`);
  return 2;
}

async function cmdDemo(): Promise<number> {
  out(`${STAMP} hls demo — keyless walkthrough. No model was called. NOT A MEASUREMENT.`);
  const nullProvider = new NullProvider();
  assertKeylessProvider('demo', nullProvider);
  const c = await nullProvider.complete({ messages: [], tools: [], maxOutput: 16, signal: new AbortController().signal });
  out(`${STAMP} null worker: first completion calls '${c.message.toolCalls[0]?.name ?? '?'}' with ${c.usage.input + c.usage.output} tokens; the`);
  out(`${STAMP}   untouched starter fails C0 and every R group conjoins C0, so null retention is 0 (gate cond. 2; graded later).`);
  const rows: { file: string; label: string }[] = [
    { file: 'failed-without-lexical-evidence.json', label: 'role/free_summary   R5' },
    { file: 'failed-with-evidence.json', label: 'role/fixed_brief    R5' },
    { file: 'attribution-unknown-decoy.json', label: 'context/fixed_brief R6' },
  ];
  out(`${STAMP} scripted rows (fixtures/scripted):`);
  for (const row of rows) {
    const o = await scoreFixture(readJson(join(FIXTURES, 'scripted', row.file)));
    const r = o.requirements[0];
    out(`${STAMP}   ${row.label}  state=${r?.state ?? 'n/a'}${r?.unknownReason ? ` (${r.unknownReason})` : ''}  class=${r?.class ?? 'n/a'}`);
  }
  out(`${STAMP} Next (later milestones): viewer, 'hls verify results/demo', tamper check, 'hls plan --tranche T2', 'hls run --live' refusal.`);
  return 0;
}

async function cmdScore(file: string | undefined): Promise<number> {
  if (file === undefined) {
    out('usage: hls score <fixture.json>');
    return 2;
  }
  const outcome = await scoreFixture(readJson(resolve(file)));
  out(JSON.stringify({ stamp: 'SYNTHETIC', ...outcome }, null, 2));
  return 0;
}

async function cmdValidate(args: readonly string[]): Promise<number> {
  const target = args.find((a) => !a.startsWith('--'));
  const execute = args.includes('--execute');
  const json = args.includes('--json');
  const reportIdx = args.indexOf('--report');
  const reportPath = reportIdx >= 0 ? args[reportIdx + 1] : undefined;
  if (target === undefined) {
    out('usage: hls validate <task dir | dir of task dirs> [--execute] [--json] [--report <file>]');
    return 2;
  }
  const dirs = findTaskDirs(resolve(target));
  if (dirs.length === 0) {
    out(`hls validate: no task.json under ${target}`);
    return 2;
  }
  const reports: ValidateReport[] = [];
  for (const dir of dirs) {
    const t = loadTask(dir);
    const pure = validatePure(t);
    if (execute) {
      const { LocalUnsafeSandbox } = await import('../src/sandbox/local');
      const hidden = t.hidden ?? new Map<RepoPath, Uint8Array>();
      const sandboxFor = (origin: SnapshotOrigin): InstanceType<typeof LocalUnsafeSandbox> =>
        new LocalUnsafeSandbox({ provider: 'null', origin, repoRoot: REPO_ROOT, hidden, vitestEntry: join(REPO_ROOT, 'node_modules', 'vitest', 'vitest.mjs') });
      const exec = await validateExecution(t, sandboxFor);
      reports.push(buildReport(t, pure, exec.conditions, exec.matrix));
    } else {
      reports.push(buildReport(t, pure, deferredExecution(t), null));
    }
  }
  if (reportPath !== undefined) writeFileSync(resolve(reportPath), `${JSON.stringify(reports, null, 2)}\n`);
  if (json) out(JSON.stringify(reports, null, 2));
  else {
    for (const r of reports) {
      out(`${r.taskId}  ${r.admitted ? 'ADMITTED' : 'NOT ADMITTED'}  (${r.dir})`);
      for (const s of r.schemaIssues) out(`  schema  ${s}`);
      for (const c of r.conditions) {
        out(`  ${c.condition.padEnd(3)} ${c.status}${c.status === 'pass' ? '' : `: ${c.findings.join('; ')}`}`);
      }
    }
  }
  if (reports.some((r) => r.schemaIssues.length > 0 || r.conditions.some((c) => c.status === 'fail'))) return 1;
  return reports.every((r) => r.admitted) ? 0 : 3;
}

const HELP = `hls <command>
  validate <path> [--execute] [--json] [--report <file>]   admission gate (pure-data; --execute runs 1-3, 9)
  selftest [--json]                                       all keyless self-tests (SYNTHETIC)
  fixture [--json]                                        scripted fixtures vs fixtures/expected.json
  check carry-selftest | visibility [--json]              builder matcher pairs / visibility fixtures
  demo                                                    keyless SYNTHETIC walkthrough
  score <fixture.json>                                    score one scripted fixture
Later milestones: check carry|alternates|containment|budget|stats, verify, plan, run, report, prereg, heldout.`;

export async function main(argv: readonly string[]): Promise<number> {
  const [cmd, ...rest] = argv;
  const json = rest.includes('--json');
  switch (cmd) {
    case 'validate':
      return cmdValidate(rest);
    case 'selftest':
      return cmdSelftest(json);
    case 'fixture':
      return cmdFixture(json);
    case 'check':
      return cmdCheck(rest.find((a) => !a.startsWith('--')), json);
    case 'demo':
      return cmdDemo();
    case 'score':
      return cmdScore(rest.find((a) => !a.startsWith('--')));
    case undefined:
    case '--help':
    case '-h':
    case 'help':
      out(HELP);
      return 0;
    default:
      out(`hls ${cmd}: not implemented in M2 (see docs/DESIGN.md §4 for the milestone that adds it)`);
      return 2;
  }
}

function samePath(a: string, b: string): boolean {
  return process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
}

const invokedDirectly = process.argv[1] !== undefined && samePath(resolve(process.argv[1]), fileURLToPath(import.meta.url));
if (invokedDirectly) {
  main(process.argv.slice(2)).then(
    (code) => {
      process.exitCode = code;
    },
    (err: unknown) => {
      process.stderr.write(`hls: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}\n`);
      process.exitCode = 1;
    },
  );
}
