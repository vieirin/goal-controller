/**
 * Every `formalspec` in the MIT corpora parses with zero Problems, and
 * `printLtl` reproduces it (goal-controller#211's oracle): ADS's models
 * (../fixtures/kaos/ads, ancailliau/ADS, MIT), KAOSTools' own `las.kaos`
 * (../fixtures/kaos/kaostools, ancailliau/KAOSTools, MIT), and the stress
 * test's `examples/kaos/**`. "Prints back" means `printLtl`'s text (its
 * module doc explains why that is not the file's original bytes) equal to
 * the model's own canonical `FormalSpec` text — `kaosFormulaText`'s, one
 * space per gap the source had — once whitespace touching `( ) , .` is
 * squashed: KAOSTools' `formalspec` lines wrap over several indented
 * lines, so `kaosFormulaText` inserts a space at some of those wraps (a
 * line break before a run-on `(` is one more "gap" than if it were on the
 * same line) that is incidental to the source's formatting, not to the
 * formula; a parser-and-printer pair cannot know which, since neither
 * reads raw file bytes.
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'mocha';
import {
  kaosFormulaText,
  parseKaos,
  type KaosAtom,
  type KaosAttribute,
  type KaosFile,
  type KaosValue,
} from '../../src/formats/index.js';
import { parseLtl, printLtl } from '../../src/ltl/index.js';

const here = import.meta.dirname;

const fixture = (path: string) =>
  readFileSync(join(here, '..', 'fixtures', 'kaos', path), 'utf8');

const FIXTURE_CORPUS = [
  'las.kaos',
  'obstacles.kaos',
  'resolutions.kaos',
  'simple.kaos',
  'simple_new_syntax.kaos',
  'validation-model.kaos',
]
  .map((name) => `ads/${name}`)
  .concat('kaostools/las.kaos');

const examplesRoot = join(here, '..', '..', '..', '..', 'examples', 'kaos');
const exampleKaosFiles = readdirSync(examplesRoot, { recursive: true })
  .filter(
    (entry): entry is string =>
      typeof entry === 'string' && entry.endsWith('.kaos'),
  )
  .map((entry) => join(examplesRoot, entry));

/** every `FormulaAtom`'s text in a `.kaos` file, declarations nested (`refinedby declare …`) too */
const formulasOf = (file: KaosFile): string[] => {
  const texts: string[] = [];
  const fromAtom = (atom: KaosAtom) => {
    if (atom.$type === 'FormulaAtom') texts.push(kaosFormulaText(atom));
    if (atom.$type === 'DeclarationAtom')
      for (const attribute of atom.declaration.attributes)
        fromAttribute(attribute);
  };
  const fromValue = (value: KaosValue) => {
    fromAtom(value.atom);
    if (value.right) fromAtom(value.right);
    for (const nested of value.bracket) fromValue(nested);
  };
  const fromAttribute = (attribute: KaosAttribute) => {
    for (const value of attribute.values) fromValue(value);
    for (const param of attribute.params) fromValue(param);
  };
  for (const item of file.items)
    if (item.$type === 'Declaration')
      for (const attribute of item.attributes) fromAttribute(attribute);
  return texts;
};

/** whitespace around `( ) , .` carries no meaning once a formula is parsed; see the module doc */
const squash = (text: string) =>
  text
    .replace(/\s+/g, ' ')
    .replace(/\s*([(),.])\s*/g, '$1')
    .trim();

const corpusFiles = [
  ...FIXTURE_CORPUS.map((path) => ({ path, text: fixture(path) })),
  ...exampleKaosFiles.map((path) => ({
    path,
    text: readFileSync(path, 'utf8'),
  })),
];

describe('LTL: every formalspec in the MIT corpora and examples/kaos (goal-controller#211)', () => {
  for (const { path, text } of corpusFiles) {
    const { ast, diagnostics } = parseKaos(text);
    it(`${path} parses as .kaos without an error`, () => {
      assert.deepStrictEqual(diagnostics, []);
    });
    const formulas = formulasOf(ast);
    if (formulas.length === 0) continue;
    it(`${path}: every formalspec (${formulas.length}) parses as LTL and prints back`, () => {
      for (const formula of formulas) {
        const { value, errors } = parseLtl(formula);
        assert.deepStrictEqual(errors, [], `${path}: ${formula}`);
        assert.strictEqual(
          squash(printLtl(value!)),
          squash(formula),
          `${path}: ${formula}`,
        );
      }
    });
  }

  it('found formalspec lines to check (the corpus is not empty)', () => {
    const total = corpusFiles.reduce(
      (n, { text }) => n + formulasOf(parseKaos(text).ast).length,
      0,
    );
    assert.ok(total > 0, 'expected at least one formalspec in the corpus');
  });
});
