/** T02 hidden group R4 (override_default, transfer_B_to_A): quantities are clamped at 64000. Asserts R4 and C0. */
import { describe, expect, it } from 'vitest';
import { assertC0, normalizeEvents, raw } from './_c0';

describe('R4', () => {
  it('C0 core behaviour', assertC0);
  it('clamps a single event at 64000 and keeps 20000 as sent', async () => {
    const events = await normalizeEvents([raw('r4-a', 'acme', 'api_calls', 70000), raw('r4-b', 'acme', 'api_calls', 20000)]);
    const byId = new Map(events.map((e) => [e.id, e.quantity]));
    expect(byId.get('r4-a')).toBe(64000);
    expect(byId.get('r4-b')).toBe(20000);
  });
});
