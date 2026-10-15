// What reads Langium, for lib's CommonJS out/: Langium is ESM-only, so
// every engine's Langium language (a folder of src/engines/<engine>/ with a
// langium-config.json and an index.ts: an engine's language/ of
// goal-controller#143, or any other folder of its grammars) and the pool's protocol
// (src/pool, which reads any engine's Langium language) are each bundled,
// into out/engines/<engine>/<folder>.js and out/pool.js, with
// `langium` required from goal-language's one CommonJS copy
// (`@goal-controller/goal-language/langium`), which goal-language's parser
// requires too: one Langium at run time. A `require('./language')` finds
// that file before the directory tsc writes, so tsc and this never write
// the same file (`--watch`: rebuilt on each change, beside `tsc --watch`).
import { build, context } from 'esbuild';
import { existsSync, readdirSync } from 'node:fs';

/** `langium` is goal-language's one CommonJS copy */
const sharedLangium = {
  name: 'shared-langium',
  setup: (build) =>
    build.onResolve({ filter: /^langium$/ }, () => ({
      path: '@goal-controller/goal-language/langium',
      external: true,
    })),
};

const shared = {
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'es2022',
  // lib's other packages are CommonJS already
  external: ['@goal-controller/*'],
  logLevel: 'warning',
  plugins: [sharedLangium],
};
/** each engine's Langium languages: `src/engines/<engine>/<folder>/` with a config and an index */
const languages = readdirSync('src/engines', { withFileTypes: true })
  .filter((engine) => engine.isDirectory())
  .flatMap((engine) =>
    readdirSync(`src/engines/${engine.name}`, { withFileTypes: true })
      .filter(
        (folder) =>
          folder.isDirectory() &&
          existsSync(
            `src/engines/${engine.name}/${folder.name}/langium-config.json`,
          ) &&
          existsSync(`src/engines/${engine.name}/${folder.name}/index.ts`),
      )
      .map((folder) => `${engine.name}/${folder.name}`),
  )
  .sort();
const bundles = [
  ...languages.map((language) => ({
    ...shared,
    entryPoints: [`src/engines/${language}/index.ts`],
    outfile: `out/engines/${language}.js`,
  })),
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
