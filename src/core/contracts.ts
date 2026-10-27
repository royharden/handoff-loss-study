/**
 * Core data contracts (PLAN.md §1 D-decisions, §3 task format, §4 carry states/classes, §5 ports and
 * records, D23 approvals, D24 prereg manifest, D25 held-out manifest).
 *
 * Every persisted shape is a zod schema; TypeScript types are inferred with z.infer. Ports are plain
 * TypeScript interfaces (no runtime). This module performs no I/O and imports no network or provider
 * SDK (enforced by eslint `no-restricted-imports` for src/core).
 *
 * What is deliberately NOT here (later milestones own it): the carry matcher's cue/marker lists and
 * clause rules (src/score/evidence.ts, M2 — frozen there by hash, D19b); the gate conditions 1-9
 * (src/tasks/validate.ts, M2); the budget meter (src/runner/budget.ts, M4). The schemas below check
 * structure and the counting rules that are pure data (8 requirements, each trap kind once, 2/2/2/2
 * slots); they do not replace `hls validate`.
 */
import { z } from 'zod';
import {
  ArmSchema,
  CellChannelSchema,
  EditionSchema,
  HandoffIdSchema,
  IsoTimestampSchema,
  LiveTrancheSchema,
  ModuleIdSchema,
  ProviderNameSchema,
  RepeatSchema,
  RepoPathSchema,
  RequirementIdSchema,
  RunIdSchema,
  Sha256HexSchema,
  StudyCellSchema,
  SyntheticProviderNameSchema,
  SyntheticTrancheSchema,
  TaskIdSchema,
  TaskShapeSchema,
  TaskSplitSchema,
  TestGroupIdSchema,
  ToolCallIdSchema,
  ToolNameSchema,
  WorkerRoleSchema,
} from './ids';
import type { Arm, Edition, ModuleId, ProviderName, RepoPath, RequirementId, TestGroupId } from './ids';
import { CarrierChannelSchema, HandoffSchema } from './handoff-schema';
import type { Sha256Hex } from './hash';

// ---------------------------------------------------------------------------------------------
// Generic JSON value (tool inputs are arbitrary JSON; canonicalisation rejects -0/NaN/undefined).
// ---------------------------------------------------------------------------------------------

export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export const JsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.null(),
    z.boolean(),
    z.number().finite(),
    z.string(),
    z.array(JsonValueSchema),
    z.record(z.string(), JsonValueSchema),
  ]),
);

const NonNegInt = z.number().int().nonnegative();
const PosInt = z.number().int().positive();
const NonEmptyText = z.string().min(1);

function unique<T>(values: readonly T[]): boolean {
  return new Set(values).size === values.length;
}

// ---------------------------------------------------------------------------------------------
// §3 Task format
// ---------------------------------------------------------------------------------------------

/** The eight trap kinds; every task has each exactly once (§3). */
export const RequirementKindSchema = z.enum([
  'negative_constraint',
  'literal_constant',
  'naming_convention',
  'override_default',
  'late_clarification',
  'cross_module_contract',
  'do_not_touch',
  'edge_case',
]);
export type RequirementKind = z.infer<typeof RequirementKindSchema>;
export const REQUIREMENT_KINDS: readonly RequirementKind[] = RequirementKindSchema.options;

/** Slots: 2 of each local and 2 transfers each way, assigned by precommitted hash (§3). */
export const SlotSchema = z.enum(['local_A', 'local_B', 'transfer_A_to_B', 'transfer_B_to_A']);
export type Slot = z.infer<typeof SlotSchema>;

/** Source slice and responsible writer implied by each slot. */
export const SLOT_ROUTING: Readonly<Record<Slot, { readonly source: ModuleId; readonly writer: ModuleId }>> = {
  local_A: { source: 'A', writer: 'A' },
  local_B: { source: 'B', writer: 'B' },
  transfer_A_to_B: { source: 'A', writer: 'B' },
  transfer_B_to_A: { source: 'B', writer: 'A' },
};

export function isTransferSlot(slot: Slot): boolean {
  return slot === 'transfer_A_to_B' || slot === 'transfer_B_to_A';
}

/**
 * Anchors (D12). `secret` anchors are absent from every repo file/name/path and must be carried;
 * `entity` anchors (protected paths, interface names) are present in the repo and are checked with
 * `entity_cue` for do_not_touch. `alternates` are equivalent spellings (any one counts, §4.6).
 * `cue` is the cue phrase the spec uses with this entity (informational for authors and reviewers;
 * the matcher accepts any cue in its closed list, which lives in src/score/evidence.ts).
 */
export const SecretAnchorSchema = z.object({
  type: z.literal('secret'),
  alternates: z.array(NonEmptyText).min(1),
});
export const EntityAnchorSchema = z.object({
  type: z.literal('entity'),
  alternates: z.array(NonEmptyText).min(1),
  cue: NonEmptyText.optional(),
});
export const AnchorSchema = z.discriminatedUnion('type', [SecretAnchorSchema, EntityAnchorSchema]);
export type Anchor = z.infer<typeof AnchorSchema>;

/**
 * Declared couplings (D11): mutant R<n> may also fail these groups. A `prerequisite` coupling means a
 * failure of that group makes this requirement's attribution `unknown` (§4.7).
 */
export const CouplingSchema = z.object({
  group: RequirementIdSchema,
  kind: z.enum(['declared', 'prerequisite']),
});
export type Coupling = z.infer<typeof CouplingSchema>;

