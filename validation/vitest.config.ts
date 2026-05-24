// Self-contained Vitest config for Verif-Kit's validation study.
// The cases are plain TypeScript (vitest + fast-check only — both in
// package.json devDependencies), so no framework plugin is needed. `root` is
// pinned to this directory so `include` resolves no matter where the scorer is
// launched from. Run the study with `node validation/score.mjs` from repo root.
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  test: {
    include: ['cases/**/*.{test,spec}.ts'],
    globals: true,
    environment: 'node'
  }
});
