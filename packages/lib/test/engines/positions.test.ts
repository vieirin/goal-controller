import * as assert from 'assert';
import { describe, it } from 'mocha';
import { GoalTree, Model, goalView } from '@goal-controller/goal-tree';
import { edgeEngineMapper } from '../../src/engines/edgeV2';
import { edgeV2 } from '../../src/engines/edgeV2/definition';

const EXAMPLE = '../../examples/edgeV2/goalModel_TAS_3_.txt';

describe('diagram positions', () => {
  it('carries each element’s x into the tree and the view', () => {
    const model = Model.load(EXAMPLE);
    const xOf = new Map(
      [...model.elements.values()].map((element) => [element.id, element.x]),
    );
    const tree = GoalTree.fromModel(model, edgeEngineMapper);
    const nodes = [
      ...GoalTree.allByType(tree.nodes, 'goal'),
      ...GoalTree.allByType(tree.nodes, 'task'),
      ...GoalTree.allByType(tree.nodes, 'resource'),
    ];
    assert.ok(nodes.length > 0);
    for (const node of nodes)
      assert.strictEqual(node.x, xOf.get(node.iStarId), node.id);
    for (const node of goalView(model, edgeV2).nodes.values())
      assert.strictEqual(node.x, xOf.get(node.iStarId), node.id);
  });
});
