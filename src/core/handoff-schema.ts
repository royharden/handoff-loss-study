/**
 * Handoff channels and the fixed-brief schema (PLAN.md D15, §4.2).
 *
 * - `free_summary`: prose written by the sender.
 * - `fixed_brief`: JSON object with exactly the seven fields below (strict: extra keys make the
 *   brief malformed). One budgeted correction is allowed; if it is still malformed the raw text is
 *   delivered and the run is flagged `malformed_handoff`; the scorer then matches it as prose.
 * - `full_trace`: mechanical, never truncated. Tool-result messages are stored with kind
 *   `tool_result` so the carry matcher can exclude them (§4.2).
 * - `verbatim_forward` / `extractive`: zero-cost baseline carriers (D18), never sent by a worker.
 *
 * Free and fixed handoffs are bounded at <= 0.5 x source tokens, measured with the D7 byte bound;
 * source = the whole spec for the role planner, the sender's own slice for a context worker.
 *
 * Pure module: parsing only, no I/O.
 */
import { z } from 'zod';
import { HandoffIdSchema, IsoTimestampSchema, Sha256HexSchema, ToolCallIdSchema, WorkerRoleSchema } from './ids';

/** Channels that carry requirement text to a receiver (cells use the first three). */
export const CarrierChannelSchema = z.enum(['free_summary', 'fixed_brief', 'full_trace', 'verbatim_forward', 'extractive']);
export type CarrierChannel = z.infer<typeof CarrierChannelSchema>;

const BriefText = z.string().max(20_000);

/** The fixed brief (D15). Field names are part of the treatment and are frozen with the prompts. */
export const FixedBriefSchema = z
  .object({
    objective: BriefText,
    requirements: z.array(BriefText),
    decisions_overrides: z.array(BriefText),
    prohibitions: z.array(BriefText),
    interfaces: z.array(BriefText),
    open_items: z.array(BriefText),
    files_touched: z.array(BriefText),
  })
  .strict();
export type FixedBrief = z.infer<typeof FixedBriefSchema>;

export const FIXED_BRIEF_FIELDS = [
  'objective',
  'requirements',
  'decisions_overrides',
  'prohibitions',
  'interfaces',
  'open_items',
  'files_touched',
] as const;

export type FixedBriefParse =
  | { readonly ok: true; readonly brief: FixedBrief }
  | { readonly ok: false; readonly reason: 'invalid_json' | 'schema_mismatch'; readonly detail: string };

/** Parse a sender's fixed-brief text. Never throws. */
export function parseFixedBrief(raw: string): FixedBriefParse {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch (err) {
    return { ok: false, reason: 'invalid_json', detail: err instanceof Error ? err.message : String(err) };
  }
  const result = FixedBriefSchema.safeParse(value);
  if (!result.success) {
    return { ok: false, reason: 'schema_mismatch', detail: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') };
  }
  return { ok: true, brief: result.data };
}

/** Handoff length bound (D15): floor(0.5 x source tokens). Source tokens come from the D7 byte bound. */
export function handoffTokenBound(sourceTokens: number): number {
  if (!Number.isInteger(sourceTokens) || sourceTokens < 0) throw new RangeError('sourceTokens must be a non-negative integer');
  return Math.floor(0.5 * sourceTokens);
}

/** One message of a full trace. Only `tool_result` messages are excluded from carry matching (§4.2). */
export const TraceMessageSchema = z.object({
  kind: z.enum(['system', 'spec_text', 'assistant', 'handoff', 'tool_call', 'tool_result']),
  text: z.string(),
  toolCallId: ToolCallIdSchema.optional(),
});
export type TraceMessage = z.infer<typeof TraceMessageSchema>;

const HandoffCommon = {
  handoffId: HandoffIdSchema,
  /** Sender worker; baselines are produced by the harness, recorded as the role they stand in for. */
  from: WorkerRoleSchema,
  to: WorkerRoleSchema,
  /** Event sequence number at which the receiver first saw this handoff. */
  deliveredAtSeq: z.number().int().nonnegative(),
  deliveredAt: IsoTimestampSchema,
  /** Byte length of the delivered carrier text (UTF-8) and its sha256. */
  bytes: z.number().int().nonnegative(),
  sha256: Sha256HexSchema,
  /** Source-token estimate (D7 byte bound) and the resulting bound; null for full_trace and baselines. */
  sourceTokens: z.number().int().nonnegative().nullable(),
  tokenBound: z.number().int().nonnegative().nullable(),
};

export const FreeSummaryHandoffSchema = z.object({
  ...HandoffCommon,
  channel: z.literal('free_summary'),
  text: z.string(),
});

export const FixedBriefHandoffSchema = z.object({
  ...HandoffCommon,
  channel: z.literal('fixed_brief'),
  /** Exactly what the sender produced after at most one correction. */
  raw: z.string(),
  /** Parsed brief, or null when it stayed malformed (then `raw` is matched as prose, §4.2). */
  parsed: FixedBriefSchema.nullable(),
  correctionUsed: z.boolean(),
  malformed: z.boolean(),
});

export const FullTraceHandoffSchema = z.object({
  ...HandoffCommon,
  channel: z.literal('full_trace'),
  messages: z.array(TraceMessageSchema),
  /** True when the trace did not fit the request ceiling; the run then ends `cap_hit` (D15). */
  capHit: z.boolean(),
});

export const VerbatimForwardHandoffSchema = z.object({
  ...HandoffCommon,
  channel: z.literal('verbatim_forward'),
  text: z.string(),
});

export const ExtractiveHandoffSchema = z.object({
  ...HandoffCommon,
  channel: z.literal('extractive'),
  text: z.string(),
});

export const HandoffSchema = z
  .discriminatedUnion('channel', [
    FreeSummaryHandoffSchema,
    FixedBriefHandoffSchema,
    FullTraceHandoffSchema,
    VerbatimForwardHandoffSchema,
    ExtractiveHandoffSchema,
  ])
  .superRefine((h, ctx) => {
    if (h.channel === 'fixed_brief' && h.malformed !== (h.parsed === null)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'fixed_brief: malformed must be true exactly when parsed is null' });
    }
    if (h.from === h.to) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'handoff sender and receiver must differ' });
    }
  });
export type Handoff = z.infer<typeof HandoffSchema>;
