// CommonJS bundles for CommonJS consumers (lib): Langium
// is ESM-only, so it goes in the parser's bundle. The catalog and the
// writers are Langium-free and bundled on their own (`./light`), so the
// browser can use them without loading the parser.
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
  external: ['@goal-controller/dialect'],
});
await build({
  ...common,
  entryPoints: ['src/light.ts'],
  outfile: 'out/cjs/light.cjs',
  external: ['@goal-controller/dialect'],
});
// the language server's services, for CommonJS tests (the worker is ESM, for browsers)
await build({
  ...common,
  entryPoints: ['src/lsp/server.ts'],
  outfile: 'out/cjs/lsp.cjs',
  external: ['@goal-controller/dialect'],
});
