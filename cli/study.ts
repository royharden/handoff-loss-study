import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, resolve, relative, isAbsolute } from 'node:path';
import { spawn } from 'node:child_process';
import { z } from 'zod';
import { C_DEV_TOKENS, DEFAULT_RUN_LIMITS, R_T0, PriceTableSchema, RunRecordSchema, retentionOf, PreregManifestSchema, HeldoutManifestSchema, CarryPairSchema, usageTotalTokens, nearestRankP75 } from '../src/core/contracts';
import type { RunEvent, RunRecord, RunBudget, PriceTable, Approval, ProviderPort, SandboxPort, HeldoutManifest } from '../src/core/contracts';
import { LiveTrancheSchema, STUDY_CELLS, makeRunId } from '../src/core/ids';
import type { Arm, LiveTranche } from '../src/core/ids';
import { GENESIS_HASH, hashCanonical, sha256Hex } from '../src/core/hash';
import { seededRng, shuffle } from '../src/stats/rng';
import { aggregate } from '../src/stats/aggregate';
import { exactMcnemar } from '../src/stats/mcnemar';
import { reportJson } from '../src/report/json';
import { reportMarkdown } from '../src/report/markdown';
import { reportHtml } from '../src/report/html';
import { loadRuns } from '../src/store/load';
import { writeRun } from '../src/store/jsonl';
import { assertLiveApproval } from '../src/store/approval';
import type { LivePlanScope } from '../src/store/approval';
import { freezePrereg, importHeldoutManifest, sourceHash, validatePrereg } from '../src/store/prereg';
import { loadTask } from '../src/tasks/load';
import type { LoadedTask } from '../src/tasks/load';
import { findTaskDirs } from '../src/tasks/load';
import { overlay, snapshotOf, treeDigest } from '../src/sandbox/port';
import type { PublicTestPort } from '../src/runner/tools';
import { LiveStateJournal } from '../src/store/live-state';
import type { CarryOutcome, LiveAttempt } from '../src/store/live-state';
import { artifactFromHandoff, pairLexicalState } from '../src/score/evidence';
import { responsibleWorker, scoreRequirement } from '../src/score/classify';

export { assertLiveApproval } from '../src/store/approval';
export interface PlannedRun { readonly taskId: string; readonly arm: Arm; readonly repeat: number }
/** Supplied by the owner-controlled runtime host after actual validation; no default consent verifier. */
export interface LiveActivationPort {
  readonly verifyRoyDecision: (approval: Approval) => Promise<boolean>;
  readonly authorizeContainers: (runId: string) => Promise<boolean>;
  readonly images: { readonly candidate: string; readonly grader: string; readonly episode: string };
  readonly workRoot: string;
  /** Stable operator-owned pre-provisioned authority outside the repo; never derived from --out. */
  readonly stateRoot: string;
  /** Custodian loader authenticates manifest-listed bytes before constructing LoadedTask. */
  readonly loadHeldoutTask?: (taskId: string, manifest: HeldoutManifest) => Promise<{ task: LoadedTask; manifestSha256: string }>;
  /** Only the independent custodian host supplies sealed semantic labels after the stable journal claim. */
  readonly loadSealedCarryPairs?: (expectedSha256: string) => Promise<{ pairs: unknown; fileSha256: string }>;
}
export interface TranchePlan extends LivePlanScope { readonly seed: number; readonly order: readonly PlannedRun[]; readonly runCount: number; readonly priceTableSha256: string; readonly allowanceStatus: string }
/** Display estimate only: not rechecked prices, not an approved model or spending grant. */
const DISPLAY_PRICES: PriceTable = { model: 'claude-haiku-5-5', currency: 'USD', inputPerMTok: 1, outputPerMTok: 5, cacheReadPerMTok: 0.1, cacheWritePerMTok: 1.25, checkedAt: '2026-10-27T00:00:00Z', source: 'Frozen plan recommendation; UNVERIFIED, live requires --prices' };
export function planTranche(tranche: LiveTranche, options: { seed?: number; maxTokens?: number; model?: string; maxUsd?: number; prices?: PriceTable } = {}): TranchePlan {
  const tasks = tranche === 'T0' ? ['T01'] : tranche === 'T1' ? Array.from({ length: 6 }, (_, i) => `T${String(i + 1).padStart(2, '0')}`) : Array.from({ length: 12 }, (_, i) => `H${String(i + 1).padStart(2, '0')}`);
  const repeats = tranche === 'T0' ? 1 : tranche === 'T1' ? 2 : 3;
  const maxTokens = options.maxTokens ?? C_DEV_TOKENS;
  if (!Number.isInteger(maxTokens) || maxTokens <= 0 || maxTokens > 150000) throw new Error('invalid allowance');
  const seed = options.seed ?? 42001;
  const random = seededRng(seed);
  const order: PlannedRun[] = [];
  for (let repeat = 0; repeat < repeats; repeat += 1) for (const taskId of shuffle(tasks, random)) for (const arm of shuffle(STUDY_CELLS, random)) order.push({ taskId, arm, repeat });
  if (tranche === 'T1') for (let repeat = 0; repeat < 3; repeat += 1) for (const taskId of shuffle(tasks, random)) order.push({ taskId, arm: 'spec_blind', repeat });
  const prices = options.prices ?? DISPLAY_PRICES;
  const model = options.model ?? prices.model;
  if (model !== prices.model) throw new Error('model differs from price table');
  const boundUsd = order.length * maxTokens * Math.max(prices.inputPerMTok, prices.outputPerMTok, prices.cacheReadPerMTok, prices.cacheWritePerMTok) / 1e6;
  return { tranche, model, tasks, cells: [...STUDY_CELLS], repeats, specBlindRunsPerTask: tranche === 'T1' ? 3 : 0, maxTokens, maxUsd: options.maxUsd ?? 0, seed, order, runCount: order.length, boundUsd, priceTableSha256: hashCanonical(prices), allowanceStatus: tranche === 'T2' && options.maxTokens === undefined ? 'PROVISIONAL — prereg allowance required to execute' : tranche === 'T2' ? 'supplied — verify against prereg before execute' : 'provisional C_dev' };
}

