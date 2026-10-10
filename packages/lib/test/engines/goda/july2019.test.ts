/**
 * GODA's 5305bc1 generator (2019-07, goal-controller#38): TAS, Fragmented
 * and BSN byte for byte (fetched into the gitignored cache, #34 D1), and its
 * changes over cc808b6 on models of our own: no frequency parameter, the
 * guards after a sibling goal (9a993f8), the time slots, the three-state
 * decision-making module, a leaf's context from its nearest decided
 * ancestor, the formulas and the eval script PARAMProducer writes.
 */
import * as assert from 'assert';
import { existsSync, readFileSync } from 'fs';
import { describe, it } from 'mocha';
import { join } from 'path';
import { Model } from '@goal-controller/goal-tree';
import {
  compileFormula,
  engineOutputProblems,
  evaluate,
  goda,
  godaOutput,
  type EngineOutput,
} from '../../../src';
import type { Container } from '../../../src/engines/goda/template/containers';
import { JULY_2019_PREV_FAILURE } from '../../../src/engines/goda/template/templates';
import { GODA_GENERATORS } from '../../../src/engines/goda/template/variants';

/* eslint-disable-next-line @typescript-eslint/no-require-imports */
const { EXAMPLES } = require('../../../../../scripts/goda-stress/fetch.cjs');

const fileOf = (output: EngineOutput, id: string) =>
  output.files.find((file) => file.id === id)!.text;

