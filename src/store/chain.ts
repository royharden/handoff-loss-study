import { z } from 'zod';
import { canonicalize, parseCanonical } from '../core/canonical';
import { chainLink, GENESIS_HASH } from '../core/hash';

export const ChainRowSchema = z.object({ index: z.number().int().nonnegative(), previous: z.string().regex(/^[0-9a-f]{64}$/), hash: z.string().regex(/^[0-9a-f]{64}$/), payload: z.unknown() }).strict();
export type ChainRow = z.infer<typeof ChainRowSchema>;

/** Every event AND the final footer is a payload. The footer's head refers to events only. */
export function encodeChain(payloads: readonly unknown[]): string {
  let previous = GENESIS_HASH;
  return payloads.map((payload, index) => {
    const hash = chainLink(previous, payload);
    const row = canonicalize({ index, previous, hash, payload });
    previous = hash;
    return row;
  }).join('\n') + '\n';
}

export function decodeChain(text: string): ChainRow[] {
  if (!text.endsWith('\n')) throw new Error('truncated JSONL: final newline missing');
  const lines = text.slice(0, -1).split('\n');
  let previous = GENESIS_HASH;
  return lines.map((line, index) => {
    const row = ChainRowSchema.parse(parseCanonical(line));
    if (row.index !== index || row.previous !== previous || row.hash !== chainLink(previous, row.payload)) throw new Error(`chain mismatch at row ${index}`);
    previous = row.hash;
    return row;
  });
}
