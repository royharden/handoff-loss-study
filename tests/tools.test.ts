import { expect, it } from 'vitest';
import type { ToolCall } from '../src/core/contracts';
import { WorkerWorkspace } from '../src/runner/workspace';
import { loadTask } from '../src/tasks/load';
import { singlePolicy } from '../src/runner/policies/single';
import { executeTool } from '../src/runner/tools';
it('refuses traversal, unseen paths, peer writes and symlink source records', () => {
  const bytes = new TextEncoder().encode('original');
  const tree = new Map([['src/a.ts', bytes], ['src/b.ts', bytes], ['src/contracts.ts', bytes]]);
  const workspace = new WorkerWorkspace(tree, [...tree.keys()], ['src/a.ts'], ['src/contracts.ts']);
  expect(() => workspace.read('../spec.md')).toThrow('path_traversal'); expect(() => workspace.read('spec.md')).toThrow('outside_view');
  expect(() => workspace.write('src/b.ts', 'bad')).toThrow('out_of_module'); expect(() => workspace.write('src/contracts.ts', 'bad')).toThrow('protected_file');
  expect(() => new WorkerWorkspace(tree, [...tree.keys()], [], [], ['src/a.ts'])).toThrow('symlink');
  workspace.write('src/a.ts', 'new'); expect(workspace.read('src/a.ts')).toBe('new'); expect(new TextDecoder().decode(tree.get('src/a.ts'))).toBe('original');
});
it('propagates public-test integrity failures instead of returning a recoverable tool error', async () => {
  const policy = singlePolicy(loadTask('tasks/dev/T01'));
  const call: ToolCall = { id: 'public-test', name: 'run_public_tests', input: {} };
  const signal = new AbortController().signal;
  const integrity = Object.assign(new Error('cleanup unconfirmed'), { integrityStop: true as const });
  await expect(executeTool(policy, call, { run: async () => { throw integrity; } }, signal)).rejects.toBe(integrity);
  const ordinary = await executeTool(policy, call, { run: async () => { throw new Error('public test failed'); } }, signal);
  expect(ordinary.outcome).toBe('error');
  expect(ordinary.segments[0]?.text).toBe('public test failed');
});