type Node = [
  id: string,
  kind: 'Goal' | 'Task' | 'Resource',
  text: string,
  props?: Record<string, string>,
];
/** One actor: its nodes, and its links (child → parent). */
const model = (
  nodes: Node[],
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

const july = (text: string) =>
  godaOutput(Model.parse(text, goda), {
    modelName: 'robot.txt',
    variant: '5305bc1',
  });

/** G1 (selected, AND or OR) → G2 → T1, G3 → T2: two sibling goals in sequence. */
const siblings = (kind: 'And' | 'Or') =>
  model(
    [
      ['g1', 'Goal', 'G1: Serve', { selected: 'true' }],
      ['g2', 'Goal', 'G2: Fetch'],
      ['g3', 'Goal', 'G3: Deliver'],
      ['t1', 'Task', 'T1: Pick'],
      ['t2', 'Task', 'T2: Drop'],
    ],
    [
      ['g2', 'g1', kind],
      ['g3', 'g1', kind],
      ['t1', 'g2'],
      ['t2', 'g3'],
    ],
  );

describe('GODA 5305bc1: the TAS, Fragmented and BSN references (#38)', () => {
  for (const [folder, file] of [
    ['TAS', 'TAS.txt'],
    ['Alternative Modeling', 'Fragmented.txt'],
    ['BSN', 'BSN.txt'],
  ] as const)
    it(`${folder}: every file byte for byte`, function () {
      const dir = join(EXAMPLES, folder);
      // the upstream models are fetched, not committed (#34 D1)
      if (!existsSync(join(dir, file))) this.skip();
      const output = godaOutput(
        Model.parse(readFileSync(join(dir, file), 'utf8'), goda),
        { modelName: file, variant: '5305bc1' },
      );
      assert.deepStrictEqual(engineOutputProblems(output), []);
      for (const { fileName, text } of output.files)
        assert.strictEqual(
          text,
          readFileSync(join(dir, 'output', fileName), 'utf8'),
          fileName,
        );
    });
});

describe('GODA 5305bc1: what changed since cc808b6', () => {
  it('has no frequency parameter: a leaf starts running, its reliability is R_', () => {
    const output = july(siblings('And'));
    const mdp = fileOf(output, 'model');
    assert.ok(!mdp.includes('F_'));
    assert.ok(mdp.includes('const double R_G2_T1;\r\nmodule G2_T1_Pick\r\n'));
    assert.ok(
      mdp.includes("[next_0] sG2_T1 = 0 -> (sG2_T1'=1);//init to running"),
    );
    assert.strictEqual(
      fileOf(output, 'reliability').split('\n')[0],
      '(R_G2_T1*R_G3_T2)',
    );
  });

  it('starts a leaf after a sibling goal when that goal succeeded, and skips it otherwise (9a993f8)', () => {
    const and = fileOf(july(siblings('And')), 'model');
    assert.ok(
      and.includes(
        "[next_1] (G2) & sG3_T2 = 0 -> (sG3_T2'=1);//init to running\n\t[next_1] !(G2) & sG3_T2 = 0 -> (sG3_T2'=3);//init to skip\n",
      ),
      and,
    );
    // under an OR: when it failed
    const or = fileOf(july(siblings('Or')), 'model');
    assert.ok(
      or.includes(
        "[next_1] !(G2) & sG3_T2 = 0 -> (sG3_T2'=1);//init to running\n\t[next_1] (G2) & sG3_T2 = 0 -> (sG3_T2'=3);//init to skip\n",
      ),
      or,
    );
    // the first has nothing before it: no guard, an empty line where the skip would be
    assert.ok(
      and.includes(
        "[next_0] sG2_T1 = 0 -> (sG2_T1'=1);//init to running\n\t\n",
      ),
    );
  });

  it('writes a three-state decision-making module whose choices set the globals', () => {
    const output = july(
      model(
        [
          ['g1', 'Goal', 'G1: Deliver [DM(G2,G3)]', { selected: 'true' }],
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
          ['t1', 'Task', 'T1: Drive'],
          [
            't2',
            'Task',
            'T2: Fly',
            { creationProperty: 'assertion trigger wind < 5' },
          ],
        ],
        [
          ['g2', 'g1', 'Or'],
          ['g3', 'g1', 'Or'],
          ['t1', 'g2'],
          ['t2', 'g3'],
        ],
      ),
    );
    const mdp = fileOf(output, 'model');
    for (const line of [
      'const int CTX_1; // day = true \n',
      'const int CTX_3; // day = true & day = false \n',
      'global CTX_G2: [0..1] init 0;\n',
      'module NonDeterminism_G1\r\n\tsG1 :[0..2] init 0;',
      "[] sG1 = 1 -> CTX_3 : (sG1'= 2) & (CTX_G2'=1) & (CTX_G3'=1) + (1 - CTX_3) : (sG1'=1);",
      "[next_1] sG1 = 2 -> (sG1'=2);",
    ])
      assert.ok(mdp.includes(line), line);
    // a leaf with its own condition under a decided goal reads that goal's global, and declares nothing
    assert.ok(
      mdp.includes(
        "sG3_T2 = 0 -> CTX_G3 : (sG3_T2'=1) + (1 - CTX_G3) : (sG3_T2'=3); //init to running or skip",
      ),
      mdp,
    );
    assert.ok(!mdp.includes('const int CTX_G3_T2'));
    // the formulas: an OR of the decided goals, each times its context
    const reliability = compileFormula(fileOf(output, 'reliability'));
    const values = { CTX_G2: 1, CTX_G3: 1, R_G2_T1: 0.9, R_G3_T2: 0.8 };
    assert.ok(
      Math.abs(evaluate(reliability, values) - (0.9 + 0.8 - 0.9 * 0.8)) < 1e-12,
    );
    // the eval script: the formulas' parameters, contexts first
    assert.match(
      fileOf(output, 'evaluate'),
      /^#!\/bin\/bash\nCTX_G\d="1";\nCTX_G\d="1";\nR_/,
    );
    assert.ok(!fileOf(output, 'evaluate').includes('F_'));
  });

  it('multiplies a child that has a context by its CTX_ in its parent’s formula, not in its own', () => {
    const output = july(
      model(
        [
          ['g1', 'Goal', 'G1: Serve', { selected: 'true' }],
          ['t1', 'Task', 'T1: Prepare'],
          [
            't11',
            'Task',
            'T1.1: Heat',
            { creationProperty: 'assertion trigger cold = true' },
          ],
          ['t12', 'Task', 'T1.2: Plate'],
        ],
        [
          ['t1', 'g1'],
          ['t11', 't1'],
          ['t12', 't1'],
        ],
      ),
    );
    assert.strictEqual(
      fileOf(output, 'reliability').split('\n')[0],
      '(CTX_G1_T1_1*R_G1_T1_1*R_G1_T1_2)',
    );
    // and its leaf, a constant of its own (no decision-making module sets it)
    assert.ok(
      fileOf(output, 'model').includes(
        'const int CTX_G1_T1_1; //cold = true\n',
      ),
    );
  });
});

describe('GODA 5305bc1: the guards before a leaf starts (9a993f8)', () => {
  const { guards } = GODA_GENERATORS['5305bc1']!;
  // what guards reads of a container: its kind, its parent, its decomposition
  const container = (
    kind: Container['kind'],
    root: Container | null,
    decomposition: Container['decomposition'] = 'AND',
  ) => ({ kind, root, decomposition }) as Container;
  const unguarded = {
    $PREV_EFFECT$: JULY_2019_PREV_FAILURE,
    $PREV_SUCCESS$: '',
    $PREV_SUCCESS_EFFECT$: '',
  };

  it('guards a leaf after a sibling goal on that goal: its success under an AND, its failure under an OR', () => {
    const and = container('goal', null);
    const leaf = container('plan', container('goal', and));
    assert.deepStrictEqual(guards(leaf, 'G2'), {
      $PREV_EFFECT$: JULY_2019_PREV_FAILURE,
      $PREV_SUCCESS$: '(G2) & ',
      $PREV_SUCCESS_EFFECT$: '!(G2) & ',
    });
    const or = container('goal', null, 'OR');
    assert.deepStrictEqual(
      guards(container('plan', container('goal', or)), 'G2'),
      {
        $PREV_EFFECT$: JULY_2019_PREV_FAILURE,
        $PREV_SUCCESS$: '!(G2) & ',
        $PREV_SUCCESS_EFFECT$: '(G2) & ',
      },
    );
  });

  it('writes no guard for a leaf under the root goal, or under no goal (where upstream throws a NullPointerException)', () => {
    // getParentGoal().getRoot() is null: the root goal's leaf
    assert.deepStrictEqual(
      guards(container('plan', container('goal', null)), 'G2'),
      unguarded,
    );
    // getParentGoal() is null: plans all the way up
    assert.deepStrictEqual(
      guards(container('plan', container('plan', null)), 'G2'),
      unguarded,
    );
    // the first leaf: no formula before it
    assert.deepStrictEqual(guards(container('plan', null), null), {
      $PREV_EFFECT$: '',
      $PREV_SUCCESS$: '',
      $PREV_SUCCESS_EFFECT$: '',
    });
  });
});
