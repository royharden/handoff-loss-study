/**
 * Keyless scripted-fixture path (PLAN.md §12 M2): `fixtures/scripted/*.json` -> scored outcome, compared
 * with `fixtures/expected.json` by `hls fixture` / `hls selftest`.
 *
 * A fixture is a recorded, builder-authored SYNTHETIC run: the arm, the requirements under test, what
 * each responsible writer received (carriers) and when it last edited, the hidden-group pass map, the
 * recorded run status, the scripted completions per worker (replayed through ScriptedProvider for usage),
 * refused writes, and stored request payloads with segment provenance (for the D16 audit). The episode
 * loop itself is M4; fixtures stand in for its output.
 *
 * Derived here (never copied from the fixture): usage totals and ledger-retry flag (from the replayed
 * script), `malformed_handoff` (a fixed brief that does not parse), `out_of_module_write_refused`,
 * visibility findings and flags, exclusion, every requirement's evidence state and class, contract
 * mismatches and retention. The recorded status is checked for consistency (unknown usage <=> status
 * usage_unknown; cap_hit needs spent + pending reservation > allowance).
 *
 * No network, no provider SDK: only the scripted provider is constructed.
 */
import { z } from 'zod';
import { canonicalize } from '../core/canonical';
import {
  ProviderCompletionSchema,
  ProviderMessageSchema,
  RequirementSchema,
  RunStatusSchema,
  WriteRefusalReasonSchema,
  assertSingleEdition,
  sumUsage,
  usageTotalTokens,
} from '../core/contracts';
import type { EdgeEvidence, Exclusion, RunFlag, RunStatus, Usage } from '../core/contracts';
import { TraceMessageSchema } from '../core/handoff-schema';
import {
  ArmSchema,
  HandoffIdSchema,
  SyntheticProviderNameSchema,
  SyntheticTrancheSchema,
  TestGroupIdSchema,
  WorkerRoleSchema,
} from '../core/ids';
import type { RequirementId, WorkerRole } from '../core/ids';
import { ScriptedProvider } from '../providers/scripted';
import { isContractMismatch, responsibleWorker, scoreRequirement } from './classify';
import type { GroupPassMap } from './classify';
import { fixedBriefArtifact } from './evidence';
import type { CarrierArtifact } from './evidence';
import { retentionFromGroups } from './retention';
import { auditRequest, auditedAnchors, legitimateViewTexts } from './visibility';
import type { VisibilityFinding } from './visibility';

const NonNegInt = z.number().int().nonnegative();
const PosInt = z.number().int().positive();

const CarrierBase = {
  handoffId: HandoffIdSchema,
  from: WorkerRoleSchema,
  to: WorkerRoleSchema,
  deliveredAtSeq: NonNegInt,
};

export const FixtureCarrierSchema = z.discriminatedUnion('channel', [
  z.object({ ...CarrierBase, channel: z.literal('free_summary'), text: z.string() }),
  z.object({ ...CarrierBase, channel: z.literal('fixed_brief'), raw: z.string() }),
  z.object({ ...CarrierBase, channel: z.literal('full_trace'), messages: z.array(TraceMessageSchema) }),
]);
export type FixtureCarrier = z.infer<typeof FixtureCarrierSchema>;

export const ScriptedFixtureSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: z.string().regex(/^[a-z0-9][a-z0-9_-]*$/),
    edition: z.literal('SYNTHETIC'),
    tranche: SyntheticTrancheSchema,
    provider: SyntheticProviderNameSchema,
    /** The §12 M2 path this fixture exercises. */
    path: z.string().min(1),
    description: z.string().min(1),
    arm: ArmSchema,
    requirements: z.array(RequirementSchema).min(1),
    view: z.object({
      spec: z.string().nullable(),
      slices: z.object({ A: z.string(), B: z.string() }).nullable(),
    }),
    carriers: z.array(FixtureCarrierSchema),
    /** Event sequence number of each worker's last edit (null: the worker never edited). */
    lastEdits: z.array(z.object({ worker: WorkerRoleSchema, seq: NonNegInt.nullable() })),
    /** Hidden-group pass map (C0 + the requirements' groups); null when the run was not graded. */
    groups: z.record(TestGroupIdSchema, z.boolean()).nullable(),
    status: RunStatusSchema,
    budget: z.object({ allowanceTokens: PosInt, pendingReservationTokens: NonNegInt }).nullable(),
    scripted: z.array(z.object({ worker: WorkerRoleSchema, completions: z.array(ProviderCompletionSchema) })),
    writeRefusals: z.array(z.object({ worker: WorkerRoleSchema, requestedPath: z.string(), reason: WriteRefusalReasonSchema })),
    requests: z.array(z.object({ worker: WorkerRoleSchema, callIndex: NonNegInt, seq: NonNegInt, messages: z.array(ProviderMessageSchema) })),
  })
  .strict();
export type ScriptedFixture = z.infer<typeof ScriptedFixtureSchema>;

