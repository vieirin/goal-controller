/**
 * The iStar-DT definition and its checks (goal-controller#119): the dialect
 * the framework accepts, its named checks, the model-level problems the
 * writer stops on (what crosses the extension's kinds, #117 D7), its
 * options, and the Notation view reading each seed's document back.
 */
import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { describe, it } from 'mocha';
import { parsePistar } from '@istar-ts/core';
import { goalView } from '@goal-controller/goal-tree';
import {
  contextFromView,
  documentDiagnostics,
  notationDocument,
  notationEdits,
} from '@goal-controller/goal-language';
import { istardtAnalysisModel } from '../../../src/engines/istardt';
import {
  istardt,
  istardtCheckRegistry,
  istardtProblems,
  readIstardtModel,
} from '../../../src/engines/istardt';
import { istardtOptions } from '../../../src/engines/istardt/options';

const PROJECTS = path.join(__dirname, '../../../../../examples/istardt');
const json = (file: string) =>
  JSON.parse(fs.readFileSync(path.join(PROJECTS, file), 'utf8'));
const problemsOf = (model: Record<string, any>) =>
  istardtProblems(
    readIstardtModel(
      istardtAnalysisModel(parsePistar(model, { fileMetamodel: true })),
    ),
  ).map((p) => `${p.severity}: ${p.message}`);
/** a node by the id its text starts with (`G1`) */
const node = (model: Record<string, any>, id: string) =>
  model.actors[0].nodes.find((n: any) => n.text.startsWith(`${id}:`));
/** an effect's link from its group (its probability's) */
const groupLinkTo = (model: Record<string, any>, effect: string) =>
  model.links.find(
    (l: any) =>
      l.type === 'istardt.EffectGroupLink' &&
      l.target === node(model, effect).id,
  );

describe('the iStar-DT definition', () => {
  it('lists goals, tasks and its extension’s kinds with their prefixes, qualities on no line, no notation operator', () => {
    assert.deepStrictEqual(
      Object.entries(istardt.elements).map(
        ([kind, e]) => `${kind} ${e?.prefix}`,
      ),
      [
        'goal G',
        'task T',
        'istardt.Effect E',
        'istardt.Condition C',
        'istardt.Predicate P',
        'istardt.Variable V',
      ],
    );
    assert.deepStrictEqual(istardt.notation?.operators, {});
    assert.deepStrictEqual(
      istardt.properties.quality.map((p) => p.key),
      ['formula', 'root', 'exportMin', 'exportMax', 'identifier'],
    );
  });

  it('declares its options with their defaults', () => {
    assert.deepStrictEqual(
      istardtOptions.map((o) => [o.key, o.default]),
      [
        ['continuous', true],
        ['infeasibleActionPenalty', 100],
      ],
    );
  });

  it('checks one root goal, with the model', () => {
    const check = istardtCheckRegistry['istardt.goal.root'];
    const elements = {
      G1: { kind: 'goal', properties: { root: 'true' } },
      G2: { kind: 'goal', properties: { root: 'true' } },
    } as any;
    assert.strictEqual(
      check({ root: 'true' }, { self: 'G1', kindOf: () => 'goal', elements }),
      'One goal is the root: G2 is too',
    );
    assert.strictEqual(
      check({ root: 'true' }, { self: 'G1', kindOf: () => 'goal' }),
      null,
    );
  });

  it('checks an export’s range', () => {
    const check = istardtCheckRegistry['istardt.export.bounds'];
    const context = { self: 'Q1', kindOf: () => undefined };
    assert.strictEqual(
      check({ exportMin: '0', exportMax: '100' }, context),
      null,
    );
    assert.strictEqual(
      check({ exportMin: '5', exportMax: '5' }, context),
      "An export's minimum is below its maximum: 5 is not below 5",
    );
  });
});

