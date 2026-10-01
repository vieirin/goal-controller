import * as assert from 'assert';
import { describe, it } from 'mocha';
import { GoalTree, Model } from '@goal-controller/goal-tree';
import { edgeEngineMapper } from '../../../src/engines/edgeV2';

describe('edgeV2EngineMapper', () => {
  it("throws edgeTaskChecks.maxRetries's message for an invalid maxRetries", () => {
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

    assert.throws(
      () => GoalTree.fromModel(model, edgeEngineMapper),
      /\[INVALID TASK\]: maxRetries must be a non-negative integer: got "-1"/,
    );
  });
});
