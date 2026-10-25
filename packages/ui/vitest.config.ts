/**
 * The UI's tests (goal-controller#65): Vitest under jsdom, with the `@/`
 * alias `tsconfig.json` has. They import the packages' `out/` as the app
 * does (the root `pnpm test` builds them first), and never start `next dev`
 * or `next build`, nor read `.next/`.
 *
 * One @istar-ts/core, as next.config.js has it (goal-controller#171): its
 * CommonJS build, the one goal-tree's `out/` requires through Node. The
 * @istar-ts packages that import it are inlined so the alias reaches them.
 * react now depends on actions and gmodel, so they get the same alias.
 */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const require = createRequire(import.meta.url);

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./', import.meta.url)),
      '@istar-ts/core': require.resolve('@istar-ts/core'),
      '@istar-ts/actions': require.resolve('@istar-ts/actions'),
      '@istar-ts/gmodel': require.resolve('@istar-ts/gmodel'),
      '@istar-ts/glsp': require.resolve('@istar-ts/glsp'),
      '@istar-ts/agent': require.resolve('@istar-ts/agent'),
    },
  },
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'jsdom',
    include: ['test/**/*.test.{ts,tsx}'],
    exclude: ['**/node_modules/**', '.next/**', 'out/**'],
    restoreMocks: true,
    setupFiles: ['./test/setup.ts'],
    // a loaded machine (several builders at once, goal-controller#423)
    // otherwise times out tests well short of a real deadlock
    testTimeout: 20000,
    server: {
      deps: {
        inline: [/@istar-ts[\\/](react|dsm3-|actions|gmodel|glsp|agent)/],
      },
    },
  },
});
