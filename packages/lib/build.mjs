// MutRoSe's language (src/engines/mutrose/language) for lib's CommonJS out/:
// Langium is ESM-only, so the language is bundled with it, into
// out/engines/mutrose/language.js. A `require('./language')` finds that file
// before the language/ directory tsc writes, so tsc and this never write the
// same file (`--watch`: rebuilt on each change, beside `tsc --watch`).
import { build, context } from 'esbuild';

const options = {
  entryPoints: ['src/engines/mutrose/language/index.ts'],
  outfile: 'out/engines/mutrose/language.js',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'es2022',
  // lib's other packages are CommonJS already
  external: ['@goal-controller/*'],
  logLevel: 'warning',
};

if (process.argv.includes('--watch')) await (await context(options)).watch();
else await build(options);
