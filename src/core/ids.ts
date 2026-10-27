/**
 * Identifier vocabulary (PLAN.md D2, D10, D10a, D14, §3, §5, §7).
 *
 * Every closed vocabulary that more than one module needs lives here as a zod schema, with the
 * TypeScript type inferred from it. No enums (erasable TypeScript only).
 */
import { z } from 'zod';
import { SHA256_HEX_PATTERN } from './hash';

export const Sha256HexSchema = z.string().regex(SHA256_HEX_PATTERN, 'expected lower-case 64-char sha256 hex');

/** ISO-8601 UTC timestamp with a trailing Z, e.g. 2026-10-27T16:20:00.000Z. */
export const IsoTimestampSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?Z$/, 'expected ISO-8601 UTC timestamp ending in Z');

/** Dev tasks are T01..T06 (builder); held-out tasks H01..H12 (custodian only, D25). */
export const TaskIdSchema = z.string().regex(/^[TH]\d{2}$/, 'task id must be T<nn> (dev) or H<nn> (held-out)');
export type TaskId = z.infer<typeof TaskIdSchema>;

export const TaskSplitSchema = z.enum(['dev', 'heldout']);
export type TaskSplit = z.infer<typeof TaskSplitSchema>;

/** Task shape strata (D10): 2/2/2 dev, 4/4/4 held-out. */
export const TaskShapeSchema = z.enum(['feature', 'refactor', 'bugfix']);
export type TaskShape = z.infer<typeof TaskShapeSchema>;

/** Planted requirements R1..R8 (D10: 8 per task). */
export const RequirementIdSchema = z.enum(['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8']);
export type RequirementId = z.infer<typeof RequirementIdSchema>;
export const REQUIREMENT_IDS: readonly RequirementId[] = RequirementIdSchema.options;

/** Hidden test groups: core behaviour C0 plus one group per requirement (D11). */
export const TestGroupIdSchema = z.enum(['C0', 'R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8']);
export type TestGroupId = z.infer<typeof TestGroupIdSchema>;
export const TEST_GROUP_IDS: readonly TestGroupId[] = TestGroupIdSchema.options;

/** The two writable modules / spec slices of every task. */
export const ModuleIdSchema = z.enum(['A', 'B']);
export type ModuleId = z.infer<typeof ModuleIdSchema>;

/** The six study cells (D2). */
export const StudyCellSchema = z.enum([
  'single',
  'role/free_summary',
  'role/fixed_brief',
  'role/full_trace',
  'context/free_summary',
  'context/fixed_brief',
]);
export type StudyCell = z.infer<typeof StudyCellSchema>;
export const STUDY_CELLS: readonly StudyCell[] = StudyCellSchema.options;

/**
 * Everything a run can be: a study cell, the dev-only spec-blind probe (§2 "Spec-blind probe
 * input"), or a zero-cost baseline row (D18: `null_worker` retention must be 0, `oracle` must be 1).
 */
export const ArmSchema = z.enum([...StudyCellSchema.options, 'spec_blind', 'null_worker', 'oracle']);
export type Arm = z.infer<typeof ArmSchema>;

/** Decomposition of a study cell. */
export const DecompositionSchema = z.enum(['single', 'role', 'context']);
export type Decomposition = z.infer<typeof DecompositionSchema>;

/** Handoff channel of a split cell (D15). */
export const CellChannelSchema = z.enum(['free_summary', 'fixed_brief', 'full_trace']);
export type CellChannel = z.infer<typeof CellChannelSchema>;

export function decompositionOf(cell: StudyCell): Decomposition {
  if (cell === 'single') return 'single';
  return cell.startsWith('role/') ? 'role' : 'context';
}

export function channelOf(cell: StudyCell): CellChannel | null {
  if (cell === 'single') return null;
  const channel = cell.slice(cell.indexOf('/') + 1);
  return CellChannelSchema.parse(channel);
}

/** Model-calling workers (D3, D4, spec-blind probe). Baseline rows have no worker. */
export const WorkerRoleSchema = z.enum(['single', 'planner', 'implementer', 'context_A', 'context_B', 'spec_blind']);
export type WorkerRole = z.infer<typeof WorkerRoleSchema>;

