import * as assert from 'assert';
import { describe, it } from 'mocha';
import { GoalTree, Model } from '@goal-controller/goal-tree';
import { sleecEngineMapper } from '../../../src/engines/sleec';

describe('sleecEngineMapper', () => {
  it('carries NormPrinciple and Proxy from a Quality, not other goal keys', () => {
    const original = Model.load('../../examples/sleec/goalModel-sleec.txt');
    const goal = [...original.elements.values()].find((element) =>
      element.name.startsWith('G3:'),
    );
    if (!goal) throw new Error('G3 not found in the model');
    const elements = new Map(original.elements);
    elements.set(goal.id, {
      ...goal,
      kind: 'istar.Quality',
      customProperties: {
        ...goal.customProperties,
        NormPrinciple: 'Autonomy',
        Proxy: 'Assent/Consent',
        Type: 'soft',
      },
    });
    const tree = GoalTree.fromModel(
      { ...original, elements },
      sleecEngineMapper,
    );
    const quality = GoalTree.allByType(tree.nodes, 'goal').find(
      (node) => node.properties.isQuality,
    );
    if (!quality) throw new Error('Quality not found in the tree');

    assert.deepStrictEqual(quality.properties.engine, {
      NormPrinciple: 'Autonomy',
      Proxy: 'Assent/Consent',
    });
  });
});
