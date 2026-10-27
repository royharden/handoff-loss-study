import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
export default defineConfig({ root: fileURLToPath(new URL('.', import.meta.url)), plugins: [react()], publicDir: fileURLToPath(new URL('../results', import.meta.url)), build: { outDir: 'dist', emptyOutDir: true }, server: { host: '127.0.0.1', strictPort: true } });
