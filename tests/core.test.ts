/**
 * M1 core tests: canonical JSON and hashing. WRITTEN, NEVER RUN (Dirty Mode construction).
 * Deferred command: `npx vitest run tests/core.test.ts` (docs/DEFERRED-VALIDATION.md DV-M1-04).
 */
import { describe, expect, it } from 'vitest';
import { CanonicalJsonError, canonicalize, isCanonical, parseCanonical } from '../src/core/canonical';
import { GENESIS_HASH, chainHead, chainLink, digestEquals, hashCanonical, sha256Hex } from '../src/core/hash';
import { parseFixedBrief } from '../src/core/handoff-schema';
import { makeRunId } from '../src/core/ids';
import {
  ApprovalSchema,
  EditionMixError,
  JsonValueSchema,
  UsageSchema,
  assertSingleEdition,
  heldoutAllowance,
  nearestRankP75,
  reservationTokens,
} from '../src/core/contracts';

describe('canonicalize', () => {
  it('sorts object keys at every depth and drops whitespace', () => {
    expect(canonicalize({ b: 1, a: { d: [3, { z: true, y: null }], c: 'x' } })).toBe(
      '{"a":{"c":"x","d":[3,{"y":null,"z":true}]},"b":1}',
    );
  });

  it('is independent of key insertion order', () => {
    const one = { alpha: 1, beta: 2, gamma: [1, 2] };
    const two = { gamma: [1, 2], beta: 2, alpha: 1 };
    expect(canonicalize(one)).toBe(canonicalize(two));
  });

  it('orders keys by UTF-16 code unit (uppercase before lowercase)', () => {
    expect(canonicalize({ b: 0, B: 0, a: 0, A: 0 })).toBe('{"A":0,"B":0,"a":0,"b":0}');
  });

  it('keeps array order', () => {
    expect(canonicalize([3, 1, 2])).toBe('[3,1,2]');
  });

  it('serialises strings and numbers like JSON.stringify', () => {
    expect(canonicalize({ s: 'line\n"q"', n: 1.5, i: 1e21, z: 0 })).toBe('{"i":1e+21,"n":1.5,"s":"line\\n\\"q\\"","z":0}');
  });

  it('rejects -0', () => {
    expect(() => canonicalize(-0)).toThrow(CanonicalJsonError);
    expect(() => canonicalize({ a: [1, -0] })).toThrow(/-0 is not allowed/);
  });

  it('rejects NaN and infinities', () => {
    expect(() => canonicalize(Number.NaN)).toThrow(/NaN/);
    expect(() => canonicalize({ x: Number.POSITIVE_INFINITY })).toThrow(CanonicalJsonError);
    expect(() => canonicalize([Number.NEGATIVE_INFINITY])).toThrow(CanonicalJsonError);
  });

  it('rejects undefined at top level, as a property value and as an array element', () => {
    expect(() => canonicalize(undefined)).toThrow(/undefined/);
    expect(() => canonicalize({ a: 1, b: undefined })).toThrow(/at \$\.b/);
    expect(() => canonicalize([1, undefined])).toThrow(/at \$\[1\]/);
  });

  it('rejects sparse arrays, cycles, bigint and non-plain objects', () => {
    // eslint-disable-next-line no-sparse-arrays
    expect(() => canonicalize([1, , 3])).toThrow(/sparse/);
    const cyclic: Record<string, unknown> = {};
    cyclic['self'] = cyclic;
    expect(() => canonicalize(cyclic)).toThrow(/cycle/);
    expect(() => canonicalize({ n: 10n })).toThrow(/bigint/);
    expect(() => canonicalize({ d: new Date(0) })).toThrow(/non-plain/);
    expect(() => canonicalize(new Map())).toThrow(/non-plain/);
  });

  it('allows repeated (non-cyclic) references', () => {
    const shared = { k: 1 };
    expect(canonicalize({ a: shared, b: shared })).toBe('{"a":{"k":1},"b":{"k":1}}');
  });

  it('parseCanonical accepts canonical text and rejects non-canonical text', () => {
    expect(parseCanonical('{"a":1,"b":[true,null]}')).toEqual({ a: 1, b: [true, null] });
    expect(() => parseCanonical('{"b":1,"a":2}')).toThrow(CanonicalJsonError);
    expect(() => parseCanonical('{ "a": 1 }')).toThrow(CanonicalJsonError);
    expect(() => parseCanonical('-0')).toThrow(CanonicalJsonError);
    expect(isCanonical('{"a":1}')).toBe(true);
    expect(isCanonical('{"a":1.0}')).toBe(false);
    expect(isCanonical('not json')).toBe(false);
  });
});

