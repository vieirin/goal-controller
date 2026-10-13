/**
 * The UI's tests (goal-controller#65): Vitest under jsdom, with the `@/`
 * alias `tsconfig.json` has. They import the packages' `out/` as the app
 * does (the root `pnpm test` builds them first), and never start `next dev`
 * or `next build`, nor read `.next/`.
 */
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./', import.meta.url)) },
  },
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'jsdom',
    include: ['test/**/*.test.{ts,tsx}'],
    exclude: ['**/node_modules/**', '.next/**', 'out/**'],
    restoreMocks: true,
  },
});