export const RequirementSchema = z
  .object({
    id: RequirementIdSchema,
    kind: RequirementKindSchema,
    slot: SlotSchema,
    sourceSlice: ModuleIdSchema,
    responsibleWriter: ModuleIdSchema,
    /** Hidden test group asserting this requirement and C0. */
    testGroup: RequirementIdSchema,
    anchors: z.array(AnchorSchema).min(1),
    /** Wrong values a receiver may use instead (e.g. the starter default); each must be distinctive (cond. 6f). */
    decoys: z.array(NonEmptyText),
    couplings: z.array(CouplingSchema),
    /** One-line reviewer summary; never shown to any worker. */
    summary: z.string().max(500).optional(),
  })
  .superRefine((r, ctx) => {
    const routing = SLOT_ROUTING[r.slot];
    if (r.sourceSlice !== routing.source || r.responsibleWriter !== routing.writer) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${r.id}: slot ${r.slot} requires sourceSlice=${routing.source}, responsibleWriter=${routing.writer}`,
      });
    }
    if (r.kind === 'cross_module_contract' && !isTransferSlot(r.slot)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${r.id}: cross_module_contract must use a transfer slot` });
    }
    if (r.kind === 'do_not_touch') {
      if (!r.anchors.some((a) => a.type === 'entity')) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${r.id}: do_not_touch needs an entity anchor (D12)` });
      }
    } else if (!r.anchors.some((a) => a.type === 'secret')) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${r.id}: ${r.kind} needs at least one secret anchor` });
    }
    if (r.couplings.some((c) => c.group === r.testGroup)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${r.id}: a requirement cannot couple to its own group` });
    }
    if (!unique(r.couplings.map((c) => c.group))) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${r.id}: duplicate coupling group` });
    }
  });
export type Requirement = z.infer<typeof RequirementSchema>;

/** Expected per-task slot counts (§3). */
export const SLOT_COUNTS: Readonly<Record<Slot, number>> = {
  local_A: 2,
  local_B: 2,
  transfer_A_to_B: 2,
  transfer_B_to_A: 2,
};

/**
 * task.json (§3). Slices are sets of whole top-level sections of spec.md, named by their exact
 * heading line text (e.g. "# Retry policy"); every slice section starts with its own heading (6b).
 */
