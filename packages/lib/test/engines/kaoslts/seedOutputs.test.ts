/**
 * kaosdoc's and kaoslts's files over every KAOS seed, read as the committed
 * `.txt` stores it (no re-keying to KAOSTools identifiers, which the stress
 * oracles and other tests do), are byte for byte what the engines gave
 * before elements were given UUID ids (goal-controller#518, review of #528):
 * `fixtures/base-output/` holds them as the base commit wrote them.
 */
import * as assert from 'assert';
import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import {
  kaosdocGoalModel,
  kaosdocOutput,
  readKaosModel,
} from '../../../src/engines/kaosdoc';
import { kaosltsGoalModel, kaosltsOutput } from '../../../src/engines/kaoslts';

const SEEDS = '../../examples/kaos';
const GOLD = join(__dirname, 'fixtures', 'base-output');

const seeds = readdirSync(SEEDS)
  .filter((dir) => statSync(join(SEEDS, dir)).isDirectory())
  .flatMap((dir) =>
    readdirSync(join(SEEDS, dir))
      .filter((file) => file.endsWith('.txt'))
      .map((file) => ({ dir, name: file.replace(/\.txt$/, ''), file })),
  );

describe('kaosdoc and kaoslts on the seeds as stored, against the base commit’s output (#518)', () => {
  it('has the seeds', () => {
    assert.ok(existsSync(GOLD));
    assert.strictEqual(seeds.length, 20);
  });

  for (const { dir, name, file } of seeds)
    it(`${dir}: the same files, byte for byte`, () => {
      const text = readFileSync(join(SEEDS, dir, file), 'utf8');
      const model = readKaosModel(text);
      const files = [
        ...kaosdocOutput(kaosdocGoalModel(model), {
          modelName: name,
        }).files.map((f) => ['kaosdoc', f] as const),
        ...kaosltsOutput(kaosltsGoalModel(model), {
          modelName: name,
        }).files.map((f) => ['kaoslts', f] as const),
      ];
      const expected = readdirSync(GOLD).filter((f) =>
        f.startsWith(`${dir}__`),
      );
      assert.deepStrictEqual(
        files.map(([engine, f]) => `${dir}__${engine}__${f.fileName}`).sort(),
        expected.sort(),
      );
      for (const [engine, f] of files)
        assert.strictEqual(
          f.text,
          readFileSync(join(GOLD, `${dir}__${engine}__${f.fileName}`), 'utf8'),
          `${engine} ${f.fileName}`,
        );
    });
});