describe('sha256', () => {
  it('matches the FIPS 180-2 "abc" vector', () => {
    expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('matches the empty-string vector and hashes strings as UTF-8', () => {
    expect(sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(sha256Hex('abc')).toBe(sha256Hex(new TextEncoder().encode('abc')));
  });

  it('hashCanonical is independent of key order', () => {
    expect(hashCanonical({ x: 1, y: 2 })).toBe(hashCanonical({ y: 2, x: 1 }));
    expect(hashCanonical({ x: 1 })).toBe(sha256Hex('{"x":1}'));
  });

  it('chain links depend on the previous hash and the payload', () => {
    const a = chainLink(GENESIS_HASH, { seq: 0 });
    const b = chainLink(a, { seq: 1 });
    expect(chainHead([{ seq: 0 }, { seq: 1 }])).toBe(b);
    expect(chainHead([{ seq: 1 }, { seq: 0 }])).not.toBe(b);
    expect(a).toBe(sha256Hex(`${GENESIS_HASH}\n{"seq":0}`));
    expect(() => chainLink('nothex', {})).toThrow();
  });

  it('digestEquals compares exactly', () => {
    expect(digestEquals(GENESIS_HASH, '0'.repeat(64))).toBe(true);
    expect(digestEquals(GENESIS_HASH, `${'0'.repeat(63)}1`)).toBe(false);
  });
});

describe('core contracts (smoke)', () => {
  it('D7 reservation formula', () => {
    expect(reservationTokens({ requestBytes: 1000, messageCount: 3, maxOutput: 2048, r: 1.25, perMessageOverheadTokens: 64 })).toBe(
      1250 + 192 + 2048,
    );
  });

  it('D6 nearest-rank P75 and held-out allowance', () => {
    expect(nearestRankP75([10, 20, 30, 40])).toBe(30);
    expect(heldoutAllowance([30_000, 31_000, 32_000, 33_000])).toEqual({ tokens: 70_000, ceilingBinds: false });
    expect(heldoutAllowance([90_000, 91_000, 92_000, 93_000])).toEqual({ tokens: 150_000, ceilingBinds: true });
  });

  it('Usage requires every field and reasoning <= output', () => {
    const ok = { input: 1, output: 2, cacheRead: 0, cacheWrite: 0, reasoning: 0, source: 'provider_reported' };
    expect(UsageSchema.safeParse(ok).success).toBe(true);
    expect(UsageSchema.safeParse({ ...ok, reasoning: 3 }).success).toBe(false);
    expect(UsageSchema.safeParse({ ...ok, input: -1 }).success).toBe(false);
  });

  it('fixed brief parsing is strict', () => {
    const brief = {
      objective: 'o',
      requirements: [],
      decisions_overrides: [],
      prohibitions: [],
      interfaces: [],
      open_items: [],
      files_touched: [],
    };
    expect(parseFixedBrief(JSON.stringify(brief)).ok).toBe(true);
    expect(parseFixedBrief(JSON.stringify({ ...brief, extra: 1 })).ok).toBe(false);
    expect(parseFixedBrief('{not json').ok).toBe(false);
  });

  it('run ids and edition mixing', () => {
    expect(makeRunId({ tranche: 'T1', taskId: 'T03', arm: 'role/fixed_brief', repeat: 1 })).toBe('T1.T03.role-fixed.r1');
    expect(assertSingleEdition([{ edition: 'SYNTHETIC' }, { edition: 'SYNTHETIC' }])).toBe('SYNTHETIC');
    expect(() => assertSingleEdition([{ edition: 'SYNTHETIC' }, { edition: 'LIVE' }])).toThrow(EditionMixError);
  });

  it('approval requires a decision reference and a future expiry', () => {
    const base = {
      schemaVersion: 1,
      tranche: 'T0',
      model: 'model-id',
      cells: ['single'],
      specBlindRunsPerTask: 0,
      tasks: ['T01'],
      repeats: 1,
      maxTokens: 150_000,
      maxUsd: 1,
      issuedAt: '2026-01-01T00:00:00Z',
      expiresAt: '2026-01-02T00:00:00Z',
      approver: { name: 'n', decisionRef: 'ref', decisionSha256: null },
      priceTableSha256: '0'.repeat(64),
    };
    expect(ApprovalSchema.safeParse(base).success).toBe(true);
    expect(ApprovalSchema.safeParse({ ...base, approver: { ...base.approver, decisionRef: '' } }).success).toBe(false);
    expect(ApprovalSchema.safeParse({ ...base, expiresAt: base.issuedAt }).success).toBe(false);
  });
});

describe('JsonValueSchema (M2: -0 rejected consistently with canonical JSON)', () => {
  it('rejects -0 at any depth and accepts 0', () => {
    expect(JsonValueSchema.safeParse(-0).success).toBe(false);
    expect(JsonValueSchema.safeParse({ a: [1, -0] }).success).toBe(false);
    expect(JsonValueSchema.safeParse({ a: [1, 0] }).success).toBe(true);
  });
});
