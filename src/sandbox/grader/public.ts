/** Public-only container entry. No hidden test input, verdicts or credentials. */
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
export async function publicEntry(paths: readonly string[]): Promise<void> {
  if (!paths.length || paths.some((p) => !/^[A-Za-z0-9_./-]+\.test\.ts$/.test(p) || p.split('/').some((v) => v === '..' || v === '.' || v === ''))) throw new Error('invalid public test paths');
  const child = spawn('/usr/local/bin/node', ['/runtime/node_modules/vitest/vitest.mjs', 'run', ...paths, '--root', '/candidate', '--config', '/runtime/grader/public.config.ts', '--reporter=json', '--outputFile=/tmp/public-result.json'], { stdio: ['ignore', 'ignore', 'ignore'], env: { PATH: '/usr/local/bin:/usr/bin:/bin', NODE_ENV: 'test', CI: '1' }, shell: false });
  const code = await new Promise<number | null>((resolve) => { child.once('error', () => resolve(null)); child.once('close', resolve); });
  let passed = false; let total = 0; let failed = 0;
  try { const report: unknown = JSON.parse(readFileSync('/tmp/public-result.json', 'utf8')); if (report && typeof report === 'object') { const r = report as Record<string, unknown>; total = Number.isInteger(r['numTotalTests']) ? r['numTotalTests'] as number : 0; failed = Number.isInteger(r['numFailedTests']) ? r['numFailedTests'] as number : 0; passed = code === 0 && r['success'] === true && total > 0 && failed === 0; } } catch { passed = false; }
  // Expose fixed fields only, never arbitrary stdout/code echoes that could cross provenance boundaries.
  process.stdout.write(JSON.stringify({ passed, total, failed }) + '\n');
}
if (process.argv[2] === '--tests') await publicEntry(process.argv.slice(3));