export interface RequirementOutcome {
  readonly requirement: RequirementId;
  readonly class: string;
  readonly flags: readonly string[];
  readonly state: EdgeEvidence['state'] | null;
  readonly unknownReason: EdgeEvidence['unknownReason'];
  readonly checks: EdgeEvidence['checks'] | null;
}

export interface FixtureOutcome {
  readonly id: string;
  readonly edition: 'SYNTHETIC';
  readonly status: RunStatus;
  readonly exclusion: Exclusion | null;
  readonly flags: readonly RunFlag[];
  readonly usageTotals: Usage;
  readonly spentTokens: number;
  readonly requirements: readonly RequirementOutcome[];
  readonly contractMismatches: readonly RequirementId[];
  readonly retention: number | null;
  readonly visibility: readonly VisibilityFinding[];
}

export class FixtureInconsistentError extends Error {
  constructor(id: string, message: string) {
    super(`fixture ${id}: ${message}`);
    this.name = 'FixtureInconsistentError';
  }
}

export function carrierArtifact(c: FixtureCarrier): CarrierArtifact {
  switch (c.channel) {
    case 'free_summary':
      return { channel: 'free_summary', text: c.text };
    case 'fixed_brief':
      return fixedBriefArtifact(c.raw);
    case 'full_trace':
      return { channel: 'full_trace', messages: c.messages };
  }
}

/** A fixed brief that stayed malformed (it is then matched as raw prose, §4.2). */
export function isMalformedBrief(c: FixtureCarrier): boolean {
  const a = carrierArtifact(c);
  return a.channel === 'fixed_brief' && a.parsed === null;
}

function carrierText(c: FixtureCarrier): string {
  switch (c.channel) {
    case 'free_summary':
      return c.text;
    case 'fixed_brief':
      return c.raw;
    case 'full_trace':
      return c.messages.map((m) => m.text).join('\n');
  }
}

/** Carriers the worker received before its last edit (all received ones if it never edited). */
export function receivedBeforeLastEdit(fx: ScriptedFixture, worker: WorkerRole): FixtureCarrier[] {
  const last = fx.lastEdits.find((e) => e.worker === worker)?.seq ?? null;
  return fx.carriers.filter((c) => c.to === worker && (last === null || c.deliveredAtSeq < last));
}

async function replayUsage(fx: ScriptedFixture): Promise<{ usages: Usage[]; retries: number }> {
  const usages: Usage[] = [];
  let retries = 0;
  for (const block of fx.scripted) {
    const provider = new ScriptedProvider(block.completions);
    const signal = new AbortController().signal;
    for (let i = 0; i < block.completions.length; i += 1) {
      const c = await provider.complete({ messages: [], tools: [], maxOutput: 2048, signal });
      usages.push(c.usage);
      retries += c.retries;
    }
    if (provider.remaining !== 0) throw new FixtureInconsistentError(fx.id, `script for ${block.worker} not fully replayed`);
  }
  return { usages, retries };
}

function exclusionOf(status: RunStatus, flags: readonly RunFlag[]): Exclusion | null {
  if (flags.includes('visibility_leak')) return 'visibility_leak';
  if (status === 'usage_unknown') return 'usage_unknown';
  if (status === 'reservation_overrun') return 'reservation_overrun';
  if (status === 'integrity_stop') return 'integrity_stop';
  if (flags.includes('model_mismatch')) return 'model_mismatch';
  return null;
}

export async function scoreFixture(input: unknown): Promise<FixtureOutcome> {
  const fx = ScriptedFixtureSchema.parse(input);
  assertSingleEdition([{ edition: fx.edition }]);
  const { usages, retries } = await replayUsage(fx);
  const usageTotals = sumUsage(usages);
  const spentTokens = usageTotalTokens(usageTotals);

  const anyUnknown = usages.some((u) => u.source === 'unknown');
  if (anyUnknown !== (fx.status === 'usage_unknown')) {
    throw new FixtureInconsistentError(fx.id, 'status usage_unknown must be recorded exactly when a completion has unknown usage');
  }
  if (fx.status === 'cap_hit') {
    if (fx.budget === null || spentTokens + fx.budget.pendingReservationTokens <= fx.budget.allowanceTokens) {
      throw new FixtureInconsistentError(fx.id, 'cap_hit needs spent + pending reservation > allowance');
    }
  }

  const flags = new Set<RunFlag>();
  if (retries > 0) flags.add('ledger_retry_used');
  if (fx.carriers.some(isMalformedBrief)) flags.add('malformed_handoff');
  if (fx.writeRefusals.some((w) => w.reason === 'out_of_module')) flags.add('out_of_module_write_refused');

  const anchors = auditedAnchors(fx.requirements);
  const visibility: VisibilityFinding[] = [];
  for (const req of fx.requests) {
    const received = fx.carriers.filter((c) => c.to === req.worker && c.deliveredAtSeq <= req.seq);
    visibility.push(
      ...auditRequest(
        {
          worker: req.worker,
          anchors,
          permittedTexts: [...legitimateViewTexts(req.worker, fx.view), ...received.map(carrierText)],
          receivedHandoffIds: new Set(received.map((c) => c.handoffId)),
        },
        req.callIndex,
        req.messages,
      ),
    );
  }
  for (const v of visibility) flags.add(v.finding);

  const sortedFlags = [...flags].sort();
  const exclusion = exclusionOf(fx.status, sortedFlags);

  const groups: GroupPassMap | null = fx.groups;
  const requirements: RequirementOutcome[] = [];
  const contractMismatches: RequirementId[] = [];
  if (groups !== null) {
    for (const r of fx.requirements) {
      const worker = responsibleWorker(fx.arm, r);
      const artifacts = worker === null ? [] : receivedBeforeLastEdit(fx, worker).map(carrierArtifact);
      const s = scoreRequirement({ arm: fx.arm, requirement: r, groups, artifacts });
      requirements.push({
        requirement: s.requirement,
        class: s.class,
        flags: s.flags,
        state: s.evidence?.state ?? null,
        unknownReason: s.evidence?.unknownReason ?? null,
        checks: s.evidence?.checks ?? null,
      });
      if (isContractMismatch(r, groups)) contractMismatches.push(r.id);
    }
  }
  return {
    id: fx.id,
    edition: 'SYNTHETIC',
    status: fx.status,
    exclusion,
    flags: sortedFlags,
    usageTotals,
    spentTokens,
    requirements,
    contractMismatches,
    retention: groups === null ? null : retentionFromGroups(groups),
    visibility,
  };
}

