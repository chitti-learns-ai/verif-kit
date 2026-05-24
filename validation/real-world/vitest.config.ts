// Self-contained Vitest config for the real-GitHub-bug validation cases.
// root is pinned to this directory so `include` resolves regardless of cwd.
// Run via: node score.mjs   (from this directory or repo root)
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  test: {
    include: ['cases/**/*.{test,spec}.ts'],
    globals: true,
    environment: 'node',
    testTimeout: 20000
  }
});
