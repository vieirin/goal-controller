import { GoalTree, Model } from '@goal-controller/goal-tree';
import * as assert from 'assert';
import { readdirSync, statSync } from 'fs';
import { join } from 'path';
import { before, describe, it } from 'mocha';
import { edgeLangiumEngineMapper } from '../../../src/engines/edgeLangium';
import { edgeEngineMapper } from '../../../src/engines/edgeV2';
import { initLogger } from '../../../src/engines/edgeV2/logger/logger';
import { generateValidatedPrismModel } from '../../../src/engines/edgeV2/template';

// every edgeV2 example model, including the conformance experiment's generated ones
const EXAMPLES = '../../examples/edgeV2';

const models = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return models(path);
    return /(^goal|^[^.]+)\.txt$/.test(entry) &&
      !entry.endsWith('.expected.txt')
      ? [path]
      : [];
  });

/** the PRISM model, or the error generation stops with */
const generate = (file: string, mapper: typeof edgeEngineMapper): string => {
  try {
    const tree = GoalTree.fromModel(Model.load(file), mapper);
    return generateValidatedPrismModel({ gm: tree.nodes, fileName: 'model' });
  } catch (error) {
    return `error: ${(error as Error).message}`;
  }
};

describe('edgeLangium generates the same PRISM as edgeV2', () => {
  before(() => {
    initLogger('edgeLangium-test', false, true);
  });

  const files = models(EXAMPLES).filter((file) => {
    try {
      Model.load(file);
      return true;
    } catch {
      return false; // notation.txt and other non-model files
    }
  });

  it('covers the example models', () => {
    assert.ok(files.length >= 20, `only ${files.length} models found`);
  });

  for (const file of files) {
    it(file.replace(`${EXAMPLES}/`, ''), () => {
      const edgeV2 = generate(file, edgeEngineMapper);
      assert.ok(!edgeV2.startsWith('error:'), `edgeV2 fails: ${edgeV2}`);
      assert.strictEqual(generate(file, edgeLangiumEngineMapper), edgeV2);
    });
  }
});
