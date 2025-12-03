import * as assert from 'assert';
import { describe, it } from 'mocha';
import { loadPistarModel } from '../../../../../../src/GoalTree';
import { convertToTree } from '../../../../../../src/GoalTree/creation';
import { allGoalsMap } from '../../../../../../src/GoalTree/utils';
import { goalDependencyStatement } from '../../../../../../src/templateEngine/modules/goalModule/template/pursue/index';

describe('Goal Dependency Statement', () => {
  it('should output G4_achieved_maintain = true for G2 dependency', () => {
    // Load the model
    const model = loadPistarModel({
      filename: 'examples/goalModel_TAS_3_.txt',
    });

    // Convert to tree
    const tree = convertToTree({ model });

    // Find G2 in the tree
    const allGoals = allGoalsMap({ gm: tree });
    const g2 = allGoals.get('G2');

    if (!g2) {
      throw new Error('G2 not found in the tree');
    }

    const g4 = allGoals.get('G4');
    if (!g4) {
      throw new Error('G4 not found in the tree');
    }
    g2.dependsOn = [g4];
    // Calculate the goal dependency statement
    const dependencyStatement = goalDependencyStatement(g2);

    // Verify that it contains G4_achieved_maintain = true
    assert.ok(
      dependencyStatement === ' & (G4_achieved_maintain=true)',
      `Expected dependency statement to include "G4_achieved_maintain=true", but got: ${dependencyStatement}`,
    );
  });
});
