import * as assert from 'assert';
import { describe, it } from 'mocha';
import { loadPistarModel } from '../../src/GoalTree';
import { convertToTree } from '../../src/GoalTree/creation';
import { allByType, allGoalsMap } from '../../src/GoalTree/utils';

describe('Exec Condition Assertions - goalModel_TAS_3', () => {
  // Load the model once for all tests
  const model = loadPistarModel({
    filename: 'examples/goalModel_TAS_3.txt',
  });

  const tree = convertToTree({ model });
  const allGoals = allGoalsMap({ gm: tree });
  const allTasks = allByType({ gm: tree, type: 'task' });

  describe('Goal nodes with assertions', () => {
    it('should have execCondition.assertion for G3 with privacyEnabled', () => {
      const g3 = allGoals.get('G3');
      assert.ok(g3, 'G3 not found in the tree');
      assert.ok(g3.execCondition, 'G3 should have execCondition');
      assert.ok(
        g3.execCondition.assertion,
        'G3 should have execCondition.assertion',
      );
      assert.strictEqual(g3.execCondition.assertion.sentence, 'privacyEnabled');
      assert.ok(
        g3.execCondition.assertion.variables.length > 0,
        'G3 assertion should have variables',
      );
    });

    it('should have execCondition with maintain and assertion for G4', () => {
      const g4 = allGoals.get('G4');
      assert.ok(g4, 'G4 not found in the tree');
      assert.ok(g4.execCondition, 'G4 should have execCondition');
      assert.ok(
        g4.execCondition.maintain,
        'G4 should have execCondition.maintain',
      );
      assert.strictEqual(g4.execCondition.maintain.sentence, 'inEmergency');
      assert.ok(
        g4.execCondition.assertion,
        'G4 should have execCondition.assertion',
      );
      assert.strictEqual(
        g4.execCondition.assertion.sentence,
        'enoughBattery & highReliability',
      );
      assert.ok(
        g4.execCondition.assertion.variables.length > 0,
        'G4 assertion should have variables',
      );
    });

    it('should have execCondition with maintain and assertion for G8', () => {
      const g8 = allGoals.get('G8');
      assert.ok(g8, 'G8 not found in the tree');
      assert.ok(g8.execCondition, 'G8 should have execCondition');
      assert.ok(
        g8.execCondition.maintain,
        'G8 should have execCondition.maintain',
      );
      assert.strictEqual(
        g8.execCondition.maintain.sentence,
        'enoughBattery & highReliability',
      );
      assert.ok(
        g8.execCondition.assertion,
        'G8 should have execCondition.assertion',
      );
      assert.strictEqual(
        g8.execCondition.assertion.sentence,
        'sensorAvailable',
      );
      assert.ok(
        g8.execCondition.assertion.variables.length > 0,
        'G8 assertion should have variables',
      );
    });

    it('should have execCondition.assertion for G12 with pharmacyAvailable&atHome', () => {
      const g12 = allGoals.get('G12');
      assert.ok(g12, 'G12 not found in the tree');
      assert.ok(g12.execCondition, 'G12 should have execCondition');
      assert.ok(
        g12.execCondition.assertion,
        'G12 should have execCondition.assertion',
      );
      assert.strictEqual(
        g12.execCondition.assertion.sentence,
        'pharmacyAvailable&atHome',
      );
      assert.ok(
        g12.execCondition.assertion.variables.length > 0,
        'G12 assertion should have variables',
      );
    });

    it('should have execCondition with maintain and assertion for G18', () => {
      const g18 = allGoals.get('G18');
      assert.ok(g18, 'G18 not found in the tree');
      assert.ok(g18.execCondition, 'G18 should have execCondition');
      assert.ok(
        g18.execCondition.maintain,
        'G18 should have execCondition.maintain',
      );
      assert.strictEqual(
        g18.execCondition.maintain.sentence,
        'inSideEffectWindow',
      );
      assert.ok(
        g18.execCondition.assertion,
        'G18 should have execCondition.assertion',
      );
      assert.strictEqual(
        g18.execCondition.assertion.sentence,
        'medicationApplied',
      );
      assert.ok(
        g18.execCondition.assertion.variables.length > 0,
        'G18 assertion should have variables',
      );
    });

    it('should have execCondition.assertion for G19 with inEmergency', () => {
      const g19 = allGoals.get('G19');
      assert.ok(g19, 'G19 not found in the tree');
      assert.ok(g19.execCondition, 'G19 should have execCondition');
      assert.ok(
        g19.execCondition.assertion,
        'G19 should have execCondition.assertion',
      );
      assert.strictEqual(g19.execCondition.assertion.sentence, 'inEmergency');
      assert.ok(
        g19.execCondition.assertion.variables.length > 0,
        'G19 assertion should have variables',
      );
    });

    it('should have execCondition with maintain and assertion for G2', () => {
      const g2 = allGoals.get('G2');
      assert.ok(g2, 'G2 not found in the tree');
      assert.ok(g2.execCondition, 'G2 should have execCondition');
      assert.ok(
        g2.execCondition.maintain,
        'G2 should have execCondition.maintain',
      );
      assert.strictEqual(g2.execCondition.maintain.sentence, 'highPrecision');
      assert.ok(
        g2.execCondition.assertion,
        'G2 should have execCondition.assertion',
      );
      assert.strictEqual(
        g2.execCondition.assertion.sentence,
        'patientTracking',
      );
      assert.ok(
        g2.execCondition.assertion.variables.length > 0,
        'G2 assertion should have variables',
      );
    });

    it('should have execCondition.assertion for G5 with privacyEnabled', () => {
      const g5 = allGoals.get('G5');
      assert.ok(g5, 'G5 not found in the tree');
      assert.ok(g5.execCondition, 'G5 should have execCondition');
      assert.ok(
        g5.execCondition.assertion,
        'G5 should have execCondition.assertion',
      );
      assert.strictEqual(g5.execCondition.assertion.sentence, 'privacyEnabled');
      assert.ok(
        g5.execCondition.assertion.variables.length > 0,
        'G5 assertion should have variables',
      );
    });

    it('should have execCondition.assertion for G6 with privacyEnabled=false', () => {
      const g6 = allGoals.get('G6');
      assert.ok(g6, 'G6 not found in the tree');
      assert.ok(g6.execCondition, 'G6 should have execCondition');
      assert.ok(
        g6.execCondition.assertion,
        'G6 should have execCondition.assertion',
      );
      assert.strictEqual(
        g6.execCondition.assertion.sentence,
        'privacyEnabled=false',
      );
      assert.ok(
        g6.execCondition.assertion.variables.length > 0,
        'G6 assertion should have variables',
      );
    });
  });

  describe('Task nodes with assertions', () => {
    it('should have execCondition.assertion for T4 with R0=true', () => {
      const t4 = allTasks.find((task) => task.id === 'T4');
      assert.ok(t4, 'T4 not found in the tree');
      assert.ok(t4.execCondition, 'T4 should have execCondition');
      assert.ok(
        t4.execCondition.assertion,
        'T4 should have execCondition.assertion',
      );
      assert.strictEqual(t4.execCondition.assertion.sentence, 'R0=true');
      assert.ok(
        t4.execCondition.assertion.variables.length > 0,
        'T4 assertion should have variables',
      );
    });

    it('should have execCondition.assertion for T9 with R3=true', () => {
      const t9 = allTasks.find((task) => task.id === 'T9');
      assert.ok(t9, 'T9 not found in the tree');
      assert.ok(t9.execCondition, 'T9 should have execCondition');
      assert.ok(
        t9.execCondition.assertion,
        'T9 should have execCondition.assertion',
      );
      assert.strictEqual(t9.execCondition.assertion.sentence, 'R3=true');
      assert.ok(
        t9.execCondition.assertion.variables.length > 0,
        'T9 assertion should have variables',
      );
    });

    it('should have execCondition.assertion for T2 with privacyEnabled', () => {
      const t2 = allTasks.find((task) => task.id === 'T2');
      assert.ok(t2, 'T2 not found in the tree');
      assert.ok(t2.execCondition, 'T2 should have execCondition');
      assert.ok(
        t2.execCondition.assertion,
        'T2 should have execCondition.assertion',
      );
      assert.strictEqual(t2.execCondition.assertion.sentence, 'privacyEnabled');
      assert.ok(
        t2.execCondition.assertion.variables.length > 0,
        'T2 assertion should have variables',
      );
    });

    it('should have execCondition.assertion for T3 with R1>50', () => {
      const t3 = allTasks.find((task) => task.id === 'T3');
      assert.ok(t3, 'T3 not found in the tree');
      assert.ok(t3.execCondition, 'T3 should have execCondition');
      assert.ok(
        t3.execCondition.assertion,
        'T3 should have execCondition.assertion',
      );
      assert.strictEqual(t3.execCondition.assertion.sentence, 'R1>50');
      assert.ok(
        t3.execCondition.assertion.variables.length > 0,
        'T3 assertion should have variables',
      );
      // Verify that R1 is extracted as a variable
      const r1Variable = t3.execCondition.assertion.variables.find(
        (v) => v.name === 'R1',
      );
      assert.ok(r1Variable, 'T3 assertion should extract R1 as a variable');
      assert.strictEqual(
        r1Variable.value,
        null,
        'R1 variable should have null value (integer comparison)',
      );
    });

    it('should have execCondition.assertion for T10 with R4>35', () => {
      const t10 = allTasks.find((task) => task.id === 'T10');
      assert.ok(t10, 'T10 not found in the tree');
      assert.ok(t10.execCondition, 'T10 should have execCondition');
      assert.ok(
        t10.execCondition.assertion,
        'T10 should have execCondition.assertion',
      );
      assert.strictEqual(t10.execCondition.assertion.sentence, 'R4>35');
      assert.ok(
        t10.execCondition.assertion.variables.length > 0,
        'T10 assertion should have variables',
      );
      // Verify that R4 is extracted as a variable
      const r4Variable = t10.execCondition.assertion.variables.find(
        (v) => v.name === 'R4',
      );
      assert.ok(r4Variable, 'T10 assertion should extract R4 as a variable');
      assert.strictEqual(
        r4Variable.value,
        null,
        'R4 variable should have null value (integer comparison)',
      );
    });

    it('should have execCondition.assertion for T11 with networkAvailable', () => {
      const t11 = allTasks.find((task) => task.id === 'T11');
      assert.ok(t11, 'T11 not found in the tree');
      assert.ok(t11.execCondition, 'T11 should have execCondition');
      assert.ok(
        t11.execCondition.assertion,
        'T11 should have execCondition.assertion',
      );
      assert.strictEqual(
        t11.execCondition.assertion.sentence,
        'networkAvailable',
      );
      assert.ok(
        t11.execCondition.assertion.variables.length > 0,
        'T11 assertion should have variables',
      );
    });
  });

  describe('Nodes without assertions should not have execCondition', () => {
    it('should not have execCondition for G0', () => {
      const g0 = allGoals.get('G0');
      assert.ok(g0, 'G0 not found in the tree');
      assert.ok(!g0.execCondition, 'G0 should not have execCondition');
    });

    it('should not have execCondition for G1', () => {
      const g1 = allGoals.get('G1');
      assert.ok(g1, 'G1 not found in the tree');
      assert.ok(!g1.execCondition, 'G1 should not have execCondition');
    });

    it('should not have execCondition for T1', () => {
      const t1 = allTasks.find((task) => task.id === 'T1');
      assert.ok(t1, 'T1 not found in the tree');
      assert.ok(!t1.execCondition, 'T1 should not have execCondition');
    });
  });
});
