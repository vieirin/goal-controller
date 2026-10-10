/**
 * The GODA engine (goal-controller#32): its outputs against upstream's
 * references for AND and OR (fetched into the gitignored cache by
 * `node scripts/goda-stress/fetch.cjs`, not committed: #34 D1), against
 * closed forms on a model of our own, what it doesn't generate yet, and the
 * formula evaluator it shares with the stress test (#35).
 */
import * as assert from 'assert';
import { existsSync, readFileSync } from 'fs';
import { describe, it } from 'mocha';
import { join } from 'path';
import { Model } from '@goal-controller/goal-tree';
import {
  close,
  compareFormulas,
  compileFormula,
  engineOutputProblems,
  evalFormulaValues,
  evaluate,
  godaCheckRegistry,
  godaOutput,
  GodaUnsupported,
  GODA_IMPLEMENTED_VARIANTS,
  GODA_VARIANTS,
  primaryFile,
  random,
  SEED,
  type EngineOutput,
} from '../../../src';

/* eslint-disable-next-line @typescript-eslint/no-require-imports */
const { EXAMPLES } = require('../../../../../scripts/goda-stress/fetch.cjs');

const ROOT = join(__dirname, '../../../../..');
const LAB = join(ROOT, 'examples/goda/LabResults.txt');

const modelOf = (text: string) => Model.parse(text);
const outputOf = (text: string, modelName = 'model.txt'): EngineOutput =>
  godaOutput(modelOf(text), { modelName });
const fileOf = (output: EngineOutput, id: string) =>
  output.files.find((file) => file.id === id)!.text;

/** A one-actor model: its nodes' texts and properties, and its links (child → parent). */
const model = (
  nodes: Array<
    [
      id: string,
      kind: 'Goal' | 'Task',
      text: string,
      props?: Record<string, string>,
    ]
  >,
  links: Array<[child: string, parent: string, kind?: 'And' | 'Or']>,
): string =>
  JSON.stringify({
    actors: [
      {
        id: 'actor',
        text: 'Robot',
        type: 'istar.Actor',
        x: 0,
        y: 0,
        nodes: nodes.map(([id, kind, text, props], i) => ({
          id,
          text,
          type: `istar.${kind}`,
          x: i * 100,
          y: 100,
          ...(props && { customProperties: props }),
        })),
      },
    ],
    dependencies: [],
    links: links.map(([child, parent, kind = 'And'], i) => ({
      id: `link${i}`,
      type: `istar.${kind}RefinementLink`,
      source: child,
      target: parent,
    })),
    tool: 'pistar.2.1.0',
    istar: '2.0',
    diagram: { width: 800, height: 600 },
  });

/** G1 (selected) → T1, refined into T1.1 and T1.2 (AND or OR). */
const twoTasks = (kind: 'And' | 'Or', texts = ['T1.1: Pick', 'T1.2: Place']) =>
  model(
    [
      ['g1', 'Goal', 'G1: Move', { selected: 'true' }],
      ['t1', 'Task', 'T1: Handle'],
      ['t11', 'Task', texts[0]!],
      ['t12', 'Task', texts[1]!],
    ],
    [
      ['t1', 'g1'],
      ['t11', 't1', kind],
      ['t12', 't1', kind],
    ],
  );

describe('GODA: the references of AND and OR', () => {
  for (const [folder, file] of [
    ['AND', 'and2.txt'],
    ['OR', 'or2.txt'],
  ] as const)
    it(`${folder}: every file byte for byte, and its formulas at 101 points`, function () {
      const dir = join(EXAMPLES, folder);
      // the upstream models are fetched, not committed (#34 D1)
      if (!existsSync(join(dir, file))) this.skip();
      const output = outputOf(readFileSync(join(dir, file), 'utf8'), file);
      assert.deepStrictEqual(engineOutputProblems(output), []);
      assert.strictEqual(primaryFile(output).fileName, `${folder}.nm`);
      for (const { fileName, text } of output.files)
        assert.strictEqual(
          text,
          readFileSync(join(dir, 'output', fileName), 'utf8'),
          fileName,
        );
      const evalValues = evalFormulaValues(fileOf(output, 'evaluate'));
      for (const id of ['reliability', 'cost']) {
        const reference = readFileSync(
          join(dir, 'output', `${id}.out`),
          'utf8',
        );
        const compared = compareFormulas(fileOf(output, id), reference, {
          evalValues,
        });
        assert.ok(compared.equal, `${id}: ${JSON.stringify(compared)}`);
      }
    });
});

