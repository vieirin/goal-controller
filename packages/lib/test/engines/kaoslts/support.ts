/** The mine pump seed (goal-controller#209) read for kaoslts, as written or with its `.kaos` edited. */
import * as assert from 'assert';
import { readFileSync } from 'fs';
import { readKaosModel } from '../../../src/engines/kaosdoc';
import {
  kaosltsGoalModel,
  operationModelOf,
  type KaosltsGoalModel,
  type OperationModel,
} from '../../../src/engines/kaoslts';
import { kaosNativeFile } from '../../../src/importers/kaos';

export const MINE_PUMP = '../../examples/kaos/mine-pump/mine-pump.kaos';
export const minePumpText = () => readFileSync(MINE_PUMP, 'utf8');

/** `text` with each `[from, to]` replaced once (each `from` must be in it). */
export const edited = (
  text: string,
  ...edits: readonly (readonly [string, string])[]
): string =>
  edits.reduce((acc, [from, to]) => {
    assert.ok(acc.includes(from), `the seed has no ${from}`);
    return acc.replace(from, to);
  }, text);

/** A `.kaos` text's IR, as kaoslts reads it. */
export const goalModelOf = (kaos: string): KaosltsGoalModel => {
  const read = kaosNativeFile.read(kaos, { modelName: 'mine-pump' });
  assert.ok(read.model, read.diagnostics.map((d) => d.message).join('; '));
  return kaosltsGoalModel(readKaosModel(JSON.stringify(read.model)));
};

/** A `.kaos` text's operation model. */
export const operationsOf = (kaos: string): OperationModel =>
  operationModelOf(goalModelOf(kaos));
