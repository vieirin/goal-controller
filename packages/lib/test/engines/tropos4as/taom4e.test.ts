/**
 * TAOM4E's `.tropos` importer (goal-controller#136 item 4): the fixtures,
 * written by hand against TAOM4E-MM.ecore and unverified against TAOM4E
 * (#134): the seeds' twins import to what the base metamodel carries of
 * the seeds, the GODA-shaped one generates through the GODA engine what
 * its piStar twin does, and the mapping's edges (#134, item 4's D).
 */
import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { describe, it } from 'mocha';
import { Model } from '@goal-controller/goal-tree';
import {
  carriedDifference,
  readTaom4e,
  taom4eCarried,
  tropos4asProblems,
  readTropos4asModel,
  tropos4asAnalysisModel,
} from '../../../src/engines/tropos4as';
import { goda, godaGoalModel, godaOutput } from '../../../src';
import { nativeFileFor } from '@goal-controller/dialect';
import { tropos4as } from '../../../src/engines/tropos4as';

/* eslint-disable-next-line @typescript-eslint/no-require-imports */
const {
  parsePistar,
} = require('../../../../goal-tree/node_modules/@istar-ts/core');

type Json = Record<string, any>;
const ROOT = path.join(__dirname, '../../../../..');
const fixture = (name: string) =>
  fs.readFileSync(path.join(__dirname, 'taom4e', name), 'utf8');
const seed = (...parts: string[]) =>
  JSON.parse(fs.readFileSync(path.join(ROOT, 'examples', ...parts), 'utf8'));
const imported = (text: string) => {
  const result = readTaom4e(text, { modelName: 'm' });
  assert.ok(result.model, JSON.stringify(result.diagnostics));
  return result as typeof result & { model: Json };
};
const ofKind = (
  severity: string,
  diagnostics: { severity: string; message: string }[],
) => diagnostics.filter((d) => d.severity === severity).map((d) => d.message);

/** A one-actor file with these classes and relations (formalcore unless prefixed). */
const file = (
  classes: string,
  relations = '',
) => `<?xml version="1.0" encoding="UTF-8"?>
<formalcore:FormalBusinessModel xmi:version="2.0" xmlns:xmi="http://www.omg.org/XMI"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xmlns:informalcore="http:///it/itc/sra/taom4e/model/core/informalcore.ecore"
    xmlns:formalcore="http:///it/itc/sra/taom4e/model/core/informalcore/formalcore.ecore"
    xmi:id="bm" name="Toy">
  <TroposClasses xsi:type="formalcore:FActor" xmi:id="A" name="Agent"/>
  ${classes}
  ${relations}
</formalcore:FormalBusinessModel>`;

describe('readTaom4e: the seeds’ twins (unverified against TAOM4E)', () => {
  for (const name of ['cleaner-agent', 'patient-monitoring'])
    it(`${name}.tropos carries what the seed does, in the Tropos4AS dialect`, () => {
      const { model, dialectRecord, diagnostics } = imported(
        fixture(`${name}.tropos`),
      );
      assert.deepStrictEqual(dialectRecord, {
        engine: 'tropos4as',
        projectResources: {},
      });
      assert.deepStrictEqual(ofKind('error', diagnostics), []);
      assert.deepStrictEqual(ofKind('warning', diagnostics), []);
      assert.strictEqual(
        carriedDifference(
          taom4eCarried(seed('tropos4as', name, `${name}.txt`)),
          taom4eCarried(model),
        ),
        null,
      );
      // it reads as a Tropos4AS model, its kinds' block with it
      const tropos = readTropos4asModel(
        tropos4asAnalysisModel(
          parsePistar(JSON.stringify(model), { fileMetamodel: true }),
        ),
      );
      assert.deepStrictEqual(
        tropos4asProblems(tropos).filter((p) => p.severity === 'error'),
        [],
      );
    });

  it('keeps the diagram’s positions and sizes, and the file’s names', () => {
    const { model } = imported(fixture('cleaner-agent.tropos'));
    const rc = model.actors[1].nodes.find((n: Json) => n.id === 'RC');
    assert.deepStrictEqual(
      { x: rc.x, y: rc.y, text: rc.text, properties: rc.customProperties },
      {
        x: 393,
        y: 141,
        text: 'RoomClean',
        properties: { achievement: 'roomClean' },
      },
    );
    assert.deepStrictEqual(model.display.RC, { width: 132, height: 42 });
    assert.deepStrictEqual(
      model.dependencies.map((d: Json) => [d.id, d.x, d.y, d.source, d.target]),
      [
        ['RoomCleanDependum', 128, 24, 'Stakeholder', 'CleanerAgent'],
        ['efficiencyDependum', 148, 110, 'Stakeholder', 'CleanerAgent'],
      ],
    );
    assert.strictEqual(model.diagram.name, 'Cleaner Agent');
    assert.strictEqual(model.diagram.customProperties.engine, 'tropos4as');
    assert.strictEqual(model.metamodel.name, 'tropos4as');
  });
});

