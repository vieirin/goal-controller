import * as assert from 'assert';
import { before, describe, it } from 'mocha';
import {
  pursueAndAnyOrderGoal,
  pursueAndSequentialGoal,
  splitSequence,
} from '../../../../../../../../src/engines/edgeV2/template/modules/goalModule/template/pursue/andGoal';
import { skipStatement } from '../../../../../../../../src/engines/edgeV2/template/modules/goalModule/template/skip';
import { decisionVariableNamesForGoal } from '../../../../../../../../src/engines/edgeV2/template/decisionVariables';
import { achievableGoalFormula } from '../../../../../../../../src/engines/edgeV2/template/modules/goalModule/template/formulas';
import { initLogger } from '../../../../../../../../src/engines/edgeV2/logger/logger';
import type { EdgeGoalNode } from '../../../../../../../../src/engines/edgeV2/types';

const emptyDecision = {
  decisionVars: [] as Array<{ variable: string; space: number }>,
  hasDecision: false,
};

const childGoal = (id: string): EdgeGoalNode =>
  ({
    iStarId: id,
    id,
    type: 'goal',
    name: id,
    relationToChildren: null,
    children: [],
    tasks: [],
    properties: {
      isQuality: false,
      engine: {
        utility: '',
        cost: '',
        dependsOn: [],
        executionDetail: null,
        decision: emptyDecision,
        maxRetries: 0,
      },
    },
  }) as EdgeGoalNode;

const andParent = (
  executionDetail: EdgeGoalNode['properties']['engine']['executionDetail'],
  childIds: string[],
): EdgeGoalNode =>
  ({
    iStarId: 'G0',
    id: 'G0',
    type: 'goal',
    name: 'Parent',
    relationToChildren: 'and',
    children: childIds.map(childGoal),
    tasks: [],
    properties: {
      isQuality: false,
      engine: {
        utility: '',
        cost: '',
        dependsOn: [],
        executionDetail,
        decision: emptyDecision,
        maxRetries: 0,
      },
    },
  }) as EdgeGoalNode;

describe('edgeV2 AND anyOrder', () => {
  before(() => {
    initLogger('anyOrder-test', false, true);
  });

  describe('pursueAndAnyOrderGoal', () => {
    it('matches EDGEV2 N=2 pursue guards', () => {
      const goal = andParent(
        { type: 'anyOrder', anyOrder: ['G1', 'G2'] },
        ['G1', 'G2'],
      );

      assert.strictEqual(
        pursueAndAnyOrderGoal(goal, ['G1', 'G2'], 'G1'),
        'G0_achievable*10.0 > decision_G0 & g2_state!=1 & (g2_state=1 | (G1_achievable/(G1_achievable+G2_achievable))*10.0 > _decision_G0)',
      );
      assert.strictEqual(
        pursueAndAnyOrderGoal(goal, ['G1', 'G2'], 'G2'),
        'G0_achievable*10.0 > decision_G0 & g1_state!=1 & (g1_state=1 | (G1_achievable/(G1_achievable+G2_achievable))*10.0 <= _decision_G0)',
      );
    });

    it('rejects OR parents', () => {
      const goal = {
        ...andParent({ type: 'anyOrder', anyOrder: ['G1', 'G2'] }, ['G1', 'G2']),
        relationToChildren: 'or' as const,
      };
      assert.throws(
        () => pursueAndAnyOrderGoal(goal, ['G1', 'G2'], 'G1'),
        /Any-order goals are not supported for OR/,
      );
    });

    it('rejects unknown child ids', () => {
      const goal = andParent(
        { type: 'anyOrder', anyOrder: ['G1', 'G2'] },
        ['G1', 'G2'],
      );
      assert.throws(
        () => pursueAndAnyOrderGoal(goal, ['G1', 'G2'], 'G99'),
        /Child ID G99 not found in anyOrder/,
      );
    });
  });

  describe('decisionVariableNamesForGoal', () => {
    it('emits _decision for AND anyOrder parents', () => {
      const goal = andParent(
        { type: 'anyOrder', anyOrder: ['G1', 'G2'] },
        ['G1', 'G2'],
      );
      assert.deepStrictEqual(decisionVariableNamesForGoal(goal), [
        'decision_G0',
        '_decision_G0',
      ]);
    });

    it('does not emit _decision for AND sequence parents', () => {
      const goal = andParent(
        { type: 'sequence', sequence: ['G1', 'G2'] },
        ['G1', 'G2'],
      );
      assert.deepStrictEqual(decisionVariableNamesForGoal(goal), [
        'decision_G0',
      ]);
    });
  });

  describe('skipStatement', () => {
    it('includes parent skip threshold for anyOrder', () => {
      const goal = andParent(
        { type: 'anyOrder', anyOrder: ['G1', 'G2'] },
        ['G1', 'G2'],
      );
      assert.strictEqual(
        skipStatement(goal),
        '[skip_G0] !g0_achieved & g0_state=1 & g1_state=0 & g2_state=0 & G0_achievable*10.0 <= decision_G0 -> (g0_state\'=0);',
      );
    });

    it('includes parent skip threshold for sequence', () => {
      const goal = andParent(
        { type: 'sequence', sequence: ['G1', 'G2'] },
        ['G1', 'G2'],
      );
      assert.strictEqual(
        skipStatement(goal),
        '[skip_G0] !g0_achieved & g0_state=1 & g1_state=0 & g2_state=0 & G0_achievable*10.0 <= decision_G0 -> (g0_state\'=0);',
      );
    });
  });

  describe('achievableGoalFormula', () => {
    it('emits AND product for anyOrder parents', () => {
      const goal = andParent(
        { type: 'anyOrder', anyOrder: ['G1', 'G2'] },
        ['G1', 'G2'],
      );
      assert.strictEqual(
        achievableGoalFormula(goal),
        'formula G0_achievable = G1_achievable * G2_achievable;',
      );
    });
  });

  describe('splitSequence / pursueAndSequentialGoal (regression)', () => {
    it('still splits sequences', () => {
      assert.deepStrictEqual(splitSequence(['G1', 'G2', 'G3'], 'G2'), [
        ['G1'],
        ['G3'],
      ]);
    });

    it('still builds sequence pursue guards', () => {
      const goal = andParent(
        { type: 'sequence', sequence: ['G1', 'G2'] },
        ['G1', 'G2'],
      );
      assert.strictEqual(
        pursueAndSequentialGoal(goal, ['G1', 'G2'], 'G2'),
        'G0_achievable*10.0 > decision_G0 & g1_achieved',
      );
    });
  });
});
