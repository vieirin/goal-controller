/**
 * Lets lib's tests (CommonJS, through ts-node) require Langium, which is
 * ESM-only (MutRoSe's language, src/engines/mutrose/language): Langium is
 * bundled into one CommonJS file, and `langium` resolves to it. Only
 * `langium`; every other package resolves as it did. lib's build does the
 * same for out/ (build.mjs).
 */
const { buildSync } = require('esbuild');
const Module = require('module');
const path = require('path');

const outfile = path.join(
  __dirname,
  '../../node_modules/.cache/mutrose-language/langium.cjs',
);
buildSync({
  stdin: {
    contents: "export * from 'langium';",
    resolveDir: path.join(__dirname, '../..'),
  },
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'es2022',
  outfile,
  logLevel: 'warning',
});

const resolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  return request === 'langium' ? outfile : resolve.call(this, request, ...rest);
};