describe('readTaom4e: a GODA-shaped file (#134 D1.3)', () => {
  const generate = (text: string, modelName: string) =>
    godaOutput(godaGoalModel(Model.parse(text, goda)), {
      modelName,
      variant: 'cc808b6',
    });

  it('dm-goda.tropos is GODA’s, and generates what examples/goda/dm does, file for file', () => {
    const { model, dialectRecord } = imported(fixture('dm-goda.tropos'));
    assert.deepStrictEqual(dialectRecord, {
      engine: 'goda',
      projectResources: {},
    });
    assert.strictEqual(model.metamodel, undefined);
    const twin = generate(
      fs.readFileSync(path.join(ROOT, 'examples/goda/dm/dm2.txt'), 'utf8'),
      'dm2.txt',
    );
    const ours = generate(JSON.stringify(model), 'dm2.txt');
    assert.deepStrictEqual(
      ours.files.map((f) => [f.fileName, f.text]),
      twin.files.map((f) => [f.fileName, f.text]),
    );
    assert.ok(twin.files.length > 0);
  });

  it('selects the one root goal and keeps creationProperty on goals and plans', () => {
    const { model } = imported(fixture('dm-goda.tropos'));
    const byText = Object.fromEntries(
      model.actors[0].nodes.map((n: Json) => [n.text, n.customProperties]),
    );
    assert.deepStrictEqual(byText['G1: goal'], { selected: 'true' });
    assert.deepStrictEqual(byText['T1.1: task'], {
      creationProperty: 'assertion trigger ctx=1',
    });
  });

  it('is not GODA’s when a label isn’t CRGMToPRISM’s or a Tropos4AS attribute is set', () => {
    const goal = (name: string, attributes = '') =>
      `<TroposClasses xsi:type="formalcore:FHardGoal" xmi:id="G" name="${name}" wanter="A"${attributes}/>`;
    assert.strictEqual(
      imported(file(goal('G1: goal'))).dialectRecord.engine,
      'goda',
    );
    assert.strictEqual(
      imported(file(goal('goal'))).dialectRecord.engine,
      'tropos4as',
    );
    assert.strictEqual(
      imported(file(goal('G1: goal', ' fulfillmentProperty="done"')))
        .dialectRecord.engine,
      'tropos4as',
    );
    assert.strictEqual(
      imported(file(goal('G1: goal', ' mode="MAINTAIN"'))).dialectRecord.engine,
      'tropos4as',
    );
  });
});