export const TaskSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: TaskIdSchema,
    split: TaskSplitSchema,
    shape: TaskShapeSchema,
    title: NonEmptyText,
    author: z.object({
      /** Builder lineage may only author dev tasks; held-out tasks are custodian-only (D25, §6). */
      lineage: z.enum(['builder', 'custodian']),
      name: NonEmptyText,
    }),
    modules: z.object({
      A: z.object({ path: RepoPathSchema }),
      B: z.object({ path: RepoPathSchema }),
    }),
    protectedInterface: RepoPathSchema,
    publicTests: z.array(RepoPathSchema).min(1),
    slices: z.object({
      A: z.object({ headings: z.array(NonEmptyText).min(1) }),
      B: z.object({ headings: z.array(NonEmptyText).min(1) }),
    }),
    slotAssignment: z.object({
      /** Hash input `<taskId>:<seed>`, precommitted before authoring. */
      input: NonEmptyText,
      sha256: Sha256HexSchema,
      /** Rule identifier, e.g. "docs/TASK-RECIPE.md#slot-assignment v1". */
      rule: NonEmptyText,
    }),
    requirements: z.array(RequirementSchema).length(8),
  })
  .superRefine((t, ctx) => {
    const fail = (message: string): void => {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${t.id}: ${message}` });
    };
    if (t.split === 'dev' && (!t.id.startsWith('T') || t.author.lineage !== 'builder')) {
      fail('dev tasks are T<nn> and builder-authored');
    }
    if (t.split === 'heldout' && (!t.id.startsWith('H') || t.author.lineage !== 'custodian')) {
      fail('held-out tasks are H<nn> and custodian-authored only (builder lineage never authors held-out data)');
    }
    if (!t.slotAssignment.input.startsWith(`${t.id}:`) || t.slotAssignment.input.length <= t.id.length + 1) {
      fail('slotAssignment.input must be `<taskId>:<seed>`');
    }
    const ids = t.requirements.map((r) => r.id);
    if (!unique(ids)) fail('requirement ids must be unique R1..R8');
    if (!unique(t.requirements.map((r) => r.testGroup))) fail('test groups must be unique');
    for (const kind of REQUIREMENT_KINDS) {
      const n = t.requirements.filter((r) => r.kind === kind).length;
      if (n !== 1) fail(`trap kind ${kind} must occur exactly once (found ${n})`);
    }
    for (const slot of SlotSchema.options) {
      const n = t.requirements.filter((r) => r.slot === slot).length;
      if (n !== SLOT_COUNTS[slot]) fail(`slot ${slot} must occur ${SLOT_COUNTS[slot]} times (found ${n})`);
    }
    const headingsA = new Set(t.slices.A.headings);
    if (t.slices.B.headings.some((h) => headingsA.has(h))) fail('slices A and B overlap (cond. 8)');
    if (!unique(t.slices.A.headings) || !unique(t.slices.B.headings)) fail('duplicate heading within a slice');
    if (t.modules.A.path === t.modules.B.path) fail('modules A and B must be different files');
    if (t.protectedInterface === t.modules.A.path || t.protectedInterface === t.modules.B.path) {
      fail('protected interface must not be a writable module');
    }
  });
export type Task = z.infer<typeof TaskSchema>;

/** static.json (§3, D17): checked by the trusted CLI outside any container. */
export const StaticConfigSchema = z.object({
  schemaVersion: z.literal(1),
  protectedFiles: z.array(z.object({ path: RepoPathSchema, sha256: Sha256HexSchema })).min(1),
  /** Identifiers that must not appear in candidate source (checked via the TS compiler API). */
  forbiddenIdentifiers: z.array(z.object({ identifier: NonEmptyText, reason: NonEmptyText })),
});
export type StaticConfig = z.infer<typeof StaticConfigSchema>;

// ---------------------------------------------------------------------------------------------
// §5 Usage, budget (D5-D8)
// ---------------------------------------------------------------------------------------------

/**
 * Token usage of one completion (§5). `input` excludes cached tokens; `cacheRead`/`cacheWrite` count
 * at full weight in the pooled allowance (D5). `reasoning` is a diagnostic subset of `output` and is
 * never added twice. `source`: provider_reported, reserved (booked from the reservation), unknown.
 */
export const UsageSourceSchema = z.enum(['provider_reported', 'reserved', 'unknown']);
export type UsageSource = z.infer<typeof UsageSourceSchema>;

export const UsageSchema = z
  .object({
    input: NonNegInt,
    output: NonNegInt,
    cacheRead: NonNegInt,
    cacheWrite: NonNegInt,
    reasoning: NonNegInt,
    source: UsageSourceSchema,
  })
  .refine((u) => u.reasoning <= u.output, 'reasoning tokens are a subset of output tokens');
export type Usage = z.infer<typeof UsageSchema>;

/** Tokens charged against the pooled allowance (D5). */
export function usageTotalTokens(u: Usage): number {
  return u.input + u.cacheRead + u.cacheWrite + u.output;
}

/** Sum usages; the source is the weakest one present (unknown < reserved < provider_reported). */
export function sumUsage(usages: readonly Usage[]): Usage {
  let source: UsageSource = 'provider_reported';
  const total = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, reasoning: 0 };
  for (const u of usages) {
    total.input += u.input;
    total.output += u.output;
    total.cacheRead += u.cacheRead;
    total.cacheWrite += u.cacheWrite;
    total.reasoning += u.reasoning;
    if (u.source === 'unknown') source = 'unknown';
    else if (u.source === 'reserved' && source !== 'unknown') source = 'reserved';
  }
  return { ...total, source };
}

/** Per-run limits (D8) and reservation constants (D7). */
export const RunLimitsSchema = z.object({
  maxCompletions: PosInt,
  maxOutput: PosInt,
  wallMs: PosInt,
  /** No single request may exceed this many tokens by reservation. */
  requestCeilingTokens: PosInt,
  /** At most this many ledger retries per call (429/5xx/timeout), each fully reserved. */
  ledgerRetriesPerCall: NonNegInt,
  /** Per-message overhead term of the D7 reservation formula. */
  perMessageOverheadTokens: NonNegInt,
});
export type RunLimits = z.infer<typeof RunLimitsSchema>;

export const DEFAULT_RUN_LIMITS: RunLimits = {
  maxCompletions: 40,
  maxOutput: 2048,
  wallMs: 15 * 60 * 1000,
  requestCeilingTokens: 90_000,
  ledgerRetriesPerCall: 1,
  perMessageOverheadTokens: 64,
};

/** Provisional dev allowance C_dev (D6) and the held-out ceiling. */
export const C_DEV_TOKENS = 150_000;
export const C_CEILING_TOKENS = 150_000;
/** T0 reservation ratio r (D7); frozen later at 1.25 x max observed tokens/bytes. */
export const R_T0 = 1.0;
export const R_CALIBRATION_FACTOR = 1.25;

/** D7: ceil(r x bytes(serialized request)) + overhead x messages + max_output. */
export function reservationTokens(args: {
  readonly requestBytes: number;
  readonly messageCount: number;
  readonly maxOutput: number;
  readonly r: number;
  readonly perMessageOverheadTokens: number;
}): number {
  const { requestBytes, messageCount, maxOutput, r, perMessageOverheadTokens } = args;
  if (![requestBytes, messageCount, maxOutput, perMessageOverheadTokens].every((n) => Number.isInteger(n) && n >= 0)) {
    throw new RangeError('reservationTokens: byte, message, output and overhead counts must be non-negative integers');
  }
  if (!Number.isFinite(r) || r <= 0) throw new RangeError('reservationTokens: r must be a positive finite number');
  return Math.ceil(r * requestBytes) + perMessageOverheadTokens * messageCount + maxOutput;
}

/** D6: held-out C = min(150,000, ceil_10k(2 x P75 dev single totals)), nearest-rank P75. */
export function nearestRankP75(values: readonly number[]): number {
  if (values.length === 0) throw new RangeError('nearestRankP75: empty input');
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil(0.75 * sorted.length) - 1;
  const v = sorted[index];
  if (v === undefined) throw new RangeError('nearestRankP75: index out of range');
  return v;
}

export function heldoutAllowance(devSingleTotals: readonly number[]): { readonly tokens: number; readonly ceilingBinds: boolean } {
  const raw = Math.ceil((2 * nearestRankP75(devSingleTotals)) / 10_000) * 10_000;
  return raw > C_CEILING_TOKENS ? { tokens: C_CEILING_TOKENS, ceilingBinds: true } : { tokens: raw, ceilingBinds: false };
}

export const ReservationSchema = z
  .object({
    requestBytes: NonNegInt,
    messageCount: NonNegInt,
    maxOutput: PosInt,
    r: z.number().positive().finite(),
    perMessageOverheadTokens: NonNegInt,
    reservedTokens: NonNegInt,
  })
  .refine((x) => {
    // zod still runs refinements on "dirty" input (e.g. a negative count), where the formula throws.
    try {
      return x.reservedTokens === reservationTokens(x);
    } catch {
      return false;
    }
  }, 'reservedTokens must equal the D7 formula');
export type Reservation = z.infer<typeof ReservationSchema>;

/** Data the runner needs to meter a run (D5-D8). */
export const RunBudgetSchema = z.object({
  allowanceTokens: PosInt,
  r: z.number().positive().finite(),
  limits: RunLimitsSchema,
});
export type RunBudget = z.infer<typeof RunBudgetSchema>;

/** Prices in USD per million tokens, re-checked on approval day (Q1). */
export const PriceTableSchema = z.object({
  model: NonEmptyText,
  currency: z.literal('USD'),
  inputPerMTok: z.number().nonnegative().finite(),
  outputPerMTok: z.number().nonnegative().finite(),
  cacheReadPerMTok: z.number().nonnegative().finite(),
  cacheWritePerMTok: z.number().nonnegative().finite(),
  checkedAt: IsoTimestampSchema,
  source: NonEmptyText,
});
export type PriceTable = z.infer<typeof PriceTableSchema>;

// ---------------------------------------------------------------------------------------------
// §5 Grading (D17)
// ---------------------------------------------------------------------------------------------

/** Why a hidden group invocation failed; protocol noise, oversize output, exit and timeout fail it (D17). */
export const GroupFailureSchema = z.enum([
  'assertion',
  'timeout',
  'protocol_noise',
  'oversize_output',
  'candidate_exit',
  'static_check',
  'grader_error',
]);
export type GroupFailure = z.infer<typeof GroupFailureSchema>;

export const GroupResultSchema = z
  .object({
    passed: z.boolean(),
    failure: GroupFailureSchema.nullable(),
    durationMs: NonNegInt.nullable(),
  })
  .refine((g) => g.passed === (g.failure === null), 'failure must be null exactly when the group passed');
export type GroupResult = z.infer<typeof GroupResultSchema>;

export const GroupResultsSchema = z.object({
  /** Digest of the graded source snapshot, of the hidden test bundle, and of the grader image. */
  snapshotDigest: Sha256HexSchema,
  hiddenBundleDigest: Sha256HexSchema,
  graderImageDigest: z.string().regex(/^sha256:[0-9a-f]{64}$/).nullable(),
  /** `local_unsafe` only for authored code (oracle/fixtures); never for model output (§5). */
  sandbox: z.enum(['docker_pair', 'local_unsafe']),
  groups: z
    .object({
      C0: GroupResultSchema,
      R1: GroupResultSchema,
      R2: GroupResultSchema,
      R3: GroupResultSchema,
      R4: GroupResultSchema,
      R5: GroupResultSchema,
      R6: GroupResultSchema,
      R7: GroupResultSchema,
      R8: GroupResultSchema,
    })
    .strict(),
});
export type GroupResults = z.infer<typeof GroupResultsSchema>;

/** Primary metric (§7): passed R groups / 8 (each R group also asserts C0, D11). */
export function retentionOf(results: GroupResults): number {
  const passed = RequirementIdSchema.options.filter((id) => results.groups[id].passed).length;
  return passed / 8;
}

// ---------------------------------------------------------------------------------------------
// D16 Segment provenance (visibility audit input)
// ---------------------------------------------------------------------------------------------

export const InitialViewItemSchema = z.enum(['spec', 'slice', 'brief', 'starter_listing', 'task_title', 'interfaces']);
export type InitialViewItem = z.infer<typeof InitialViewItemSchema>;

export const SegmentProvenanceSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('system') }),
  z.object({ kind: z.literal('initial_view'), item: InitialViewItemSchema, module: ModuleIdSchema.nullable() }),
  z.object({ kind: z.literal('handoff'), handoffId: HandoffIdSchema }),
  z.object({ kind: z.literal('tool_result'), callId: ToolCallIdSchema, path: z.string().nullable() }),
  z.object({
    kind: z.literal('self'),
    /** Own replayed assistant turn, or tool output whose bytes derive from this worker's own writes. */
    origin: z.enum(['assistant_turn', 'own_file_read', 'edit_echo', 'own_listing', 'own_test_output']),
    callId: ToolCallIdSchema.nullable(),
  }),
]);
export type SegmentProvenance = z.infer<typeof SegmentProvenanceSchema>;

export const RequestSegmentSchema = z.object({
  provenance: SegmentProvenanceSchema,
  text: z.string(),
});
export type RequestSegment = z.infer<typeof RequestSegmentSchema>;

// ---------------------------------------------------------------------------------------------
// §5 Provider port data (model-neutral, D9)
// ---------------------------------------------------------------------------------------------

export const ToolCallSchema = z.object({
  id: ToolCallIdSchema,
  name: ToolNameSchema,
  input: JsonValueSchema,
});
export type ToolCall = z.infer<typeof ToolCallSchema>;

export const ToolSpecSchema = z.object({
  name: ToolNameSchema,
  description: NonEmptyText,
  /** JSON Schema of the tool input. */
  inputSchema: z.record(z.string(), JsonValueSchema),
});
export type ToolSpec = z.infer<typeof ToolSpecSchema>;

/** A message as the runner builds it; every piece of text carries its provenance (D16). */
export const ProviderMessageSchema = z.discriminatedUnion('role', [
  z.object({ role: z.literal('system'), segments: z.array(RequestSegmentSchema) }),
  z.object({ role: z.literal('user'), segments: z.array(RequestSegmentSchema) }),
  /** Assistant turns are always `self` provenance when replayed. */
  z.object({ role: z.literal('assistant'), text: z.string(), toolCalls: z.array(ToolCallSchema) }),
  z.object({
    role: z.literal('tool'),
    toolCallId: ToolCallIdSchema,
    isError: z.boolean(),
    segments: z.array(RequestSegmentSchema),
  }),
]);
export type ProviderMessage = z.infer<typeof ProviderMessageSchema>;

export const StopReasonSchema = z.enum(['end_turn', 'tool_use', 'max_tokens', 'refusal', 'other']);

export const ProviderCompletionSchema = z.object({
  message: z.object({ text: z.string(), toolCalls: z.array(ToolCallSchema) }),
  usage: UsageSchema,
  requestedModel: z.string().nullable(),
  observedModel: z.string().nullable(),
  latencyMs: NonNegInt,
  /** Ledger retries used for this call (D7: at most one, fully reserved). SDK auto-retry is off. */
  retries: NonNegInt,
  stopReason: StopReasonSchema,
});
export type ProviderCompletion = z.infer<typeof ProviderCompletionSchema>;

export interface ProviderCompleteArgs {
  readonly messages: readonly ProviderMessage[];
  readonly tools: readonly ToolSpec[];
  readonly maxOutput: number;
  readonly signal: AbortSignal;
}

/** ProviderPort (§5). Implementations: null, scripted, mock (keyless) and anthropic (live, disabled). */
export interface ProviderPort {
  readonly name: ProviderName;
  complete(args: ProviderCompleteArgs): Promise<ProviderCompletion>;
}

/** A frozen candidate source tree handed to the grader. */
export interface SourceSnapshot {
  readonly digest: Sha256Hex;
  readonly files: ReadonlyMap<RepoPath, Uint8Array>;
}

/** SandboxPort (§5, D17): `docker_pair` for model output; `LocalUnsafeSandbox` for authored code only. */
export interface SandboxPort {
  readonly kind: GroupResults['sandbox'];
  grade(snapshot: SourceSnapshot, hiddenBundleDigest: Sha256Hex): Promise<GroupResults>;
}

/** RunnerPort (§5). Yields every event of one run in sequence order. */
export interface RunnerPort {
  runCell(task: Task, cell: Arm, repeat: number, budget: RunBudget, sandbox: SandboxPort): AsyncIterable<RunEvent>;
}

// ---------------------------------------------------------------------------------------------
// §4 Carry evidence, classes (D13, D14)
// ---------------------------------------------------------------------------------------------

/** Result of one check (§4.6). */
export const CheckResultSchema = z.enum(['positive', 'negative', 'unknown']);
export type CheckResult = z.infer<typeof CheckResultSchema>;

/** Evidence state per eligible edge (§4.7). */
export const EvidenceStateSchema = z.enum(['evidence', 'no_evidence', 'unknown']);
export type EvidenceState = z.infer<typeof EvidenceStateSchema>;

export const UnknownReasonSchema = z.enum(['missing_artifact', 'prerequisite_failed', 'check_unknown', 'decoy_conflict']);
export type UnknownReason = z.infer<typeof UnknownReasonSchema>;

/** Requirement classes (§4.9). */
export const RequirementClassSchema = z.enum([
  'kept',
  'single_not_done',
  'failed_with_evidence',
  'failed_without_lexical_evidence',
  'attribution_unknown',
  'local_not_done',
]);
export type RequirementClass = z.infer<typeof RequirementClassSchema>;

/** Diagnostic flags on `kept` (§4.9). */
export const ClassFlagSchema = z.enum(['kept_without_lexical_evidence', 'kept_attribution_unknown']);
export type ClassFlag = z.infer<typeof ClassFlagSchema>;

export const EdgeEvidenceSchema = z
  .object({
    state: EvidenceStateSchema,
    unknownReason: UnknownReasonSchema.nullable(),
    /** Channel of the artifact the responsible writer received (null when missing). */
    channel: CarrierChannelSchema.nullable(),
    checks: z.object({
      secretAnchor: CheckResultSchema.nullable(),
      entityCue: CheckResultSchema.nullable(),
      decoyConflict: z.boolean().nullable(),
    }),
  })
  .refine((e) => (e.state === 'unknown') === (e.unknownReason !== null), 'unknownReason is set exactly when state is unknown');
export type EdgeEvidence = z.infer<typeof EdgeEvidenceSchema>;

export const RequirementScoreSchema = z
  .object({
    requirement: RequirementIdSchema,
    kind: RequirementKindSchema,
    slot: SlotSchema,
    passed: z.boolean(),
    /** True when the requirement had to cross a handoff edge to reach its responsible writer. */
    eligibleEdge: z.boolean(),
    evidence: EdgeEvidenceSchema.nullable(),
    class: RequirementClassSchema,
    flags: z.array(ClassFlagSchema),
  })
  .superRefine((s, ctx) => {
    const fail = (message: string): void => {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${s.requirement}: ${message}` });
    };
    if (s.eligibleEdge !== (s.evidence !== null)) fail('evidence is present exactly on eligible edges');
    if (s.passed !== (s.class === 'kept')) fail('class is kept exactly when the group passed');
    if (s.flags.length > 0 && s.class !== 'kept') fail('diagnostic flags apply to kept only');
    if (s.evidence !== null && s.class === 'kept') {
      const want: ClassFlag | null =
        s.evidence.state === 'no_evidence' ? 'kept_without_lexical_evidence' : s.evidence.state === 'unknown' ? 'kept_attribution_unknown' : null;
      if ((want === null && s.flags.length !== 0) || (want !== null && (s.flags.length !== 1 || s.flags[0] !== want))) {
        fail('kept flag must follow the edge state (§4.9)');
      }
    }
  });
