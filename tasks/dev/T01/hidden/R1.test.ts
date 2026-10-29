/** T01 hidden group R1 (negative_constraint, local_A): x-hook-signature is stripped. Asserts R1 and C0. */
import { describe, expect, it } from 'vitest';
import { assertC0, delivery, retryHeaders } from './_c0';

describe('R1', () => {
  it('C0 core behaviour', assertC0);
  it('strips x-hook-signature from the forwarded headers', async () => {
    const d = delivery('r1', [500], { 'content-type': 'application/json', 'x-hook-signature': 'sha256=5f2c0e', 'x-tenant': 't-9' });
    const headers = await retryHeaders(d);
    expect(Object.keys(headers).map((k) => k.toLowerCase())).not.toContain('x-hook-signature');
    expect(Object.values(headers)).not.toContain('sha256=5f2c0e');
    expect(headers['x-tenant']).toBe('t-9');
  });
});