describe('readTaom4e: the mapping (#134, item 4’s D)', () => {
  const goal = (id: string, attributes: string) =>
    `<TroposClasses xsi:type="formalcore:FHardGoal" xmi:id="${id}" name="${id}" wanter="A" ${attributes}/>`;

  it('reads mode and Formal Tropos’s properties as the goal’s type and conditions', () => {
    const { model, diagnostics } = imported(
      file(
        [
          goal(
            'a',
            'mode="ACHIEVE" creationProperty="hour >= 6" fulfillmentProperty="done"',
          ),
          goal('m', 'mode="MAINTAIN" invariantProperty="temperature >= 20"'),
          goal('am', 'mode="ACHIEVEMAINTAIN" invariantProperty="ok"'),
          goal('av', 'mode="AVOID" attribute="x: int"'),
          goal('ltl', 'fulfillmentProperty="F (done)"'),
        ].join('\n'),
      ),
    );
    assert.deepStrictEqual(
      Object.fromEntries(
        model.actors[0].nodes.map((n: Json) => [n.id, n.customProperties]),
      ),
      {
        a: { creation: 'hour >= 6', achievement: 'done' },
        m: { type: 'maintain', maintain: 'temperature >= 20' },
        am: { type: 'maintain', maintain: 'ok' },
        av: { mode: 'AVOID', attribute: 'x: int' },
        // kept as written: the checks say it is no condition
        ltl: { achievement: 'F (done)' },
      },
    );
    assert.deepStrictEqual(ofKind('warning', diagnostics), [
      'am: mode ACHIEVEMAINTAIN read as maintain; its achieve phase is lost',
      'av: mode AVOID has no Tropos4AS goal type; kept as mode',
    ]);
  });

  it('reads contributions by their metric, an unknown one with a warning', () => {
    const { model, diagnostics } = imported(
      file(
        `<TroposClasses xsi:type="formalcore:FPlan" xmi:id="p" name="p" capableOf="A"/>
         <TroposClasses xsi:type="formalcore:FSoftGoal" xmi:id="q" name="q" wanter="A"/>
         <TroposClasses xsi:type="formalcore:FHardGoal" xmi:id="g" name="g" wanter="A"/>`,
        ['++', '--', '0.5']
          .map(
            (metric, i) =>
              `<TroposRelations xsi:type="formalcore:FContribution" xmi:id="c${i}" contributer="p" contributed="q" metric="${metric}"/>`,
          )
          .join('\n') +
          '<TroposRelations xsi:type="formalcore:FContribution" xmi:id="cg" contributer="p" contributed="g" metric="+"/>',
      ),
    );
    assert.deepStrictEqual(
      model.links.map((l: Json) => [l.id, l.label]),
      // each its relation's id
      [
        ['c0', 'make'],
        ['c1', 'break'],
        ['c2', 'unknown'],
      ],
    );
    assert.deepStrictEqual(ofKind('warning', diagnostics), [
      'p → q: metric "0.5" is not ++, +, - or --; read as unknown',
      'p contributes to g, not a softgoal: iStar 2.0 contributes to qualities only; left out',
    ]);
  });

  it('lays out what no diagram places, and says what it can’t read', () => {
    const { model, diagnostics } = imported(
      file(
        goal('g', '') +
          '<TroposClasses xsi:type="formalcore:FPlan" xmi:id="p" name="p" capableOf="A"/>' +
          '<TroposClasses xsi:type="informalcore:Capability" xmi:id="cap" name="cap"/>',
        '<TroposRelations xsi:type="informalcore:MeansEnd" xmi:id="me" meansPlan="p" end="nowhere"/>',
      ),
    );
    assert.ok(model.actors[0].nodes.every((n: Json) => Number.isFinite(n.x)));
    assert.deepStrictEqual(model.links, []);
    assert.ok(
      ofKind('warning', diagnostics).some((m) => /end names nowhere/.test(m)),
    );
    assert.ok(
      ofKind('info', diagnostics).includes(
        "informalcore:Capability cap: not in the base metamodel's mapping; left out",
      ),
    );
  });

  it('refuses what isn’t a TAOM4E model', () => {
    for (const text of ['not xml <', '<?xml version="1.0"?><root/>']) {
      const result = readTaom4e(text);
      assert.strictEqual(result.model, null);
      assert.ok(ofKind('error', result.diagnostics).length > 0);
    }
  });

  it('is Tropos4AS’s native file, .tropos', () => {
    assert.strictEqual(
      nativeFileFor([tropos4as], 'Cleaner.TROPOS')?.file.label,
      'TAOM4E',
    );
  });
});
