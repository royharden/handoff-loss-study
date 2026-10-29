import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { RunEventSchema, RunRecordSchema, TaskSchema } from '../core/contracts';
import type { RunEvent, RunRecord, Task } from '../core/contracts';
import { canonicalize } from '../core/canonical';
import { chainHead, hashCanonical } from '../core/hash';
import type { CarrierArtifact } from '../score/evidence';
import { encodeChain } from './chain';
import { snapshotOf } from './snapshot';

export interface RunBundleInput {
  readonly record: RunRecord;
  readonly events: readonly RunEvent[];
  readonly task: Task;
  readonly artifactsByRequirement: Readonly<Record<string, readonly CarrierArtifact[]>>;
  readonly snapshot?: ReadonlyMap<string, Uint8Array>;
  readonly view?: { readonly spec: string; readonly brief: string; readonly slices: { readonly A: string; readonly B: string } };
}

/** New directory only. No overwrite, partial repair or silently replaced evidence. */
export function writeRun(directory: string, input: RunBundleInput): RunRecord {
  const events = input.events.map((e) => RunEventSchema.parse(e));
  const record = RunRecordSchema.parse({ ...input.record, eventCount: events.length, chainHead: chainHead(events) });
  const task = TaskSchema.parse(input.task);
  const evidence = { task, artifactsByRequirement: input.artifactsByRequirement, view: input.view ?? null };
  const snapshot = input.snapshot === undefined ? null : snapshotOf(input.snapshot);
  const footer = { type: 'footer', record, evidenceSha256: hashCanonical(evidence), snapshotSha256: snapshot === null ? null : hashCanonical(snapshot) };
  mkdirSync(directory, { recursive: false });
  writeFileSync(join(directory, 'evidence.json'), canonicalize(evidence) + '\n', { flag: 'wx' });
  if (snapshot !== null) writeFileSync(join(directory, 'snapshot.json'), canonicalize(snapshot) + '\n', { flag: 'wx' });
  const journal = encodeChain([...events, footer]);
  // Human-readable companion is byte-identical to the compressed authoritative transcript.
  writeFileSync(join(directory, 'events.jsonl'), journal, { flag: 'wx' });
  // Written last: an interrupted write has no complete gzipped journal and cannot verify.
  writeFileSync(join(directory, 'events.jsonl.gz'), gzipSync(journal), { flag: 'wx' });
  return record;
}
