/**
 * Lets lib's tests (CommonJS, through ts-node) require Langium, which is
 * ESM-only: `langium` resolves to goal-language's one CommonJS copy
 * (`@goal-controller/goal-language/langium`), the one lib's out/ and
 * goal-language's parser require too (build.mjs), so a test sees one
 * Langium. Only `langium`; every other package resolves as it did.
 */
const Module = require('module');

const shared = require.resolve('@goal-controller/goal-language/langium');

const resolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  return request === 'langium' ? shared : resolve.call(this, request, ...rest);
};
