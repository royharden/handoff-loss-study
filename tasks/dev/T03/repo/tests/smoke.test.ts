import { describe, expect, it } from 'vitest';
import { coreKey } from '../src/parcel-values';
import { displaySummary } from '../src/parcel-view';

describe('parcel public surface', () => {
  it('retains the caller identifier', () => {
    expect(coreKey({ id: 'sample', amount: 2, fields: {} })).toBe('sample');
  });
  it('exposes a text projection', () => {
    expect(typeof displaySummary([])).toBe('string');
  });
});
