/**
 * M2 CLI keyless paths (PLAN.md §12 M2). WRITTEN, NEVER RUN.
 * Deferred command: `npx vitest run tests/selftest.test.ts` (docs/DEFERRED-VALIDATION.md DV-M2-06).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { main } from '../cli/hls';

const fixture = (rel: string): string => fileURLToPath(new URL(`../fixtures/${rel}`, import.meta.url));

describe('hls (keyless)', () => {
  it('selftest passes', async () => {
    expect(await main(['selftest'])).toBe(0);
  });
  it('fixture, check carry-selftest and check visibility pass', async () => {
    expect(await main(['fixture'])).toBe(0);
    expect(await main(['check', 'carry-selftest'])).toBe(0);
    expect(await main(['check', 'visibility'])).toBe(0);
  });
  it('demo runs keyless', async () => {
    expect(await main(['demo'])).toBe(0);
  });
  it('score prints a SYNTHETIC outcome', async () => {
    expect(await main(['score', fixture('scripted/kept.json')])).toBe(0);
  });
  it('validate rejects the bad tasks (exit 1) and leaves the control task deferred (exit 3)', async () => {
    expect(await main(['validate', fixture('bad-tasks')])).toBe(1);
    expect(await main(['validate', fixture('control-task/T80')])).toBe(3);
  });
  it('unimplemented commands exit 2', async () => {
    expect(await main(['run', '--live'])).toBe(2);
  });
  it('no network or provider SDK import on the keyless path (static check of the CLI and scorer sources)', () => {
    const files = ['../cli/hls.ts', '../src/score/fixture.ts', '../src/score/evidence.ts', '../src/providers/null.ts', '../src/providers/scripted.ts', '../src/providers/port.ts'];
    for (const f of files) {
      const src = readFileSync(new URL(f, import.meta.url), 'utf8');
      expect(src).not.toMatch(/from ['"](@anthropic-ai\/sdk|openai|undici|axios|node-fetch|node:https?|https?|node:net|net)['"]/);
    }
  });
});