export type RequirementScore = z.infer<typeof RequirementScoreSchema>;

// ---------------------------------------------------------------------------------------------
// Carry-conformance pairs (D19). Builder self-test pairs carry no semantic label.
// ---------------------------------------------------------------------------------------------

export const CarryPairSchema = z
  .object({
    id: NonEmptyText,
    /** builder_selftest = matcher mechanics only (D19a); custodian sets validate meaning (D19b). */
    set: z.enum(['builder_selftest', 'custodian_public', 'custodian_sealed']),
    channel: CarrierChannelSchema,
    /** Carrier text (prose / raw brief) or a parsed fixed brief encoded as JSON text. */
    carrier: z.string(),
    requirementKind: RequirementKindSchema,
    anchors: z.array(AnchorSchema).min(1),
    decoys: z.array(NonEmptyText),
    expectedLexicalState: EvidenceStateSchema,
    /** Independent semantic label: custodian sets only. */
    semanticLabel: z.enum(['carried', 'not_carried']).optional(),
    note: z.string().optional(),
  })
  .superRefine((p, ctx) => {
    if (p.set === 'builder_selftest' && p.semanticLabel !== undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${p.id}: builder self-test pairs must not carry a semantic label (D19a)` });
    }
    if (p.set !== 'builder_selftest' && p.semanticLabel === undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${p.id}: custodian pairs need a semantic label (D19b)` });
    }
  });
