import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import { assertCore } from './core';

// sha256 of the starter src/contracts.ts (LF line endings; .gitattributes keeps them).
const CONTRACTS_SHA256 = '808e8d34c0bbfe69925f1948ee3bc4675c09fdd32a848537f810931cb4abb1b8';

it('R7: src/contracts.ts is unchanged', () => {
  assertCore();
  const path = fileURLToPath(new URL('../src/contracts.ts', import.meta.url));
  expect(createHash('sha256').update(readFileSync(path)).digest('hex')).toBe(CONTRACTS_SHA256);
});
