/**
 * The DT-Golog writer (goal-controller#119): byte for byte with dtx2dtg's
 * golden files after the header (the committed Order and Heating), section
 * by section against slices cut by hand from `1.Order-Auth.pl`, `previous`
 * in a quality and in a condition, Java's numbers and names, and what
 * dtx2dtg leaves as TODOs on our own model (unverified: DT-Golog runs it,
 * `pnpm stress:istardt --oracle`).
 */
import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { describe, it } from 'mocha';
import { parsePistar } from '@istar-ts/core';
import { analysisModel } from '../../../src/engines/analysis';
import {
  camelCase,
  istardtOutput,
  istardtTemplate,
  IstardtWriteError,
  javaFloat,
  readIstardtModel,
} from '../../../src/engines/istardt';
import { engineOutputProblems } from '../../../src/engines/output';

const PROJECTS = path.join(__dirname, '../../../../../examples/istardt');
const read = (file: string) =>
  fs.readFileSync(path.join(PROJECTS, file), 'utf8');

const modelOf = (file: string) =>
  analysisModel(parsePistar(JSON.parse(read(file)), { fileMetamodel: true }));
const write = (file: string, modelName = 'Spec') =>
  istardtTemplate(readIstardtModel(modelOf(file)), { modelName });
const afterHeader = (text: string) => text.split('\n').slice(4).join('\n');

describe('the DT-Golog writer against dtx2dtg’s golden files', () => {
  for (const [model, golden] of <const>[
    ['istardt-order/Order.txt', 'istardt-order/reference/Order.pl'],
    ['istardt-heating/Heating.txt', 'istardt-heating/reference/Heating.pl'],
  ])
    it(`${model}: byte for byte after the four header lines`, () => {
      assert.strictEqual(afterHeader(write(model)), afterHeader(read(golden)));
    });

  it('writes the header from the model’s name, the date TEST unless given', () => {
    const order = write('istardt-order/Order.txt', 'Order');
    assert.ok(
      order.startsWith(
        '% DT-Golog Specification for Model: Order \n% Date Translated: TEST \n% From source: Order \n% Using DTTRanslate \n',
      ),
    );
  });
});

describe('the DT-Golog writer, section by section (Order)', () => {
  const order = write('istardt-order/Order.txt');
  const has = (slice: string) => assert.ok(order.includes(slice), slice);

  it('the options, cross-run and exported sets, initializations', () => {
    has('getNumRuns(1).\ngetObsType(continuous).\n');
    has('transStateStructure([cost(_),happyCustomer(_)]).\n');
    has(
      'discreteExportedSet([deliveredInTimeA_fl,deliveredInTimeB_fl,deliveredLateA_fl,deliveredLateB_fl,neverDeliveredA_fl,neverDeliveredB_fl]).\n',
    );
    has('continuousExportedSet([]).\n');
    has('init([happyCustomer(0),cost(0),overallQuality(0)]).\n');
  });

  it('the action lists, nondetActions and prob', () => {
    has('agentActionList([orderFromSupplierA,orderFromSupplierB]).\n');
    has(
      'nondetActions(orderFromSupplierA,_,[deliveredInTimeA_Eff,neverDeliveredA_Eff,deliveredLateA_Eff]).\n',
    );
    has('prob(neverDeliveredA_Eff,0.05,_).\nprob(deliveredLateA_Eff,0.2,_).\n');
  });

  it('proc with # for OR, and dtgRun’s bp(root,10,…)', () => {
    has('proc(orderMaterial, orderFromSupplierA # orderFromSupplierB).\n');
    has(
      'dtgRun(L,U,P) :-  with_output_to(string(_),bp(orderMaterial,10,L,U,P,x)).\n',
    );
  });

  it('a successor-state axiom per predicate, poss per effect with its OR siblings', () => {
    has(
      'deliveredInTimeA_fl(do(A,S)) :- deliveredInTimeA_fl(S); A=deliveredInTimeA_Eff.\n',
    );
    has(
      'poss(deliveredInTimeB_Eff,S) :- \\+ orderFromSupplierB_Att(S),\\+ orderFromSupplierA_Att(S).\n',
    );
    has(
      'poss(orderFromSupplierA,S) :- (poss(deliveredInTimeA_Eff,S);poss(neverDeliveredA_Eff,S);poss(deliveredLateA_Eff,S)).\n',
    );
  });

  it('_Sat and _Att per task and goal, from the satisfying effects', () => {
    has(
      'orderFromSupplierA_Sat(S) :- deliveredInTimeA_fl(S);deliveredLateA_fl(S).\n',
    );
    has(
      'orderMaterial_Att(S) :- orderFromSupplierA_Att(S);orderFromSupplierB_Att(S).\n',
    );
    has('goalAchieved(S) :- orderMaterial_Sat(S).\n');
  });

  it('a quality’s clause: its initial value when cross-run, val/2 lookups, the tree parenthesised', () => {
    has(
      'happyCustomer(V,S) :-happyCustomer(R_happyCustomer_init,s0),\n' +
        '                       val(R_deliveredInTimeA_fl,deliveredInTimeA_fl(S)),\n',
    );
    has(
      'overallQuality(V,S) :- \n' +
        '                        cost(R_cost,S),\n' +
        '                        happyCustomer(R_happyCustomer,S),\n' +
        '                        V is \n' +
        '((0.7) * (R_cost)) + ((0.3) * (R_happyCustomer)).\n',
    );
    has('rewardInst(R,S) :- overallQuality(R,S).\n');
  });
});

