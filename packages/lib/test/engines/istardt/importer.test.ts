/**
 * The iStarDT-X importer (goal-controller#119): the committed seeds
 * (dtx2dtg's Order and Heating fixtures, our own model of what they lack)
 * and what is wrong with a file. dtx2dtg's nine golden pairs are `pnpm
 * stress:istardt`'s (fetched, not committed).
 */
import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { describe, it } from 'mocha';
import { importIstardt } from '../../../src/importers/istardt';

const PROJECTS = path.join(__dirname, '../../../../../examples/istardt');
const read = (file: string) =>
  fs.readFileSync(path.join(PROJECTS, file), 'utf8');

type Json = Record<string, any>;
const imported = (file: string, modelName?: string) => {
  const result = importIstardt(read(file), { modelName });
  assert.ok(result.model, JSON.stringify(result.diagnostics));
  return result as Required<typeof result> & { model: Json };
};
const nodesOf = (model: Json): Map<string, Json> =>
  new Map(model.actors[0].nodes.map((n: Json) => [n.id, n]));
const linksOf = (model: Json, type: string) =>
  model.links
    .filter((l: Json) => l.type === type)
    .map((l: Json) => `${l.source}->${l.target}`);

describe('importIstardt: dtx2dtg’s Order (1.Order.istardtx)', () => {
  const { model, dialectRecord, diagnostics } = imported(
    'istardt-order/1.Order.istardtx',
    'Order',
  );
  const nodes = nodesOf(model);

  it('reads it without a warning, for the iStar-DT engine, its options the defaults', () => {
    assert.deepStrictEqual(diagnostics, []);
    assert.deepStrictEqual(dialectRecord, {
      engine: 'istardt',
      projectResources: {},
      options: { continuous: true, infeasibleActionPenalty: 100 },
    });
    assert.strictEqual(model.diagram.customProperties.engine, 'istardt');
    assert.strictEqual(model.diagram.customProperties.lastUpdated, 'Test');
    assert.strictEqual(model.diagram.name, 'Order');
  });

  it('numbers each kind in the file’s order, its name the description (#117 D1)', () => {
    assert.deepStrictEqual(
      [...nodes.values()].map((n) => `${n.type} ${n.text}`),
      [
        'istar.Goal G1: Order Material',
        'istar.Task T1: Order From Supplier A',
        'istar.Task T2: Order From Supplier B',
        'istardt.Effect E1: deliveredInTimeA',
        'istardt.Effect E2: neverDeliveredA',
        'istardt.Effect E3: deliveredLateA',
        'istardt.Effect E4: deliveredInTimeB',
        'istardt.Effect E5: neverDeliveredB',
        'istardt.Effect E6: deliveredLateB',
        'istar.Quality Q1: Cost',
        'istar.Quality Q2: Happy Customer',
        'istar.Quality Q3: Overall Quality',
        'istardt.Predicate P1: neverDeliveredB',
        'istardt.Predicate P2: deliveredInTimeB',
        'istardt.Predicate P3: deliveredLateB',
        'istardt.Predicate P4: neverDeliveredA',
        'istardt.Predicate P5: deliveredInTimeA',
        'istardt.Predicate P6: deliveredLateA',
      ],
    );
  });

  it('keeps the file’s name only where it isn’t the camelCase of the description', () => {
    assert.strictEqual(nodes.get('G1')!.customProperties.identifier, undefined);
    assert.strictEqual(nodes.get('Q2')!.customProperties.identifier, undefined);
    assert.strictEqual(
      nodes.get('E1')!.customProperties.identifier,
      'deliveredInTimeA_Eff',
    );
  });

  it('reads the root goal, the effects’ probabilities and predicates, the qualities’ formulas', () => {
    assert.deepStrictEqual(nodes.get('G1')!.customProperties, {
      root: 'true',
      episodeLength: '1',
    });
    assert.deepStrictEqual(nodes.get('E2')!.customProperties, {
      identifier: 'neverDeliveredA_Eff',
      probability: '0.05',
      satisfying: 'false',
      turnsTrue: 'neverDeliveredA',
    });
    assert.deepStrictEqual(nodes.get('Q3')!.customProperties, {
      formula: '0.7 * cost + 0.3 * happyCustomer',
      root: 'true',
    });
  });

  it('links refinements child to parent and each task to its effects, in order', () => {
    assert.deepStrictEqual(linksOf(model, 'istar.OrRefinementLink'), [
      'T1->G1',
      'T2->G1',
    ]);
    assert.deepStrictEqual(linksOf(model, 'istardt.EffectLink'), [
      'T1->E1',
      'T1->E2',
      'T1->E3',
      'T2->E4',
      'T2->E5',
      'T2->E6',
    ]);
  });

  it('keeps the sets on the actor, in the file’s order (#117 D4)', () => {
    assert.deepStrictEqual(model.actors[0].customProperties, {
      crossRun: 'cost, happyCustomer',
      exported:
        'deliveredInTimeA, deliveredInTimeB, deliveredLateA, deliveredLateB, neverDeliveredA, neverDeliveredB',
      initializations: 'happyCustomer:0, cost:0, overallQuality:0',
    });
  });

  it('lays it out: every node placed, the kinds’ metamodel block written', () => {
    for (const node of [model.actors[0], ...nodes.values()])
      assert.ok(
        Number.isFinite(node.x) && Number.isFinite(node.y),
        `${node.id} placed`,
      );
    assert.strictEqual(model.metamodel.name, 'istardt');
    assert.deepStrictEqual(
      model.metamodel.elements.map((e: Json) => e.kind),
      [
        'istardt.Effect',
        'istardt.Condition',
        'istardt.Predicate',
        'istardt.Variable',
      ],
    );
  });

  it('is the model the project keeps (projects.cjs --write)', () => {
    assert.strictEqual(
      read('istardt-order/Order.txt'),
      `${JSON.stringify(model, null, 2)}\n`,
    );
  });
});