describe('GODA: a model of our own (examples/goda/LabResults.txt)', () => {
  const output = outputOf(readFileSync(LAB, 'utf8'), 'LabResults.txt');

  it('writes upstream’s eight files, the MDP first and primary, named after the actor', () => {
    assert.deepStrictEqual(engineOutputProblems(output), []);
    assert.deepStrictEqual(
      output.files.map((file) => [file.id, file.fileName, !!file.primary]),
      [
        ['model', 'Lab.nm', true],
        ['reachability-max', 'ReachabilityMax.pctl', false],
        ['reachability-min', 'ReachabilityMin.pctl', false],
        ['cost-max', 'CostMax.pctl', false],
        ['cost-min', 'CostMin.pctl', false],
        ['reliability', 'reliability.out', false],
        ['cost', 'cost.out', false],
        ['evaluate', 'eval_formula.sh', false],
      ],
    );
    assert.strictEqual(
      fileOf(output, 'cost-min'),
      'R{"cost"}min=? [ F "success" ]\n',
    );
  });

  it('sequences the leaves, one time slot each, in id order', () => {
    const nm = fileOf(output, 'model');
    const starts = [...nm.matchAll(/\[next_(\d+)\] (s\w+) = 0 ->/g)].map(
      ([, slot, state]) => `${state}@${slot}`,
    );
    assert.deepStrictEqual(starts, [
      'sG1_T1_1@0',
      'sG1_T1_21@1',
      'sG1_T1_22@2',
      'sG2_T2@3',
    ]);
    assert.ok(
      nm.includes(
        'formula G1 = ((sG1_T1_1=2) & ((sG1_T1_21=2) | (sG1_T1_22=2)));',
      ),
    );
    assert.ok(nm.includes('formula G0 = G1 & G2;\nlabel "success" = G0;'));
  });

  it('reads a leaf’s cost bracket into its reward, and leaves it out of the module’s name', () => {
    const nm = fileOf(output, 'model');
    assert.ok(nm.includes('module G1_T1_1_PrepareSample\r\n'));
    for (const reward of [
      'sG1_T1_1 = 1 : 2;',
      'sG1_T1_21 = 1 : 0.5*x;',
      'sG1_T1_22 = 1 : 1*y;',
      'sG2_T2 = 1 : W_G2_T2;',
    ])
      assert.ok(nm.includes(reward), reward);
    assert.ok(
      nm.includes('const double x;\nconst double y;\nconst double W_G2_T2;\n'),
    );
  });

  it('composes formulas equal to the closed forms of its tree', () => {
    const reliability = compileFormula(fileOf(output, 'reliability'));
    const cost = compileFormula(fileOf(output, 'cost'));
    const next = random(SEED);
    for (let i = 0; i < 100; i++) {
      const v: Record<string, number> = {};
      for (const name of new Set([...reliability.variables, ...cost.variables]))
        v[name] = next();
      const r = (id: string) => v[`F_${id}`]! * v[`R_${id}`]!;
      const [r11, r21, r22, r2] = [
        'G1_T1_1',
        'G1_T1_21',
        'G1_T1_22',
        'G2_T2',
      ].map(r) as [number, number, number, number];
      // OR: either; AND: both
      const r12 = r21 + r22 - r21 * r22;
      const rT1 = r11 * r12;
      // upstream's cost: AND, each child's cost times every child's reliability;
      // OR of two, both costs times the OR's reliability, less the first's reliability times the second's cost
      const [c11, c21, c22, c2] = [2, 0.5 * v.x!, v.y!, v.W_G2_T2!];
      const c12 = r12 * (c21 + c22) - r21 * c22;
      const cT1 = rT1 * c11 + rT1 * c12;
      assert.ok(close(evaluate(reliability, v), rT1 * r2));
      assert.ok(close(evaluate(cost, v), rT1 * r2 * cT1 + rT1 * r2 * c2));
    }
  });
});

