/**
 * iStarDT-X as iStar-DT's native file (goal-controller#144 item 2): the
 * committed sources round-trip (read, written, read back: the model but for
 * positions; written again, the file, canonically), the seeds' models too,
 * and the native files the seeds ship are the writer's output. dtx2dtg's
 * nine fixtures and its validator are `pnpm stress:istardt`'s (fetched;
 * `--oracle` runs the validator in Docker).
 */
import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { describe, it } from 'mocha';
import { readXml } from '@goal-controller/goal-language/formats';
import {
  canonicalIstardtx,
  istardt,
  writeIstardtx,
} from '../../../src/engines/istardt';
import { modelRoundTrip } from '../../../src/importers/native';
import { describeNativeRoundTrips } from '../../support/nativeRoundTrip';

type Json = Record<string, any>;
const EXAMPLES = path.join(__dirname, '../../../../../examples/istardt');
const read = (...parts: string[]) =>
  fs.readFileSync(path.join(EXAMPLES, ...parts), 'utf8');
const file = istardt.nativeFiles!.istardtx!;
const SEEDS = [
  { dir: 'istardt-order', source: '1.Order.istardtx', model: 'Order' },
  {
    dir: 'istardt-heating',
    source: '3.2.Heating_10R_Mixed.istardtx',
    model: 'Heating',
  },
  { dir: 'istardt-own', source: 'istardt-own.istardtx', model: 'istardt-own' },
];

describeNativeRoundTrips(
  istardt,
  SEEDS.map(({ dir, source }) => ({
    name: source,
    file: 'istardtx',
    text: read(dir, source),
    // they hold only what the model keeps
    lossless: true,
  })),
);

describe('iStar-DT: iStarDT-X, the seeds through it', () => {
  for (const { dir, model } of SEEDS)
    it(`${dir}: its model, written and read back, is itself but for positions`, () => {
      const trip = modelRoundTrip(file, JSON.parse(read(dir, `${model}.txt`)), {
        modelName: model,
      });
      assert.strictEqual(trip.problem, null);
    });

  for (const { dir, model } of SEEDS) {
    const project = JSON.parse(read(dir, 'project.json'));
    const shipped = project.models[0].native?.istardtx;
    if (!shipped) continue;
    it(`${dir} ships ${shipped}: the writer's output for its model`, () => {
      const { text } = writeIstardtx(JSON.parse(read(dir, `${model}.txt`)), {
        options: project.options,
      });
      assert.strictEqual(text, read(dir, shipped));
    });
  }

  it('writes what the Schematron requires: every goal its episode length, a description everywhere', () => {
    const { text } = writeIstardtx(
      JSON.parse(read('istardt-own', 'istardt-own.txt')),
    );
    const { root } = readXml(text!);
    const all = (name: string) => {
      const out: { attributes: Record<string, string> }[] = [];
      const walk = (e: NonNullable<typeof root>) => {
        if (e.name === name) out.push(e);
        e.children.forEach(walk);
      };
      walk(root!);
      return out;
    };
    assert.ok(all('goal').length > 0);
    assert.ok(all('goal').every((g) => g.attributes.episodeLength));
    for (const name of [
      'goal',
      'task',
      'effect',
      'quality',
      'condBox',
      'predicate',
    ])
      assert.ok(
        all(name).every((e) => e.attributes.description !== undefined),
        name,
      );
    assert.deepStrictEqual(all('options')[0]!.attributes, {
      continuous: 'true',
      infeasibleActionPenalty: '100',
    });
  });

  it('writes a pre the importer made a condition of inline, as the file had it', () => {
    const { text } = writeIstardtx(
      JSON.parse(read('istardt-own', 'istardt-own.txt')),
    );
    assert.ok(!/<condBox name="waterByHandPre"/.test(text!));
    assert.ok(
      /<task name="waterByHand"[^>]*>\s*<pre>\s*<(and|or|not|gt|gte|lt|lte|eq|neq)>/.test(
        text!,
      ),
    );
  });

  it('writes the same model to the same text', () => {
    const model: Json = JSON.parse(read('istardt-heating', 'Heating.txt'));
    assert.strictEqual(writeIstardtx(model).text, writeIstardtx(model).text);
  });

  it('compares what the importer reads: a changed probability differs, comments and defaults don’t', () => {
    const source = read('istardt-order', '1.Order.istardtx');
    assert.strictEqual(
      canonicalIstardtx(
        source.replace('<!--', '<!-- more').replace('terminal = "false"', ''),
      ),
      canonicalIstardtx(source),
    );
    assert.notStrictEqual(
      canonicalIstardtx(
        source.replace('probability = "0.75"', 'probability = "0.7"'),
      ),
      canonicalIstardtx(source),
    );
  });
});