function readJson(path: string): unknown { return JSON.parse(readFileSync(path, 'utf8')) as unknown; }
function flag(args: readonly string[], name: string): string | undefined {
  const i = args.indexOf(name);
  if (i === -1) return undefined;
  const value = args[i + 1];
  if (value === undefined || value.startsWith('--')) throw new Error(`${name} requires a value`);
  return value;
}
function numberFlag(args: readonly string[], name: string, fallback: number): number {
  const raw = flag(args, name); const value = raw === undefined ? fallback : Number(raw);
  if (!Number.isFinite(value) || value < 0) throw new Error(`${name} must be a nonnegative finite number`);
  return value;
}
function output(value: unknown): void { process.stdout.write(typeof value === 'string' ? value + '\n' : JSON.stringify(value, null, 2) + '\n'); }
function outsideRepo(root: string, path: string): boolean { const rel = relative(resolve(root), resolve(path)); return isAbsolute(rel) || rel === '..' || rel.startsWith('../') || rel.startsWith('..\\'); }

/** Zero-cost controls are actually graded source snapshots, never hand-assigned 0/1 scores. */
async function persistBaselines(destination: string, task: LoadedTask, sandboxFor: (runId: string) => SandboxPort, experiment: RunRecord, matcher: string): Promise<void> {
  if (task.hidden === null || task.oracle === null) throw new Error('null/oracle controls require authored hidden tests and oracle');
  for (const arm of ['null_worker', 'oracle'] as const) {
    const runId = makeRunId({ tranche: experiment.tranche, taskId: task.task.id, arm, repeat: 0 });
    const startedAt = new Date().toISOString();
    const snapshot = snapshotOf(arm === 'oracle' ? overlay(task.repo, task.oracle) : task.repo);
    const groups = await sandboxFor(runId).grade(snapshot, treeDigest(task.hidden));
    const passed = Object.fromEntries(Object.entries(groups.groups).map(([id, group]) => [id, group.passed]));
    const requirements = task.task.requirements.map((requirement) => scoreRequirement({ arm, requirement, groups: passed, artifacts: [] }));
    const retention = retentionOf(groups);
    const finishedAt = new Date().toISOString(); const wallMs = Date.parse(finishedAt) - Date.parse(startedAt);
    const usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, reasoning: 0, source: 'provider_reported' as const };
    const taskDigest = hashCanonical(task.task); const promptsDigest = hashCanonical({ policy: 'worker-loop-v1', arm, brief: task.brief });
    const common = { runId, at: startedAt };
    const events: RunEvent[] = [{ ...common, seq: 0, type: 'run_started', edition: experiment.edition, taskId: task.task.id, arm, repeat: 0, provider: experiment.provider, requestedModel: experiment.model.requested, budget: experiment.budget, taskDigest, promptsDigest }, { ...common, at: finishedAt, seq: 1, type: 'grade', results: groups }, { ...common, at: finishedAt, seq: 2, type: 'score', matcherSha256: matcher, requirements, retention }, { ...common, at: finishedAt, seq: 3, type: 'run_finished', status: 'completed', flags: [], usageTotals: usage, spentTokens: 0, completions: 0, wallMs, snapshotDigest: snapshot.digest }];
    const record = RunRecordSchema.parse({ ...experiment, runId, arm, repeat: 0, startedAt, finishedAt, model: { requested: experiment.model.requested, observed: [] }, status: 'completed', flags: [], exclusion: null, groupResults: groups, requirements, retention, usageTotals: usage, spentTokens: 0, completions: 0, wallMs, snapshotDigest: snapshot.digest, digests: { task: taskDigest, prompts: promptsDigest, matcher, hiddenBundle: groups.hiddenBundleDigest }, eventCount: events.length, chainHead: GENESIS_HASH });
    const artifactsByRequirement = Object.fromEntries(task.task.requirements.map((r) => [r.id, []]));
    writeRun(join(destination, runId), { record, events, task: task.task, artifactsByRequirement, snapshot: snapshot.files, view: { spec: task.spec, brief: task.brief, slices: task.sliceText } });
    output({ runId, baseline: true, modelCalls: 0, retention });
    // A failing control invalidates the instrument; retain the actual result and stop.
    if ((arm === 'null_worker' && retention !== 0) || (arm === 'oracle' && retention !== 1)) throw new Error('baseline control failed; no further dispatch');
  }
}
const GateReceipt = z.object({ schemaVersion: z.literal(1), gate: z.enum(['G-A', 'G-I', 'G-C']), status: z.literal('PASS'), tranche: LiveTrancheSchema, codeSha256: z.string().regex(/^[0-9a-f]{64}$/), evidenceRefs: z.array(z.string().min(1)).min(1), approvedBy: z.string().min(1), royDecisionRef: z.string().min(1), ownerConsentVerified: z.literal(true), expiresAt: z.string() }).strict();

