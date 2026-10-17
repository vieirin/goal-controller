import * as assert from 'assert';
import { describe, it } from 'mocha';
import { GoalTree, Model } from '@goal-controller/goal-tree';
import { edgeEngineMapper } from '../../../src/engines/edgeV2';

describe('edgeV2EngineMapper', () => {
  it('reads a negative maxRetries as unset: 0, the dialect reporting it', () => {
    const original = Model.load('../../examples/edgeV2/simpleChoice.txt');
    const task = [...original.elements.values()].find((element) =>
      element.name.startsWith('T1:'),
    );
    if (!task) throw new Error('T1 not found in the model');
    const elements = new Map(original.elements);
    elements.set(task.id, {
      ...task,
      customProperties: { ...task.customProperties, maxRetries: '-1' },
    });
    const model = { ...original, elements };

    // #249: invalid value, changed (was edgeTaskChecks.maxRetries's throw):
    // below its min it is unset, and valueProblem says "At least 0"
    const t1 = GoalTree.fromModel(model, edgeEngineMapper)
      .query.allByType('task')
      .find((node) => node.id === 'T1');
    assert.strictEqual(t1?.properties.engine.maxRetries, 0);
  });
});
