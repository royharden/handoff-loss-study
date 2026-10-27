/** T02 hidden group R2 (literal_constant, transfer_B_to_A): cpu and vcpu map to vcpu_seconds_v3. Asserts R2 and C0. */
import { describe, expect, it } from 'vitest';
import { assertC0, normalizeEvents, raw } from './_c0';

describe('R2', () => {
  it('C0 core behaviour', assertC0);
  it('maps the raw processor meters to vcpu_seconds_v3', async () => {
    const events = await normalizeEvents([raw('r2-a', 'acme', 'cpu', 30), raw('r2-b', 'acme', 'vcpu', 12)]);
    expect(events.map((e) => e.meter)).toEqual(['vcpu_seconds_v3', 'vcpu_seconds_v3']);
  });
});
