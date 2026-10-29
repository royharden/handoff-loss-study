import { defineConfig } from 'vitest/config';
export default defineConfig({ cacheDir: '/tmp/vite-cache', test: { include: ['**/*.test.ts'], pool: 'forks', fileParallelism: false, maxWorkers: 1, minWorkers: 1, testTimeout: 10_000 }, resolve: { alias: { vitest: '/runtime/node_modules/vitest/dist/index.js' } } });
