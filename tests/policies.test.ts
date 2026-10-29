import { expect, it } from 'vitest';
import { loadTask } from '../src/tasks/load';
import { contextPolicy } from '../src/runner/policies/context';
import { plannerPolicy, implementerPolicy } from '../src/runner/policies/role';
import { singlePolicy } from '../src/runner/policies/single';
import { specBlindPolicy } from '../src/runner/policies/spec-blind';
import { runEpisode } from '../src/runner/episode';
import { MockProvider, mockStepsForArm } from '../src/providers/mock';
import { DEFAULT_RUN_LIMITS } from '../src/core/contracts';
import type { ProviderPort, SandboxPort, ToolCall } from '../src/core/contracts';
import { STUDY_CELLS } from '../src/core/ids';
it('delivers brief to every policy and gives context no peer source path', () => {
  const task = loadTask('tasks/dev/T01');
  for (const policy of [singlePolicy(task), plannerPolicy(task), implementerPolicy(task), contextPolicy(task, 'A'), contextPolicy(task, 'B'), specBlindPolicy(task)]) {
    const brief = policy.messages.flatMap((m) => m.role === 'user' ? m.segments.filter((s) => s.provenance.kind === 'initial_view' && s.provenance.item === 'brief') : []);
    expect(brief[0]?.text).toBe(task.brief);
  }
  const a = contextPolicy(task, 'A'); expect(() => a.workspace.read(task.task.modules.B.path)).toThrow('outside_view');
  expect(implementerPolicy(task).source).toBe(''); expect(specBlindPolicy(task).source).toBe('');
});
it('stops dispatch and grading after public-test cleanup integrity failure, burning T2', async () => {
  const task = loadTask('tasks/dev/T01');
  for (const tranche of ['DEMO', 'T2'] as const) {
    const model = 'in-process-regression';
    const first = mockStepsForArm('single')[0];
    if (first === undefined) throw new Error('missing mock step');
    const calls: ToolCall[] = [
      { id: 'before', name: 'write_file', input: { path: task.task.modules.A.path, text: 'before cleanup failure' } },
      { id: 'test', name: 'run_public_tests', input: {} },
      { id: 'after', name: 'write_file', input: { path: task.task.modules.A.path, text: 'must not run' } },
    ];
    const replay = new MockProvider([{ ...first, requestedModel: model, observedModel: model, message: { text: '', toolCalls: calls } }, { ...first, requestedModel: model, observedModel: model }]);
    let dispatches = 0; let testRuns = 0; let grades = 0;
    // The T2 name exercises live-branch bookkeeping with an in-process fixture, never an API adapter.
    const provider: ProviderPort = { name: tranche === 'T2' ? 'anthropic' : 'mock', complete: (args) => { dispatches += 1; return replay.complete(args); } };
    const sandbox: SandboxPort = { kind: 'docker_pair', grade: async () => { grades += 1; throw new Error('must not grade'); } };
    const result = await runEpisode({ task, arm: 'single', repeat: 0, tranche, provider, model, sandbox,
      publicTests: { run: async () => { testRuns += 1; throw Object.assign(new Error('cleanup unconfirmed'), { integrityStop: true as const }); } },
      budget: { allowanceTokens: 150000, r: 1, limits: { ...DEFAULT_RUN_LIMITS } },
    });
    expect(result.status).toBe('integrity_stop'); expect(result.flags.includes('heldout_burned')).toBe(tranche === 'T2');
    expect(dispatches).toBe(1); expect(testRuns).toBe(1); expect(grades).toBe(0); expect(result.groups).toBeNull();
    expect(new TextDecoder().decode(result.snapshot.files.get(task.task.modules.A.path))).toBe('before cleanup failure');
    expect(result.events.filter((event) => event.type === 'request')).toHaveLength(1);
    expect(result.events.at(-1)).toMatchObject({ type: 'run_finished', status: 'integrity_stop', flags: tranche === 'T2' ? ['heldout_burned'] : [] });
  }
});
it('retains hidden-grading cleanup integrity-stop mapping', async () => {
  const task = loadTask('tasks/dev/T01');
  const result = await runEpisode({ task, arm: 'single', repeat: 0, tranche: 'DEMO', provider: new MockProvider(mockStepsForArm('single')),
    sandbox: { kind: 'docker_pair', grade: async () => { throw Object.assign(new Error('grader cleanup unconfirmed'), { integrityStop: true as const }); } },
    budget: { allowanceTokens: 150000, r: 1, limits: { ...DEFAULT_RUN_LIMITS } },
  });
  expect(result.status).toBe('integrity_stop'); expect(result.groups).toBeNull();
});
it('traverses all six SYNTHETIC policy paths without inventing grades', async () => {
  const task = loadTask('tasks/dev/T01');
  for (const arm of STUDY_CELLS) { const result = await runEpisode({ task, arm, repeat: 0, tranche: 'DEMO', provider: new MockProvider(mockStepsForArm(arm)), budget: { allowanceTokens: 150000, r: 1, limits: { ...DEFAULT_RUN_LIMITS } } }); expect(result.status).toBe('completed'); expect(result.groups).toBeNull(); expect(result.events[0]?.type).toBe('run_started'); expect(result.events.at(-1)?.type).toBe('run_finished'); }
});
