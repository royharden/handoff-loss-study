// Vitest config (PLAN.md M1). Never run yet: see docs/DEFERRED-VALIDATION.md (DV-M1-04).
// Host vitest runs only builder-authored unit tests. Hidden task groups are never run on the host for
// model output; they run in the D17 grader container (src/sandbox, M4).
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: ['node_modules/**', 'tasks/**', 'fixtures/**', 'results/**'],
    environment: 'node',
    globals: false,
    testTimeout: 20_000,
    // No network in tests: the keyless suites use null/scripted/mock providers only.
    pool: 'forks',
    // Keep the default keyless suite bounded on shared agent machines.
    fileParallelism: false,
    maxWorkers: 1,
    minWorkers: 1,
  },
});