export type CarryPair = z.infer<typeof CarryPairSchema>;

// ---------------------------------------------------------------------------------------------
// §5 Run events and run records
// ---------------------------------------------------------------------------------------------

/** Terminal status of a run (D7, D8, §7 stop conditions). */
export const RunStatusSchema = z.enum([
  'completed',
  'cap_hit',
  'usage_unknown',
  'reservation_overrun',
  'completion_limit',
  'wall_limit',
  'worker_crash',
  'integrity_stop',
]);
export type RunStatus = z.infer<typeof RunStatusSchema>;

export const RunFlagSchema = z.enum([
  'malformed_handoff',
  'visibility_leak',
  'self_originated_anchor',
  'out_of_module_write_refused',
  'ledger_retry_used',
  'model_mismatch',
  'heldout_burned',
]);
export type RunFlag = z.infer<typeof RunFlagSchema>;

/** Prereg exclusion reasons; excluded runs are listed, never silently dropped (D16, §7). */
export const ExclusionSchema = z.enum(['visibility_leak', 'usage_unknown', 'reservation_overrun', 'model_mismatch', 'integrity_stop']);
export type Exclusion = z.infer<typeof ExclusionSchema>;

export const WriteRefusalReasonSchema = z.enum([
  'out_of_module',
  'outside_view',
  'path_traversal',
  'absolute_path',
  'symlink',
  'protected_file',
]);

