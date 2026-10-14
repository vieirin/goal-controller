/**
 * Analysis engines (goal-controller#107), on the toy dialect: the model as
 * analyses read it, defining analyses, and running one.
 */
import * as assert from 'assert';
import { describe, it } from 'mocha';
import {
  analysisModel,
  defineAnalyses,
  runAnalysis,
  type AnalysisModel,
} from '../../../src';
import { toyAnalyses, toyGraph } from './toy';

/* eslint-disable-next-line @typescript-eslint/no-require-imports */
const {
  parsePistar,
} = require('../../../../goal-tree/node_modules/@istar-ts/core');

const node = (id: string, type: string, text: string, x = 0) => ({
  id,
  text,
  type,
  x,
  y: 0,
  customProperties: { Description: '' },
});

/** Two actors: Ann's task contributes 3 and 4 to her goal, Bob's nothing. */
export const TOY_MODEL = JSON.stringify({
  actors: [
    {
      ...node('a1', 'istar.Actor', 'Ann'),
      customProperties: { Description: '', budget: '5' },
      nodes: [
        node('g1', 'istar.Goal', 'G1: deliver'),
        node('t1', 'istar.Task', 'T1: drive', 100),
        node('t2', 'istar.Task', 'T2: fly', 200),
      ],
    },
    { ...node('b1', 'istar.Role', 'Bob', 400), nodes: [] },
  ],
  orphans: [],
  dependencies: [],
  links: [
    {
      id: 'l1',
      type: 'istar.ContributionLink',
      source: 't1',
      target: 'g1',
      label: 'help',
      customProperties: { weight: '3' },
    },
    {
      id: 'l2',
      type: 'istar.ContributionLink',
      source: 't2',
      target: 'g1',
      label: 'make',
      customProperties: { weight: '4' },
    },
  ],
  display: {},
  tool: 'pistar.2.1.0',
  istar: '2.0',
  saveDate: 'Mon, 13 Oct 2026 00:00:00 GMT',
  diagram: { width: 800, height: 600 },
});

const model = (): AnalysisModel => analysisModel(parsePistar(TOY_MODEL));

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