/** Tranches (D10a). FIXTURE and DEMO are keyless SYNTHETIC editions only (§5). */
export const LiveTrancheSchema = z.enum(['T0', 'T1', 'T2']);
export type LiveTranche = z.infer<typeof LiveTrancheSchema>;
export const SyntheticTrancheSchema = z.enum(['FIXTURE', 'DEMO']);
export type SyntheticTranche = z.infer<typeof SyntheticTrancheSchema>;
export const TrancheSchema = z.enum([...LiveTrancheSchema.options, ...SyntheticTrancheSchema.options]);
export type Tranche = z.infer<typeof TrancheSchema>;

/** Record edition discriminant: SYNTHETIC records can never be mixed with LIVE ones (§5). */
export const EditionSchema = z.enum(['SYNTHETIC', 'LIVE']);
export type Edition = z.infer<typeof EditionSchema>;

/** Provider adapters (§5). Only `anthropic` is live, and it ships disabled (D9, D23). */
export const ProviderNameSchema = z.enum(['null', 'scripted', 'mock', 'anthropic']);
export type ProviderName = z.infer<typeof ProviderNameSchema>;
export const SyntheticProviderNameSchema = z.enum(['null', 'scripted', 'mock']);

/** Closed worker tool set (D1). No shell. */
export const ToolNameSchema = z.enum([
  'list_files',
  'read_file',
  'write_file',
  'edit_file',
  'run_public_tests',
  'submit_handoff',
  'finish',
]);
export type ToolName = z.infer<typeof ToolNameSchema>;

/** Repeat index within a task × arm (D10: 3 held-out repeats, D10a: 2 dev repeats, 3 spec-blind). */
export const RepeatSchema = z.number().int().min(0).max(9);

const CELL_SLUG: Readonly<Record<Arm, string>> = {
  single: 'single',
  'role/free_summary': 'role-free',
  'role/fixed_brief': 'role-fixed',
  'role/full_trace': 'role-trace',
  'context/free_summary': 'ctx-free',
  'context/fixed_brief': 'ctx-fixed',
  spec_blind: 'specblind',
  null_worker: 'null',
  oracle: 'oracle',
};

/** Run ids: `<tranche>.<taskId>.<armSlug>.r<repeat>`, e.g. `T1.T03.role-fixed.r1`. */
export const RunIdSchema = z
  .string()
  .regex(
    /^(T0|T1|T2|FIXTURE|DEMO)\.[TH]\d{2}\.(single|role-free|role-fixed|role-trace|ctx-free|ctx-fixed|specblind|null|oracle)\.r\d$/,
    'run id must be <tranche>.<taskId>.<armSlug>.r<repeat>',
  );
export type RunId = z.infer<typeof RunIdSchema>;

export function makeRunId(parts: { tranche: Tranche; taskId: TaskId; arm: Arm; repeat: number }): RunId {
  return RunIdSchema.parse(`${parts.tranche}.${parts.taskId}.${CELL_SLUG[parts.arm]}.r${parts.repeat}`);
}

/** Handoff ids are local to a run: h1, h2, ... (a context run has two: one per worker, D4). */
export const HandoffIdSchema = z.string().regex(/^h[1-9]\d*$/, 'handoff id must be h<n>');
export type HandoffId = z.infer<typeof HandoffIdSchema>;

/** Provider-issued tool-call ids are opaque; we only require a bounded non-empty string. */
export const ToolCallIdSchema = z.string().min(1).max(256);
export type ToolCallId = z.infer<typeof ToolCallIdSchema>;

/** Repo-relative POSIX path: no leading slash, no backslash, no `.`/`..` segments, no empty segment. */
export const RepoPathSchema = z
  .string()
  .min(1)
  .max(512)
  .refine(
    (p) =>
      !p.startsWith('/') &&
      !p.includes('\\') &&
      !/^[A-Za-z]:/.test(p) &&
      p.split('/').every((seg) => seg !== '' && seg !== '.' && seg !== '..'),
    'expected a normalised repo-relative POSIX path',
  );
export type RepoPath = z.infer<typeof RepoPathSchema>;
