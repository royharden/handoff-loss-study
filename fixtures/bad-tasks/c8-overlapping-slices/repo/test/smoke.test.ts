import { describe, expect, it } from 'vitest';
import * as A from '../src/a';
import * as B from '../src/b';

describe('public smoke', () => {
  it('exports the starter API', () => {
    expect(typeof A.createLimiter).toBe('function');
    expect(typeof B.callOnce).toBe('function');
    expect(typeof B.buildHeaders).toBe('function');
  });
});
