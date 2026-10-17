/**
 * The UI's tests (goal-controller#65): Vitest under jsdom, with the `@/`
 * alias `tsconfig.json` has. They import the packages' `out/` as the app
 * does (the root `pnpm test` builds them first), and never start `next dev`
 * or `next build`, nor read `.next/`.
 *
 * One @istar-ts/core, as next.config.js has it (goal-controller#171): its
 * CommonJS build, the one goal-tree's `out/` requires through Node. The
 * @istar-ts packages that import it are inlined so the alias reaches them.
 */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./', import.meta.url)),
      '@istar-ts/core': createRequire(import.meta.url).resolve(
        '@istar-ts/core',
      ),
    },
  },
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'jsdom',
    include: ['test/**/*.test.{ts,tsx}'],
    exclude: ['**/node_modules/**', '.next/**', 'out/**'],
    restoreMocks: true,
    server: { deps: { inline: [/@istar-ts[\\/](react|dsm3-)/] } },
  },
});