describe('istardtProblems: the model as a whole', () => {
  it('finds nothing wrong with the seeds but what dtx2dtg reads differently', () => {
    assert.deepStrictEqual(problemsOf(json('istardt-order/Order.txt')), []);
    assert.deepStrictEqual(problemsOf(json('istardt-heating/Heating.txt')), [
      'warning: C1 (hvacOn) is exported, but DT-Golog exports goals, tasks and predicates (discrete), qualities and variables (continuous): the writer leaves it out, as dtx2dtg',
    ]);
    assert.deepStrictEqual(problemsOf(json('istardt-own/istardt-own.txt')), [
      "info: T2 (lookAtPlants)'s npr from T1 (checkSoilSensor) says nothing more: OR siblings already exclude each other",
    ]);
  });

  it('two roots, probabilities that don’t sum to 1, an effect of no task', () => {
    const model = json('istardt-order/Order.txt');
    node(model, 'G1').customProperties.root = 'true';
    node(model, 'Q2').customProperties.root = 'true';
    groupLinkTo(model, 'E1').customProperties.probability = '0.7';
    const e6 = groupLinkTo(model, 'E6');
    model.links = model.links.filter((l: any) => l !== e6);
    assert.deepStrictEqual(problemsOf(model), [
      'error: iStar-DT has one root quality: Q2 (happyCustomer), Q3 (overallQuality) are roots',
      "error: E6 (deliveredLateB_Eff) is no task's effect: link a task to it",
      "error: T1 (orderFromSupplierA)'s effects' probabilities sum to 0.95, not 1",
      "error: T2 (orderFromSupplierB)'s effects' probabilities sum to 0.65, not 1",
    ]);
  });

  it('a formula beside utility links, an effect weighing by two predicates, a name that isn’t there, a set of the wrong kind', () => {
    const model = json('istardt-order/Order.txt');
    // Happy Customer by a formula naming nothing; Cost by both
    const happy = node(model, 'Q2').id;
    model.links = model.links.filter(
      (l: any) => !(l.type === 'istardt.UtilityLink' && l.target === happy),
    );
    node(model, 'Q2').customProperties.formula =
      '0.5 * nowhere + orderMaterial';
    node(model, 'Q1').customProperties.formula = '1';
    model.links.push({
      id: 'extra',
      type: 'istardt.TurnsTrueLink',
      source: node(model, 'E1').id,
      target: node(model, 'P1').id,
    });
    model.actors[0].customProperties.crossRun = 'cost, orderMaterial';
    assert.deepStrictEqual(problemsOf(model), [
      'error: Q1 (cost) has a formula and utility links: give it one or the other',
      "error: E1 (deliveredInTimeA_Eff)'s utility link to Q1 (cost): an effect weighs on a quality by the one predicate it turns true (it turns 2)",
      "error: Q2 (happyCustomer)'s formula names nowhere, which is no element",
      // its formula changed, its links didn't
      "warning: Q2 (happyCustomer)'s links don't show what its formula reads: no link from orderMaterial",
      'error: the cross-run set has predicate, condition, variable, quality: orderMaterial is a goal',
    ]);
  });

  it('an export without its range; two elements DT-Golog would call the same', () => {
    const model = json('istardt-heating/Heating.txt');
    delete node(model, 'Q4').customProperties.exportMax;
    node(model, 'P1').customProperties.identifier = 'cost';
    const problems = problemsOf(model);
    assert.ok(
      problems.includes(
        'error: cost names two elements (P1 and Q1): DT-Golog would confuse them',
      ),
      problems.join('\n'),
    );
    assert.ok(
      problems.includes(
        'warning: Q4 (roomTemperature) is exported continuous without exportMin and exportMax: written as 0.0..0.0',
      ),
      problems.join('\n'),
    );
  });
});

describe('iStar-DT in the Notation view', () => {
  for (const file of [
    'istardt-order/Order.txt',
    'istardt-heating/Heating.txt',
    'istardt-own/istardt-own.txt',
  ])
    it(`${file}: reads its own document back, no diagnostic, no edit`, () => {
      const view = goalView(
        parsePistar(json(file), { fileMetamodel: true }),
        istardt,
      );
      // the view reads each goal's and task's id from its text, not its
      // piStar id (the workbench takes the two being equal for "no id")
      for (const n of view.nodes.values())
        assert.notStrictEqual(n.id, n.iStarId, `${n.id} read from its text`);
      const { text } = notationDocument(istardt, view);
      const context = contextFromView(istardt, view, []);
      assert.deepStrictEqual(documentDiagnostics(istardt, text, context), []);
      assert.deepStrictEqual(notationEdits(istardt, text, view), []);
    });

  it('writes the actor’s sets as its actor line, goals and tasks with their properties', () => {
    const view = goalView(
      parsePistar(json('istardt-order/Order.txt'), { fileMetamodel: true }),
      istardt,
    );
    const { text } = notationDocument(istardt, view);
    assert.ok(
      text.startsWith(
        'actor "default" {crossRun = cost, happyCustomer} {exported = deliveredInTimeA, deliveredInTimeB, deliveredLateA, deliveredLateB, neverDeliveredA, neverDeliveredB} {initializations = happyCustomer:0, cost:0, overallQuality:0}\n',
      ),
      text,
    );
    assert.ok(
      text.includes('G1: Order Material\n  root true\n  episodeLength 1\n'),
      text,
    );
  });
});
