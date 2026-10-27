import { describe, it, expect } from 'vitest';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { RunRecordSchema, GroupResultsSchema } from '../src/core/contracts';
import type { RunEvent } from '../src/core/contracts';
import { TEST_GROUP_IDS } from '../src/core/ids';
import { scoreRequirement } from '../src/score/classify';
import { hashCanonical } from '../src/core/hash';
import { encodeChain, decodeChain } from '../src/store/chain';
import { writeRun } from '../src/store/jsonl';
import { verifyRun } from '../src/store/load';
import { ungradedBundle } from './m5-fixture';
describe('M5 score recomputation', () => {
  it('recomputes eight scores and catches internally re-chained invented scores', () => {
    const root = mkdtempSync(join(tmpdir(), 'hls-verify-'));
    try {
      const base = ungradedBundle(); const digest = hashCanonical([]);
      const groups = GroupResultsSchema.parse({ snapshotDigest: digest, hiddenBundleDigest: digest, graderImageDigest: null, sandbox: 'local_unsafe', groups: Object.fromEntries(TEST_GROUP_IDS.map((id) => [id, { passed: false, failure: 'assertion', durationMs: null }])) });
      const requirements = base.task.requirements.map((requirement) => scoreRequirement({ arm: 'single', requirement, groups: Object.fromEntries(TEST_GROUP_IDS.map((id) => [id, false])), artifacts: [] }));
      const finish = base.events[1]; if (finish === undefined) throw new Error('fixture missing finish');
      const shared = { at: finish.at, runId: finish.runId };
      const events: RunEvent[] = [base.events[0] as RunEvent, { ...shared, seq: 1, type: 'grade', results: groups }, { ...shared, seq: 2, type: 'score', matcherSha256: digest, requirements, retention: 0 }, { ...finish, seq: 3, snapshotDigest: digest } as RunEvent];
      const record = RunRecordSchema.parse({ ...base.record, snapshotDigest: digest, groupResults: groups, requirements, retention: 0, digests: { ...base.record.digests, matcher: digest, hiddenBundle: digest } });
      const dir = join(root, 'run'); writeRun(dir, { ...base, record, events, snapshot: new Map() });
      expect(verifyRun(dir).scoreRecomputed).toBe(true);
      const path = join(dir, 'events.jsonl');
      const payloads = decodeChain(readFileSync(path, 'utf8')).map((r) => r.payload);
      const footer = payloads.at(-1) as { record: { requirements: { class: string }[] } };
      const first = footer.record.requirements[0]; if (first === undefined) throw new Error('fixture missing requirement');
      first.class = 'kept';
      writeFileSync(path, encodeChain(payloads));
      writeFileSync(join(dir, 'events.jsonl.gz'), gzipSync(encodeChain(payloads)));
      expect(() => verifyRun(dir)).toThrow(/recomputation/);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
});
