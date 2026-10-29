import { describe, expect, it, vi } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ApprovalSchema } from '../src/core/contracts';
import { hashCanonical } from '../src/core/hash';
import { decodeChain, encodeChain } from '../src/store/chain';
import { initializeLiveState, LiveAttempt, LiveStateJournal } from '../src/store/live-state';

// SOURCE ONLY in Dirty Mode: all files below are test-owned synthetic state, never real approvals/heldout data.
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'hls-live-state-'));
  const product = join(root, 'product'); const state = join(root, 'operator-state');
  mkdirSync(product); mkdirSync(state); initializeLiveState(state);
  return { root, product, state, journal: new LiveStateJournal(state, product) };
}
function approval(decision: string, tranche: 'T0' | 'T1' | 'T2' = 'T2', maxUsd = 40) {
  return ApprovalSchema.parse({ schemaVersion: 1, tranche, model: 'synthetic-model', cells: ['single'], tasks: [tranche === 'T2' ? 'H01' : 'T01'], repeats: 1, specBlindRunsPerTask: 0, maxTokens: 100, maxUsd, issuedAt: '2026-10-26T00:00:00Z', expiresAt: '2026-10-28T00:00:00Z', approver: { name: 'SYNTHETIC', decisionRef: `synthetic:${decision}`, decisionSha256: hashCanonical(decision) }, priceTableSha256: hashCanonical('synthetic prices') });
}
const edition = { preregSha256: hashCanonical('synthetic prereg metadata'), heldoutSha256: hashCanonical('synthetic manifest metadata only') };
const dev = { preregSha256: null, heldoutSha256: null };
const carryEdition = { sealedPairsSha256: hashCanonical('opaque sealed edition identity only'), matcherSha256: hashCanonical('matcher edition A'), publicPairsSha256: hashCanonical('public metadata pin A') };

describe('sealed carry stable custody (M5-R2 regression SOURCE ONLY)', () => {
  it.each(['conformance_passed', 'conformance_failed', 'sealed_load_failed'] as const)('retains %s across new receipts, matcher/public pins and approval decisions', (outcome) => {
    const f = fixture();
    try {
      f.journal.claimCarry(carryEdition, join(f.root, 'receipts-a'));
      f.journal.finishCarry(carryEdition.sealedPairsSha256, outcome);
      const reopened = new LiveStateJournal(f.state, f.product);
      expect(() => reopened.claimCarry(carryEdition, join(f.root, 'receipts-b'))).toThrow(/already consumed/);
      expect(() => reopened.claimCarry({ ...carryEdition, matcherSha256: hashCanonical('matcher B'), publicPairsSha256: hashCanonical('public B') }, join(f.root, 'receipts-c'))).toThrow(/already consumed/);
      expect(() => reopened.finishCarry(carryEdition.sealedPairsSha256, outcome)).toThrow(/invalid sealed carry finish/);
      // Carry claims neither consume approvals nor erase app accounting; the shared journal remains usable.
      const devAttempt = reopened.start(approval('fresh decision', 'T0'), 1, dev, join(f.root, 'dev'));
      devAttempt.finish('synthetic dev stop');
      expect(() => reopened.claimCarry(carryEdition, join(f.root, 'receipts-d'))).toThrow(/already consumed/);
      expect(decodeChain(readFileSync(f.journal.path, 'utf8')).map((r) => r.payload)).toContainEqual({ type: 'carry_finish', sealedPairsSha256: carryEdition.sealedPairsSha256, outcome });
      const newEdition = { ...carryEdition, matcherSha256: hashCanonical('matcher B'), sealedPairsSha256: hashCanonical('new opaque sealed identity') };
      expect(() => reopened.claimCarry(newEdition, join(f.root, 'receipts-e'))).not.toThrow();
    } finally { rmSync(f.root, { recursive: true, force: true }); }
  });
  it('a crash with only the fsynced claim consumes the sealed digest before any receipt/result or finish exists', () => {
    const f = fixture();
    try {
      f.journal.claimCarry(carryEdition, join(f.root, 'never-created-receipts-a'));
      expect(() => new LiveStateJournal(f.state, f.product).claimCarry({ ...carryEdition, matcherSha256: hashCanonical('changed after crash') }, join(f.root, 'never-created-receipts-b'))).toThrow(/already consumed/);
      const payloads = decodeChain(readFileSync(f.journal.path, 'utf8')).map((r) => r.payload);
      expect(payloads).toHaveLength(2); // activation + durable start, no finish/result required
      expect(payloads[1]).toEqual({ type: 'carry_start', ...carryEdition, destination: join(f.root, 'never-created-receipts-a') });
    } finally { rmSync(f.root, { recursive: true, force: true }); }
  });
  it('requires valid existing authority and an exclusive lock; no receipt-based initialization or lock stealing', () => {
    const f = fixture();
    try {
      const empty = join(f.root, 'empty'); mkdirSync(empty);
      expect(() => new LiveStateJournal(empty, f.product).claimCarry(carryEdition, join(f.root, 'receipts'))).toThrow();
      writeFileSync(`${f.journal.path}.lock`, 'synthetic interrupted claim owner');
      expect(() => f.journal.claimCarry(carryEdition, join(f.root, 'receipts'))).toThrow();
      expect(readFileSync(`${f.journal.path}.lock`, 'utf8')).toBe('synthetic interrupted claim owner');
      rmSync(`${f.journal.path}.lock`); // test-owned cleanup, never production recovery
      expect(() => f.journal.claimCarry({ ...carryEdition, sealedPairsSha256: 'invalid' }, join(f.root, 'receipts'))).toThrow();
      writeFileSync(f.journal.path, 'malformed\n');
      expect(() => new LiveStateJournal(f.state, f.product).claimCarry(carryEdition, join(f.root, 'receipts'))).toThrow();
    } finally { rmSync(f.root, { recursive: true, force: true }); }
  });
});

