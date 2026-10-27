/** Public DEV expectation: R1 and C0, isolated from other policy helpers. */
import { describe, expect, it } from 'vitest';
import { assertC0 } from './_c0';
import { callCandidate } from './_rpc';
describe('R1', () => {
  it('core projection', assertC0);
  it('R1 consumer policy', async () => {
    expect(await callCandidate('src/ticket-view.ts', 'publicFields', [{ 'agentPrivateMemo': 'private', visible: 'ok' }])).toEqual({ visible: 'ok' });
  });
});