// ---------------------------------------------------------------------------------------------
// fixtures/expected.json
// ---------------------------------------------------------------------------------------------

const ExpectedRequirementSchema = z
  .object({
    class: z.string(),
    flags: z.array(z.string()),
    state: z.enum(['evidence', 'no_evidence', 'unknown']).nullable(),
    unknownReason: z.enum(['missing_artifact', 'prerequisite_failed', 'check_unknown', 'decoy_conflict']).nullable(),
  })
  .strict();

export const ExpectedFixtureSchema = z
  .object({
    path: z.string(),
    status: RunStatusSchema,
    exclusion: z.string().nullable(),
    flags: z.array(z.string()),
    spentTokens: NonNegInt,
    requirements: z.record(z.string(), ExpectedRequirementSchema),
    contractMismatches: z.array(z.string()),
    retention: z.number().nullable(),
    visibility: z.array(z.object({ finding: z.string(), requirement: z.string(), anchor: z.string() }).strict()),
    trace: z.string().min(1),
  })
  .strict();
export type ExpectedFixture = z.infer<typeof ExpectedFixtureSchema>;

export const ExpectedFileSchema = z
  .object({
    schemaVersion: z.literal(1),
    edition: z.literal('SYNTHETIC'),
    lineage: z.literal('builder'),
    note: z.string(),
    fixtures: z.record(z.string(), ExpectedFixtureSchema),
    carrySelftest: z.record(z.string(), z.object({ state: z.enum(['evidence', 'no_evidence', 'unknown']), trace: z.string().min(1) }).strict()),
    controlTask: z.object({ dir: z.string(), taskId: z.string(), expectedFailures: z.array(z.string()), schemaIssues: z.boolean(), trace: z.string() }).strict(),
    badTasks: z.record(
      z.string(),
      z
        .object({
          taskId: z.string(),
          plantedCondition: z.string(),
          expectedPureFailures: z.array(z.string()),
          expectedExecutionFailures: z.array(z.string()),
          schemaIssues: z.boolean(),
          executionNote: z.string(),
          trace: z.string().min(1),
        })
        .strict(),
    ),
  })
  .strict();
export type ExpectedFile = z.infer<typeof ExpectedFileSchema>;

/** Differences between an outcome and its expected record (empty = match). */
export function compareFixture(outcome: FixtureOutcome, expected: ExpectedFixture): string[] {
  const diffs: string[] = [];
  const eq = (what: string, got: unknown, want: unknown): void => {
    const g = canonicalize(got);
    const w = canonicalize(want);
    if (g !== w) diffs.push(`${what}: got ${g}, expected ${w}`);
  };
  eq('status', outcome.status, expected.status);
  eq('exclusion', outcome.exclusion, expected.exclusion);
  eq('flags', outcome.flags, [...expected.flags].sort());
  eq('spentTokens', outcome.spentTokens, expected.spentTokens);
  eq('contractMismatches', outcome.contractMismatches, expected.contractMismatches);
  eq('retention', outcome.retention, expected.retention);
  eq(
    'visibility',
    outcome.visibility.map((v) => ({ finding: v.finding, requirement: v.requirement, anchor: v.anchor })),
    expected.visibility,
  );
  const got = Object.fromEntries(outcome.requirements.map((r) => [r.requirement, { class: r.class, flags: r.flags, state: r.state, unknownReason: r.unknownReason }]));
  eq('requirements', got, expected.requirements);
  return diffs;
}
