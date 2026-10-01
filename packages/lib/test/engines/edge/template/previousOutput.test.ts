import { GoalTree, Model } from '@goal-controller/goal-tree';
import * as assert from 'assert';
import { existsSync, rmSync } from 'fs';
import { before, describe, it } from 'mocha';
import { edgeEngineMapper } from '../../../../src/engines/edge';
import { initLogger } from '../../../../src/engines/edge/logger/logger';
import { generateValidatedPrismModel } from '../../../../src/engines/edge/template';

const MODEL = '../../examples/edge/experiments/8-minimalMaintain.txt';

const generate = (
  options: {
    previousOutput?: string;
    clean?: boolean;
    writeReport?: boolean;
  } = {},
): string => {
  const tree = GoalTree.fromModel(Model.load(MODEL), edgeEngineMapper);
  return generateValidatedPrismModel({
    gm: tree.nodes,
    fileName: '8-minimalMaintain',
    ...options,
  });
};

describe('generateValidatedPrismModel: previousOutput', () => {
  before(() => {
    initLogger('previousOutput-test', false, true);
  });

  it('keeps the System module transitions from a previous output', () => {
    const first = generate({ clean: true });
    const second = generate({ previousOutput: first });

    const systemModuleOf = (prism: string): string =>
      prism.slice(
        prism.indexOf('module System'),
        prism.indexOf('endmodule', prism.indexOf('module System')),
      );

    assert.strictEqual(systemModuleOf(second), systemModuleOf(first));
  });

  it('drops old transitions when clean is true, even with previousOutput set', () => {
    const first = generate({ clean: true });
    const cleaned = generate({ previousOutput: first, clean: true });

    assert.strictEqual(cleaned, first);
  });

  it('writeReport: false writes no logs/ files', () => {
    const reportPath = 'logs/writeReport-test.validation.json';
    rmSync(reportPath, { force: true });

    const tree = GoalTree.fromModel(Model.load(MODEL), edgeEngineMapper);
    generateValidatedPrismModel({
      gm: tree.nodes,
      fileName: 'writeReport-test',
      writeReport: false,
    });

    assert.ok(!existsSync(reportPath));
  });
});
