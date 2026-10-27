/** T02 hidden group R1 (negative_constraint, local_A): healthcheck_ping events are excluded. Asserts R1 and C0. */
import { describe, expect, it } from 'vitest';
import { assertC0, normalizeEvents, raw } from './_c0';

describe('R1', () => {
  it('C0 core behaviour', assertC0);
  it('excludes healthcheck_ping events from the output', async () => {
    const events = await normalizeEvents([raw('r1-a', 'acme', 'healthcheck_ping', 3), raw('r1-b', 'acme', 'api_calls', 10)]);
    expect(events.map((e) => e.meter)).not.toContain('healthcheck_ping');
    expect(events.map((e) => e.id)).toEqual(['r1-b']);
  });
});