export const ProviderErrorKindSchema = z.enum(['rate_limit', 'server_error', 'timeout', 'malformed_response', 'refused_live_disabled', 'other']);

const EventBase = {
  seq: NonNegInt,
  at: IsoTimestampSchema,
  runId: RunIdSchema,
};

export const RunEventSchema = z.discriminatedUnion('type', [
  z.object({
    ...EventBase,
    type: z.literal('run_started'),
    edition: EditionSchema,
    taskId: TaskIdSchema,
    arm: ArmSchema,
    repeat: RepeatSchema,
    provider: ProviderNameSchema,
    requestedModel: z.string().nullable(),
    budget: RunBudgetSchema,
    taskDigest: Sha256HexSchema,
    promptsDigest: Sha256HexSchema,
  }),
  z.object({
    ...EventBase,
    type: z.literal('view_delivered'),
    worker: WorkerRoleSchema,
    items: z.array(
      z.object({ item: InitialViewItemSchema, module: ModuleIdSchema.nullable(), bytes: NonNegInt, sha256: Sha256HexSchema }),
    ),
  }),
  z.object({
    ...EventBase,
    type: z.literal('reservation'),
    worker: WorkerRoleSchema,
    callIndex: NonNegInt,
    attempt: NonNegInt,
    reservation: ReservationSchema,
    spentBefore: NonNegInt,
    allowanceTokens: PosInt,
    granted: z.boolean(),
  }),
  z.object({
    ...EventBase,
    type: z.literal('request'),
    worker: WorkerRoleSchema,
    callIndex: NonNegInt,
    attempt: NonNegInt,
    messages: z.array(ProviderMessageSchema),
    requestBytes: NonNegInt,
    requestSha256: Sha256HexSchema,
  }),
  z.object({
    ...EventBase,
    type: z.literal('response'),
    worker: WorkerRoleSchema,
    callIndex: NonNegInt,
    attempt: NonNegInt,
    completion: ProviderCompletionSchema,
    /** Tokens booked to the ledger for this attempt (provider usage, or the reservation if unknown). */
    bookedTokens: NonNegInt,
  }),
  z.object({
    ...EventBase,
    type: z.literal('provider_error'),
    worker: WorkerRoleSchema,
    callIndex: NonNegInt,
    attempt: NonNegInt,
    kind: ProviderErrorKindSchema,
    retryable: z.boolean(),
    message: z.string().max(2000),
    bookedTokens: NonNegInt,
  }),
  z.object({
    ...EventBase,
    type: z.literal('tool_call'),
    worker: WorkerRoleSchema,
    callId: ToolCallIdSchema,
    tool: ToolNameSchema,
    input: JsonValueSchema,
    outcome: z.enum(['ok', 'refused', 'error']),
    resultBytes: NonNegInt,
    resultSha256: Sha256HexSchema,
    resultProvenance: z.enum(['tool_result', 'self']),
  }),
  z.object({
    ...EventBase,
    type: z.literal('write_refused'),
    worker: WorkerRoleSchema,
    callId: ToolCallIdSchema,
    /** The path exactly as requested (it may be invalid, so it is not a RepoPath). */
    requestedPath: z.string().max(1024),
    reason: WriteRefusalReasonSchema,
  }),
  z.object({
    ...EventBase,
    type: z.literal('handoff_correction'),
    worker: WorkerRoleSchema,
    handoffId: HandoffIdSchema,
    channel: CellChannelSchema,
    reason: z.enum(['invalid_json', 'schema_mismatch', 'over_length']),
  }),
  z.object({ ...EventBase, type: z.literal('handoff_delivered'), handoff: HandoffSchema }),
  z.object({
    ...EventBase,
    type: z.literal('merge'),
    files: z.array(z.object({ path: RepoPathSchema, from: ModuleIdSchema, sha256: Sha256HexSchema })),
  }),
  z.object({
    ...EventBase,
    type: z.literal('visibility'),
    finding: z.enum(['visibility_leak', 'self_originated_anchor']),
    worker: WorkerRoleSchema,
    callIndex: NonNegInt,
    requirement: RequirementIdSchema,
    /** Which anchor alternate was seen; stored so `hls verify` can recompute the audit. */
    anchor: NonEmptyText,
    provenance: SegmentProvenanceSchema,
  }),
  z.object({ ...EventBase, type: z.literal('grade'), results: GroupResultsSchema }),
  z.object({
    ...EventBase,
    type: z.literal('score'),
    matcherSha256: Sha256HexSchema,
    requirements: z.array(RequirementScoreSchema).length(8),
    retention: z.number().min(0).max(1),
  }),
  z.object({
    ...EventBase,
    type: z.literal('run_finished'),
    status: RunStatusSchema,
    flags: z.array(RunFlagSchema),
    usageTotals: UsageSchema,
    spentTokens: NonNegInt,
    completions: NonNegInt,
    wallMs: NonNegInt,
    snapshotDigest: Sha256HexSchema.nullable(),
  }),
]);
export type RunEvent = z.infer<typeof RunEventSchema>;
export type RunEventType = RunEvent['type'];

