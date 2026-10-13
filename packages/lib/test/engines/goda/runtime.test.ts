/**
 * SA-BSN (goal-controller#94): the GODA engine reads lesunb/bsn's goal model
 * and, with `runtimeFormulas`, writes the two formulas its runtime loads,
 * byte for byte; and `param.zip`, committed beside them, comes from cc808b6
 * on an earlier revision of the model (#93).
 */
import * as assert from 'assert';
import { readdirSync, readFileSync } from 'fs';
import { describe, it } from 'mocha';
import { join } from 'path';
import { Model } from '@goal-controller/goal-tree';
import {
  compileFormula,
  engineOutputProblems,
  goda,
  godaOutput,
  GodaUnsupported,
  type GodaVariant,
} from '../../../src';
import { model } from './support';

const PROJECT = join(__dirname, '../../../../../examples/goda/sa-bsn');
const REFERENCE = join(PROJECT, 'reference');
const SA_BSN = readFileSync(join(PROJECT, 'goalModel.txt'), 'utf8');
const reference = (fileName: string) =>
  readFileSync(join(REFERENCE, fileName), 'utf8');

const generate = (
  text: string,
  options: { variant?: GodaVariant; runtimeFormulas?: boolean } = {},
) =>
  godaOutput(Model.parse(text, goda), {
    modelName: 'goalModel.txt',
    variant: 'cc808b6',
    ...options,
  });
const runtimeOf = (text: string) => {
  const { files } = generate(text, { runtimeFormulas: true });
  const of = (fileName: string) =>
    files.find((file) => file.fileName === fileName)?.text;
  return { reliability: of('reliability.formula'), cost: of('cost.formula') };
};

describe('GODA: SA-BSN’s runtime formulas (#94)', () => {
  it('writes reliability.formula and cost.formula byte for byte, without a newline', () => {
    const output = generate(SA_BSN, { runtimeFormulas: true });
    assert.deepStrictEqual(engineOutputProblems(output), []);
    const { reliability, cost } = runtimeOf(SA_BSN);
    assert.strictEqual(reliability, reference('reliability.formula'));
    assert.strictEqual(cost, reference('cost.formula'));
    assert.ok(!reliability!.endsWith('\n') && !cost!.endsWith('\n'));
  });

  it('reads 7 leaves with the scoped ids the runtime’s terms name', () => {
    const terms = (text: string, prefix: string) =>
      compileFormula(text)
        .variables.filter((v) => v.startsWith(prefix))
        .map((v) => v.slice(prefix.length));
    const { reliability, cost } = runtimeOf(SA_BSN);
    const leaves = [
      'G3_T1_1',
      'G3_T1_2',
      'G3_T1_3',
      'G3_T1_4',
      'G3_T1_5',
      'G3_T1_6',
      'G4_T1',
    ];
    for (const prefix of ['CTX_', 'F_', 'R_'])
      assert.deepStrictEqual(terms(reliability!, prefix), leaves, prefix);
    for (const prefix of ['CTX_', 'W_'])
      assert.deepStrictEqual(terms(cost!, prefix), leaves, prefix);
  });

  it('are off by default: GODA’s eight files, as before', () => {
    const files = generate(SA_BSN).files.map((file) => file.fileName);
    assert.strictEqual(files.length, 8);
    assert.ok(!files.some((file) => file.endsWith('.formula')));
  });

  it('5305bc1 rejects the model, as upstream does: [G3#G4] read as a decision, without contexts', () => {
    assert.throws(
      () => generate(SA_BSN, { variant: '5305bc1', runtimeFormulas: true }),
      /G3 and G4 are decision-making operands without a context/,
    );
  });

  // G1 (selected) → T1, refined into T1.1 and T1.2, each in a context or not
  const twoLeaves = (
    annotation: string,
    kind: 'And' | 'Or' = 'And',
    t11 = 'T1.1: Pick',
  ) =>
    model(
      [
        ['g1', 'Goal', 'G1: Move', { selected: 'true' }],
        ['t1', 'Task', `T1: Handle${annotation}`],
        [
          't11',
          'Task',
          t11,
          { creationProperty: 'assertion trigger a = true' },
        ],
        ['t12', 'Task', 'T1.2: Place'],
      ],
      [
        ['t1', 'g1'],
        ['t11', 't1', kind],
        ['t12', 't1', kind],
      ],
    );

  it('composes an AND, annotated # or not, as a product and a sum; a leaf in a context times its CTX_', () => {
    const expected = {
      reliability: '(CTX_G1_T1_1*F_G1_T1_1*R_G1_T1_1*F_G1_T1_2*R_G1_T1_2)',
      cost: '(CTX_G1_T1_1*W_G1_T1_1+W_G1_T1_2)',
    };
    assert.deepStrictEqual(runtimeOf(twoLeaves('')), expected);
    assert.deepStrictEqual(runtimeOf(twoLeaves(' [T1.1#T1.2]')), expected);
  });

  it('has no runtime form for an OR, a decision, or a leaf with a cost', () => {
    for (const text of [
      twoLeaves('', 'Or'),
      twoLeaves(' [DM(T1.1,T1.2)]'),
      twoLeaves('', 'And', 'T1.1: Pick [W = 2]'),
    ])
      assert.throws(() => runtimeOf(text), GodaUnsupported);
  });
});

describe('GODA: where SA-BSN’s param.zip comes from (#93, #94)', () => {
  const PARAM = readdirSync(REFERENCE).filter(
    (file) => !file.endsWith('.formula'),
  );
  const differing = (text: string) =>
    generate(text)
      .files.filter(({ fileName, text: ours }) => ours !== reference(fileName))
      .map(({ fileName }) => fileName)
      .sort();

  it('is eight files', () => {
    assert.strictEqual(PARAM.length, 8);
  });

  it('cc808b6 on this revision of the model: the formulas and the MDP differ', () => {
    assert.deepStrictEqual(differing(SA_BSN), [
      'BSN.nm',
      'cost.out',
      'reliability.out',
    ]);
  });

  it('cc808b6 reproduces every file from the revision with T1 an OR decision and G2 unannotated', () => {
    const revision = JSON.parse(
      SA_BSN.replace(' [G3#G4]', '').replace(
        '[T1.1#T1.2#T1.3#T1.4#T1.5#T1.6]',
        '[DM(T1.1,T1.2,T1.3,T1.4,T1.5,T1.6)]',
      ),
    ) as {
      actors: { nodes: { id: string; text: string }[] }[];
      links: { type: string; target: string }[];
    };
    const t1 = revision.actors[0]!.nodes.find((node) =>
      node.text.startsWith('T1:Monitor'),
    )!.id;
    for (const link of revision.links)
      if (link.target === t1) link.type = 'istar.OrRefinementLink';
    assert.deepStrictEqual(differing(JSON.stringify(revision)), []);
  });
});
