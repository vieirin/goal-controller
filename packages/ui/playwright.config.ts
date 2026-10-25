import { createHash } from 'node:crypto';
import { defineConfig, devices } from '@playwright/test';

// One port (and dev-server distDir) per checkout: several git worktrees running `pnpm e2e` at
// once must not reuse each other's dev server, and this checkout's own `next dev` (a developer's
// :3000) must never be touched either. `E2E_PORT` overrides it. (`__filename`, not
// `import.meta.url`: packages/ui has no `"type": "module"`, so this config loads as CJS.)
const checkoutPort =
  4300 + (createHash('sha1').update(__filename).digest().readUInt16BE(0) % 700);
const PORT = Number(process.env.E2E_PORT) || checkoutPort;

/**
 * Smoke e2e for the workbench (#418), a regression baseline for the istar-ts migration
 * (#408): today's text↔diagram sync, undo, inspector edits and engine switching, exercised
 * through a real browser rather than jsdom. `webServer` runs the Next dev server (needed so
 * `services/examples.ts` serves examples/ from disk instead of fetching them over the network)
 * on its own port and distDir, so it never collides with a developer's `pnpm run dev:ui`.
 */
export default defineConfig({
  testDir: './e2e',
  globalSetup: require.resolve('./e2e/global-setup'),
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `node scripts/examples-manifest.mjs --local && NEXT_DIST_DIR=.next-e2e next dev --turbopack -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    // Reusing a running server is opt-in (E2E_REUSE=1): with a per-checkout port and its own
    // distDir, a reused server can only be this checkout's own, never another worktree's or a
    // developer's `:3000` dev server.
    reuseExistingServer: process.env.E2E_REUSE === '1',
    timeout: 180_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
