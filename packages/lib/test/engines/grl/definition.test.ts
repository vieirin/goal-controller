/**
 * GRL's definition, checks, strategies and analyses (goal-controller#106).
 */
import * as assert from 'assert';
import { describe, it } from 'mocha';
import { linkPropertiesOf, actorPropertiesOf } from '@goal-controller/dialect';
import type { CheckContext } from '../../../src/engines/checks';
import {
  grl,
  grlAnalyses,
  grlCheckRegistry,
  readStrategies,
} from '../../../src/engines/grl';
import type { AnalysisModel } from '../../../src/engines/analysis';

const context = (target?: string): CheckContext => ({
  self: 'l1',
  kindOf: () => undefined,
  readLink: () => ({
    kind: 'istar.ContributionLink',
    source: null,
    target: null,
    properties: {},
    ...(target && {
      ends: {
        source: { iStarId: 's', kind: 'istar.Task' },
        target: { iStarId: 't', kind: target },
      },
    }),
  }),
});

describe('the GRL definition', () => {
  it('declares GRL’s contribution properties and actors’ importance', () => {
    assert.deepStrictEqual(
      linkPropertiesOf(grl, 'istar.ContributionLink').map((p) => p.key),
      ['contribution', 'quantitativeContribution', 'correlation'],
    );
    assert.deepStrictEqual(
      actorPropertiesOf(grl, 'istar.Actor').map((p) => p.key),
      ['importance', 'importanceQuantitative'],
    );
    assert.strictEqual(grl.projectResources.strategies.many, true);
  });

  it('rejects a quantitative contribution outside −100..100', () => {
    const check = grlCheckRegistry['grl.link.quantitativeContribution'];
    assert.strictEqual(
      check({ quantitativeContribution: '-100' }, context()),
      null,
    );
    assert.strictEqual(
      check({ quantitativeContribution: '150' }, context()),
      'A quantitative contribution is an integer, −100..100, not 150',
    );
    assert.ok(check({ quantitativeContribution: '2.5' }, context()));
  });

  it('rejects a contribution to a belief', () => {
    const check = grlCheckRegistry['grl.link.contribution'];
    assert.strictEqual(check({}, context('istar.Quality')), null);
    assert.strictEqual(
      check({}, context('grl.Belief')),
      'A contribution goes to an intentional element, not to a belief',
    );
    // without the model (no readLink): nothing to say
    assert.strictEqual(
      check({}, { self: 'l1', kindOf: () => undefined }),
      null,
    );
  });
});

describe('GRL strategies (the strategies resource)', () => {
  const file = (text: object, path = 'strategies/a.json') => ({
    path,
    text: JSON.stringify(text),
  });

  it('resolves includes first, the strategy’s own winning', () => {
    const { strategies, diagnostics } = readStrategies([
      file({
        group: 'G',
        preferences: { range: 'positive', tolerance: 0 },
        strategies: [
          {
            id: 'a',
            name: 'A',
            evaluations: { x: { value: 10 }, y: { value: 20 } },
          },
          {
            id: 'b',
            name: 'B',
            includes: ['a'],
            evaluations: { y: { value: 90, label: 'Satisfied' } },
          },
        ],
      }),
    ]);
    assert.deepStrictEqual(diagnostics, []);
    const b = strategies.find((s) => s.id === 'b')!;
    assert.deepStrictEqual(
      [...b.evaluations].map(([id, e]) => [id, e.value, e.label]),
      [
        ['x', 10, 'None'],
        ['y', 90, 'Satisfied'],
      ],
    );
    assert.deepStrictEqual(b.preferences, { range: 'positive', tolerance: 0 });
  });

  it('says what is wrong: a value, a label, a repeated id, an include', () => {
    const { diagnostics } = readStrategies([
      file({
        group: 'G',
        strategies: [
          {
            id: 'a',
            evaluations: { x: { value: 101 }, y: { label: 'Fine' } },
            includes: ['z'],
          },
          { id: 'b', includes: ['b'], evaluations: {} },
        ],
      }),
      file(
        { group: 'H', strategies: [{ id: 'a', evaluations: {} }] },
        'strategies/b.json',
      ),
    ]);
    assert.deepStrictEqual(
      diagnostics.map((d) => d.message),
      [
        "Strategy a: element x's value is an integer, -100..100",
        "Strategy a: element y's label is one of Denied, WeaklyDenied, WeaklySatisfied, Satisfied, Conflict, Unknown, None",
        'Strategy a is defined twice',
        'Strategy a includes unknown strategy z',
        'Strategy b includes itself (through b)',
      ],
    );
  });
});

describe('GRL’s analyses', () => {
  const model: AnalysisModel = {
    actors: [],
    elements: [
      { id: 't', kind: 'istar.Quality', name: 'T', properties: {} },
      { id: 's', kind: 'istar.Task', name: 'S', properties: {} },
    ],
    links: [
      {
        id: 'c',
        kind: 'istar.ContributionLink',
        source: 's',
        target: 't',
        label: 'help',
        properties: { contribution: 'Help', quantitativeContribution: '50' },
      },
    ],
  };
  const resource = {
    'strategies/s.json': JSON.stringify({
      group: 'G',
      strategies: [
        {
          id: '1',
          name: 'One',
          evaluations: { s: { value: 100 }, ghost: { value: 5 } },
        },
      ],
    }),
  };

  it('gives one case per strategy, a value and a label per element', () => {
    const { cases } = grlAnalyses.grlQuantitative.run(model, resource);
    assert.strictEqual(cases.length, 1);
    assert.strictEqual(
      cases[0]!.label,
      "One (evaluates ghost, which the model doesn't have)",
    );
    assert.deepStrictEqual(cases[0]!.values.t, {
      value: 50,
      label: '50 (Weakly satisfied)',
    });
    const qualitative = grlAnalyses.grlQualitative.run(model, resource);
    assert.deepStrictEqual(qualitative.cases[0]!.values.t, {
      value: 'WeaklySatisfied',
      label: 'Weakly satisfied',
    });
  });

  it('evaluates with no strategy: every leaf 0', () => {
    const { cases } = grlAnalyses.grlQuantitative.run(model, {});
    assert.deepStrictEqual(
      cases.map((c) => [c.label, c.values.t?.value]),
      [['No strategy', 0]],
    );
  });
});
