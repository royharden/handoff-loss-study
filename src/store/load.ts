import { readFileSync, readdirSync, lstatSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { z } from 'zod';
import { RunEventSchema, RunRecordSchema, TaskSchema, assertSingleEdition, retentionOf } from '../core/contracts';
import type { RunRecord } from '../core/contracts';
import type { Handoff } from '../core/handoff-schema';
import { canonicalize, parseCanonical } from '../core/canonical';
import { chainHead, hashCanonical } from '../core/hash';
import { scoreRequirement, responsibleWorker, isEligibleEdge } from '../score/classify';
import { artifactFromHandoff, edgeEvidence } from '../score/evidence';
import { extractiveSummary } from '../score/extractive';
import { auditRequest, auditedAnchors, legitimateViewTexts } from '../score/visibility';
import { decodeChain } from './chain';
import { verifySnapshot, storedSnapshotDigest } from './snapshot';

const Footer = z.object({ type: z.literal('footer'), record: RunRecordSchema, evidenceSha256: z.string(), snapshotSha256: z.string().nullable() }).strict();
const Evidence = z.object({ task: TaskSchema, artifactsByRequirement: z.record(z.array(z.unknown())), view: z.object({ spec: z.string(), brief: z.string(), slices: z.object({ A: z.string(), B: z.string() }) }).nullable() }).strict();
export interface VerifiedRun { readonly record: RunRecord; readonly directory: string; readonly journalHead: string; readonly scoreRecomputed: boolean; readonly diagnostics: { readonly runId: string; readonly handoffs: readonly Handoff[]; readonly baselines: { requirement: string; verbatim: string; extractive: string }[]; readonly verbatimCopyShare: number | null; readonly contractMismatches: string[] } }
function readCanonical(path: string): unknown { const text = readFileSync(path, 'utf8'); if (!text.endsWith('\n')) throw new Error('canonical artifact final newline missing'); return parseCanonical(text.slice(0, -1)); }

/** Integrity verification is not grader reexecution or evidence of a live provider call. */
export function verifyRun(directory: string, expectedMatcherSha256?: string): VerifiedRun {
  const journal = gunzipSync(readFileSync(join(directory, 'events.jsonl.gz')), { maxOutputLength: 128 * 1024 * 1024 }).toString('utf8');
  if (readFileSync(join(directory, 'events.jsonl'), 'utf8') !== journal) throw new Error('compressed/uncompressed transcript mismatch');
  const rows = decodeChain(journal);
  const last = rows.at(-1);
  if (last === undefined) throw new Error('empty journal');
  const footer = Footer.parse(last.payload);
  const record = footer.record;
  if (expectedMatcherSha256 !== undefined && record.digests.matcher !== null && record.digests.matcher !== expectedMatcherSha256) throw new Error('matcher source differs from recorded edition');
  const events = rows.slice(0, -1).map((r) => RunEventSchema.parse(r.payload));
  if (events.length !== record.eventCount || chainHead(events) !== record.chainHead) throw new Error('event count/head mismatch');
  if (events.some((e, i) => e.runId !== record.runId || e.seq !== i)) throw new Error('event identity/sequence mismatch');
  const start = events[0];
  const finish = events.at(-1);
  if (start?.type !== 'run_started' || finish?.type !== 'run_finished') throw new Error('run lacks start/finish events');
  if (start.edition !== record.edition || start.taskId !== record.taskId || start.arm !== record.arm || start.repeat !== record.repeat || start.taskDigest !== record.digests.task || start.promptsDigest !== record.digests.prompts || start.provider !== record.provider || start.requestedModel !== record.model.requested || start.at !== record.startedAt || canonicalize(start.budget) !== canonicalize(record.budget)) throw new Error('start/footer mismatch');
  if (finish.status !== record.status || finish.spentTokens !== record.spentTokens || finish.completions !== record.completions || finish.wallMs !== record.wallMs || finish.snapshotDigest !== record.snapshotDigest || finish.at !== record.finishedAt || canonicalize(finish.usageTotals) !== canonicalize(record.usageTotals) || canonicalize(finish.flags) !== canonicalize(record.flags)) throw new Error('finish/footer mismatch');
  const rawEvidence = readCanonical(join(directory, 'evidence.json'));
  if (hashCanonical(rawEvidence) !== footer.evidenceSha256) throw new Error('evidence digest mismatch');
  const evidence = Evidence.parse(rawEvidence);
  if (evidence.task.id !== record.taskId || hashCanonical(evidence.task) !== record.digests.task) throw new Error('task identity/digest mismatch');
  if (evidence.view !== null && hashCanonical({ policy: 'worker-loop-v1', arm: record.arm, brief: evidence.view.brief }) !== record.digests.prompts) throw new Error('brief/prompt digest mismatch');
  if (events.some((e) => e.type === 'request') && evidence.view === null) throw new Error('request verification requires pinned spec/slices/brief');
  if (footer.snapshotSha256 !== null) {
    const snapshot = verifySnapshot(readCanonical(join(directory, 'snapshot.json')));
    if (hashCanonical(snapshot) !== footer.snapshotSha256) throw new Error('snapshot footer digest mismatch');
    if (storedSnapshotDigest(snapshot) !== record.snapshotDigest || (record.groupResults !== null && storedSnapshotDigest(snapshot) !== record.groupResults.snapshotDigest)) throw new Error('graded snapshot digest mismatch');
  }
  if (record.snapshotDigest !== null && footer.snapshotSha256 === null) throw new Error('pinned snapshot missing from bundle');
  const delivered = events.filter((e) => e.type === 'handoff_delivered').map((e) => e.handoff);
  const derivedArtifacts = Object.fromEntries(evidence.task.requirements.map((requirement) => [requirement.id, delivered.filter((h) => h.to === responsibleWorker(record.arm, requirement)).map(artifactFromHandoff)]));
  if (canonicalize(derivedArtifacts) !== canonicalize(evidence.artifactsByRequirement)) throw new Error('carrier inputs disagree with delivered handoff events');
  if (evidence.view !== null) {
    const view = evidence.view;
    const expectedVisibility = events.flatMap((event, index) => {
      if (event.type !== 'request' || event.attempt !== 0) return [];
      const incoming = events.slice(0, index).filter((e) => e.type === 'handoff_delivered').flatMap((e) => e.type === 'handoff_delivered' && e.handoff.to === event.worker ? [e.handoff] : []);
      const handoffText = incoming.map((h) => h.channel === 'fixed_brief' ? h.raw : h.channel === 'full_trace' ? JSON.stringify(h.messages) : h.text);
      return auditRequest({ worker: event.worker, anchors: auditedAnchors(evidence.task.requirements), permittedTexts: [...legitimateViewTexts(event.worker, { spec: view.spec, slices: view.slices }), ...handoffText], receivedHandoffIds: new Set(incoming.map((h) => h.handoffId)) }, event.callIndex, event.messages);
    });
    const actualVisibility = events.filter((e) => e.type === 'visibility').map((e) => ({ finding: e.finding, worker: e.worker, callIndex: e.callIndex, requirement: e.requirement, anchor: e.anchor, provenance: e.provenance }));
    // A detected leak may halt before the offending request dispatch; retain that terminal finding.
    const dispatchedIndices = new Set(events.flatMap((e) => e.type === 'request' ? [e.callIndex] : []));
    if (canonicalize(expectedVisibility) !== canonicalize(actualVisibility.filter((e) => dispatchedIndices.has(e.callIndex)))) throw new Error('visibility recomputation mismatch');
    if (actualVisibility.some((e) => e.finding === 'visibility_leak') && !record.flags.includes('visibility_leak')) throw new Error('visibility leak not reflected in footer');
  }
  if (record.groupResults !== null) {
    if (record.snapshotDigest !== record.groupResults.snapshotDigest || record.digests.hiddenBundle !== record.groupResults.hiddenBundleDigest) throw new Error('grade digest/footer mismatch');
    if (!record.groupResults.groups.C0.passed && Object.entries(record.groupResults.groups).some(([id, g]) => id !== 'C0' && g.passed)) throw new Error('R group cannot pass a failed C0 conjunct');
    const grades = events.filter((e) => e.type === 'grade');
    if (grades.length !== 1 || canonicalize(grades[0]?.results) !== canonicalize(record.groupResults)) throw new Error('grade/footer mismatch');
    const groups = Object.fromEntries(Object.entries(record.groupResults.groups).map(([id, g]) => [id, g.passed]));
    const recomputed = evidence.task.requirements.map((requirement) => scoreRequirement({ arm: record.arm, requirement, groups, artifacts: derivedArtifacts[requirement.id] ?? [] }));
    if (canonicalize(recomputed) !== canonicalize(record.requirements) || retentionOf(record.groupResults) !== record.retention) throw new Error('score recomputation mismatch');
    const scores = events.filter((e) => e.type === 'score');
    if (scores.length !== 1 || canonicalize(scores[0]?.requirements) !== canonicalize(recomputed) || scores[0]?.retention !== record.retention || scores[0]?.matcherSha256 !== record.digests.matcher) throw new Error('score event/footer mismatch');
  }
  const baselines = evidence.view === null ? [] : evidence.task.requirements.filter((r) => isEligibleEdge(record.arm, r)).map((requirement) => {
    const source = evidence.view?.slices[requirement.sourceSlice] ?? '';
    return { requirement: requirement.id, verbatim: edgeEvidence({ requirement, artifacts: [{ channel: 'verbatim_forward', text: source }], prerequisiteFailed: false }).state, extractive: edgeEvidence({ requirement, artifacts: [{ channel: 'extractive', text: extractiveSummary(source, record.budget.r).text }], prerequisiteFailed: false }).state };
  });
  const sourceLines = new Set((evidence.view?.spec ?? '').split('\n').map((s) => s.trim()).filter(Boolean));
  const carrierLines = delivered.flatMap((h) => {
    const text = h.channel === 'full_trace' ? h.messages.filter((m) => ['assistant', 'handoff', 'spec_text'].includes(m.kind)).map((m) => m.text).join('\n') : h.channel === 'fixed_brief' ? (h.parsed === null ? h.raw : [h.parsed.objective, ...h.parsed.requirements, ...h.parsed.decisions_overrides, ...h.parsed.prohibitions, ...h.parsed.interfaces, ...h.parsed.open_items, ...h.parsed.files_touched].join('\n')) : h.text;
    return text.replace(/\r\n?/g, '\n').split('\n').map((s) => s.trim()).filter(Boolean);
  });
  const verbatimCopyShare = carrierLines.length === 0 ? null : carrierLines.filter((line) => sourceLines.has(line.trim())).length / carrierLines.length;
  const contractMismatches = evidence.task.requirements.filter((r) => r.kind === 'cross_module_contract' && record.groupResults?.groups.C0.passed === true && record.groupResults.groups[r.testGroup].passed === false).map((r) => r.id);
  return { directory, record, journalHead: last.hash, scoreRecomputed: record.groupResults !== null, diagnostics: { runId: record.runId, handoffs: delivered, baselines, verbatimCopyShare, contractMismatches } };
}

/** Only explicit result directories; never traverses sealed data or symlinks. */
export function loadRuns(root: string, expectedMatcherSha256?: string): VerifiedRun[] {
  if (lstatSync(root).isSymbolicLink()) throw new Error('result symlink refused');
  const names = readdirSync(root);
  const runs = names.includes('events.jsonl.gz') ? [verifyRun(root, expectedMatcherSha256)] : names.sort().flatMap((name) => {
    const path = join(root, name);
    const stat = lstatSync(path);
    if (stat.isSymbolicLink()) throw new Error('result symlink refused');
    return stat.isDirectory() ? [verifyRun(path, expectedMatcherSha256)] : [];
  });
  assertSingleEdition(runs.map((r) => r.record));
  if (new Set(runs.map((r) => r.record.runId)).size !== runs.length) throw new Error('duplicate run IDs');
  return runs;
}
