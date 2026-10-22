/**
 * The `.kaos` reader and writer on KAOS's operation and object models
 * (goal-controller#194): KAOSTools' entities, associations, predicates and
 * types, our operations and events, and the links between them, read into
 * the `kaos` dialect's `kaosOperations` kinds and written back. The
 * fixture (test/importers/fixtures/kaos/pump-operations.kaos) is re-keyed
 * from the structure of FSE'02's mine pump.
 */
import * as assert from 'assert';
import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, it } from 'mocha';
import { parsePistar, validateModel } from '@istar-ts/core';
import { KAOS_OBSTACLES } from '@istar-ts/dsm3-kaos/metamodel';
import {
  KAOS_UNSUPPORTED_KEY,
  kaosNativeFile,
  readKaos,
  writeKaos,
} from '../../src/importers/kaos';
import { modelRoundTrip } from '../../src/importers/native';
import {
  KAOS_MODEL,
  KAOS_OPERATIONS_BLOCK,
} from '../../src/dialects/kaos/metamodel';
import {
  kaosdocDocument,
  kaosdocGoalModel,
  readKaosModel,
} from '../../src/engines/kaosdoc';
import {
  kaospropAnalysisModel,
  propagateProbabilities,
  readKaosObstacleModel,
} from '../../src/engines/kaosprop';

const FIXTURE = readFileSync(
  join(__dirname, 'fixtures/kaos/pump-operations.kaos'),
  'utf8',
);

type Json = Record<string, any>;
const readText = (text: string) => {
  const { model, diagnostics } = readKaos(text, { modelName: 'm' });
  assert.ok(model, JSON.stringify(diagnostics));
  return { model: model as Json, diagnostics };
};
const nodeOf = (model: Json, id: string) =>
  model.orphans.find((n: Json) => n.id === id);
/** Each link as `type source->target`, with its properties. */
const linksOf = (model: Json) =>
  model.links.map((l: Json) => [
    `${l.type} ${l.source}->${l.target}`,
    l.customProperties ?? {},
  ]);

