// CommonJS bundles for CommonJS consumers (lib): Langium is ESM-only, so
// its CommonJS form is bundled once (`./langium`, out/cjs/langium.cjs) and
// the parser's bundle requires it, as lib's bundles do: one Langium at run
// time. The catalog and the writers are Langium-free and bundled on their
// own (`./light`), so the browser can use them without loading the parser.
import { build } from 'esbuild';

/** `langium` is the one CommonJS copy, out/cjs/langium.cjs, beside the bundle */
const sharedLangium = {
  name: 'shared-langium',
  setup: (build) =>
    build.onResolve({ filter: /^langium$/ }, () => ({
      path: './langium.cjs',
      external: true,
    })),
};

const common = {
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'es2022',
  logLevel: 'warning',
};
await build({
  ...common,
  entryPoints: ['src/langium.ts'],
  outfile: 'out/cjs/langium.cjs',
});
await build({
  ...common,
  entryPoints: ['src/index.ts'],
  outfile: 'out/cjs/index.cjs',
  external: ['@goal-controller/dialect'],
  plugins: [sharedLangium],
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