const RunRecordCommon = {
  schemaVersion: z.literal(1),
  runId: RunIdSchema,
  taskId: TaskIdSchema,
  arm: ArmSchema,
  repeat: RepeatSchema,
  startedAt: IsoTimestampSchema,
  finishedAt: IsoTimestampSchema,
  model: z.object({ requested: z.string().nullable(), observed: z.array(z.string()) }),
  sampling: z.object({ temperature: z.number().min(0).max(2).nullable(), maxOutput: PosInt }),
  budget: RunBudgetSchema,
  usageTotals: UsageSchema,
  spentTokens: NonNegInt,
  completions: NonNegInt,
  wallMs: NonNegInt,
  status: RunStatusSchema,
  flags: z.array(RunFlagSchema),
  exclusion: ExclusionSchema.nullable(),
  groupResults: GroupResultsSchema.nullable(),
  requirements: z.array(RequirementScoreSchema),
  retention: z.number().min(0).max(1).nullable(),
  snapshotDigest: Sha256HexSchema.nullable(),
  digests: z.object({
    task: Sha256HexSchema,
    prompts: Sha256HexSchema,
    matcher: Sha256HexSchema.nullable(),
    hiddenBundle: Sha256HexSchema.nullable(),
  }),
  /** Number of chained events and the chain head over them (store format, M5). */
  eventCount: NonNegInt,
  chainHead: Sha256HexSchema,
};

export const SyntheticRunRecordSchema = z.object({
  ...RunRecordCommon,
  edition: z.literal('SYNTHETIC'),
  tranche: SyntheticTrancheSchema,
  provider: SyntheticProviderNameSchema,
  approval: z.null(),
  preregSha256: z.null(),
});

export const LiveRunRecordSchema = z.object({
  ...RunRecordCommon,
  edition: z.literal('LIVE'),
  tranche: LiveTrancheSchema,
  provider: z.literal('anthropic'),
  approval: z.object({ fileSha256: Sha256HexSchema, decisionRef: NonEmptyText }),
  /** Required for T2 (D24); null for T0/T1. */
  preregSha256: Sha256HexSchema.nullable(),
});