describe('GODA: several actors', () => {
  // each actor has its root; the second holds the selected goal
  const actor = (id: string, text: string, nodes: object[]) => ({
    id,
    text,
    type: 'istar.Actor',
    x: 0,
    y: 0,
    nodes,
  });
  const node = (id: string, kind: string, text: string, props?: object) => ({
    id,
    text,
    type: `istar.${kind}`,
    x: 0,
    y: 0,
    ...(props && { customProperties: props }),
  });
  const twoActors = JSON.stringify({
    actors: [
      actor('lab', 'Lab', [
        node('g1', 'Goal', 'G1: Analyse'),
        node('t1', 'Task', 'T1: Test sample'),
      ]),
      actor('robot', 'Delivery Robot', [
        node('g2', 'Goal', 'G2: Deliver', { selected: 'true' }),
        node('t2', 'Task', 'T2: Carry sample'),
      ]),
    ],
    dependencies: [],
    links: [
      { id: 'l1', type: 'istar.AndRefinementLink', source: 't1', target: 'g1' },
      { id: 'l2', type: 'istar.AndRefinementLink', source: 't2', target: 'g2' },
    ],
    tool: 'pistar.2.1.0',
    istar: '2.0',
    diagram: { width: 800, height: 600 },
  });

  it('names the MDP after its actor, never as a path out of out/', () => {
    const escaping = twoActors.replace('"Delivery Robot"', '"../models/lab"');
    const output = outputOf(escaping, 'lab.txt');
    assert.strictEqual(primaryFile(output).fileName, '.._models_lab.nm');
    assert.deepStrictEqual(engineOutputProblems(output), []);
  });

  it('names the MDP after the actor of the selected goal, and writes only its tree', () => {
    const output = outputOf(twoActors, 'lab.txt');
    // AgentDefinition: the actor's name, its whitespace made `_`
    assert.strictEqual(primaryFile(output).fileName, 'Delivery_Robot.nm');
    const nm = fileOf(output, 'model');
    assert.ok(nm.includes('module G2_T2_CarrySample'));
    assert.ok(!nm.includes('G1_T1'));
    assert.ok(nm.includes('label "success" = G2;'));
  });
});

describe('GODA: models', () => {
  it('AND and OR of two tasks: the goal formula joins them with & or |', () => {
    assert.ok(
      fileOf(outputOf(twoTasks('And')), 'model').includes(
        'formula G1 = ((sG1_T1_1=2) & (sG1_T1_2=2));',
      ),
    );
    assert.ok(
      fileOf(outputOf(twoTasks('Or')), 'model').includes(
        'formula G1 = ((sG1_T1_1=2) | (sG1_T1_2=2));',
      ),
    );
  });

  it('orders siblings by id, digits read as one number (T1.2 before T1.10)', () => {
    const nm = fileOf(
      outputOf(twoTasks('And', ['T1.10: Pick', 'T1.2: Place'])),
      'model',
    );
    assert.ok(
      nm.indexOf('module G1_T1_2_Place') < nm.indexOf('module G1_T1_10_Pick'),
    );
  });

  it('reads a bracket without its spaces, and a cost of a variable', () => {
    const nm = fileOf(
      outputOf(
        twoTasks('And', ['T1.1: Pick [W = 0.25 load]', 'T1.2: Place [W=3]']),
      ),
      'model',
    );
    assert.ok(nm.includes('sG1_T1_1 = 1 : 0.25*load;'));
    assert.ok(nm.includes('sG1_T1_2 = 1 : 3;'));
    assert.ok(nm.includes('const double load;\nrewards "cost"'));
  });

  it('generates from exactly one selected goal', () => {
    const none = twoTasks('And').replace(
      '"selected":"true"',
      '"selected":"false"',
    );
    assert.throws(() => outputOf(none), /set selected to true on one goal/);
  });

  it('names what it does not generate yet, with its issue', () => {
    const unsupported = (text: string, issue: string) =>
      assert.throws(
        () => outputOf(text),
        (error: Error) =>
          error instanceof GodaUnsupported && error.message.includes(issue),
      );
    // an unknown element
    unsupported(twoTasks('And', ['T1.X: Pick', 'T1.2: Place']), '#37');
    assert.deepStrictEqual(GODA_VARIANTS, ['cc808b6', '5305bc1']);
    assert.deepStrictEqual(GODA_IMPLEMENTED_VARIANTS, ['cc808b6']);
    assert.throws(
      () =>
        godaOutput(modelOf(twoTasks('And')), {
          modelName: 'model.txt',
          variant: '5305bc1',
        }),
      GodaUnsupported,
    );
  });

  it('checks that one goal is selected, across the model', () => {
    const check = godaCheckRegistry['goda.goal.selected'];
    const elements = {
      G1: { kind: 'goal', children: [], properties: { selected: 'true' } },
      G2: { kind: 'goal', children: [], properties: { selected: 'true' } },
      G3: { kind: 'goal', children: [], properties: {} },
    };
    const context = (self: string) => ({
      self,
      kindOf: () => undefined,
      elements,
    });
    assert.strictEqual(
      check({ selected: 'true' }, context('G1')),
      'Only one goal is selected: G2 is selected too',
    );
    assert.strictEqual(check({}, context('G3')), null);
    // without the model, a check across elements says nothing
    assert.strictEqual(
      check({ selected: 'true' }, { self: 'G1', kindOf: () => undefined }),
      null,
    );
  });
});

