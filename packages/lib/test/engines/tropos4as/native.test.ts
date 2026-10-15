/**
 * TAOM4E's `.tropos` as Tropos4AS's native file (goal-controller#144 item
 * 3): written and read back, both seeds and the hand-written fixtures are
 * themselves but for `lossy`; the fixtures, read and written, are
 * themselves canonically; the GODA-shaped one, written and read back, still
 * generates examples/goda/dm's files; what TAOM4E has no class for is kept
 * in goal-controller's extension. Unverified against TAOM4E: no tool can
 * re-read what it writes (#134).
 */
import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { describe, it } from 'mocha';
import { Model } from '@goal-controller/goal-tree';
import { readXmi } from '@goal-controller/goal-language/formats';
import { goda, godaGoalModel, godaOutput } from '../../../src';
import {
  canonicalTaom4e,
  tropos4as,
  writeTaom4e,
} from '../../../src/engines/tropos4as';
import { modelRoundTrip } from '../../../src/importers/native';
import { describeNativeRoundTrips } from '../../support/nativeRoundTrip';

type Json = Record<string, any>;
const ROOT = path.join(__dirname, '../../../../..');
const FIXTURES = ['cleaner-agent', 'patient-monitoring', 'dm-goda'];
const fixture = (name: string) =>
  fs.readFileSync(path.join(__dirname, 'taom4e', `${name}.tropos`), 'utf8');
const seed = (name: string): Json =>
  JSON.parse(
    fs.readFileSync(
      path.join(ROOT, 'examples/tropos4as', name, `${name}.txt`),
      'utf8',
    ),
  );
const file = tropos4as.nativeFiles!.tropos!;

describeNativeRoundTrips(
  tropos4as,
  FIXTURES.map((name) => ({
    name: `${name}.tropos`,
    file: 'tropos',
    text: fixture(name),
    // they hold only what the model keeps
    lossless: true,
  })),
);

describe('Tropos4AS: .tropos, the seeds through it (unverified against TAOM4E)', () => {
  for (const name of ['cleaner-agent', 'patient-monitoring'])
    it(`${name}: written and read back, itself but for ${file.lossy!.join(', ')}`, () => {
      const trip = modelRoundTrip(file, seed(name), { modelName: name });
      assert.strictEqual(trip.problem, null);
    });

  it('writes the same model to the same text', () => {
    const model = seed('patient-monitoring');
    assert.strictEqual(writeTaom4e(model).text, writeTaom4e(model).text);
  });

  it('writes TAOM4E’s shape: the project, its diagrams, the business model', () => {
    const { text } = writeTaom4e(seed('cleaner-agent'));
    const { reader } = readXmi(text);
    const [project, business] = reader!.document.root.children;
    assert.strictEqual(
      project!.feature,
      'it.itc.sra.taom4e.model.project:Project',
    );
    assert.strictEqual(
      business!.feature,
      'it.itc.sra.taom4e.model.core.informalcore.formalcore:FormalBusinessModel',
    );
    assert.strictEqual(project!.attributes.BusinessModel, business!.id);
    const rc = reader!.document.byId.get('RC')!;
    assert.deepStrictEqual(
      {
        type: rc.type,
        mode: rc.attributes.mode,
        fulfillment: rc.attributes.fulfillmentProperty,
        wanter: rc.attributes.wanter,
      },
      {
        type: 'it.itc.sra.taom4e.model.core.informalcore.formalcore:FHardGoal',
        mode: 'ACHIEVE',
        fulfillment: 'roomClean',
        wanter: 'CleanerAgent',
      },
    );
    assert.strictEqual(
      reader!.document.byId.get('MBL')!.attributes.mode,
      'MAINTAIN',
    );
    // the means-end of a plan, the decomposition of RoomClean, positions
    const types = reader!.document.nodes.map((n) => n.type?.split(':')[1]);
    assert.strictEqual(types.filter((t) => t === 'MeansEnd').length, 3);
    assert.strictEqual(types.filter((t) => t === 'OrDecLink').length, 2);
    const figure = reader!.document.nodes.find(
      (n) => n.attributes.core === 'RC',
    )!;
    assert.deepStrictEqual(
      [figure.attributes.x, figure.attributes.y, figure.attributes.width],
      ['393', '141', '132'],
    );
  });

  it('keeps what TAOM4E has no class for in goal-controller’s extension, which canonical leaves out', () => {
    const { text, diagnostics } = writeTaom4e(seed('patient-monitoring'));
    const { reader } = readXmi(text);
    const extension = reader!.document.root.children[2]!;
    assert.deepStrictEqual(extension.attributes, {
      extender: 'goal-controller',
      engine: 'tropos4as',
    });
    const kept = (feature: string) =>
      extension.children
        .filter((c) => c.feature === feature)
        .map((c) => c.attributes);
    // the artifacts, failures and errors, with their properties
    assert.deepStrictEqual(
      kept('node').map((a) => [a.id, a.type]),
      [
        ['mealsNotEaten', 'tropos4as.Failure'],
        ['medicineNotTaken', 'tropos4as.Failure'],
        ['errorNotEat', 'tropos4as.Error'],
        ['errorMedicine', 'tropos4as.Error'],
        ['errorNoDinner', 'tropos4as.Error'],
        ['medicineSensor', 'tropos4as.Artifact'],
        ['mealSensor', 'tropos4as.Artifact'],
      ],
    );
    // conditions with no Formal Tropos slot
    assert.ok(
      kept('property').some(
        (a) => a.of === 'takeMedicine' && a.key === 'failure',
      ),
    );
    // Tropos4AS's links, and refinements of an error
    assert.ok(kept('link').some((a) => a.type === 'tropos4as.SequenceLink'));
    assert.ok(
      diagnostics.some((d) => /goal-controller's extension/.test(d.message)),
    );
    assert.ok(!canonicalTaom4e(text).includes('xmi:Extension'));
  });
});

describe('Tropos4AS: .tropos, the GODA-shaped fixture (#134 D1.3)', () => {
  it('written and read back, it generates what examples/goda/dm does, file for file', () => {
    const { model } = file.read(fixture('dm-goda'), { modelName: 'dm2' });
    const { text } = writeTaom4e(model!);
    // CRGMToPRISM's context, as Formal Tropos writes it
    assert.ok(text.includes('creationProperty="assertion trigger ctx=1"'));
    const back = file.read(text, { modelName: 'dm2' });
    assert.strictEqual(back.dialectRecord!.engine, 'goda');
    const generate = (json: Json) =>
      godaOutput(godaGoalModel(Model.parse(JSON.stringify(json), goda)), {
        modelName: 'dm2.txt',
        variant: 'cc808b6',
      }).files.map((f) => [f.fileName, f.text]);
    const twin = JSON.parse(
      fs.readFileSync(path.join(ROOT, 'examples/goda/dm/dm2.txt'), 'utf8'),
    );
    assert.deepStrictEqual(generate(back.model!), generate(twin));
  });
});
