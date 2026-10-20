/**
 * Analysis engines (goal-controller#107), on the toy dialect: the model as
 * analyses read it, defining analyses, and running one.
 */
import * as assert from 'assert';
import { describe, it } from 'mocha';
import { defineAnalyses, runAnalysis, type AnalysisModel } from '../../../src';
import { toyAnalyses, toyAnalysisModel, toyGraph } from './toy';
import { TOY_MODEL } from './toyModel';

/* eslint-disable-next-line @typescript-eslint/no-require-imports */
const {
  parsePistar,
} = require('../../../../goal-tree/node_modules/@istar-ts/core');

// the view of its KindModel (goal-controller#125)
const model = (): AnalysisModel => toyAnalysisModel(parsePistar(TOY_MODEL));

describe('analysis engines (#107)', () => {
  it('reads actors, elements and links with their properties', () => {
    const read = model();
    assert.deepStrictEqual(
      read.actors.map((a) => [a.id, a.kind, a.properties.budget, a.elements]),
      [
        ['a1', 'istar.Actor', '5', ['g1', 't1', 't2']],
        ['b1', 'istar.Role', undefined, []],
      ],
    );
    assert.deepStrictEqual(
      read.elements.map((e) => [e.id, e.kind, e.actor]),
      [
        ['g1', 'istar.Goal', 'a1'],
        ['t1', 'istar.Task', 'a1'],
        ['t2', 'istar.Task', 'a1'],
      ],
    );
    assert.deepStrictEqual(read.links[0], {
      id: 'l1',
      kind: 'istar.ContributionLink',
      source: 't1',
      target: 'g1',
      label: 'help',
      properties: { weight: '3' },
    });
  });

  it("runs the toy's analysis: the link property summed over each actor, over budget a warning", () => {
    const run = runAnalysis(toyAnalyses.weights, model());
    assert.ok('result' in run);
    assert.deepStrictEqual(run.result.cases, [
      {
        id: 'all',
        label: 'All contributions',
        values: {
          a1: { value: 7, severity: 'warning' },
          b1: { value: 0 },
        },
      },
    ]);
  });

  it('gives the message of an analysis that throws, and no result', () => {
    const run = runAnalysis(
      {
        label: 'broken',
        run: () => {
          throw new Error('no strategy');
        },
      },
      model(),
    );
    assert.deepStrictEqual(run, { error: 'no strategy' });
  });

  it('reads only a project resource its dialect declares', () => {
    const analysis = { label: 'x', run: () => ({ cases: [] }) };
    assert.throws(
      () =>
        defineAnalyses(toyGraph, { x: { ...analysis, input: 'strategies' } }),
      /toygraph: analysis x reads unknown project resource strategies/,
    );
    assert.throws(
      () => defineAnalyses(toyGraph, { x: { ...analysis, label: '' } }),
      /analysis x: needs an id and a label/,
    );
    const withStrategies = {
      ...toyGraph,
      projectResources: {
        strategies: {
          label: 'Strategies',
          format: 'json' as const,
          path: 'strategies/',
          many: true,
        },
      },
    };
    assert.doesNotThrow(() =>
      defineAnalyses(withStrategies, {
        x: { ...analysis, input: 'strategies' },
      }),
    );
  });
});
