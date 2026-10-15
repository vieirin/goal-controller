/**
 * defineEngine (goal-controller#124): what it rejects at definition time,
 * with why, and registerEngines' one id per engine.
 */
import * as assert from 'assert';
import { describe, it } from 'mocha';
import { defineDialect } from '@goal-controller/dialect';
import { defineEngine, registerEngines } from '../../src/engines/engine';
import {
  edgeEngine,
  edgeV2Engine,
  godaEngine,
  grlEngine,
  mutroseEngine,
  sleecEngine,
} from '../../src';

const toy = defineDialect({
  id: 'toy',
  name: 'Toy',
  elements: { goal: { prefix: 'G', fill: '#fff' } },
  defaultFill: '#fff',
  properties: {
    goal: [
      { key: 'weight', value: { type: 'int' }, help: 'w', check: 'toy.weight' },
    ],
    task: [],
    resource: [],
    quality: [],
  },
  propertyLineOrder: ['weight'],
  indent: '  ',
  problems: {
    notAChild: { severity: 'error', message: '' },
    missingFromNotation: { severity: 'warning', message: '' },
    relationMismatch: { severity: 'error', message: '' },
    notInDiagram: { severity: 'error', message: '' },
  },
  projectResources: {
    scenarios: { label: 'Scenarios', format: 'json', path: 'scenarios.json' },
  },
});

const base = {
  id: 'toy',
  help: 'a toy',
  dialect: toy,
  checks: { 'toy.weight': () => null },
  mapper: { allowedGoalKeys: ['weight'], allowedTaskKeys: [] },
  output: { label: 'Toy', extension: 'toy', language: 'text' },
  projectResources: {
    scenarios: () => ({ symbols: {}, data: null, diagnostics: [] }),
  },
} as const;

/** defineEngine on a toy engine changed by `patch`, untyped: what the types would reject too. */
const define = (patch: Record<string, unknown>) => () =>
  (defineEngine as (engine: unknown) => unknown)({ ...base, ...patch });

describe('defineEngine', () => {
  it('takes an engine whose checks, parsers, analyses and outputs agree with its dialect', () => {
    const engine = define({ outputs: [{ id: 'model' }] })() as typeof base;
    assert.strictEqual(engine.id, 'toy');
    assert.ok(Object.isFrozen(engine));
  });

  it('rejects a check a property names that its checks lack', () =>
    assert.throws(
      define({ checks: {} }),
      /^Error: toy: goal\.weight names check toy\.weight, not in its checks$/,
    ));

  it('rejects a project resource without a parser, and a parser for none', () => {
    assert.throws(
      define({ projectResources: {} }),
      /^Error: toy: project resource scenarios has no parser$/,
    );
    assert.throws(
      define({
        projectResources: { ...base.projectResources, strategies: () => null },
      }),
      /^Error: toy: a parser for unknown project resource strategies$/,
    );
  });

  it("rejects an analysis input the dialect's resources don't declare", () =>
    assert.throws(
      define({
        analyses: {
          evaluation: {
            label: 'Evaluation',
            input: 'strategies',
            run: () => ({ cases: [] }),
          },
        },
      }),
      /^Error: toy: analysis evaluation reads unknown project resource strategies$/,
    ));

  it('rejects an output id declared twice', () =>
    assert.throws(
      define({ outputs: [{ id: 'model' }, { id: 'cost' }, { id: 'model' }] }),
      /^Error: toy: output model is declared twice$/,
    ));

  it('rejects file kinds without the extension that defines them', () =>
    assert.throws(
      define({ fileKinds: true }),
      /^Error: toy: fileKinds without an extension \(its kinds\)$/,
    ));

  it('rejects checks or parsers without a dialect', () => {
    assert.throws(
      define({ dialect: undefined, projectResources: undefined }),
      /^Error: toy: checks without a dialect$/,
    );
    assert.throws(
      define({ dialect: undefined, checks: undefined }),
      /^Error: toy: project resource parsers without a dialect$/,
    );
  });
});

describe('registerEngines', () => {
  it("lists lib's engines in the order given", () =>
    assert.deepStrictEqual(
      registerEngines(
        edgeV2Engine,
        edgeEngine,
        sleecEngine,
        mutroseEngine,
        godaEngine,
        grlEngine,
      ).map((engine) => engine.id),
      ['edgev2', 'edge', 'sleec', 'mutrose', 'goda', 'grl'],
    ));

  it('rejects an engine id registered twice', () =>
    assert.throws(
      () => registerEngines(edgeEngine, godaEngine, edgeEngine),
      /^Error: engine edge is registered twice$/,
    ));
});