describe('GODA: formulas as numbers', () => {
  const RELIABILITY = '(F_A*R_A*F_B*R_B)\n\n//R_A = reliability of node A\n';
  const OR = '(-F_A*R_A*F_B*R_B+F_A*R_A+F_B*R_B)';
  const value = (text: string, values = {}) =>
    evaluate(compileFormula(text), values);

  it('reads formulas: precedence, unary minus, comments, deep nesting', () => {
    assert.strictEqual(value('2+3*4'), 14);
    assert.strictEqual(value('-2*3+1'), -5);
    assert.strictEqual(value('(-(-(2)))'), 2);
    assert.strictEqual(value('2^3^2'), 512);
    assert.strictEqual(value('8/4/2'), 1);
    assert.strictEqual(value('1-x', { x: 0.25 }), 0.75);
    assert.deepStrictEqual(compileFormula(RELIABILITY).variables, [
      'F_A',
      'F_B',
      'R_A',
      'R_B',
    ]);
    const deep = `${'('.repeat(20000)}x${')'.repeat(20000)}`;
    assert.strictEqual(value(deep, { x: 3 }), 3);
    for (const bad of ['', '(x', 'x)', 'x y', '*x', 'x+', 'x $ y'])
      assert.throws(() => compileFormula(bad), bad);
  });

  it('reads the values eval_formula.sh gives', () => {
    assert.deepStrictEqual(
      evalFormulaValues(
        '#!/bin/bash\nW_A="1";\nR_A="0.99";\n\nsed -e "s/W_A/$W_A/g" $1 | bc\n',
      ),
      { W_A: 1, R_A: 0.99 },
    );
  });

  it('compares formulas numerically: equal when equivalent, not when they differ anywhere', () => {
    const evalValues = { F_A: 0.99, R_A: 0.99, F_B: 0.99, R_B: 0.99 };
    const same = compareFormulas('R_A*F_A*(R_B*F_B)', RELIABILITY, {
      evalValues,
    });
    assert.ok(same.equal);
    assert.ok('points' in same && same.points === 101);
    // equal at the eval_formula.sh point (all 0.99) but not elsewhere
    const swapped = compareFormulas('F_A*R_A*F_B*F_B', RELIABILITY, {
      evalValues,
    });
    assert.ok(!swapped.equal);
    assert.ok('mismatches' in swapped && swapped.mismatches.count === 100);
    // a variable one side lacks
    const extra = compareFormulas(`${OR}*CTX_A`, OR, {
      evalValues: { ...evalValues, CTX_A: 1 },
    });
    assert.ok(!extra.equal);
    assert.ok('variables' in extra);
    assert.deepStrictEqual(extra.variables.onlyOurs, ['CTX_A']);
    // a value the reference's own script doesn't give: that point is left out
    const partial = compareFormulas(OR, OR, { evalValues: { F_A: 1 } });
    assert.ok(partial.equal && 'points' in partial && partial.points === 100);
    assert.ok('evalPoint' in partial);
    assert.deepStrictEqual(partial.evalPoint?.missing, ['F_B', 'R_A', 'R_B']);
    // within 1e-9, relative above 1
    assert.ok(close(1e6, 1e6 + 1e-4));
    assert.ok(!close(0.5, 0.5 + 2e-9));
    // seeded: the same points every run
    const a = random(SEED);
    const b = random(SEED);
    assert.deepStrictEqual([a(), a(), a()], [b(), b(), b()]);
    // a formula that doesn't read is said so, not thrown
    assert.deepStrictEqual(compareFormulas('(x', OR), {
      equal: false,
      error: 'ours: unbalanced (',
    });
  });
});
