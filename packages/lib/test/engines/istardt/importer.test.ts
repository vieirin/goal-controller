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
/** an element's label: the id its text starts with; a task's effect group, `T1.group` */
const labelsOf = (model: Json): Map<string, string> => {
  const labels = new Map<string, string>();
  for (const n of model.actors[0].nodes)
    if (n.text) labels.set(n.id, n.text.split(':')[0]);
  for (const n of model.actors[0].nodes)
    if (!n.text) {
      const task = model.links.find((l: Json) => l.target === n.id).source;
      labels.set(n.id, `${labels.get(task)}.group`);
    }
  return labels;
};
/** the nodes by label */
const nodesOf = (model: Json): Map<string, Json> => {
  const labels = labelsOf(model);
  return new Map(
    model.actors[0].nodes.map((n: Json) => [labels.get(n.id)!, n]),
  );
};
const linksOf = (model: Json, type: string) => {
  const labels = labelsOf(model);
  return model.links
    .filter((l: Json) => l.type === type)
    .map((l: Json) => `${labels.get(l.source)}->${labels.get(l.target)}`);
};
const weightsOf = (model: Json, type: string, key: string) => {
  const labels = labelsOf(model);
  return model.links
    .filter((l: Json) => l.type === type)
    .map(
      (l: Json) =>
        `${labels.get(l.source)}->${labels.get(l.target)} ${l.customProperties[key]}`,
    );
};

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
        'istardt.EffectGroup ',
        'istardt.EffectGroup ',
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

  it('reads the root goal and the effects; a weighted sum is no formula (#117 D3)', () => {
    assert.deepStrictEqual(nodes.get('G1')!.customProperties, {
      root: 'true',
      episodeLength: '1',
    });
    assert.deepStrictEqual(nodes.get('E2')!.customProperties, {
      identifier: 'neverDeliveredA_Eff',
      satisfying: 'false',
    });
    assert.deepStrictEqual(nodes.get('Q3')!.customProperties, {
      root: 'true',
    });
  });

  it('links refinements child to parent, each task to its effect group and the group to its effects, in order', () => {
    assert.deepStrictEqual(linksOf(model, 'istar.OrRefinementLink'), [
      'T1->G1',
      'T2->G1',
    ]);
    assert.deepStrictEqual(linksOf(model, 'istardt.EffectLink'), [
      'T1->T1.group',
      'T2->T2.group',
    ]);
    assert.deepStrictEqual(
      weightsOf(model, 'istardt.EffectGroupLink', 'probability'),
      [
        'T1.group->E1 0.75',
        'T1.group->E2 0.05',
        'T1.group->E3 0.2',
        'T2.group->E4 0.5',
        'T2.group->E5 0.15',
        'T2.group->E6 0.35',
      ],
    );
  });

  it('links each effect to the predicate it turns true', () => {
    assert.deepStrictEqual(linksOf(model, 'istardt.TurnsTrueLink'), [
      'E1->P5',
      'E2->P4',
      'E3->P6',
      'E4->P2',
      'E5->P1',
      'E6->P3',
    ]);
  });

  it('draws a weighted sum as utility links, in its terms’ order, as mx2dtx’s diagram does', () => {
    const utility = (target: string) =>
      weightsOf(model, 'istardt.UtilityLink', 'weight').filter((l: string) =>
        l.includes(`->${target} `),
      );
    assert.deepStrictEqual(utility('Q1'), [
      'E1->Q1 0.5',
      'E3->Q1 0.5',
      'E2->Q1 0.5',
      'E4->Q1 1.0',
      'E6->Q1 1.0',
      'E5->Q1 1.0',
    ]);
    assert.deepStrictEqual(utility('Q3'), ['Q1->Q3 0.7', 'Q2->Q3 0.3']);
  });

  it('keeps the file’s names as the piStar ids: the view’s ids are the texts’ (importers.md)', () => {
    assert.strictEqual(nodes.get('G1')!.id, 'orderMaterial');
    assert.strictEqual(nodes.get('E1')!.id, 'deliveredInTimeA_Eff');
    assert.strictEqual(
      nodes.get('T1.group')!.id,
      'orderFromSupplierA/effectGroup',
    );
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
        'istardt.EffectGroup',
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

  it('links what each formula reads to its quality or condition, previous values as PRE (the paper’s figure)', () => {
    assert.deepStrictEqual(linksOf(model, 'istardt.ReadsLink'), [
      'Q5->Q1',
      'Q4->Q2',
      'C1->Q4',
      'C1->Q5',
      'P4->C1',
      'P3->C1',
    ]);
    assert.deepStrictEqual(linksOf(model, 'istardt.ReadsPreviousLink'), [
      'Q4->Q4',
      'Q5->Q5',
      'C1->C1',
    ]);
    // a weighted sum is its utility links, not reads links
    assert.deepStrictEqual(linksOf(model, 'istardt.UtilityLink'), [
      'Q1->Q3',
      'Q2->Q3',
    ]);
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

  it('reads turnsTrue and turnsFalse as links, set, a variable and a comparison', () => {
    assert.deepStrictEqual(nodes.get('E8')!.customProperties, {
      satisfying: 'true',
      set: 'moisture:80',
    });
    assert.deepStrictEqual(
      linksOf(model, 'istardt.TurnsTrueLink').filter((l: string) =>
        l.startsWith('E8->'),
      ),
      ['E8->P6'],
    );
    assert.deepStrictEqual(linksOf(model, 'istardt.TurnsFalseLink'), [
      'E6->P1',
      'E8->P1',
      'E8->P4',
    ]);
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
      nodes.get('Q2')!.customProperties.formula,
      '-(moisture / 100)',
    );
  });

  it('draws its weighted sums as utility links, from effects and from qualities', () => {
    assert.deepStrictEqual(weightsOf(model, 'istardt.UtilityLink', 'weight'), [
      'E5->Q1 0.4',
      'E4->Q1 -0.5',
      'E9->Q1 -1.0',
      'E7->Q1 -0.3',
      'Q1->Q4 0.6',
      'Q3->Q4 0.3',
      'Q2->Q4 1.0',
    ]);
    assert.strictEqual(nodes.get('Q4')!.customProperties.formula, undefined);
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