/** Receipts are operator attestation, never inferred from file existence or Dirty construction review. */
function assertActivationGates(root: string, plan: TranchePlan, approval: Approval): void {
  const codeSha256 = sourceHash(root, ['src', 'cli']);
  for (const gate of plan.tranche === 'T2' ? ['G-A', 'G-I', 'G-C'] : ['G-A', 'G-I']) {
    const path = join(root, 'approvals', `${plan.tranche}.${gate}.json`);
    if (!existsSync(path)) throw new Error(`live refused: missing actual ${gate} activation receipt`);
    const receipt = GateReceipt.parse(readJson(path));
    if (receipt.gate !== gate || receipt.tranche !== plan.tranche || receipt.codeSha256 !== codeSha256 || receipt.royDecisionRef !== approval.approver.decisionRef || !Number.isFinite(Date.parse(receipt.expiresAt)) || Date.parse(receipt.expiresAt) <= Date.now()) throw new Error(`live refused: stale/mismatched ${gate} receipt`);
  }
}

async function executePlan(root: string, args: readonly string[], plan: TranchePlan, prices: PriceTable, activation?: LiveActivationPort): Promise<number> {
  const live = args.includes('--live');
  const providerName = flag(args, '--provider') ?? (live ? 'anthropic' : 'null');
  if (live && providerName !== 'anthropic') throw new Error('live requires anthropic');
  if (!live && providerName !== 'mock' && providerName !== 'null') throw new Error('synthetic execution accepts mock or null only');
  const destination = resolve(flag(args, '--out') ?? join(root, 'results', live ? plan.tranche : 'synthetic'));
  if (live && plan.tranche === 'T2' && !outsideRepo(root, destination)) throw new Error('held-out result evidence must remain outside the product repo; supply --out <outer-shell path>');
  let approval: Approval | undefined;
  let approvalSha256: string | null = null;
  let preregSha256: string | null = null;
  let heldoutManifest: HeldoutManifest | null = null;
  let prereg: ReturnType<typeof PreregManifestSchema.parse> | null = null;
  let reservationRatio = R_T0;
  let stateJournal: LiveStateJournal | undefined;
  let liveAttempt: LiveAttempt | undefined;
  if (live) {
    const approvalPath = join(root, 'approvals', `${plan.tranche}.json`);
    if (!existsSync(approvalPath)) throw new Error('live refused: no approval (approved spend is $0)');
    approval = assertLiveApproval(readJson(approvalPath), plan, prices, 0, process.env.HLS_LIVE_ENABLED);
    approvalSha256 = sha256Hex(readFileSync(approvalPath));
    if (flag(args, '--prices') === undefined) throw new Error('live refused: current owner-approved --prices table required');
    assertActivationGates(root, plan, approval);
    if (activation === undefined || !(await activation.verifyRoyDecision(approval))) throw new Error('live refused: owner decision validation port unavailable or consent unverified');
    stateJournal = new LiveStateJournal(activation.stateRoot, root);
    if (!outsideRepo(stateJournal.root, destination) || !outsideRepo(destination, stateJournal.root)) throw new Error('live result destination must be separate from trusted state root');
    if (plan.tranche !== 'T0') {
      const calibration = z.object({ reservationRatio: z.number().positive(), sourceTranche: z.literal('T0'), codeSha256: z.string(), evidenceRef: z.string().min(1) }).strict().parse(readJson(join(root, 'approvals', 'calibration.json')));
      if (calibration.codeSha256 !== sourceHash(root, ['src', 'cli'])) throw new Error('calibration source mismatch');
      reservationRatio = calibration.reservationRatio;
    }
    if (plan.tranche === 'T2') {
      const m = PreregManifestSchema.parse(readJson(join(root, 'prereg.manifest.json'))); prereg = m;
      if (m.sampling.temperature !== 1 || m.sampling.maxOutput !== DEFAULT_RUN_LIMITS.maxOutput) throw new Error('prereg sampling differs from live adapter');
      if (m.model !== plan.model || m.allowance.tokens !== plan.maxTokens || m.reservationRatio !== reservationRatio || m.runOrder.sha256 !== hashCanonical(plan.order) || m.priceTable.model !== prices.model || hashCanonical(m.priceTable) !== hashCanonical(prices) || m.analysisCodeSha256 !== sourceHash(root, ['src/stats', 'src/report']) || m.promptsSha256 !== sourceHash(root, ['src/runner/policies', 'src/runner/channels']) || m.matcherSha256 !== sourceHash(root, ['src/score/normalize.ts', 'src/score/evidence.ts'])) throw new Error('live refused: prereg source/order/allowance mismatch');
      heldoutManifest = HeldoutManifestSchema.parse(readJson(join(root, 'heldout.manifest.json')));
      if (m.heldoutManifestSha256 !== hashCanonical(heldoutManifest)) throw new Error('heldout manifest changed after freeze');
      preregSha256 = hashCanonical(m);
      // The sealed-data execution adapter must authenticate every file before reading it.
      // Until that operator-controlled adapter exists, no fallback to public dev tasks is allowed.
      if (activation.loadHeldoutTask === undefined) throw new Error('T2 refused: authenticated custodian sealed-task loader unavailable');
      for (const key of ['candidate', 'grader', 'episode'] as const) if (!activation.images[key].endsWith(`@${m.imageDigests[key]}`)) throw new Error('prereg image digest mismatch');
    }
  }
  if (live) {
    if (approval === undefined || stateJournal === undefined) throw new Error('live state authority unavailable');
    // Fsynced exclusive claim precedes imports, heldout loader and any provider dispatch.
    liveAttempt = stateJournal.start(approval, plan.boundUsd, { preregSha256, heldoutSha256: heldoutManifest === null ? null : hashCanonical(heldoutManifest) }, destination);
  }
  try {
    const { runEpisode } = await import('../src/runner/episode');
    const { NullProvider } = await import('../src/providers/null');
    const { MockProvider } = await import('../src/providers/mock');
    const { mockStepsForArm } = await import('../src/providers/mock');
    const { LocalUnsafeSandbox } = await import('../src/sandbox/local');
    const budget: RunBudget = { allowanceTokens: plan.maxTokens, r: reservationRatio, limits: DEFAULT_RUN_LIMITS };
    for (const run of plan.order) if (existsSync(join(destination, makeRunId({ tranche: live ? plan.tranche : 'DEMO', ...run })))) throw new Error('run directory already exists; no selective rerun or overwrite');
    for (const taskId of plan.tasks) for (const arm of ['null_worker', 'oracle'] as const) if (existsSync(join(destination, makeRunId({ tranche: live ? plan.tranche : 'DEMO', taskId, arm, repeat: 0 })))) throw new Error('baseline directory already exists; owner reconciliation required');
    mkdirSync(destination, { recursive: true });
    let crashes = 0; let attempted = 0;
    const baselinesWritten = new Set<string>();
    for (const run of plan.order) {
      if (live && approval !== undefined) assertLiveApproval(approval, { ...plan, boundUsd: plan.maxTokens * Math.max(prices.inputPerMTok, prices.outputPerMTok, prices.cacheReadPerMTok, prices.cacheWritePerMTok) / 1e6 }, prices, liveAttempt?.charged() ?? Number.NaN, process.env.HLS_LIVE_ENABLED);
      let task: LoadedTask;
      if (live && plan.tranche === 'T2') {
        if (activation?.loadHeldoutTask === undefined || heldoutManifest === null) throw new Error('missing custodian loader');
        const authenticated = await activation.loadHeldoutTask(run.taskId, heldoutManifest);
        if (authenticated.manifestSha256 !== hashCanonical(heldoutManifest) || authenticated.task.task.id !== run.taskId || authenticated.task.task.author.lineage !== 'custodian' || authenticated.task.task.split !== 'heldout') throw new Error('custodian task authentication mismatch');
        task = authenticated.task;
      } else task = loadTask(join(root, 'tasks', 'dev', run.taskId));
      if (task.schemaIssues.length > 0) throw new Error('task schema issues prevent execution');
      let provider: ProviderPort;
      if (live) {
        // Importing the SDK and reading a key happen only beyond all approval and activation gates.
        const { AnthropicProvider } = await import('../src/providers/anthropic');
        if (approval === undefined || activation === undefined || liveAttempt === undefined) throw new Error('live activation missing');
        provider = new AnthropicProvider({ approval, scope: plan, prices, r: reservationRatio, verifyRoyDecision: activation.verifyRoyDecision, spend: liveAttempt });
      } else provider = providerName === 'mock' ? new MockProvider(mockStepsForArm(run.arm)) : new NullProvider();
      // Synthetic providers emit authored fixture actions. LocalUnsafeSandbox is forbidden for live model output.
      let sandbox: SandboxPort;
      let baselineSandboxFor: (runId: string) => SandboxPort;
      let publicTests: PublicTestPort | undefined;
      if (live) {
        if (activation === undefined || task.hidden === null || task.staticConfig === null) throw new Error('live sandbox prerequisites missing');
        const runId = makeRunId({ tranche: plan.tranche, ...run });
        if (!(await activation.authorizeContainers(runId))) throw new Error('live refused: Docker consent/agent-ports ownership unavailable');
        const { DockerPairSandbox, DockerPublicTestPort } = await import('../src/sandbox/docker');
        const pairOptions = { ownerRunId: runId, workRoot: activation.workRoot, hidden: task.hidden, staticConfig: task.staticConfig, doNotTouchGroups: task.task.requirements.filter((r) => r.kind === 'do_not_touch').map((r) => r.testGroup), candidatePaths: [...task.repo.keys()].filter((p) => /^src\/.+\.ts$/.test(p)), candidateImage: activation.images.candidate, graderImage: activation.images.grader, authorizeContainers: activation.authorizeContainers };
        sandbox = new DockerPairSandbox(pairOptions);
        baselineSandboxFor = (ownerRunId) => new DockerPairSandbox({ ...pairOptions, ownerRunId });
        const tests = new Map(task.task.publicTests.map((path) => { const bytes = task.repo.get(path); if (bytes === undefined) throw new Error('public test path missing'); return [path, bytes] as const; }));
        publicTests = new DockerPublicTestPort({ ownerRunId: runId, workRoot: activation.workRoot, episodeImage: activation.images.episode, publicTests: tests, authorizeContainers: activation.authorizeContainers });
      } else { sandbox = new LocalUnsafeSandbox({ provider: providerName as 'null' | 'mock', origin: 'fixture', repoRoot: root, hidden: task.hidden ?? new Map(), vitestEntry: join(root, 'node_modules', 'vitest', 'vitest.mjs') }); baselineSandboxFor = () => sandbox; }
      const result = await runEpisode({ task, arm: run.arm, repeat: run.repeat, tranche: live ? plan.tranche : 'DEMO', provider, budget, sandbox, ...(publicTests === undefined ? {} : { publicTests }), ...(live ? { model: plan.model } : {}) });
      const artifactsByRequirement = Object.fromEntries(task.task.requirements.map((requirement) => [requirement.id, result.handoffs.filter((h) => h.to === responsibleWorker(run.arm, requirement)).map(artifactFromHandoff)]));
      const groups = result.groups === null ? null : Object.fromEntries(Object.entries(result.groups.groups).map(([key, value]) => [key, value.passed]));
      const requirements = groups === null ? [] : task.task.requirements.map((requirement) => scoreRequirement({ arm: run.arm, requirement, groups, artifacts: artifactsByRequirement[requirement.id] ?? [] }));
      const retention = result.groups === null ? null : retentionOf(result.groups);
      const events = [...result.events];
      const start = events[0]; const finish = events.at(-1);
      if (start?.type !== 'run_started' || finish?.type !== 'run_finished') throw new Error('episode missing boundary events');
      const matcher = sourceHash(root, ['src/score/normalize.ts', 'src/score/evidence.ts']);
      if (retention !== null) events.splice(events.length - 1, 0, { type: 'score', seq: events.length - 1, at: finish.at, runId: result.runId, matcherSha256: matcher, requirements, retention });
      const sequenced = events.map((event, seq) => ({ ...event, seq }) as RunEvent);
      const exclusion = result.flags.includes('visibility_leak') ? 'visibility_leak' : result.status === 'usage_unknown' ? 'usage_unknown' : result.status === 'reservation_overrun' ? 'reservation_overrun' : result.flags.includes('model_mismatch') ? 'model_mismatch' : result.status === 'integrity_stop' ? 'integrity_stop' : null;
      const record = RunRecordSchema.parse({ schemaVersion: 1, runId: result.runId, taskId: run.taskId, arm: run.arm, repeat: run.repeat, startedAt: start.at, finishedAt: finish.at, model: { requested: start.requestedModel, observed: [...new Set(events.flatMap((e) => e.type === 'response' ? [e.completion.observedModel] : []).filter((x): x is string => typeof x === 'string'))] }, sampling: { temperature: live ? (prereg?.sampling.temperature ?? 1) : null, maxOutput: budget.limits.maxOutput }, budget, usageTotals: result.usage, spentTokens: result.spentTokens, completions: result.completions, wallMs: result.wallMs, status: result.status, flags: result.flags, exclusion, groupResults: result.groups, requirements, retention, snapshotDigest: finish.snapshotDigest, digests: { task: start.taskDigest, prompts: start.promptsDigest, matcher: retention === null ? null : matcher, hiddenBundle: result.groups?.hiddenBundleDigest ?? null }, eventCount: sequenced.length, chainHead: GENESIS_HASH, ...(live && approval !== undefined ? { edition: 'LIVE', tranche: plan.tranche, provider: 'anthropic', approval: { fileSha256: approvalSha256, decisionRef: approval.approver.decisionRef }, preregSha256 } : { edition: 'SYNTHETIC', tranche: 'DEMO', provider: providerName, approval: null, preregSha256: null }) });
      writeRun(join(destination, record.runId), { record, events: sequenced, task: task.task, artifactsByRequirement, snapshot: result.snapshot.files, view: { spec: task.spec, brief: task.brief, slices: task.sliceText } });
      output({ runId: record.runId, edition: record.edition, status: record.status, retention: record.retention });
      attempted += 1; if (result.status === 'worker_crash') crashes += 1;
      if (exclusion !== null || (live && plan.tranche !== 'T2' && crashes / attempted > 0.1)) throw new Error(`tranche stopped: exclusion=${exclusion ?? 'none'}; status=${result.status}; flags=${result.flags.join(',')}; instrumentCrashes=${crashes}/${attempted}`);
      if (!baselinesWritten.has(task.task.id)) { await persistBaselines(destination, task, baselineSandboxFor, record, matcher); baselinesWritten.add(task.task.id); }
    }
    liveAttempt?.finish('all planned runs and controls completed', true);
    return 0;
  } catch (error) {
    if (liveAttempt !== undefined) {
      const reason = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      try { liveAttempt.finish(reason); } catch (stateError) {
        // The durable start still consumes T2 even if the finish cannot be persisted. Never hide either failure.
        throw new AggregateError([error, stateError], 'live execution stopped; durable start remains consumed, stop reason could not be persisted');
      }
    }
    throw error;
  }
}

