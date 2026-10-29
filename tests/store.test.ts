import { describe, it, expect } from 'vitest';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { encodeChain, decodeChain } from '../src/store/chain';
import { writeRun } from '../src/store/jsonl';
import { verifyRun } from '../src/store/load';
import { ungradedBundle } from './m5-fixture';
import { redactSecrets } from '../src/store/redact';
import { DurableSpendLedger } from '../src/store/spend';
describe('M5 journal durability and footer chain', () => {
  it('keeps unknown reservations charged, enforces cap and rejects reused settlements/corruption', async () => {
    const root = mkdtempSync(join(tmpdir(), 'hls-spend-'));
    try {
      const path = join(root, 'spend.jsonl'); const ledger = new DurableSpendLedger(path, 'synthetic-scope');
      const id = await ledger.reserve(5, 6);
      await expect(ledger.reserve(2, 6)).rejects.toThrow();
      await ledger.settle(id, 1);
      await expect(ledger.settle(id, 1)).rejects.toThrow();
      await ledger.reserve(5, 6);
      await expect(ledger.reserve(1, 6)).rejects.toThrow();
      writeFileSync(path, readFileSync(path, 'utf8').replace('"boundUsd":5', '"boundUsd":4'));
      await expect(ledger.reserve(0, 6)).rejects.toThrow();
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
  it('redacts actual loaded values recursively including tool keys; it never reads credentials', () => {
    const fake = 'SYNTHETIC-key-value';
    expect(JSON.stringify(redactSecrets({ text: `prefix ${fake}`, tool: { [fake]: [fake] } }, [fake]))).not.toContain(fake);
    expect(redactSecrets('not a secret', [fake])).toBe('not a secret');
  });
  it('hashes footer bytes as well as all events; truncation and reordering fail', () => {
    const journal = encodeChain([{ type: 'event', value: 1 }, { type: 'footer', value: 2 }]);
    expect(decodeChain(journal)).toHaveLength(2);
    expect(() => decodeChain(journal.replace('"value":2', '"value":3'))).toThrow();
    expect(() => decodeChain(journal.slice(0, -1))).toThrow();
    expect(() => decodeChain(journal.trimEnd().split('\n').reverse().join('\n') + '\n')).toThrow();
  });
  it('persists a new complete run and refuses overwrite; evidence changes fail', () => {
    const root = mkdtempSync(join(tmpdir(), 'hls-store-'));
    try {
      const dir = join(root, 'run'); writeRun(dir, ungradedBundle());
      expect(verifyRun(dir).scoreRecomputed).toBe(false);
      expect(() => writeRun(dir, ungradedBundle())).toThrow();
      const path = join(dir, 'evidence.json');
      writeFileSync(path, readFileSync(path, 'utf8').replace('"title":', '"changedTitle":'));
      expect(() => verifyRun(dir)).toThrow();
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
});
