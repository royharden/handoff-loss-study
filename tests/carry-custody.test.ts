import { describe, expect, it, vi } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { studyMain } from '../cli/study';
import type { LiveActivationPort } from '../cli/study';
import { sha256Hex } from '../src/core/hash';
import { decodeChain } from '../src/store/chain';
import { initializeLiveState } from '../src/store/live-state';

// SOURCE ONLY / NOT EXECUTED. Exercise command custody with metadata and an opaque loader stub.
// The public parser is narrowly replaced with a metadata parser: these are not carry-conformance
// pairs, expected answers or semantic labels. Real conformance still requires independent custodian data.
vi.mock('../src/core/contracts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/core/contracts')>();
  const { z } = await import('zod');
  return { ...actual, CarryPairSchema: z.object({ id: z.string(), set: z.literal('custodian_public') }).strict() };
});
const pins = vi.hoisted(() => ({ matcher: 'a'.repeat(64) }));
vi.mock('../src/store/prereg', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/store/prereg')>();
  return { ...actual, sourceHash: () => pins.matcher };
});

function fixture(provision = true) {
  const root = mkdtempSync(join(tmpdir(), 'hls-carry-custody-'));
  const product = join(root, 'product'); const state = join(root, 'operator-state');
  mkdirSync(product); mkdirSync(state);
  if (provision) initializeLiveState(state); // test-only fixture provisioning, never activation
  const publicPath = join(root, 'opaque-public-metadata.json'); const freezePath = join(root, 'freeze-metadata.json');
  writeFileSync(publicPath, JSON.stringify(Array.from({ length: 40 }, (_, id) => ({ id: `metadata-${id}`, set: 'custodian_public' }))));
  const sealedPairsSha256 = 'b'.repeat(64);
  function freeze(matcher = 'a'.repeat(64), decisionRef = 'synthetic:decision-A') {
    pins.matcher = matcher;
    writeFileSync(freezePath, JSON.stringify({ matcherSha256: matcher, publicPairsSha256: sha256Hex(readFileSync(publicPath)), sealedPairsSha256, frozenAt: '2000-01-01T00:00:00Z', custodianName: 'SYNTHETIC metadata only', royDecisionRef: decisionRef }));
  }
  freeze();
  const args = (receipt: string) => ['check', 'carry', '--public', publicPath, '--freeze', freezePath, '--receipt-dir', join(root, receipt)];
  const port = (loadSealedCarryPairs: NonNullable<LiveActivationPort['loadSealedCarryPairs']>): LiveActivationPort => ({ stateRoot: state, workRoot: join(root, 'unused-work'), images: { candidate: 'unused', grader: 'unused', episode: 'unused' }, verifyRoyDecision: async () => false, authorizeContainers: async () => false, loadSealedCarryPairs });
  return { root, product, state, sealedPairsSha256, freeze, args, port };
}

describe('check carry command claims stable sealed custody before opening (M5-R2)', () => {
  it('two receipt directories and a changed matcher/decision cannot repeat a loader failure before result', async () => {
    const f = fixture();
    const privateDiagnostic = 'opaque custodian diagnostic must not escape';
    const loader = vi.fn(async (): Promise<{ pairs: unknown; fileSha256: string }> => {
      // Loader can observe the durable start before it is ever invoked; no sealed bytes are supplied.
      expect(decodeChain(readFileSync(join(f.state, 'live-state.jsonl'), 'utf8')).map((r) => r.payload)).toContainEqual({ type: 'carry_start', sealedPairsSha256: f.sealedPairsSha256, matcherSha256: pins.matcher, publicPairsSha256: sha256Hex(readFileSync(join(f.root, 'opaque-public-metadata.json'))), destination: join(f.root, 'receipts-a') });
      throw new Error(privateDiagnostic);
    });
    try {
      await expect(studyMain(f.args('receipts-a'), f.product, f.port(loader))).rejects.toThrow(/sealed_load_failed/);
      expect(existsSync(join(f.root, 'receipts-a', 'carry-once-result.json'))).toBe(false);
      await expect(studyMain(f.args('receipts-b'), f.product, f.port(loader))).rejects.toThrow(/already consumed/);
      f.freeze('c'.repeat(64), 'synthetic:decision-B');
      await expect(studyMain(f.args('receipts-c'), f.product, f.port(loader))).rejects.toThrow(/already consumed/);
      expect(loader).toHaveBeenCalledTimes(1);
      expect(loader).toHaveBeenCalledWith(f.sealedPairsSha256);
      const journal = readFileSync(join(f.state, 'live-state.jsonl'), 'utf8');
      expect(journal).not.toContain(privateDiagnostic);
      expect(decodeChain(journal).map((r) => r.payload)).toContainEqual({ type: 'carry_finish', sealedPairsSha256: f.sealedPairsSha256, outcome: 'sealed_load_failed' });
    } finally { rmSync(f.root, { recursive: true, force: true }); }
  });
  it('an interrupted opaque loader leaves only the claim and refuses a second directory before a result', async () => {
    const f = fixture(); let opened: () => void = () => undefined;
    const opening = new Promise<void>((resolve) => { opened = resolve; });
    const loader = vi.fn(async (): Promise<{ pairs: unknown; fileSha256: string }> => {
      opened(); return await new Promise<never>(() => { /* model process disappearance: no response or finish */ });
    });
    try {
      void studyMain(f.args('receipts-a'), f.product, f.port(loader));
      await opening;
      f.freeze('c'.repeat(64));
      await expect(studyMain(f.args('receipts-b'), f.product, f.port(loader))).rejects.toThrow(/already consumed/);
      expect(loader).toHaveBeenCalledTimes(1);
      expect(existsSync(join(f.root, 'receipts-a', 'carry-once-result.json'))).toBe(false);
      expect(decodeChain(readFileSync(join(f.state, 'live-state.jsonl'), 'utf8'))).toHaveLength(2);
    } finally { rmSync(f.root, { recursive: true, force: true }); }
  });
  it('refuses missing stable authority without initializing it or invoking the loader', async () => {
    const f = fixture(false);
    const loader = vi.fn(async (): Promise<{ pairs: unknown; fileSha256: string }> => { throw new Error('must never open'); });
    try {
      await expect(studyMain(f.args('receipts-a'), f.product, f.port(loader))).rejects.toThrow();
      expect(loader).not.toHaveBeenCalled();
      expect(existsSync(join(f.state, 'live-state.jsonl'))).toBe(false);
      expect(existsSync(join(f.root, 'receipts-a'))).toBe(false);
    } finally { rmSync(f.root, { recursive: true, force: true }); }
  });
  it('a receipt write failure consumes the edition without invoking the opaque loader', async () => {
    const f = fixture();
    const loader = vi.fn(async (): Promise<{ pairs: unknown; fileSha256: string }> => { throw new Error('must never open'); });
    try {
      writeFileSync(join(f.root, 'blocked-receipts'), 'presentation path is a file');
      await expect(studyMain(f.args('blocked-receipts'), f.product, f.port(loader))).rejects.toThrow(/receipt_write_failed/);
      await expect(studyMain(f.args('receipts-b'), f.product, f.port(loader))).rejects.toThrow(/already consumed/);
      expect(loader).not.toHaveBeenCalled();
      expect(decodeChain(readFileSync(join(f.state, 'live-state.jsonl'), 'utf8')).map((r) => r.payload)).toContainEqual({ type: 'carry_finish', sealedPairsSha256: f.sealedPairsSha256, outcome: 'receipt_write_failed' });
    } finally { rmSync(f.root, { recursive: true, force: true }); }
  });
});
