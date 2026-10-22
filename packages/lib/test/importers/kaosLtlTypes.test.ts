/**
 * `ltl` formulas type-checked against the operation and object models'
 * declared predicates, entities and associations (goal-controller#385):
 * every `formula`-tagged property of a real KAOS model (the mine pump
 * fixture, test/importers/fixtures/kaos/pump-operations.kaos; every
 * examples/kaos/**\/*.kaos the stress test reads), through the same
 * `valueProblem` path the Problems panel and `propertyErrors` use.
 */
import * as assert from 'assert';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { describe, it } from 'mocha';
import { parsePistar } from '@istar-ts/core';
import type { DefinitionContext } from '@goal-controller/dialect';
import { goalView } from '@goal-controller/goal-tree';
import { contextFromView, valueProblem } from '@goal-controller/goal-language';
import { readKaos } from '../../src/importers/kaos';
import { kaos } from '../../src/dialects/kaos';
import { KAOS_MODEL } from '../../src/dialects/kaos/metamodel';

const FIXTURE = readFileSync(
  join(__dirname, 'fixtures/kaos/pump-operations.kaos'),
  'utf8',
);

/** Every `formula` Problem a `.kaos` text's elements have, key `id.key`. */
const formulaProblemsOf = (text: string): Record<string, string> => {
  const { model: json } = readKaos(text, { modelName: 'm' });
  if (!json) throw new Error('readKaos failed');
  const model = parsePistar(json, { metamodel: KAOS_MODEL });
  const tree = goalView(model, kaos);
  const context: DefinitionContext = contextFromView(kaos, tree, []);
  const problems: Record<string, string> = {};
  for (const [id, element] of Object.entries(context.elements))
    for (const property of kaos.properties[element.kind] ?? []) {
      if (property.value.type !== 'formula') continue;
      const written = element.properties[property.key];
      if (!written) continue;
      const problem = valueProblem(property.value, written, context, kaos);
      if (problem) problems[`${id}.${property.key}`] = problem;
    }
  return problems;
};

const examplesRoot = join(__dirname, '..', '..', '..', '..', 'examples/kaos');
const exampleFiles = readdirSync(examplesRoot, { recursive: true })
  .filter(
    (entry): entry is string =>
      typeof entry === 'string' && entry.endsWith('.kaos'),
  )
  .map((entry) => join(examplesRoot, entry));

/**
 * Pre-existing defects the stress corpus's own data has, unmasked by this
 * type check (not #385's to fix; each is its own issue, not a comment):
 * - flood.kaos's predicate `DustyEnvironment` is declared with that
 *   capitalisation but every `formalspec` calls `dustyEnvironment()`
 *   (goal-controller#398).
 * - las-quantitative.kaos's `ambulance_intervention` formalspec writes a
 *   quantifier with no `.`/`·` separator before its body, which the LTL
 *   grammar requires (a pre-existing parser gap, goal-controller#211's,
 *   not #385's: it is a syntax Problem, not a type one;
 *   goal-controller#399).
 */
const KNOWN_DEFECTS = new Set([
  'dusty_environment.FormalSpec',
  'ambulance_intervention.FormalSpec',
]);

describe('ltl type-checking: the operation and object models (#385)', () => {
  it('the mine pump fixture type-checks clean', () => {
    assert.deepStrictEqual(formulaProblemsOf(FIXTURE), {});
  });

  it('a mutated attribute name raises a Problem', () => {
    const mutated = FIXTURE.replace(
      'formalspec when sump.highWater == true',
      'formalspec when sump.highWaterXXX == true',
    );
    assert.notStrictEqual(mutated, FIXTURE);
    assert.deepStrictEqual(formulaProblemsOf(mutated), {
      'pump_on_when_high_water.FormalSpec':
        'sump has no attribute highWaterXXX',
    });
  });

  for (const path of exampleFiles) {
    it(`${path}: every formula type-checks against its model`, () => {
      const problems = formulaProblemsOf(readFileSync(path, 'utf8'));
      for (const key of KNOWN_DEFECTS) delete problems[key];
      assert.deepStrictEqual(problems, {});
    });
  }
});