describe('operator live authority independent of result destination (M5-R1 regression source)', () => {
  it('two output directories cannot repeat an attempted/burned immutable T2 edition or reset approval spend', async () => {
    const f = fixture(); const dispatch = vi.fn();
    try {
      const first = f.journal.start(approval('same'), 5, edition, join(f.root, 'output-a'));
      await first.reserve(5, 40); dispatch(); // simulated unknown/failed request remains charged
      first.finish('reservation_overrun: synthetic integrity stop');
      const reopened = new LiveStateJournal(f.state, f.product);
      expect(() => { reopened.start(approval('same'), 5, edition, join(f.root, 'output-b')); dispatch(); }).toThrow(/already attempted/);
      expect(() => reopened.start({ ...approval('same'), approver: { ...approval('same').approver, decisionRef: 'synthetic:alternate-reference-to-same-decision' } }, 5, edition, join(f.root, 'output-b'))).toThrow(/already attempted/);
      expect(() => reopened.start(approval('new approval'), 5, edition, join(f.root, 'output-b'))).toThrow(/consumed or burned/);
      expect(() => reopened.start(approval('amended prereg'), 5, { ...edition, preregSha256: hashCanonical('amendment') }, join(f.root, 'output-b'))).toThrow(/consumed or burned/);
      expect(dispatch).toHaveBeenCalledTimes(1);
      const payloads = decodeChain(readFileSync(f.journal.path, 'utf8')).map((r) => r.payload);
      expect(payloads).toContainEqual({ type: 'finish', attemptId: first.id, status: 'burned', reason: 'reservation_overrun: synthetic integrity stop' });
      // Unknown $5 survives finish/reopen and a new approval: $36 would exceed the total app ceiling.
      expect(() => reopened.start(approval('dev', 'T1'), 36, dev, join(f.root, 'output-c'))).toThrow(/cap/);
    } finally { rmSync(f.root, { recursive: true, force: true }); }
  });
  it('a crash after start consumes T2 even before a result file or finish marker exists', () => {
    const f = fixture();
    try {
      f.journal.start(approval('crashed'), 1, edition, join(f.root, 'absent-output-a'));
      expect(() => new LiveStateJournal(f.state, f.product).start(approval('replacement'), 1, edition, join(f.root, 'absent-output-b'))).toThrow(/consumed or burned/);
    } finally { rmSync(f.root, { recursive: true, force: true }); }
  });
  it('sums different approvals/tranches app-wide, retaining unknown/failed charges and actual settlements', async () => {
    const f = fixture();
    try {
      const smoke = f.journal.start(approval('smoke', 'T0', 20), 20, dev, join(f.root, 'a'));
      const known = await smoke.reserve(20, 20); await smoke.settle(known, 15); smoke.finish('synthetic transport failure after billed request');
      const pilot = f.journal.start(approval('pilot', 'T1', 20), 20, dev, join(f.root, 'b'));
      await pilot.reserve(20, 20); pilot.finish('synthetic timeout: usage unknown');
      expect(() => f.journal.start(approval('over app ceiling'), 6, edition, join(f.root, 'c'))).toThrow(/cap/);
      const heldout = f.journal.start(approval('fits remaining', 'T2', 10), 5, edition, join(f.root, 'd'));
      await heldout.reserve(5, 10);
      await expect(heldout.reserve(0.01, 10)).rejects.toThrow(/cap/);
    } finally { rmSync(f.root, { recursive: true, force: true }); }
  });
  it('enforces the stored approval/tranche cap across handles; caller caps and duplicate settlements cannot replace it', async () => {
    const f = fixture();
    try {
      const a = f.journal.start(approval('bounded', 'T0', 6), 6, dev, join(f.root, 'a'));
      const otherOutputHandle = new LiveAttempt(new LiveStateJournal(f.state, f.product), a.id);
      const known = await a.reserve(4, 6); await a.settle(known, 2);
      await expect(otherOutputHandle.settle(known, 0)).rejects.toThrow();
      await otherOutputHandle.reserve(4, 6); // unsettled, fully charged: total $6
      await expect(a.reserve(1, 6)).rejects.toThrow(/cap/);
      await expect(a.reserve(1, 40)).rejects.toThrow(/cap/);
      expect(otherOutputHandle.charged()).toBe(6);
    } finally { rmSync(f.root, { recursive: true, force: true }); }
  });
  it('actual overrun stays recorded and prevents any further approval/app reservation', async () => {
    const f = fixture();
    try {
      const a = f.journal.start(approval('overrun', 'T0', 6), 6, dev, join(f.root, 'a'));
      const id = await a.reserve(6, 6); await a.settle(id, 41);
      expect(a.charged()).toBe(41);
      await expect(a.reserve(0, 6)).rejects.toThrow(/cap/);
      expect(() => f.journal.start(approval('new', 'T1'), 0, dev, join(f.root, 'b'))).toThrow(/cap/);
    } finally { rmSync(f.root, { recursive: true, force: true }); }
  });
  it('missing/malformed authority and stale/concurrent locks fail closed; no automatic init or stealing', async () => {
    const f = fixture();
    try {
      const empty = join(f.root, 'empty'); mkdirSync(empty);
      expect(() => new LiveStateJournal(empty, f.product)).toThrow();
      expect(() => new LiveStateJournal(join(f.root, 'absent'), f.product)).toThrow();
      expect(() => new LiveStateJournal(f.product, f.product)).toThrow(/outside product/);
      const a = f.journal.start(approval('lock', 'T0'), 1, dev, join(f.root, 'a'));
      writeFileSync(`${f.journal.path}.lock`, 'synthetic crashed owner');
      await expect(a.reserve(1, 40)).rejects.toThrow();
      expect(readFileSync(`${f.journal.path}.lock`, 'utf8')).toBe('synthetic crashed owner');
      rmSync(`${f.journal.path}.lock`); // test-owned cleanup only; production never steals a lock
      writeFileSync(f.journal.path, 'malformed\n');
      expect(() => new LiveStateJournal(f.state, f.product)).toThrow();
      writeFileSync(f.journal.path, encodeChain([{ type: 'activate', schemaVersion: 1, app: 'handoff-loss-study', appMaxUsd: 41 }]));
      expect(() => new LiveStateJournal(f.state, f.product)).toThrow();
    } finally { rmSync(f.root, { recursive: true, force: true }); }
  });
});
