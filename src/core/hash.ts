/**
 * SHA-256 helpers (PLAN.md §5, D24, M1). Uses node:crypto only; no network.
 *
 * Strings are hashed as their UTF-8 bytes. Hash-chain links (used by the M5 store) are defined here
 * so that the record format and `hls verify` share one definition.
 */
import { createHash } from 'node:crypto';
import { canonicalize } from './canonical';

/** Lower-case 64-character hex SHA-256 digest. */
export type Sha256Hex = string;

export const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/;

/** Previous-hash value of the first link of every chain. */
export const GENESIS_HASH: Sha256Hex = '0'.repeat(64);

/** SHA-256 of a UTF-8 string or raw bytes, as lower-case hex. */
export function sha256Hex(data: string | Uint8Array): Sha256Hex {
  const h = createHash('sha256');
  if (typeof data === 'string') h.update(data, 'utf8');
  else h.update(data);
  return h.digest('hex');
}

/** SHA-256 of the canonical JSON serialisation of `value` (throws on non-canonicalisable input). */
export function hashCanonical(value: unknown): Sha256Hex {
  return sha256Hex(canonicalize(value));
}

export function isSha256Hex(value: string): boolean {
  return SHA256_HEX_PATTERN.test(value);
}

/**
 * One hash-chain link: sha256(prevHash + "\n" + canonical(payload)).
 * The newline separator keeps the 64-hex prefix unambiguous from the JSON body.
 */
export function chainLink(prevHash: Sha256Hex, payload: unknown): Sha256Hex {
  if (!isSha256Hex(prevHash)) throw new Error(`chainLink: prevHash is not a sha256 hex digest`);
  return sha256Hex(`${prevHash}\n${canonicalize(payload)}`);
}

/** Fold a sequence of payloads into a chain head, starting from GENESIS_HASH. */
export function chainHead(payloads: Iterable<unknown>): Sha256Hex {
  let head = GENESIS_HASH;
  for (const p of payloads) head = chainLink(head, p);
  return head;
}

/** Constant-time comparison of two hex digests of equal length. */
export function digestEquals(a: Sha256Hex, b: Sha256Hex): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
