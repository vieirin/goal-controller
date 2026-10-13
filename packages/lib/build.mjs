// What reads Langium, for lib's CommonJS out/: Langium is ESM-only, so
// MutRoSe's language (src/engines/mutrose/language) and the pool's protocol
// (src/pool, which reads any engine's Langium language) are each bundled
// with it, into out/engines/mutrose/language.js and out/pool.js. A
// `require('./language')` finds that file before the directory tsc writes,
// so tsc and this never write the same file (`--watch`: rebuilt on each
// change, beside `tsc --watch`).
import { build, context } from 'esbuild';

const shared = {
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'es2022',
  // lib's other packages are CommonJS already
  external: ['@goal-controller/*'],
  logLevel: 'warning',
};
const bundles = [
  {
    ...shared,
    entryPoints: ['src/engines/mutrose/language/index.ts'],
    outfile: 'out/engines/mutrose/language.js',
  },
  {
    ...shared,
    entryPoints: ['src/pool/index.ts'],
    outfile: 'out/pool.js',
    // CommonJS already: not bundled
    external: [
      ...shared.external,
      'zod',
      'zod/*',
      'jsonc-parser',
      'yaml',
      '@rgrove/parse-xml',
    ],
  },
];

if (process.argv.includes('--watch'))
  for (const options of bundles) await (await context(options)).watch();
else await Promise.all(bundles.map((options) => build(options)));
