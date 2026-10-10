/**
 * GODA's decision making and context conditions (goal-controller#36): the
 * DM reference byte for byte (fetched into the gitignored cache, #34 D1), the
 * decision-making module and the context parameters on models of our own,
 * and the pieces of upstream's Java they are ported from.
 */
import * as assert from 'assert';
import { existsSync, readFileSync } from 'fs';
import { describe, it } from 'mocha';
import { join } from 'path';
import { Model } from '@goal-controller/goal-tree';
import {
  compareFormulas,
  compileFormula,
  engineOutputProblems,
  evaluate,
  goda,
  godaOutput,
  type EngineOutput,
} from '../../../src';
import {
  clearCondition,
  contextsInfo,
} from '../../../src/engines/goda/template/contexts';
import { javaHashMapOrder } from '../../../src/engines/goda/template/javaHashMap';
import { combinations } from '../../../src/engines/goda/template/prism';

/* eslint-disable-next-line @typescript-eslint/no-require-imports */
const { EXAMPLES } = require('../../../../../scripts/goda-stress/fetch.cjs');

const fileOf = (output: EngineOutput, id: string) =>
  output.files.find((file) => file.id === id)!.text;

/** One actor: G1 (selected) → T1 [annotation], refined (OR) into its tasks, each with its context. */
const decision = (
  annotation: string,
  tasks: Array<[id: string, context?: string]>,
): string =>
  JSON.stringify({
    actors: [
      {
        id: 'actor',
        text: 'Robot',
        type: 'istar.Actor',
        x: 0,
        y: 0,
        nodes: [
          {
            id: 'g1',
            text: 'G1: Deliver',
            type: 'istar.Goal',
            x: 0,
            y: 0,
            customProperties: { selected: 'true' },
          },
          {
            id: 't1',
            text: `T1: Choose${annotation ? ` [${annotation}]` : ''}`,
            type: 'istar.Task',
            x: 0,
            y: 100,
          },
          ...tasks.map(([id, context], i) => ({
            id: `c${i}`,
            text: `${id}: Route`,
            type: 'istar.Task',
            x: i * 100,
            y: 200,
            ...(context && { customProperties: { creationProperty: context } }),
          })),
        ],
      },
    ],
    dependencies: [],
    links: [
      {
        id: 'l',
        type: 'istar.AndRefinementLink',
        source: 't1',
        target: 'g1',
      },
      ...tasks.map((_, i) => ({
        id: `l${i}`,
        type: 'istar.OrRefinementLink',
        source: `c${i}`,
        target: 't1',
      })),
    ],
    tool: 'pistar.2.1.0',
    istar: '2.0',
    diagram: { width: 800, height: 600 },
  });

const generate = (text: string) =>
  godaOutput(Model.parse(text, goda), {
    modelName: 'robot.txt',
    variant: 'cc808b6',
  });

