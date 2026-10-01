import * as assert from 'assert';
import { describe, it } from 'mocha';
import { GoalTree, Model } from '@goal-controller/goal-tree';
import { edgeEngineMapper } from '../../../src/engines/edge';

describe('edgeEngineMapper', () => {
  it('carries utility and cost on tasks, like edgeV2', () => {
    const original = Model.load(
      '../../examples/edge/experiments/1-minimal.txt',
    );
    const task = [...original.elements.values()].find((element) =>
      element.name.startsWith('T1:'),
    );
    if (!task) throw new Error('T1 not found in the model');
    const elements = new Map(original.elements);
    elements.set(task.id, {
      ...task,
      customProperties: { ...task.customProperties, utility: '5', cost: '2' },
    });
    const model = { ...original, elements };

    const tree = GoalTree.fromModel(model, edgeEngineMapper);
    const t1 = GoalTree.allByType(tree.nodes, 'task').find(
      (node) => node.id === 'T1',
    );
    if (!t1) throw new Error('T1 not found in the tree');

    assert.strictEqual(t1.properties.engine.utility, '5');
    assert.strictEqual(t1.properties.engine.cost, '2');
  });

  it('defaults utility and cost to empty strings when unset', () => {
    const model = Model.load('../../examples/edge/experiments/1-minimal.txt');
    const tree = GoalTree.fromModel(model, edgeEngineMapper);
    const t1 = GoalTree.allByType(tree.nodes, 'task').find(
      (node) => node.id === 'T1',
    );
    if (!t1) throw new Error('T1 not found in the tree');

    assert.strictEqual(t1.properties.engine.utility, '');
    assert.strictEqual(t1.properties.engine.cost, '');
  });

  it("throws edgeTaskChecks.maxRetries's message for an invalid maxRetries", () => {
    const original = Model.load(
      '../../examples/edge/experiments/1-minimal.txt',
    );
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

  it('does not carry goal keys (e.g. utility) from a Quality', () => {
    const original = Model.load(
      '../../examples/edge/experiments/1-minimal.txt',
    );
    const goal = [...original.elements.values()].find((element) =>
      element.name.startsWith('G2:'),
    );
    if (!goal) throw new Error('G2 not found in the model');
    const elements = new Map(original.elements);
    elements.set(goal.id, {
      ...goal,
      kind: 'istar.Quality',
      customProperties: {
        ...goal.customProperties,
        utility: '5',
        cost: '2',
      },
    });
    const tree = GoalTree.fromModel(
      { ...original, elements },
      edgeEngineMapper,
    );
    const quality = GoalTree.allByType(tree.nodes, 'goal').find(
      (node) => node.properties.isQuality,
    );
    if (!quality) throw new Error('Quality not found in the tree');

    assert.strictEqual(quality.properties.engine.utility, '');
    assert.strictEqual(quality.properties.engine.cost, '');
  });
});
