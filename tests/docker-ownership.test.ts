import { describe, expect, it } from 'vitest';
import { dockerArgs } from '../src/sandbox/docker';
import type { AgentPortsIdentity } from '../src/sandbox/docker';

// Synthetic argv-only identities: these do not register a ledger claim or start Docker.
const identity: AgentPortsIdentity = { project: 'synthetic-hls', instance: 'argv-test', owner: 'synthetic-owner' };
const image = `hls-test@sha256:${'a'.repeat(64)}`;

describe('container ledger identity in generated argv', () => {
  for (const kind of ['candidate', 'grader', 'public'] as const) {
    it(`labels ${kind} with the supplied ledger claim and preserves isolation flags`, () => {
      const args = dockerArgs({ ownerRunId: 'synthetic-run', agentPorts: identity, name: `hls-${kind}-test`, uid: kind === 'grader' ? 10002 : 10001, image,
        mounts: kind === 'grader' ? [{ source: 'synthetic-hidden', target: '/hidden', readOnly: true }, { source: 'synthetic-results', target: '/results', readOnly: false }] : [{ source: 'synthetic-source', target: '/candidate', readOnly: true }],
        command: ['node', 'synthetic-entry.ts'] });
      const labels = args.flatMap((arg, index) => arg === '--label' ? [args[index + 1]] : []);
      expect(labels).toEqual(['hls.owner=synthetic-run', 'hls.app=handoff-loss-study', 'agentports.project=synthetic-hls', 'agentports.instance=argv-test', 'agentports.owner=synthetic-owner']);
      expect(args.slice(args.indexOf('--pull'), args.indexOf('--pull') + 2)).toEqual(['--pull', 'never']);
      expect(args.slice(args.indexOf('--network'), args.indexOf('--network') + 2)).toEqual(['--network', 'none']);
      expect(args).toContain('--read-only');
      expect(args).toContain('no-new-privileges:true');
    });
  }

  it('refuses missing ledger identity or any empty, unsafe or placeholder field before spawn', () => {
    const invalid: unknown[] = [undefined, null];
    for (const key of ['project', 'instance', 'owner'] as const) {
      for (const value of [undefined, '', ' ', 'unsafe/value', '<PLACEHOLDER_AGENT_PORTS_ID>', 'PLACEHOLDER_AGENT_PORTS_ID']) invalid.push({ ...identity, [key]: value });
    }
    for (const agentPorts of invalid) {
      expect(() => dockerArgs({ ownerRunId: 'synthetic-run', agentPorts: agentPorts as AgentPortsIdentity, name: 'hls-candidate-test', uid: 10001, image, mounts: [], command: [] })).toThrow('actual agent-ports project/instance/owner identity required');
    }
  });
});
