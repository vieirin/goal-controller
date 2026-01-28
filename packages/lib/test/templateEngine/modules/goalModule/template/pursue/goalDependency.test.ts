import * as assert from 'assert';
import { describe, it } from 'mocha';
import { GoalTree, Model } from '@goal-controller/goal-tree';
import { goalDependencyStatement } from '../../../../../../src/templateEngine/modules/goalModule/template/pursue/index';

describe('Goal Dependency Statement', () => {
  it('should output G4_achieved_maintain = true for G2 dependency', () => {
    // Load the model
    const model = Model.load('../../examples/goalModel_TAS_3_.txt');

    // Convert to tree
    const tree = GoalTree.fromModel(model);

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
    g2.properties.edge.dependsOn = [g4];
    // Calculate the goal dependency statement
    const dependencyStatement = goalDependencyStatement(g2);

    // Verify that it contains G4_achieved_maintain = true
    assert.ok(
      dependencyStatement === ' & (G4_achieved_maintain=true)',
      `Expected dependency statement to include "G4_achieved_maintain=true", but got: ${dependencyStatement}`,
    );
  });
});
