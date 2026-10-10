/**
 * cc808b6's cost clean-up (`cleanMultipleContexts`, goal-controller#39):
 * skipping a replacement that changed nothing, until the text changes, gives
 * the same output as running every one in order as upstream does (the
 * oracle, `skipUnchanged: false`): on formulas with repeated factors, on a
 * model of our own, and on Fragmented, the model the skip exists
 * for (fetched into the gitignored cache, #34 D1; not a reference under
 * cc808b6).
 */
import * as assert from 'assert';
import { existsSync, readFileSync } from 'fs';
import { describe, it } from 'mocha';
import { join } from 'path';
import { GoalTree, Model } from '@goal-controller/goal-tree';
import { godaEngineMapper, type GodaGoalNode } from '../../../src';
import { GODA_GENERATORS } from '../../../src/engines/goda/template/variants';
import {
  __test_only_exports__,
  composeFormulas,
} from '../../../src/engines/goda/template/formulas';

/* eslint-disable-next-line @typescript-eslint/no-require-imports */
const { EXAMPLES } = require('../../../../../scripts/goda-stress/fetch.cjs');

/** The selected root's containers, as cc808b6 builds them. */
const rootOf = (text: string) => {
  const goalsOf = (goal: GodaGoalNode): GodaGoalNode[] => [
    goal,
    ...(goal.children ?? []).flatMap(goalsOf),
  ];
  const roots = GoalTree.fromModel(
    Model.parse(text),
    godaEngineMapper,
  ).nodes.filter((node): node is GodaGoalNode => node.type === 'goal');
  const goal = roots
    .flatMap(goalsOf)
    .find((g) => g.properties.engine.selected)!;
  const root = roots.find((r) => goalsOf(r).includes(goal))!;
  return GODA_GENERATORS.cc808b6!.containers({
    roots: [root],
    selected: (g) => g === goal,
  })[0]!;
};

/** Both clean-ups on the same containers (each composes afresh). */
const both = (text: string) => ({
  skipping: composeFormulas(rootOf(text), { frequency: true }),
  everyOne: composeFormulas(rootOf(text), {
    frequency: true,
    skipUnchanged: false,
  }),
});

/**
 * G1 decides between G2 and G3 (each with a context), each an AND of two
 * tasks that inherit their goal's context (cc808b6): CTX_ factors in the
 * cost's products.
 */
const decided = JSON.stringify({
  actors: [
    {
      id: 'actor',
      text: 'Robot',
      type: 'istar.Actor',
      x: 0,
      y: 0,
      nodes: [
        ['g1', 'Goal', 'G1: Serve [DM(G2,G3)]', { selected: 'true' }],
        [
          'g2',
          'Goal',
          'G2: By day',
          { creationProperty: 'assertion condition day = true' },
        ],
        [
          'g3',
          'Goal',
          'G3: By night',
          { creationProperty: 'assertion condition day = false' },
        ],
        ['t1', 'Task', 'T1: Load'],
        ['t11', 'Task', 'T1.1: Pick'],
        ['t12', 'Task', 'T1.2: Place'],
        ['t2', 'Task', 'T2: Carry'],
        ['t21', 'Task', 'T2.1: Lift'],
        ['t22', 'Task', 'T2.2: Drop'],
      ].map(([id, kind, text, props], i) => ({
        id,
        text,
        type: `istar.${kind}`,
        x: i * 100,
        y: 0,
        ...(props && { customProperties: props }),
      })),
    },
  ],
  dependencies: [],
  links: [
    ['g2', 'g1', 'Or'],
    ['g3', 'g1', 'Or'],
    ['t1', 'g2', 'And'],
    ['t11', 't1', 'And'],
    ['t12', 't1', 'And'],
    ['t2', 'g3', 'And'],
    ['t21', 't2', 'And'],
    ['t22', 't2', 'And'],
  ].map(([source, target, kind], i) => ({
    id: `l${i}`,
    type: `istar.${kind}RefinementLink`,
    source,
    target,
  })),
  tool: 'pistar.2.1.0',
  istar: '2.0',
  diagram: { width: 800, height: 600 },
});

describe("GODA cc808b6: the cost clean-up's skip of replacements that changed nothing", () => {
  it('gives what running every replacement gives, on a decided model with inherited contexts', () => {
    const { skipping, everyOne } = both(decided);
    assert.strictEqual(skipping.cost, everyOne.cost);
    assert.strictEqual(skipping.reliability, everyOne.reliability);
  });

  it('cleans what it should, and the same, on formulas with repeated factors', () => {
    const { cleanMultipleContexts } = __test_only_exports__;
    for (const [form, cleaned] of [
      // a product with a factor twice: written once (the spaces of the
      // products it rewrites go: upstream's replacement)
      ['A*B + CTX_a*R_a*CTX_a', 'A*B+CTX_a*R_a'],
      // the same product twice: both replaced by the first replacement
      ['CTX_a*W_a*CTX_a - CTX_a*W_a*CTX_a', 'CTX_a*W_a-CTX_a*W_a'],
      // after a change, a replacement that changed nothing before runs again
      ['X*Y*X + X*Y + X*Y*X*Y', 'X*Y+X*Y+X*Y'],
      // nothing repeated: the same products (their spaces go all the same)
      ['A*B + C', 'A*B+C'],
    ] as const) {
      assert.strictEqual(cleanMultipleContexts(form, true), cleaned, form);
      assert.strictEqual(cleanMultipleContexts(form, false), cleaned, form);
    }
  });

  it('gives what running every replacement gives on Fragmented (24,722 replacements, 212 that change it)', function () {
    const file = join(EXAMPLES, 'Alternative Modeling', 'Fragmented.txt');
    // the upstream models are fetched, not committed (#34 D1)
    if (!existsSync(file)) this.skip();
    this.timeout(60_000);
    const { skipping, everyOne } = both(readFileSync(file, 'utf8'));
    assert.strictEqual(skipping.cost, everyOne.cost);
  });
});
