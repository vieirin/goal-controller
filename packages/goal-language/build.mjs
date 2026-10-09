// CommonJS bundles for CommonJS consumers (lib, the dialect package): Langium
// is ESM-only, so it goes in the parser's bundle. The catalog is Langium-free
// and bundled on its own, so the dialect package (and the browser) can read it
// without loading the parser.
import { build } from 'esbuild';

const common = {
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'es2022',
  logLevel: 'warning',
};
await build({
  ...common,
  entryPoints: ['src/index.ts'],
  outfile: 'out/cjs/index.cjs',
});
await build({
  ...common,
  entryPoints: ['src/catalog.ts'],
  outfile: 'out/cjs/catalog.cjs',
});
