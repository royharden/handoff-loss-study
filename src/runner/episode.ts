import { RunEventSchema } from '../core/contracts';
import type { GroupResults, ProviderPort, RunBudget, RunEvent, RunFlag, RunStatus, SandboxPort, SourceSnapshot, Usage, RunnerPort, Task } from '../core/contracts';
import { sha256Hex, hashCanonical } from '../core/hash';
import { channelOf, makeRunId } from '../core/ids';
import type { Arm, Tranche, WorkerRole } from '../core/ids';
import { HandoffSchema } from '../core/handoff-schema';
import type { Handoff } from '../core/handoff-schema';
import { auditRequest, auditedAnchors } from '../score/visibility';
import { isSandboxIntegrityError, snapshotOf, treeDigest } from '../sandbox/port';
import type { LoadedTask } from '../tasks/load';
import { LedgerProvider, ProviderAttemptError } from '../providers/ledger';
import { BudgetMeter, BudgetStop } from './budget';
import { executeTool, toolsFor } from './tools';
import type { PublicTestPort } from './tools';
import { singlePolicy } from './policies/single';
import type { WorkerPolicy } from './policies/single';
import { implementerPolicy, plannerPolicy } from './policies/role';
import { contextPolicy } from './policies/context';
import { specBlindPolicy } from './policies/spec-blind';
import { mergeModules } from './merge';
import { checkHandoffLength } from './channels/free';
import { inspectFixed } from './channels/fixed';
import { fullTrace } from './channels/trace';