describe('readKaos: the operation and object models (#194)', () => {
  it('reads each declaration into its kind, its attributes typed by key', () => {
    const { model, diagnostics } = readText(FIXTURE);
    assert.deepStrictEqual(diagnostics, []);
    const kinds = Object.fromEntries(
      model.orphans.map((n: Json) => [n.id, n.type]),
    );
    assert.deepStrictEqual(kinds, {
      pump_on_when_high_water: 'kaos.BehavioralGoal',
      controller: 'kaos.Agent',
      sump: 'kaos.Entity',
      pump: 'kaos.Entity',
      waterLevel: 'kaos.Type',
      has_pump: 'kaos.Association',
      high_water_detected: 'kaos.Event',
      high_water: 'kaos.Predicate',
      switch_pump_on: 'kaos.Operation',
    });
    assert.deepStrictEqual(nodeOf(model, 'sump').customProperties, {
      Description: '',
      EntityType: 'environment',
      Attributes: 'highWater:bool, level:waterLevel',
    });
    assert.deepStrictEqual(nodeOf(model, 'controller').customProperties, {
      Type: '',
      Description: '',
      Load: 'one switch per tick',
      Attributes: 'pumpSwitch:On|Off',
    });
    assert.deepStrictEqual(
      nodeOf(model, 'high_water_detected').customProperties,
      { Description: '', Frequency: 'at most once a minute' },
    );
    // a predicate's formal definition is a formula, its text as written (#211 parses it)
    assert.deepStrictEqual(nodeOf(model, 'high_water').customProperties, {
      Description: '',
      FormalSpec: 's.highWater == true',
      Arguments: 's:sump',
      Default: 'false',
    });
    assert.deepStrictEqual(nodeOf(model, 'switch_pump_on').customProperties, {
      Description: 'Switches the pump on',
      DomPre: 'controller.pumpSwitch != "On"',
      DomPost: 'controller.pumpSwitch == "On"',
    });
  });

  it('reads the links: operationalisation with its required conditions, performance, monitoring, control, cause, input, output, association', () => {
    const { model } = readText(FIXTURE);
    assert.deepStrictEqual(linksOf(model), [
      ['kaos.ResponsibilityAssignment controller->pump_on_when_high_water', {}],
      ['kaos.MonitoringLink controller->sump', { Monitors: 'sump.highWater' }],
      [
        'kaos.ControlLink controller->controller',
        { Controls: 'controller.pumpSwitch' },
      ],
      ['kaos.AssociationLink has_pump->sump', { Multiplicity: '0..1' }],
      [
        'kaos.AssociationLink has_pump->pump',
        { Multiplicity: '1', Role: 'installed' },
      ],
      ['kaos.PerformanceLink controller->switch_pump_on', {}],
      [
        'kaos.OperationalisationLink switch_pump_on->pump_on_when_high_water',
        { ReqTrig: 'sump.highWater == true' },
      ],
      [
        'kaos.CauseLink high_water_detected->switch_pump_on',
        { Delay: '1 tick' },
      ],
      ['kaos.InputLink sump->switch_pump_on', {}],
      ['kaos.OutputLink switch_pump_on->controller', {}],
    ]);
  });

  it('declares the kinds in the model’s block, which the workbench reads on the KAOS root; it validates', () => {
    const { model } = readText(FIXTURE);
    assert.deepStrictEqual(model.metamodel, KAOS_OPERATIONS_BLOCK);
    const text = JSON.stringify(model);
    // the workbench's reading: the root, the file's block applied
    const read = parsePistar(text, {
      metamodel: KAOS_OBSTACLES,
      fileMetamodel: true,
    });
    assert.deepStrictEqual(validateModel(read), []);
    // lib's: the root with the dialect's kinds, the block kept as written
    assert.deepStrictEqual(
      validateModel(parsePistar(text, { metamodel: KAOS_MODEL })),
      [],
    );
    // a model without these kinds has no block (every corpus file but the flood's)
    const { model: plain } = readText(
      'declare goal [ g ] assignedto a end declare agent [ a ] end',
    );
    assert.ok(!('metamodel' in plain));
  });

  it('round-trips the fixture: its text, but its comments, byte for byte; the written text is a fixed point', () => {
    const { model } = readText(FIXTURE);
    const trip = modelRoundTrip(kaosNativeFile, model, { modelName: 'm' });
    assert.ok(trip.ok, trip.problem ?? '');
    const uncommented = FIXTURE.replace(/^#.*\n/gm, '');
    assert.strictEqual(trip.written, uncommented);
    const again = kaosNativeFile.read(trip.written!, { modelName: 'm' });
    assert.strictEqual(
      writeKaos(again.model!, { modelName: 'm' }).text,
      trip.written,
    );
    assert.deepStrictEqual(
      writeKaos(model, { modelName: 'm' }).diagnostics,
      [],
    );
  });

  it('makes what an attribute names and nothing declares, of the kind it implies, and says it', () => {
    const { model, diagnostics } = readText(`declare operation [ op ]
  performedby a
  input e
  causedby ev
  reqpre [ g ] x.ready == true
end
declare agent [ b ]
  monitors s.level, p
end`);
    const kinds = Object.fromEntries(
      model.orphans.map((n: Json) => [n.id, n.type]),
    );
    assert.deepStrictEqual(kinds, {
      op: 'kaos.Operation',
      b: 'kaos.Agent',
      a: 'kaos.Agent',
      g: 'kaos.BehavioralGoal',
      ev: 'kaos.Event',
      e: 'kaos.Entity',
      s: 'kaos.Entity',
      p: 'kaos.Predicate',
    });
    assert.deepStrictEqual(
      diagnostics.map((d) => d.message),
      [
        'a is not declared: read as an agent',
        'g is not declared: read as a goal',
        'ev is not declared: read as an event',
        'e is not declared: read as an entity',
        's is not declared: read as an entity',
        'p is not declared: read as a predicate',
      ],
    );
    // a required condition without its operationalizes makes the link
    assert.deepStrictEqual(
      linksOf(model).find(([link]: [string]) =>
        link.startsWith('kaos.OperationalisationLink'),
      ),
      ['kaos.OperationalisationLink op->g', { ReqPre: 'x.ready == true' }],
    );
  });

  it('keeps as written what it doesn’t read in a form it knows, each said', () => {
    const { model, diagnostics } = readText(`declare entity [ e ]
  attribute untyped
  isa thing
  type robot
end
declare association [ r ]
  link [0, 1, 2] e
end
declare operation [ op ]
  causedby [late = "1 s"] ev
end
declare event [ ev ] end`);
    assert.strictEqual(
      model.diagram.customProperties[KAOS_UNSUPPORTED_KEY],
      [
        'override entity [ e ]\n  attribute untyped\n  isa thing\n  type robot\nend',
        'override association [ r ]\n  link [0, 1, 2] e\nend',
        'override operation [ op ]\n  causedby [late = "1 s"] ev\nend',
      ].join('\n\n'),
    );
    assert.deepStrictEqual(
      diagnostics.map((d) => d.message),
      [
        'attribute of e: kept as written, not read (not in this form on an entity)',
        'isa of e: kept as written, not read (no place in the model for isa)',
        'type of e: kept as written, not read (not in this form on an entity)',
        'link of r: kept as written, not read (not in this form on an association)',
        'causedby of op: kept as written, not read (not in this form on an operation)',
      ],
    );
  });

  it('reads KAOSTools’ other names for an entity and an association (object, relation) as them', () => {
    const { model } = readText(`declare object [ o ] attribute a : bool end
declare relation [ r ] link [*] o end`);
    assert.deepStrictEqual(
      model.orphans.map((n: Json) => n.type),
      ['kaos.Entity', 'kaos.Association'],
    );
    assert.deepStrictEqual(linksOf(model), [
      ['kaos.AssociationLink r->o', { Multiplicity: '*' }],
    ]);
    const { text } = writeKaos(model, { modelName: 'm' });
    assert.ok(
      text!.includes('declare entity [ o ]\n  attribute a : bool\nend'),
    );
    assert.ok(text!.includes('declare association [ r ]\n  link [*] o\nend'));
  });

  it('reads an object’s initial values (`initially name : value`, #209) as its Initially, and writes them back', () => {
    const { model, diagnostics } = readText(
      `declare entity [ sump ] attribute lowWater : bool initially lowWater : true end
declare agent [ a ] attribute on : bool initially on : false end
declare goal [ g ] initially x : true end`,
    );
    assert.strictEqual(
      nodeOf(model, 'sump').customProperties.Initially,
      'lowWater:true',
    );
    assert.strictEqual(
      nodeOf(model, 'a').customProperties.Initially,
      'on:false',
    );
    // a goal has no attributes: kept as written
    assert.deepStrictEqual(
      diagnostics.map((d) => d.message),
      [
        'initially of g: kept as written, not read (not in this form on a goal)',
      ],
    );
    const { text } = writeKaos(model, { modelName: 'm' });
    assert.ok(
      text!.includes(
        'declare entity [ sump ]\n  attribute lowWater : bool\n  initially lowWater : true\nend',
      ),
      text!,
    );
    assert.ok(text!.includes('  initially on : false\n'), text!);
  });

  it('places an operation below the requirement it operationalises, a loose predicate below the model', () => {
    const { model } = readText(FIXTURE);
    const at = (id: string) => nodeOf(model, id);
    assert.ok(at('switch_pump_on').y > at('pump_on_when_high_water').y);
    const { model: flooded } = readText(`declare goal [ g ] end
declare predicate [ p ] end
declare predicate [ q ] end`);
    const g = nodeOf(flooded, 'g');
    for (const id of ['p', 'q']) assert.ok(nodeOf(flooded, id).y > g.y, id);
  });
});

describe('the KAOS engines read a model of operations and objects (#194)', () => {
  it('kaosdoc writes its document; the operation model has no section of its own yet', () => {
    const { model } = readText(FIXTURE);
    const document = kaosdocDocument(
      kaosdocGoalModel(readKaosModel(JSON.stringify(model))),
      { title: 'pump' },
    );
    assert.ok(document.includes('Maintain [PumpOnWhenHighWater]'));
    assert.ok(!document.includes('SwitchPumpOn'));
  });

  it('kaosprop propagates over it, its operations and objects in the model’s elements only', () => {
    const { model } = readText(FIXTURE);
    const view = kaospropAnalysisModel(
      readKaosObstacleModel(JSON.stringify(model)),
    );
    assert.ok(view.elements.some((e) => e.kind === 'kaosOperations.Operation'));
    const { probabilities } = propagateProbabilities(view);
    assert.strictEqual(probabilities.get('pump_on_when_high_water'), 1);
  });
});
