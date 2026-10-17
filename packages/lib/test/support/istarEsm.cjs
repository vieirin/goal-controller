/**
 * Lets lib's dialect tests (CommonJS, through ts-node) require the UI's
 * workbench modules that read KAOS and NFR models (goal-controller#171):
 * `@istar-ts/dsm3-kaos` and `@istar-ts/dsm3-nfr` export ESM only, so they
 * resolve to their ESM builds, which Node requires as ES modules. They import
 * `@istar-ts/core` as ESM, so `@istar-ts/core` resolves to its ESM build too,
 * for one core in the process. Drop this when istar-ts publishes their
 * `/metamodel` subpaths with a CommonJS build (istar-ts#14, 0.13.2).
 */
const Module = require('module');
const { dirname, join } = require('path');

const UI = join(__dirname, '../../../ui');
const esm = (name) =>
  join(
    dirname(require.resolve(`${name}/package.json`, { paths: [UI] })),
    'dist/index.js',
  );
const ESM = Object.fromEntries(
  ['@istar-ts/core', '@istar-ts/dsm3-kaos', '@istar-ts/dsm3-nfr'].map(
    (name) => [name, esm(name)],
  ),
);

const resolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  return ESM[request] ?? resolve.call(this, request, ...rest);
};
