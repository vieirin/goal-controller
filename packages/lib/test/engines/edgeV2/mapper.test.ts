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

  it('rejects a dependsOn that names a quality, as the check does (#266)', () => {
    const original = Model.load('../../examples/edgeV2/simpleChoice.txt');
    const goal = [...original.elements.values()].find((element) =>
      element.name.startsWith('G2:'),
    );
    const root = [...original.elements.values()].find((element) =>
      element.name.startsWith('G1:'),
    );
    if (!goal || !root) throw new Error('G1/G2 not found in the model');
    const elements = new Map(original.elements);
    elements.set(goal.id, { ...goal, kind: 'istar.Quality' });
    elements.set(root.id, {
      ...root,
      customProperties: { ...root.customProperties, dependsOn: 'G2' },
    });
    assert.throws(
      () => GoalTree.fromModel({ ...original, elements }, edgeEngineMapper),
      {
        message:
          '[INVALID MODEL]: Dependency G2 for node G1 must be a goal, got quality',
      },
    );
  });
});