export const RunRecordSchema = z
  .discriminatedUnion('edition', [SyntheticRunRecordSchema, LiveRunRecordSchema])
  .superRefine((r, ctx) => {
    const fail = (message: string): void => {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${r.runId}: ${message}` });
    };
    if (!r.runId.startsWith(`${r.tranche}.${r.taskId}.`)) fail('runId does not match tranche/task');
    if (r.edition === 'LIVE' && r.tranche === 'T2' && r.preregSha256 === null) fail('T2 records require a prereg hash (D24)');
    if (r.groupResults === null) {
      if (r.requirements.length !== 0 || r.retention !== null) fail('ungraded runs carry no scores');
    } else {
      if (r.requirements.length !== 8) fail('graded runs score all 8 requirements');
      if (r.retention !== retentionOf(r.groupResults)) fail('retention must equal passed R groups / 8');
      for (const s of r.requirements) {
        if (s.passed !== r.groupResults.groups[s.requirement].passed) fail(`${s.requirement}: score disagrees with group result`);
      }
    }
    if (r.flags.includes('visibility_leak') && r.exclusion !== 'visibility_leak' && r.exclusion !== 'integrity_stop') {
      fail('a visibility leak excludes the run (D16)');
    }
  });
export type RunRecord = z.infer<typeof RunRecordSchema>;

export class EditionMixError extends Error {
  constructor(editions: readonly Edition[]) {
    super(`refusing to mix record editions: ${[...new Set(editions)].join(', ')} (SYNTHETIC and LIVE never mix, §5)`);
    this.name = 'EditionMixError';
  }
}

/** Loader guard (§5): all records must share one edition. Returns it, or null for an empty list. */
export function assertSingleEdition(records: readonly { readonly edition: Edition }[]): Edition | null {
  const first = records[0];
  if (first === undefined) return null;
  const editions = records.map((r) => r.edition);
  if (editions.some((e) => e !== first.edition)) throw new EditionMixError(editions);
  return first.edition;
}

// ---------------------------------------------------------------------------------------------
// D23 Approval file. Its existence is NOT Roy's consent: `approver.decisionRef` must point to Roy's
// signed decision. The repo ships with no approval files and the spend cap is $0.
// ---------------------------------------------------------------------------------------------

export const ApprovalSchema = z
  .object({
    schemaVersion: z.literal(1),
    tranche: LiveTrancheSchema,
    model: NonEmptyText,
    cells: z.array(StudyCellSchema).min(1),
    /** Spec-blind probe runs per task (T1 only: 3; otherwise 0). */
    specBlindRunsPerTask: NonNegInt,
    tasks: z.array(TaskIdSchema).min(1),
    repeats: PosInt,
    /** Pooled per-run token allowance C. */
    maxTokens: PosInt,
    /** Hard dollar cap for the whole tranche. */
    maxUsd: z.number().nonnegative().finite(),
    issuedAt: IsoTimestampSchema,
    expiresAt: IsoTimestampSchema,
    approver: z.object({
      name: NonEmptyText,
      /** Pointer to Roy's signed written decision (file path, message id or URL). Required. */
      decisionRef: NonEmptyText,
      decisionSha256: Sha256HexSchema.nullable(),
    }),
    priceTableSha256: Sha256HexSchema,
  })
  .strict()
  .superRefine((a, ctx) => {
    if (Date.parse(a.expiresAt) <= Date.parse(a.issuedAt)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'expiresAt must be after issuedAt' });
    }
    if (!unique(a.cells) || !unique(a.tasks)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'cells and tasks must be unique' });
    }
    if (a.tranche !== 'T1' && a.specBlindRunsPerTask !== 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'spec-blind probes run in T1 only' });
    }
  });
export type Approval = z.infer<typeof ApprovalSchema>;

// ---------------------------------------------------------------------------------------------
// D24 Prereg manifest and D25 held-out manifest
// ---------------------------------------------------------------------------------------------

export const BOOTSTRAP_RESAMPLES = 10_000;
export const BOOTSTRAP_SEED = 42_001;

/** The four primary contrasts (D20): minuend - subtrahend. */
export const PRIMARY_CONTRASTS = [
  { id: 'H1', minuend: 'role/fixed_brief', subtrahend: 'single' },
  { id: 'H2', minuend: 'context/fixed_brief', subtrahend: 'single' },
  { id: 'H3', minuend: 'role/free_summary', subtrahend: 'role/fixed_brief' },
  { id: 'H4', minuend: 'context/free_summary', subtrahend: 'context/fixed_brief' },
] as const;

const OciDigestSchema = z.string().regex(/^sha256:[0-9a-f]{64}$/, 'expected sha256:<hex> image digest');

export const PreregManifestSchema = z
  .object({
    schemaVersion: z.literal(1),
    frozenAt: IsoTimestampSchema,
    hypotheses: z
      .array(
        z.object({
          id: z.enum(['H1', 'H2', 'H3', 'H4']),
          minuend: StudyCellSchema,
          subtrahend: StudyCellSchema,
          statement: NonEmptyText,
        }),
      )
      .length(4),
    allowance: z.object({
      tokens: PosInt,
      devSingleP75: PosInt,
      ceilingTokens: PosInt,
      /** True when min(150k, ...) bound; recorded as a deviation row, never a silent clamp (§2). */
      ceilingBinds: z.boolean(),
    }),
    reservationRatio: z.number().positive().finite(),
    exclusions: z.array(ExclusionSchema),
    analysisCodeSha256: Sha256HexSchema,
    promptsSha256: Sha256HexSchema,
    matcherSha256: Sha256HexSchema,
    imageDigests: z.object({ episode: OciDigestSchema, candidate: OciDigestSchema, grader: OciDigestSchema }),
    model: NonEmptyText,
    sampling: z.object({ temperature: z.number().min(0).max(2), maxOutput: PosInt }),
    priceTable: PriceTableSchema,
    heldoutManifestSha256: Sha256HexSchema,
    /** Seeded balanced precommitted run order. */
    runOrder: z.object({ seed: NonEmptyText, runCount: PosInt, sha256: Sha256HexSchema }),
    bootstrap: z.object({ resamples: PosInt, seed: NonNegInt }),
    /** Appended after freeze only; each is reported as a deviation. */
    amendments: z.array(z.object({ at: IsoTimestampSchema, description: NonEmptyText, deviation: z.literal(true) })),
  })
  .strict()
  .superRefine((m, ctx) => {
    for (const expected of PRIMARY_CONTRASTS) {
      const h = m.hypotheses.find((x) => x.id === expected.id);
      if (h === undefined || h.minuend !== expected.minuend || h.subtrahend !== expected.subtrahend) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${expected.id} must be ${expected.minuend} - ${expected.subtrahend} (D20)` });
      }
    }
    const expectTokens = Math.min(m.allowance.ceilingTokens, Math.ceil((2 * m.allowance.devSingleP75) / 10_000) * 10_000);
    if (m.allowance.tokens !== expectTokens) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'allowance.tokens must equal min(ceiling, ceil_10k(2 x P75)) (D6)' });
    }
  });
export type PreregManifest = z.infer<typeof PreregManifestSchema>;

/** heldout.manifest.json (D25): the only held-out artefact that enters the repo. */
export const HeldoutManifestSchema = z
  .object({
    schemaVersion: z.literal(1),
    custodian: z.object({ name: NonEmptyText, modelFamily: NonEmptyText }),
    sealedAt: IsoTimestampSchema,
    files: z
      .array(
        z.object({
          kind: z.enum(['task_file', 'carry_sealed']),
          /** Path relative to the sealed folder, e.g. tasks/H01/spec.md or carry-sealed/pairs.json. */
          path: RepoPathSchema,
          bytes: NonNegInt,
          sha256: Sha256HexSchema,
        }),
      )
      .min(1),
  })
  .strict()
  .refine((m) => unique(m.files.map((f) => f.path)), 'manifest paths must be unique');
export type HeldoutManifest = z.infer<typeof HeldoutManifestSchema>;

/** Convenience re-exports so callers can type group maps without importing ids. */
export type { RequirementId, TestGroupId };
export const ALL_TEST_GROUPS = TestGroupIdSchema.options;
