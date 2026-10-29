import { z } from 'zod';
const NumberOrNull = z.number().finite().nullable();
const Requirement = z.object({ requirement: z.string(), kind: z.string(), slot: z.string(), passed: z.boolean(), class: z.string(), flags: z.array(z.string()), evidence: z.object({ state: z.string(), unknownReason: z.string().nullable(), channel: z.string().nullable() }).passthrough().nullable() }).passthrough();
const Record = z.object({ runId: z.string(), edition: z.enum(['LIVE', 'SYNTHETIC']), tranche: z.string(), arm: z.string(), taskId: z.string(), repeat: z.number().int(), retention: NumberOrNull, status: z.string(), exclusion: z.string().nullable(), flags: z.array(z.string()), requirements: z.array(Requirement), digests: z.object({ matcher: z.string().nullable() }).passthrough() }).passthrough();
const Report = z.object({ schemaVersion: z.literal(1), edition: z.enum(['LIVE', 'SYNTHETIC']).nullable(), banner: z.string(), runs: z.number().int().nonnegative(), records: z.array(Record), rows: z.array(z.object({ arm: z.string(), runs: z.number(), graded: z.number(), excluded: z.number(), retention: NumberOrNull, fullSuccess: NumberOrNull, evidenceRate: NumberOrNull, unknownRate: NumberOrNull, tokens: z.number(), usd: NumberOrNull }).passthrough()), contrasts: z.array(z.object({ id: z.string(), minuend: z.string(), subtrahend: z.string(), estimate: NumberOrNull, lower: NumberOrNull, upper: NumberOrNull, tasks: z.number(), omittedTasks: z.number() }).passthrough()) }).passthrough();
export type ViewerReport = z.infer<typeof Report>;
export function parseReport(raw: unknown): ViewerReport {
  const report = Report.parse(raw);
  const editions = new Set(report.records.map((r) => r.edition));
  if (editions.size > 1 || report.records.some((r) => r.edition !== report.edition)) throw new Error('Refusing mixed SYNTHETIC/LIVE editions');
  if (new Set(report.records.map((r) => r.tranche)).size > 1) throw new Error('Refusing mixed tranches');
  if (new Set(report.records.map((r) => r.digests.matcher).filter((x) => x !== null)).size > 1) throw new Error('Refusing mixed matcher editions');
  if (new Set(report.records.map((r) => r.runId)).size !== report.records.length || report.records.length !== report.runs) throw new Error('Duplicate or missing run records');
  return report;
}
