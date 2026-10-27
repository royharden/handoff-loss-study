import { defineConfig } from 'vitest/config';
export default defineConfig({ cacheDir: '/tmp/vite-cache', test: { setupFiles: ['/runtime/grader/client.ts'], include: ['/hidden/**/*.test.ts'], pool: 'forks', fileParallelism: false, maxWorkers: 1, minWorkers: 1, testTimeout: 20_000, hookTimeout: 20_000 }, resolve: { alias: { vitest: '/runtime/node_modules/vitest/dist/index.js' } } });