export async function studyMain(argv: readonly string[], root: string, activation?: LiveActivationPort): Promise<number | null> {
  const [command, ...args] = argv;
  if (command === 'plan' || command === 'run') {
    const tranche = LiveTrancheSchema.parse(flag(args, '--tranche') ?? 'T0');
    const prices = flag(args, '--prices') === undefined ? DISPLAY_PRICES : PriceTableSchema.parse(readJson(resolve(flag(args, '--prices') ?? '')));
    const model = flag(args, '--model') ?? prices.model;
    const options = { seed: numberFlag(args, '--seed', 42001), maxUsd: numberFlag(args, '--max-usd', 0), model, prices };
    const tokens = flag(args, '--max-tokens');
    const plan = planTranche(tranche, tokens === undefined ? options : { ...options, maxTokens: Number(tokens) });
    if (command === 'plan' || (!args.includes('--live') && !args.includes('--execute'))) { output({ mode: 'DRY RUN — no dispatch, no approval implied', ...plan }); return 0; }
    return executePlan(root, args, plan, prices, activation);
  }
  if (command === 'verify' || command === 'report') {
    const path = args[0]; if (path === undefined || path.startsWith('--')) throw new Error(`${command} requires a result directory`);
    const runs = loadRuns(resolve(path), sourceHash(root, ["src/score/normalize.ts", "src/score/evidence.ts"]));
    if (runs.length === 0) throw new Error('no complete run journals');
    if (command === 'verify') { output({ verified: runs.map((r) => ({ runId: r.record.runId, journalHead: r.journalHead, scoreRecomputed: r.scoreRecomputed })), graderRerun: false }); return 0; }
    const pricesPath = flag(args, '--prices');
    const devPath = flag(args, '--dev-results');
    const devRecords = devPath === undefined ? [] : loadRuns(resolve(devPath), sourceHash(root, ["src/score/normalize.ts", "src/score/evidence.ts"])).map((r) => r.record);
    const report = aggregate(runs.map((r) => r.record), pricesPath === undefined ? undefined : PriceTableSchema.parse(readJson(resolve(pricesPath))), runs.map((r) => r.diagnostics), devRecords);
    const destination = resolve(flag(args, '--out') ?? join(root, 'results', 'report'));
    if (runs.some((r) => r.record.tranche === 'T2') && !outsideRepo(root, destination)) throw new Error('held-out report must remain outside product repo; supply --out <outer-shell path>');
    mkdirSync(destination, { recursive: true });
    writeFileSync(join(destination, 'report.json'), reportJson(report));
    writeFileSync(join(destination, 'report.md'), reportMarkdown(report));
    writeFileSync(join(destination, 'index.html'), reportHtml(report));
    output({ banner: report.banner, directory: destination, runs: report.runs }); return 0;
  }
  if (command === 'prereg' && args[0] === 'freeze') {
    const input = flag(args, '--input'); if (input === undefined) throw new Error('prereg freeze requires --input <complete manifest.json>');
    const raw = readJson(resolve(input));
    const m = PreregManifestSchema.parse(raw);
    const devPath = flag(args, '--dev-results');
    if (devPath === undefined) throw new Error('prereg freeze requires --dev-results <verified T1 directory> to derive the allowance');
    const singles = loadRuns(resolve(devPath), sourceHash(root, ["src/score/normalize.ts", "src/score/evidence.ts"])).map((r) => r.record).filter((r) => r.arm === 'single');
    if (singles.length !== 12 || singles.some((r) => r.tranche !== 'T1' || r.edition !== 'LIVE' || r.model.requested !== m.model || r.exclusion !== null || r.usageTotals.source !== 'provider_reported') || new Set(singles.map((r) => r.taskId)).size !== 6 || singles.some((r) => r.repeat !== 0 && r.repeat !== 1)) throw new Error('prereg allowance requires all twelve verified T1 single runs');
    if (m.allowance.devSingleP75 !== nearestRankP75(singles.map((r) => usageTotalTokens(r.usageTotals)))) throw new Error('prereg P75 differs from actual T1 single totals');
    const order = planTranche('T2', { seed: Number(m.runOrder.seed), maxTokens: m.allowance.tokens, prices: m.priceTable, model: m.model }).order;
    const manifest = HeldoutManifestSchema.parse(readJson(join(root, 'heldout.manifest.json')));
    if (new Set(manifest.files.filter((f) => f.kind === 'task_file').map((f) => f.path.split('/')[1])).size !== 12) throw new Error('prereg requires twelve custodian held-out task namespaces');
    const pins = { analysisCodeSha256: sourceHash(root, ['src/stats', 'src/report']), promptsSha256: sourceHash(root, ['src/runner/policies', 'src/runner/channels']), matcherSha256: sourceHash(root, ['src/score/normalize.ts', 'src/score/evidence.ts']), heldoutManifestSha256: hashCanonical(manifest), runOrder: order };
    output({ frozen: true, sha256: freezePrereg(join(root, 'prereg.manifest.json'), validatePrereg(raw, pins)), consent: 'NOT a live approval' }); return 0;
  }
  if (command === 'heldout' && args[0] === 'import') {
    const manifest = flag(args, '--manifest') ?? (args[1]?.startsWith('--') ? undefined : args[1]); if (manifest === undefined) throw new Error('heldout import requires --manifest <custodian manifest.json>; does not open sealed content');
    output({ imported: 'manifest only', sha256: importHeldoutManifest(readJson(resolve(manifest)), join(root, 'heldout.manifest.json')), sealedFilesRead: false }); return 0;
  }
  if (command === 'check' && args[0] === 'stats') {
    const p = exactMcnemar(5, 1); const ok = p !== null && Math.abs(p - 14 / 64) < 1e-12;
    output({ edition: 'SYNTHETIC', check: 'McNemar arithmetic', ok, actual: p, expected: 14 / 64, note: 'Broader stats tests: npm run test -- tests/stats.test.ts' }); return ok ? 0 : 1;
  }
  if (command === 'check' && (args[0] === 'budget' || args[0] === 'containment')) {
    const files = args[0] === 'budget' ? ['tests/budget.test.ts', 'tests/ledger.test.ts', 'tests/approvals.test.ts'] : ['tests/tools.test.ts', 'tests/policies.test.ts', 'tests/channels.test.ts'];
    const entry = join(root, 'node_modules', 'vitest', 'vitest.mjs');
    if (!existsSync(entry)) throw new Error('deferred check cannot run: dependencies not installed; no PASS claimed');
    const code = await new Promise<number>((resolveCode, reject) => {
      const child = spawn(process.execPath, [entry, 'run', ...files], { cwd: root, stdio: 'inherit', shell: false, windowsHide: true });
      child.once('error', reject); child.once('close', (exitCode) => resolveCode(exitCode ?? 1));
    });
    if (code !== 0) return code;
    if (args[0] === 'containment') { output({ memoryAndPolicyChecks: 'PASS', dockerAttackHangCleanup: 'DEFERRED — owner-authorized Docker D-class evidence required, not proven by unit tests', admitted: false }); return 3; }
    return 0;
  }
  if (command === 'check' && args[0] === 'alternates') {
    const { LocalUnsafeSandbox } = await import('../src/sandbox/local');
    const rows: { task: string; alternate: string; passed: boolean }[] = [];
    for (const dir of findTaskDirs(join(root, 'tasks', 'dev'))) {
      const task = loadTask(dir);
      if (task.hidden === null || task.alternates.size < 2) throw new Error(`${task.task.id}: hidden tests and two alternates required`);
      const sandbox = new LocalUnsafeSandbox({ provider: 'null', origin: 'alternate', repoRoot: root, hidden: task.hidden, vitestEntry: join(root, 'node_modules', 'vitest', 'vitest.mjs') });
      for (const [name, files] of task.alternates) { const result = await sandbox.grade(snapshotOf(overlay(task.repo, files)), treeDigest(task.hidden)); rows.push({ task: task.task.id, alternate: name, passed: Object.values(result.groups).every((g) => g.passed) }); }
    }
    const ok = rows.length > 0 && rows.every((r) => r.passed); output({ edition: 'SYNTHETIC', check: 'authored dev alternates', ok, rows }); return ok ? 0 : 1;
  }
  if (command === 'check' && args[0] === 'carry') {
    const path = flag(args, '--public'); const freezePath = flag(args, '--freeze');
    if (path === undefined || freezePath === undefined || activation?.loadSealedCarryPairs === undefined) throw new Error('carry refused: independent custodian public pairs, pre-opening matcher freeze and authenticated sealed loader required');
    const freeze = z.object({ matcherSha256: z.string(), publicPairsSha256: z.string(), sealedPairsSha256: z.string(), frozenAt: z.string(), custodianName: z.string().min(1), royDecisionRef: z.string().min(1) }).strict().parse(readJson(resolve(freezePath)));
    if (freeze.matcherSha256 !== sourceHash(root, ['src/score/normalize.ts', 'src/score/evidence.ts']) || freeze.publicPairsSha256 !== sha256Hex(readFileSync(resolve(path))) || !Number.isFinite(Date.parse(freeze.frozenAt)) || Date.parse(freeze.frozenAt) > Date.now()) throw new Error('carry freeze/source/public pair pin mismatch');
    const publicPairs = z.array(CarryPairSchema).length(40).parse(readJson(resolve(path)));
    if (publicPairs.some((p) => p.set !== 'custodian_public')) throw new Error('public conformance must be independent custodian data');
    const receiptDir = flag(args, '--receipt-dir');
    if (receiptDir === undefined || !outsideRepo(root, receiptDir)) throw new Error('sealed carry receipts must remain outside product repo; supply --receipt-dir <outer-shell path>');
    const destination = resolve(receiptDir);
    const stateJournal = new LiveStateJournal(activation.stateRoot, root);
    if (!outsideRepo(stateJournal.root, destination) || !outsideRepo(destination, stateJournal.root)) throw new Error('carry receipt destination must be separate from trusted state root');
    // Claim sealed identity, independent of matcher/public/approval/receipt directory, before any opening.
    stateJournal.claimCarry({ sealedPairsSha256: freeze.sealedPairsSha256, matcherSha256: freeze.matcherSha256, publicPairsSha256: freeze.publicPairsSha256 }, destination);
    let failure: CarryOutcome = 'receipt_write_failed';
    let results: { id: string; set: string; matchesExpected: boolean; falseEvidence: boolean }[];
    let ok: boolean;
    try {
      mkdirSync(destination, { recursive: true });
      // Presentation copy only; stable journal authority remains consumed even if this write fails.
      writeFileSync(join(destination, 'carry-once.json'), JSON.stringify({ matcherSha256: freeze.matcherSha256, sealedPairsSha256: freeze.sealedPairsSha256, openedAt: new Date().toISOString() }) + '\n', { flag: 'wx' });
      failure = 'sealed_load_failed';
      const sealed = await activation.loadSealedCarryPairs(freeze.sealedPairsSha256);
      failure = 'sealed_hash_mismatch';
      if (sealed.fileSha256 !== freeze.sealedPairsSha256) throw new Error('sealed carry file hash mismatch');
      failure = 'sealed_schema_invalid';
      const sealedPairs = z.array(CarryPairSchema).length(40).parse(sealed.pairs);
      failure = 'sealed_identity_invalid';
      if (sealedPairs.some((p) => p.set !== 'custodian_sealed')) throw new Error('sealed conformance must be independent custodian data');
      const pairs = [...publicPairs, ...sealedPairs];
      failure = 'duplicate_pair_ids';
      if (new Set(pairs.map((p) => p.id)).size !== 80) throw new Error('carry conformance IDs must be unique');
      failure = 'evaluation_failed';
      results = pairs.map((p) => { const actual = pairLexicalState(p); return { id: p.id, set: p.set, matchesExpected: actual === p.expectedLexicalState, falseEvidence: actual === 'evidence' && p.semanticLabel !== 'carried' }; });
      ok = results.every((r) => r.matchesExpected && !r.falseEvidence);
      failure = 'result_write_failed';
      writeFileSync(join(destination, 'carry-once-result.json'), JSON.stringify({ ok, matcherSha256: freeze.matcherSha256, results }, null, 2) + '\n', { flag: 'wx' });
    } catch {
      // Never persist or rethrow custodian/schema error text: it may contain sealed labels or bytes.
      const stop = new Error(`sealed carry evaluation stopped: ${failure}; edition remains consumed`);
      try { stateJournal.finishCarry(freeze.sealedPairsSha256, failure); } catch { throw new AggregateError([stop, new Error('carry stop persistence failed; durable start remains consumed')], 'sealed carry stop could not be persisted'); }
      throw stop;
    }
    stateJournal.finishCarry(freeze.sealedPairsSha256, ok ? 'conformance_passed' : 'conformance_failed');
    output({ check: 'custodian carry conformance', ok, results, note: 'failure halts activation; no tuning/reopening this sealed edition' }); return ok ? 0 : 1;
  }
  return null;
}
