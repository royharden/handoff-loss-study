import { openSync, closeSync, readFileSync, appendFileSync, existsSync, fsyncSync, unlinkSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { canonicalize } from '../core/canonical';
import { chainLink, GENESIS_HASH } from '../core/hash';
import { decodeChain } from './chain';

const Entry = z.discriminatedUnion('type', [z.object({ type: z.literal('reserve'), id: z.string(), boundUsd: z.number().nonnegative().finite(), scopeSha256: z.string() }).strict(), z.object({ type: z.literal('settle'), id: z.string(), actualUsd: z.number().nonnegative().finite() }).strict()]);
/** Append-only fsynced all-attempt USD ledger. An unsettled reservation stays fully charged. */
export class DurableSpendLedger {
  readonly path: string;
  readonly scopeSha256: string;
  constructor(path: string, scopeSha256: string) { this.path = path; this.scopeSha256 = scopeSha256; }
  private transact<T>(action: (state: { charged: number; reservations: Map<string, number>; settled: Set<string> }, append: (entry: z.infer<typeof Entry>) => void) => T): T {
    const lockPath = `${this.path}.lock`;
    const lock = openSync(lockPath, 'wx'); // no waiting or stale-lock stealing
    try {
      const rows = existsSync(this.path) ? decodeChain(readFileSync(this.path, 'utf8')) : [];
      let charged = 0; const reservations = new Map<string, number>(); const settled = new Set<string>();
      for (const row of rows) {
        const entry = Entry.parse(row.payload);
        if (entry.type === 'reserve') {
          if (entry.scopeSha256 !== this.scopeSha256 || reservations.has(entry.id)) throw new Error('spend ledger scope/identity mismatch');
          reservations.set(entry.id, entry.boundUsd); charged += entry.boundUsd;
        } else {
          const bound = reservations.get(entry.id);
          if (bound === undefined || settled.has(entry.id)) throw new Error('invalid spend settlement');
          charged += entry.actualUsd - bound; settled.add(entry.id);
        }
      }
      let head = rows.at(-1)?.hash ?? GENESIS_HASH; let index = rows.length;
      return action({ charged, reservations, settled }, (entry) => {
        const hash = chainLink(head, entry);
        appendFileSync(this.path, canonicalize({ index, previous: head, hash, payload: entry }) + '\n', { encoding: 'utf8', flag: 'a' });
        const fd = openSync(this.path, 'a'); try { fsyncSync(fd); } finally { closeSync(fd); }
        index += 1; head = hash;
      });
    } finally { closeSync(lock); unlinkSync(lockPath); }
  }
  async reserve(boundUsd: number, maxUsd: number): Promise<string> {
    if (![boundUsd, maxUsd].every((x) => Number.isFinite(x) && x >= 0)) throw new Error('invalid USD bound');
    return this.transact((state, append) => {
      if (state.charged + boundUsd > maxUsd) throw new Error('durable spend + bound exceeds approval');
      const id = randomUUID(); append({ type: 'reserve', id, boundUsd, scopeSha256: this.scopeSha256 }); return id;
    });
  }
  async settle(id: string, actualUsd: number): Promise<void> {
    this.transact((state, append) => {
      if (!Number.isFinite(actualUsd) || actualUsd < 0 || !state.reservations.has(id) || state.settled.has(id)) throw new Error('invalid spend settlement');
      append({ type: 'settle', id, actualUsd });
    });
  }
}