describe('importIstardt: dtx2dtg’s Heating (3.2.Heating_10R_Mixed.istardtx)', () => {
  const { model, diagnostics } = imported(
    'istardt-heating/3.2.Heating_10R_Mixed.istardtx',
    'Heating',
  );
  const nodes = nodesOf(model);
  const formula = (id: string) => nodes.get(id)!.customProperties.formula;

  it('writes the qualities’ trees as expressions, in Jackson’s operand order, shaped as the file nests them', () => {
    assert.deepStrictEqual(diagnostics, []);
    assert.strictEqual(formula('Q1'), '0 - 0.06 * runningTime');
    assert.strictEqual(
      formula('Q2'),
      '(roomTemperature - 23) * (roomTemperature - 23) * -0.1',
    );
    assert.strictEqual(
      formula('Q4'),
      '0.5 + 0.9 * previous(roomTemperature) + hvacOn * (0.05 * previous(roomTemperature) + 1.75)',
    );
    assert.strictEqual(formula('Q5'), 'previous(runningTime) + 10 * hvacOn');
  });

  it('writes a condition fully parenthesised: `!` takes everything after it', () => {
    assert.strictEqual(nodes.get('C1')!.text, 'C1: Condition Box');
    assert.strictEqual(nodes.get('C1')!.customProperties.identifier, 'hvacOn');
    assert.strictEqual(
      formula('C1'),
      '((previous(hvacOn) & (!(signalOffS))) | signalOnS)',
    );
  });

  it('puts a continuous export’s bounds on its element, the episode’s length on the root', () => {
    assert.deepStrictEqual(nodes.get('Q4')!.customProperties, {
      formula: formula('Q4'),
      exportMin: '-10',
      exportMax: '100',
    });
    assert.strictEqual(nodes.get('G1')!.customProperties.episodeLength, '10');
    assert.strictEqual(
      model.actors[0].customProperties.crossRun,
      'roomTemperature, runningTime, hvacOn',
    );
  });

  it('is the model the project keeps', () => {
    assert.strictEqual(
      read('istardt-heating/Heating.txt'),
      `${JSON.stringify(model, null, 2)}\n`,
    );
  });
});