describe('GODA: the DM reference (#36)', () => {
  it('DM: every file byte for byte', function () {
    const dir = join(EXAMPLES, 'DM');
    // the upstream models are fetched, not committed (#34 D1)
    if (!existsSync(join(dir, 'dm2.txt'))) this.skip();
    const output = godaOutput(
      Model.parse(readFileSync(join(dir, 'dm2.txt'), 'utf8'), goda),
      { modelName: 'dm2.txt', variant: 'cc808b6' },
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

describe('GODA: decision making', () => {
  const two = generate(
    decision('DM(T1.1,T1.2)', [
      ['T1.1', 'assertion trigger ctx=1'],
      ['T1.2', 'assertion trigger ctx=2'],
    ]),
  );
  const mdp = fileOf(two, 'model');

  it('writes a decision-making module: one constant per combination of the contexts, a global per child', () => {
    assert.deepStrictEqual(engineOutputProblems(two), []);
    for (const line of [
      'const int CTX_1; // ctx = 1 \n',
      'const int CTX_2; // ctx = 2 \n',
      'const int CTX_3; // ctx = 1 & ctx = 2 \n',
      'global CTX_G1_T1_1: [0..1] init 0;\n',
      'global CTX_G1_T1_2: [0..1] init 0;\n',
      'module NonDeterminism_G1_T1\r\n\tsG1_T1 :[0..5] init 0;',
      "[next_0] sG1_T1 = 0 -> (sG1_T1'= 1);",
      "[] sG1_T1 = 1 -> CTX_3 : (sG1_T1'= 4)  + (1 - CTX_3) : (sG1_T1'=1);",
      "\t[] sG1_T1 = 4 -> (sG1_T1'=5) & (CTX_G1_T1_1'=1) & (CTX_G1_T1_2'=1);\n",
      "[next_1] sG1_T1 = 5 -> (sG1_T1'=5);",
    ])
      assert.ok(mdp.includes(line), line);
    // before the leaves it chooses between
    assert.ok(
      mdp.indexOf('module NonDeterminism_G1_T1') <
        mdp.indexOf('module G1_T1_1_Route'),
    );
  });

  it('starts each chosen leaf on its global, which no constant of its own declares', () => {
    assert.ok(
      mdp.includes(
        "[next_1] sG1_T1_1 = 0 -> F_G1_T1_1*CTX_G1_T1_1 : (sG1_T1_1'=1) + (1 - F_G1_T1_1*CTX_G1_T1_1) : (sG1_T1_1'=3); //init to running or skip",
      ),
    );
    assert.ok(!mdp.includes('const int CTX_G1_T1_1'));
    assert.ok(mdp.includes('formula G1 = ((sG1_T1_1=2) | (sG1_T1_2=2));'));
    // its parameters, the context's first
    assert.match(
      fileOf(two, 'evaluate'),
      /^#!\/bin\/bash\nCTX_G1_T1_1="1";\nW_G1_T1_1="1";\nR_G1_T1_1="0.99";\nF_G1_T1_1="0.99";\nCTX_G1_T1_2="1";/,
    );
  });

  it('composes the formulas of an OR over the leaves, each times its context', () => {
    const at = (values: Record<string, number>) => ({
      reliability: evaluate(compileFormula(fileOf(two, 'reliability')), values),
      cost: evaluate(compileFormula(fileOf(two, 'cost')), values),
    });
    const values = {
      CTX_G1_T1_1: 1,
      CTX_G1_T1_2: 0,
      F_G1_T1_1: 0.9,
      R_G1_T1_1: 0.8,
      F_G1_T1_2: 0.7,
      R_G1_T1_2: 0.6,
      W_G1_T1_1: 3,
      W_G1_T1_2: 5,
    };
    const [a, b] = [0.9 * 0.8, 0.7 * 0.6 * 0];
    assert.ok(Math.abs(at(values).reliability - (a + b - a * b)) < 1e-12);
    // upstream's cost of an OR: the sum of the costs times the reliability, less the first's reliability times the second's cost
    assert.ok(
      Math.abs(at(values).cost - ((a + b - a * b) * (3 + 0) - a * 0)) < 1e-12,
    );
    // the contexts come first among the comments, in HashMap order (_2 before _1)
    assert.match(
      fileOf(two, 'reliability'),
      /\n\n\/\/CTX_G1_T1_2 = \(ctx=2\)\n\/\/CTX_G1_T1_1 = \(ctx=1\)\n\/\/R_G1_T1_1/,
    );
  });

  it('chooses among three contexts: seven combinations', () => {
    const three = fileOf(
      generate(
        decision('DM(T1.1,T1.2,T1.3)', [
          ['T1.1', 'assertion trigger a=1'],
          ['T1.2', 'assertion trigger b=1'],
          ['T1.3', 'assertion trigger a=1 & b=1'],
        ]),
      ),
      'model',
    );
    assert.ok(three.includes('sG1_T1 :[0..9] init 0;'));
    assert.ok(
      three.includes('const int CTX_7; // a = 1 & b = 1 & a = 1 & b = 1 \n'),
    );
    assert.ok(
      three.includes(
        "\t[] sG1_T1 = 8 -> (sG1_T1'=9) & (CTX_G1_T1_1'=1) & (CTX_G1_T1_2'=1) & (CTX_G1_T1_3'=1);\n",
      ),
    );
  });

  it('declares the constant of a context no decision-making module sets', () => {
    const plain = fileOf(
      generate(decision('', [['T1.1', 'assertion condition ready = true']])),
      'model',
    );
    assert.ok(plain.includes('const int CTX_G1_T1_1; //ready = true\n'));
    assert.ok(!plain.includes('NonDeterminism'));
  });

  it('agrees with the reference formulas of the same shape at 101 points', () => {
    // the DM reference's formulas, written by hand from its tree (no upstream file)
    const reliability =
      '(-CTX_G1_T1_1*F_G1_T1_1*R_G1_T1_1*CTX_G1_T1_2*F_G1_T1_2*R_G1_T1_2+CTX_G1_T1_1*F_G1_T1_1*R_G1_T1_1+CTX_G1_T1_2*F_G1_T1_2*R_G1_T1_2)';
    assert.ok(compareFormulas(fileOf(two, 'reliability'), reliability).equal);
  });
});

describe('GODA: what decision making is ported from', () => {
  it('GenerateCombination: every non-empty combination, as a binary count', () => {
    assert.deepStrictEqual(combinations(['a', 'b', 'c']), [
      ['a'],
      ['b'],
      ['a', 'b'],
      ['c'],
      ['a', 'c'],
      ['b', 'c'],
      ['a', 'b', 'c'],
    ]);
  });

  it('CtxParser and clearCtxList: a condition as each writer prints it', () => {
    assert.strictEqual(contextsInfo(['assertion trigger ctx=1']), 'ctx = 1');
    assert.strictEqual(
      contextsInfo([
        'assertion condition ctx1 = 10 & ctx = 1',
        'assertion trigger x>0.5|y',
      ]),
      'ctx1 = 10 & ctx = 1 & x > 0.5 | y',
    );
    // a parenthesis has no visitor upstream: ANTLR's default gives null
    assert.strictEqual(contextsInfo(['assertion trigger (a = 1)']), 'null');
    assert.throws(() => contextsInfo(['ctx = 1']), /not a context condition/);
    assert.strictEqual(clearCondition('assertion trigger ctx=1'), 'ctx=1');
    assert.strictEqual(
      clearCondition('assertion condition  a = 1 & b = 2'),
      'a = 1 & b = 2',
    );
    // the language reads more than one space between the prefix's words
    assert.strictEqual(clearCondition('assertion  trigger ctx=1'), 'ctx=1');
    assert.strictEqual(contextsInfo(['assertion\ttrigger ctx=1']), 'ctx = 1');
    // CtxRegex.g4's `expr '!=' value`
    assert.strictEqual(
      contextsInfo(['assertion trigger docked != false']),
      'docked != false',
    );
  });

  it("HashMap: Java's iteration order of String keys", () => {
    // String.hashCode's buckets of a 16-slot table: _2 (14) before _1 (15)
    assert.deepStrictEqual(javaHashMapOrder(['CTX_G1_T1_1', 'CTX_G1_T1_2']), [
      'CTX_G1_T1_2',
      'CTX_G1_T1_1',
    ]);
    // one bucket keeps insertion order; more than 12 keys double the table
    const keys = Array.from({ length: 13 }, (_, i) => `k${i}`);
    assert.deepStrictEqual(
      [...javaHashMapOrder(keys)].sort(),
      [...keys].sort(),
    );
    assert.deepStrictEqual(javaHashMapOrder(['a', 'a']), ['a']);
  });
});