describe('the DT-Golog writer: previous, in a quality and in a condition (Heating)', () => {
  const heating = write('istardt-heating/Heating.txt');
  const has = (slice: string) => assert.ok(heating.includes(slice), slice);

  it('a quality reading its own previous value: from s0, without its initial value', () => {
    has(
      'runningTime(V,S) :- \n' +
        '                     runningTime(R_runningTime,s0),\n' +
        '                     val(R_hvacOn_fl,hvacOn_fl(S)),\n' +
        '                     V is \n' +
        '(R_runningTime) + ((10.0) * (R_hvacOn_fl)).\n',
    );
  });

  it('a condition’s previous as its fluent at s0, `!` as \\+ (…)', () => {
    has('hvacOn_fl(s0) :- !,initiallyTrue(hvacOn_fl).\n');
    has(
      'hvacOn_fl(S) :- ((hvacOn_fl(s0),\\+ (signalOffS_fl(S)));signalOnS_fl(S)).\n',
    );
  });

  it('a continuous export with its bounds as floats; an exported condition left out', () => {
    has(
      'continuousExportedSet([[roomTemperature(_),-10.0,100.0], [runningTime(_),0.0,100.0]]).\n',
    );
    has('discreteExportedSet([]).\n');
  });
});

describe('the DT-Golog writer: what dtx2dtg leaves as TODOs (our own model, unverified)', () => {
  const own = write('istardt-own/istardt-own.txt', 'Garden');
  const has = (slice: string) => assert.ok(own.includes(slice), slice);

  it('turnsFalse keeps a fluent unless its effect happens', () => {
    has(
      'soilDry_fl(do(A,S)) :- (soilDry_fl(S),\\+ A=handWatered,\\+ A=sprinkled); A=readDry.\n',
    );
  });

  it('pre: the ancestors’ and the task’s own; npr: `\\+` the source', () => {
    has(
      'poss(handWatered,S) :- \\+ waterByHand_Att(S),\\+ runSprinkler_Att(S),inspectGarden_Sat(S),waterByHandPre_fl(S).\n',
    );
    has(
      'poss(sprinkled,S) :- \\+ runSprinkler_Att(S),\\+ waterByHand_Att(S),inspectGarden_Sat(S),\\+ soilWet_fl(S).\n',
    );
  });

  it('a variable set by effects, read by a comparison and a division', () => {
    has('moisture(V,s0) :- getInitValue(moisture_fl,V),!.\n');
    has('moisture(V,do(A,S)) :- A=readDry,!,V is 20.0.\n');
    has('moisture(V,do(_,S)) :- moisture(V,S).\n');
    has(
      'soilWet_fl(S) :- (soilWetRead_fl(S);(moisture(V_moisture,S),V_moisture > 50.0)).\n',
    );
    has('-((R_moisture) / (100.0)).\n');
  });

  it('a weighted sum from its utility links, in their order: effects by the predicate they turn true', () => {
    has(
      '((((0.4) * (R_plantsFine_fl)) + ((-0.5) * (R_plantsWilted_fl))) + ((-1.0) * (R_jammed_fl))) + ((-0.3) * (R_spilledWater_fl)).\n',
    );
    has(
      '(((0.6) * (R_plantHealth)) + ((0.3) * (R_ownerHappiness))) + ((1.0) * (R_waterCost)).\n',
    );
    has('init([moisture_fl(40),plantHealth(0),ownerHappiness(0)]).\n');
  });

  it('an AND of three: one procedure per order', () => {
    assert.strictEqual(own.match(/^proc\(tendGarden, /gm)?.length, 6);
  });
});

describe('the DT-Golog writer’s conventions', () => {
  it('prints numbers as Java prints a float', () => {
    assert.deepStrictEqual(
      [23, -10, 0, 0.05, 0.1, 1.75, -0.1, 100, 1e7, 0.0001, 0.3].map(javaFloat),
      [
        '23.0',
        '-10.0',
        '0.0',
        '0.05',
        '0.1',
        '1.75',
        '-0.1',
        '100.0',
        '1.0E7',
        '1.0E-4',
        '0.3',
      ],
    );
  });

  it('names an element as Formatter.toCamelCase does', () => {
    assert.strictEqual(
      camelCase('Assign to Subcontractor A'),
      'assignToSubcontractorA',
    );
    assert.strictEqual(
      camelCase('deliveredInTimeA_Eff'),
      'deliveredInTimeAEff',
    );
    assert.strictEqual(camelCase('Order Material'), 'orderMaterial');
  });

  it('writes discrete observations when the option says so', () => {
    const order = istardtTemplate(
      readIstardtModel(modelOf('istardt-order/Order.txt')),
      {
        modelName: 'Order',
        continuous: false,
      },
    );
    assert.ok(order.includes('getObsType(discrete).\n'));
  });

  it('is one output, `dtgolog`, a .pl named after the model', () => {
    const output = istardtOutput(modelOf('istardt-order/Order.txt'), {
      modelName: 'Order',
    });
    assert.deepStrictEqual(engineOutputProblems(output), []);
    assert.deepStrictEqual(
      output.files.map(({ id, fileName, primary }) => ({
        id,
        fileName,
        primary,
      })),
      [{ id: 'dtgolog', fileName: 'Order.pl', primary: true }],
    );
  });

  it('stops on the model’s errors, each said once', () => {
    const json = JSON.parse(read('istardt-order/Order.txt'));
    const goal = json.actors[0].nodes.find((n: any) =>
      n.text.startsWith('G1:'),
    );
    delete goal.customProperties.root;
    const model = readIstardtModel(
      analysisModel(parsePistar(json, { fileMetamodel: true })),
    );
    assert.throws(
      () => istardtTemplate(model, { modelName: 'Order' }),
      (error: unknown) =>
        error instanceof IstardtWriteError &&
        error.problems.map((p) => p.message).join('\n') ===
          'iStar-DT needs a root goal: set root to true on one goal',
    );
  });
});