export interface EpisodeOptions {
  task: LoadedTask; arm: Arm; repeat: number; tranche: Tranche; provider: ProviderPort; budget: RunBudget;
  sandbox?: SandboxPort; model?: string; publicTests?: PublicTestPort; signal?: AbortSignal;
}
export interface EpisodeResult { runId: string; events: RunEvent[]; snapshot: SourceSnapshot; handoffs: Handoff[]; status: RunStatus; flags: RunFlag[]; usage: Usage; spentTokens: number; completions: number; wallMs: number; groups: GroupResults | null; }
/** Own minimal tool loop. No task metadata, hidden tests or full task object is ever serialised to a provider. */
export async function runEpisode(options: EpisodeOptions): Promise<EpisodeResult> {
  const { task, arm, provider, budget } = options;
  const live = provider.name === 'anthropic';
  if (live !== ['T0', 'T1', 'T2'].includes(options.tranche)) throw new Error('SYNTHETIC/live mixing');
  if (live && options.sandbox?.kind !== 'docker_pair') throw new Error('live requires D17 Docker pair');
  if (task.task.split === 'heldout' && options.tranche !== 'T2') throw new Error('heldout requires T2');
  if (arm === 'oracle') throw new Error('oracle is an authored sandbox baseline, not a worker policy');
  if (arm === 'null_worker' && provider.name !== 'null') throw new Error('null_worker requires null provider');
  const runId = makeRunId({ tranche: options.tranche, taskId: task.task.id, arm, repeat: options.repeat });
  const meter = new BudgetMeter(budget); const ledger = new LedgerProvider(provider, meter);
  const events: RunEvent[] = []; const handoffs: Handoff[] = []; const flags = new Set<RunFlag>();
  let status: RunStatus = 'completed'; let snapshot = snapshotOf(task.repo); let groups: GroupResults | null = null;
  let currentSingle: WorkerPolicy | null = null;
  let contextWorkers: { a: WorkerPolicy; b: WorkerPolicy } | null = null;
  const signal = AbortSignal.any([options.signal ?? new AbortController().signal, AbortSignal.timeout(budget.limits.wallMs)]);
  const emit = (event: Record<string, unknown>): void => { events.push(RunEventSchema.parse({ ...event, seq: events.length, at: new Date().toISOString(), runId })); };
  emit({ type: 'run_started', edition: live ? 'LIVE' : 'SYNTHETIC', taskId: task.task.id, arm, repeat: options.repeat, provider: provider.name, requestedModel: options.model ?? null, budget, taskDigest: hashCanonical(task.task), promptsDigest: hashCanonical({ policy: 'worker-loop-v1', arm, brief: task.brief }) });
  const received = new Map<WorkerRole, Handoff[]>();
  const textOf = (h: Handoff): string => h.channel === 'fixed_brief' ? h.raw : h.channel === 'full_trace' ? JSON.stringify(h.messages) : h.text;
  const deliver = (policy: WorkerPolicy, handoff: Handoff): void => {
    handoffs.push(handoff); emit({ type: 'handoff_delivered', handoff });
    const list = received.get(policy.role) ?? []; list.push(handoff); received.set(policy.role, list);
    policy.messages.push({ role: 'user', segments: [{ provenance: { kind: 'handoff', handoffId: handoff.handoffId }, text: textOf(handoff) }] });
  };
  let callIndex = 0;
  const handoffId = (role: WorkerRole): string => role === 'context_B' ? 'h2' : 'h1';
  async function worker(policy: WorkerPolicy, phase: 'handoff' | 'finish', channel: 'free_summary' | 'fixed_brief' | 'full_trace' | null): Promise<string> {
    const user = policy.messages.find((m) => m.role === 'user');
    if (user?.role === 'user') emit({ type: 'view_delivered', worker: policy.role, items: user.segments.filter((s) => s.provenance.kind === 'initial_view').map((s) => ({ item: s.provenance.kind === 'initial_view' ? s.provenance.item : 'brief', module: s.provenance.kind === 'initial_view' ? s.provenance.module : null, bytes: Buffer.byteLength(s.text), sha256: sha256Hex(s.text) })) });
    policy.messages.push({ role: 'user', segments: [{ provenance: { kind: 'system' }, text: phase === 'handoff' ? `Phase 1: inspect and plan only; submit exactly one ${channel} handoff. ${channel === 'fixed_brief' ? 'JSON keys: objective, requirements, decisions_overrides, prohibitions, interfaces, open_items, files_touched; arrays except objective.' : ''}` : 'Implement your visible assignment, then finish. No return or repair round.' }] });
    let correction = false;
    while (true) {
      meter.assertRunning(); if (signal.aborted) throw new Error('episode aborted');
      const allowed = toolsFor(policy).filter((t) => phase !== 'handoff' || !['write_file', 'edit_file', 'run_public_tests'].includes(t.name));
      const incoming = received.get(policy.role) ?? [];
      const index = callIndex++;
      const findings = auditRequest({ worker: policy.role, anchors: auditedAnchors(task.task.requirements), permittedTexts: [policy.source, ...incoming.map(textOf)], receivedHandoffIds: new Set(incoming.map((h) => h.handoffId)) }, index, policy.messages);
      for (const finding of findings) { flags.add(finding.finding); emit({ type: 'visibility', ...finding }); }
      if (findings.some((f) => f.finding === 'visibility_leak')) { if (options.tranche === 'T2') flags.add('heldout_burned'); meter.stop('integrity_stop'); }
      const completion = await ledger.complete({ messages: policy.messages, tools: allowed, maxOutput: budget.limits.maxOutput, signal }, {
        reservation: (reservation, attempt, spentBefore) => emit({ type: 'reservation', worker: policy.role, callIndex: index, attempt, reservation, spentBefore, allowanceTokens: budget.allowanceTokens, granted: true }),
        request: (args, serialized, attempt) => emit({ type: 'request', worker: policy.role, callIndex: index, attempt, messages: args.messages, requestBytes: Buffer.byteLength(serialized), requestSha256: sha256Hex(serialized) }),
        response: (response, bookedTokens, attempt) => { if (attempt) flags.add('ledger_retry_used'); emit({ type: 'response', worker: policy.role, callIndex: index, attempt, completion: response, bookedTokens }); },
        error: (error, bookedTokens, attempt) => emit({ type: 'provider_error', worker: policy.role, callIndex: index, attempt, kind: error instanceof ProviderAttemptError ? error.kind : 'other', retryable: error instanceof ProviderAttemptError && error.retryable, message: error instanceof Error ? error.message.slice(0, 2000) : 'provider error', bookedTokens }),
      });
      if (live && completion.observedModel !== options.model) { flags.add('model_mismatch'); meter.stop('integrity_stop'); }
      if (new Set(completion.message.toolCalls.map((c) => c.id)).size !== completion.message.toolCalls.length || (completion.message.toolCalls.length > 1 && completion.message.toolCalls.some((c) => c.name === 'finish' || c.name === 'submit_handoff'))) throw new Error('control tool must be the sole call');
      policy.messages.push({ role: 'assistant', ...completion.message });
      if (!completion.message.toolCalls.length) { policy.messages.push({ role: 'user', segments: [{ provenance: { kind: 'system' }, text: phase === 'handoff' ? 'Use submit_handoff to complete this phase.' : 'Use finish to complete this worker.' }] }); continue; }
      for (const call of completion.message.toolCalls) {
        const result = allowed.some((t) => t.name === call.name) ? await executeTool(policy, call, options.publicTests, signal) : { outcome: 'error' as const, segments: [{ provenance: { kind: 'tool_result' as const, callId: call.id, path: null }, text: 'tool unavailable in this phase' }] };
        const resultText = result.segments.map((s) => s.text).join('\n');
        emit({ type: 'tool_call', worker: policy.role, callId: call.id, tool: call.name, input: call.input, outcome: result.outcome, resultBytes: Buffer.byteLength(resultText), resultSha256: sha256Hex(resultText), resultProvenance: result.segments.every((s) => s.provenance.kind === 'self') ? 'self' : 'tool_result' });
        if ('refusal' in result && result.refusal) { flags.add('out_of_module_write_refused'); emit({ type: 'write_refused', worker: policy.role, callId: call.id, requestedPath: result.refusal.requestedPath.slice(0, 1024), reason: result.refusal.reason }); }
        policy.messages.push({ role: 'tool', toolCallId: call.id, isError: result.outcome !== 'ok', segments: result.segments });
        if ('handoff' in result && result.handoff !== undefined && phase === 'handoff') {
          const raw = result.handoff;
          const check = channel === 'fixed_brief' ? inspectFixed(raw, policy.source, budget.r) : { ...checkHandoffLength(raw, policy.source, budget.r), correctionReason: null };
          const reason = !check.fits ? 'over_length' : check.correctionReason;
          if (channel !== 'full_trace' && reason && !correction) {
            correction = true;
            emit({ type: 'handoff_correction', worker: policy.role, handoffId: handoffId(policy.role), channel, reason });
            policy.messages.push({ role: 'user', segments: [{ provenance: { kind: 'system' }, text: `One budgeted correction: ${reason}; resubmit within ${check.tokenBound} byte-bound tokens.` }] }); continue;
          }
          if (channel !== 'full_trace' && !check.fits) meter.stop('cap_hit');
          if (channel === 'fixed_brief' && !inspectFixed(raw, policy.source, budget.r).parsed.ok) flags.add('malformed_handoff');
          return raw;
        }
        if ('finish' in result && result.finish) { if (phase === 'finish' || channel === 'full_trace') return ''; throw new Error('worker finished without required handoff'); }
      }
    }
  }
  function handoff(from: WorkerPolicy, to: WorkerPolicy, channel: 'free_summary' | 'fixed_brief' | 'full_trace', raw: string): Handoff {
    const trace = fullTrace(from.messages); const text = channel === 'full_trace' ? JSON.stringify(trace) : raw;
    const length = checkHandoffLength(raw, from.source, budget.r);
    const base = { handoffId: handoffId(from.role), from: from.role, to: to.role, deliveredAtSeq: events.length, deliveredAt: new Date().toISOString(), bytes: Buffer.byteLength(text), sha256: sha256Hex(text), sourceTokens: channel === 'full_trace' ? null : length.sourceTokens, tokenBound: channel === 'full_trace' ? null : length.tokenBound };
    if (channel === 'full_trace') return HandoffSchema.parse({ ...base, channel, messages: trace, capHit: false });
    if (channel === 'free_summary') return HandoffSchema.parse({ ...base, channel, text });
    const parsed = inspectFixed(raw, from.source, budget.r).parsed;
    return HandoffSchema.parse({ ...base, channel, raw, parsed: parsed.ok ? parsed.brief : null, malformed: !parsed.ok, correctionUsed: events.some((e) => e.type === 'handoff_correction' && e.worker === from.role) });
  }
  try {
    if (arm === 'single' || arm === 'spec_blind' || arm === 'null_worker') { const policy = arm === 'spec_blind' ? specBlindPolicy(task) : singlePolicy(task); currentSingle = policy; await worker(policy, 'finish', null); snapshot = snapshotOf(policy.workspace.tree()); }
    else if (arm.startsWith('role/')) { const channel = channelOf(arm as 'role/free_summary'); if (!channel) throw new Error('channel missing'); const planner = plannerPolicy(task); const implementer = implementerPolicy(task); currentSingle = implementer; const raw = await worker(planner, 'handoff', channel); deliver(implementer, handoff(planner, implementer, channel, raw)); await worker(implementer, 'finish', null); snapshot = snapshotOf(implementer.workspace.tree()); }
    else if (arm.startsWith('context/')) {
      const channel = channelOf(arm as 'context/free_summary'); if (!channel || channel === 'full_trace') throw new Error('invalid context channel');
      const a = contextPolicy(task, 'A'); const b = contextPolicy(task, 'B');
      contextWorkers = { a, b };
      const rawA = await worker(a, 'handoff', channel); const rawB = await worker(b, 'handoff', channel);
      // Both phase-1 outputs are frozen before either receiver sees a peer handoff.
      const ab = handoff(a, b, channel, rawA); const ba = handoff(b, a, channel, rawB); deliver(b, ab); deliver(a, ba);
      a.canHandoff = false; b.canHandoff = false;
      a.canTest = true; b.canTest = true;
      await worker(a, 'finish', null); await worker(b, 'finish', null);
      snapshot = snapshotOf(mergeModules(task.task, task.repo, a.workspace.tree(), b.workspace.tree()));
      emit({ type: 'merge', files: (['A', 'B'] as const).map((m) => ({ path: task.task.modules[m].path, from: m, sha256: sha256Hex(snapshot.files.get(task.task.modules[m].path) ?? new Uint8Array()) })) });
    } else throw new Error('unsupported arm');
  } catch (error) {
    status = isSandboxIntegrityError(error) ? 'integrity_stop' : error instanceof BudgetStop ? error.status : 'worker_crash';
    if (status === 'integrity_stop' && options.tranche === 'T2') flags.add('heldout_burned');
    if (currentSingle) snapshot = snapshotOf(currentSingle.workspace.tree());
    if (contextWorkers) snapshot = snapshotOf(mergeModules(task.task, task.repo, contextWorkers.a.workspace.tree(), contextWorkers.b.workspace.tree()));
    if (status === 'cap_hit') { for (const h of handoffs) if (h.channel === 'full_trace') h.capHit = true; for (const e of events) if (e.type === 'handoff_delivered' && e.handoff.channel === 'full_trace') e.handoff.capHit = true; }
  }
  // Cap hits and worker failures are outcomes: grade the last actual writes after stopping the loop.
  if (options.sandbox && status !== 'integrity_stop' && status !== 'reservation_overrun' && status !== 'usage_unknown') {
    try { if (!task.hidden) throw new Error('hidden bundle absent'); groups = await options.sandbox.grade(snapshot, treeDigest(task.hidden)); emit({ type: 'grade', results: groups }); }
    catch (error) { if (isSandboxIntegrityError(error)) { status = 'integrity_stop'; if (options.tranche === 'T2') flags.add('heldout_burned'); } else status = 'worker_crash'; }
  }
  const wallMs = Date.now() - meter.started;
  emit({ type: 'run_finished', status, flags: [...flags], usageTotals: ledger.usage, spentTokens: meter.spent, completions: meter.completions, wallMs, snapshotDigest: snapshot.digest });
  return { runId, events, snapshot, handoffs, status, flags: [...flags], usage: ledger.usage, spentTokens: meter.spent, completions: meter.completions, wallMs, groups };
}
/** Existing port bridge. It validates task identity rather than accepting unseen loader metadata. */
export class StudyRunner implements RunnerPort {
  readonly options: Omit<EpisodeOptions, 'arm' | 'repeat' | 'budget' | 'sandbox'>;
  constructor(options: Omit<EpisodeOptions, 'arm' | 'repeat' | 'budget' | 'sandbox'>) { this.options = options; }
  async *runCell(task: Task, cell: Arm, repeat: number, budget: RunBudget, sandbox: SandboxPort): AsyncIterable<RunEvent> {
    if (hashCanonical(task) !== hashCanonical(this.options.task.task)) throw new Error('loaded task mismatch');
    const result = await runEpisode({ ...this.options, arm: cell, repeat, budget, sandbox });
    yield* result.events;
  }
}
