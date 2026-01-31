import * as assert from 'assert';
import { describe, it } from 'mocha';
import { GoalTree, Model } from '@goal-controller/goal-tree';
import { goalDependencyStatement } from '../../../../../../../../src/engines/edge/template/modules/goalModule/template/pursue/index';
import { edgeEngineMapper } from '../../../../../../../../src/engines/edge/mapper';

describe('Goal Dependency Statement', () => {
  it('should output G4_achieved_maintain = true for G2 dependency', () => {
    // Load the model
    const model = Model.load('../../examples/goalModel_TAS_3_.txt');

    // Convert to tree
    const tree = GoalTree.fromModel(model, edgeEngineMapper);

    // Find G2 in the tree
    const allGoals = tree.query.allGoalsMap();
    const g2 = allGoals.get('G2');

    if (!g2) {
      throw new Error('G2 not found in the tree');
    }

    const g4 = allGoals.get('G4');
    if (!g4) {
      throw new Error('G4 not found in the tree');
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    g2.properties.engine.dependsOn = [g4] as any;
    // Calculate the goal dependency statement
    const dependencyStatement = goalDependencyStatement(g2);

    // Verify that it contains G4_achieved_maintain = true
    assert.ok(
      dependencyStatement === ' & (G4_achieved_maintain=true)',
      `Expected dependency statement to include "G4_achieved_maintain=true", but got: ${dependencyStatement}`,
    );
  });
});