describe('importIstardt: our own model (istardt-own.istardtx)', () => {
  const { model, diagnostics } = imported(
    'istardt-own/istardt-own.istardtx',
    'Garden',
  );
  const nodes = nodesOf(model);

  it('turns a pre that is a formula into a condition it names, and says so (#117 D2)', () => {
    assert.deepStrictEqual(diagnostics, [
      {
        severity: 'info',
        message:
          "waterByHand's pre is a formula: read as condition C2 (waterByHandPre)",
      },
    ]);
    // its name is its identifier: no identifier property
    assert.strictEqual(nodes.get('C2')!.text, 'C2: waterByHandPre');
    assert.deepStrictEqual(nodes.get('C2')!.customProperties, {
      formula: '(soilDry | plantsWilted)',
    });
  });

  it('links pre and npr from the element or condition they name to their holder', () => {
    assert.deepStrictEqual(linksOf(model, 'istardt.PrecedenceLink'), [
      'G2->G3',
      'C2->T3',
    ]);
    assert.deepStrictEqual(linksOf(model, 'istardt.NegativePrecedenceLink'), [
      'T1->T2',
      'C1->T4',
    ]);
  });

  it('reads turnsFalse, set, a variable and a comparison', () => {
    assert.deepStrictEqual(nodes.get('E8')!.customProperties, {
      probability: '0.95',
      satisfying: 'true',
      turnsTrue: 'watered',
      turnsFalse: 'soilDry, plantsWilted',
      set: 'moisture:80',
    });
    assert.deepStrictEqual(nodes.get('V1')!.customProperties, {
      identifier: 'moisture',
      exportMin: '0',
      exportMax: '100',
    });
    assert.strictEqual(
      nodes.get('C1')!.customProperties.formula,
      '(soilWetRead | (moisture > 50))',
    );
    assert.strictEqual(
      nodes.get('Q4')!.customProperties.formula,
      '0.6 * plantHealth + 0.3 * ownerHappiness + -waterCost',
    );
  });

  it('is the model the project keeps', () => {
    assert.strictEqual(
      read('istardt-own/istardt-own.txt'),
      `${JSON.stringify(model, null, 2)}\n`,
    );
  });
});

describe('importIstardt: what isn’t an iStarDT-X file, or reads differently', () => {
  it('rejects a file whose root isn’t <iStarDT>, and one that isn’t XML', () => {
    const other = importIstardt('<grl:URNspec/>');
    assert.strictEqual(other.model, null);
    assert.match(other.diagnostics.at(-1)!.message, /root is <grl:URNspec>/);
    const broken = importIstardt('not xml at all');
    assert.strictEqual(broken.model, null);
    assert.ok(broken.diagnostics.some((d) => d.severity === 'error'));
  });

  it('warns of what a file names and doesn’t declare, and of a second actor', () => {
    const { diagnostics } = importIstardt(`<iStarDT><actors>
      <actor name="a"><goals><goal name="g" root="true">
        <refinement type="OR"><childTask ref="missing"/></refinement>
      </goal></goals>
      <crossRuns><crossRun><qualID>nowhere</qualID></crossRun></crossRuns></actor>
      <actor name="b"/></actors></iStarDT>`);
    assert.deepStrictEqual(
      diagnostics.map((d) => `${d.severity}: ${d.message}`),
      [
        'warning: iStar-DT has one actor: the first of 2 is read',
        "warning: goal g refines into missing, which the file doesn't declare as a task",
        "warning: the cross-run set names nowhere, which the file doesn't declare",
      ],
    );
  });
});
