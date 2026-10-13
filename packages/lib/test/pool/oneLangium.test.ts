/**
 * One Langium at run time (#86), in lib's built out/: MutRoSe's language,
 * HDDL's, the goal language's parser and the pool all require
 * goal-language's one CommonJS copy (`@goal-controller/goal-language/langium`),
 * none bundles its own. Read from out/, as the CLI and the workbench load
 * lib (`pnpm build:lib` first; the root `pnpm test` does).
 */
import { expect } from 'chai';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const OUT = join(__dirname, '../../out');

/** Langium's own code: a file that defines it, not one that requires it */
const definesLangium = (file: string) =>
  readFileSync(file, 'utf8').includes('function isAstNode(');

describe('one Langium at run time, in out/', () => {
  before(function () {
    if (!existsSync(join(OUT, 'index.js')))
      throw new Error('lib is not built: run `pnpm build:lib` first');
  });

  it('MutRoSe’s, HDDL’s and the goal language’s parsers extend the one copy’s classes', () => {
    const { DefaultLexer } = require('@goal-controller/goal-language/langium');
    const { mutroseServices } = require(
      join(OUT, 'engines/mutrose/language.js'),
    );
    const { hddlServices } = require(join(OUT, 'engines/mutrose/hddl.js'));
    const { goalServices } = require('@goal-controller/goal-language');
    for (const services of [mutroseServices(), hddlServices(), goalServices()])
      expect(services.parser.Lexer).to.be.instanceOf(DefaultLexer);
  });

  it('only that copy defines Langium, once lib and a pool are loaded', () => {
    const lib = require(join(OUT, 'index.js'));
    const { createPool } = require(join(OUT, 'engines/definitionPool'));
    createPool(lib.mutrosePool).update([
      { id: 'd.hddl', kind: 'hddl', text: '(define (domain d))' },
    ]);
    const shared = require.resolve('@goal-controller/goal-language/langium');
    expect(
      Object.keys(require.cache)
        .filter((file) => file.endsWith('.js') || file.endsWith('.cjs'))
        .filter(definesLangium),
    ).to.deep.equal([shared]);
  });
});
