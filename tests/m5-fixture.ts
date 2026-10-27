/** Mechanical SYNTHETIC journal inputs. No semantic/gold or held-out labels. */
import { loadTask } from '../src/tasks/load';
import { DEFAULT_RUN_LIMITS, RunRecordSchema } from '../src/core/contracts';
import type { RunEvent } from '../src/core/contracts';
import { GENESIS_HASH, hashCanonical } from '../src/core/hash';
import type { RunBundleInput } from '../src/store/jsonl';
export function ungradedBundle(): RunBundleInput {
  const task = loadTask('tasks/dev/T01').task;
  const budget = { allowanceTokens: 150000, r: 1, limits: DEFAULT_RUN_LIMITS };
  const usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, reasoning: 0, source: 'provider_reported' as const };
  const runId = 'DEMO.T01.single.r0'; const at = '2026-10-27T00:00:00Z';
  const digest = hashCanonical(task);
  const events: RunEvent[] = [{ seq: 0, at, runId, type: 'run_started', edition: 'SYNTHETIC', taskId: task.id, arm: 'single', repeat: 0, provider: 'null', requestedModel: null, budget, taskDigest: digest, promptsDigest: digest }, { seq: 1, at, runId, type: 'run_finished', status: 'completed', flags: [], usageTotals: usage, spentTokens: 0, completions: 0, wallMs: 0, snapshotDigest: null }];
  const record = RunRecordSchema.parse({ schemaVersion: 1, runId, taskId: task.id, arm: 'single', repeat: 0, startedAt: at, finishedAt: at, model: { requested: null, observed: [] }, sampling: { temperature: null, maxOutput: 2048 }, budget, usageTotals: usage, spentTokens: 0, completions: 0, wallMs: 0, status: 'completed', flags: [], exclusion: null, groupResults: null, requirements: [], retention: null, snapshotDigest: null, digests: { task: digest, prompts: digest, matcher: null, hiddenBundle: null }, eventCount: 2, chainHead: GENESIS_HASH, edition: 'SYNTHETIC', tranche: 'DEMO', provider: 'null', approval: null, preregSha256: null });
  return { record, task, events, artifactsByRequirement: Object.fromEntries(task.requirements.map((r) => [r.id, []])) };
}
