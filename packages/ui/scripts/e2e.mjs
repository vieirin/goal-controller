#!/usr/bin/env node
/**
 * Runs Playwright, then restores the tracked files its `webServer` command rewrites
 * (goal-controller#424): the manifest generator's `--local` write to
 * `lib/examples-manifest.json`, and `next dev`'s own rewrite of `next-env.d.ts` and
 * `tsconfig.json` to point at the e2e distDir (`NEXT_DIST_DIR=.next-e2e`,
 * `playwright.config.ts`). Snapshotting here, before `playwright test` starts the
 * server, is the only point those files are still as the tree had them — Playwright's
 * own `globalSetup`/`globalTeardown` hooks run after `webServer` is already up.
 */
import { spawnSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TRACKED_FILES = [
  'next-env.d.ts',
  'tsconfig.json',
  'lib/examples-manifest.json',
];

const snapshot = async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'goal-controller-e2e-'));
  const saved = [];
  for (const file of TRACKED_FILES) {
    const src = path.join(ROOT, file);
    const dest = path.join(dir, path.basename(file));
    await fs.copyFile(src, dest);
    saved.push([src, dest]);
  }
  return saved;
};

const restore = async (saved) => {
  for (const [src, dest] of saved) await fs.copyFile(dest, src);
};

const saved = await snapshot();
const result = spawnSync(
  'pnpm',
  ['exec', 'playwright', 'test', ...process.argv.slice(2)],
  { cwd: ROOT, stdio: 'inherit' },
);
await restore(saved);
process.exit(result.status ?? 1);
