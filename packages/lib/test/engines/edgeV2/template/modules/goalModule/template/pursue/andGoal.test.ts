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
import type {
  Decision,
  EdgeGoalNode,
} from '../../../../../../../../src/engines/edgeV2/types';

const emptyDecision: Decision = {
  decisionVars: [],
  hasDecision: false,
};

const childGoal = (id: string): EdgeGoalNode => {
  const goal: EdgeGoalNode = {
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
  };
  return goal;
};

const andParent = (
  executionDetail: EdgeGoalNode['properties']['engine']['executionDetail'],
  childIds: string[],
): EdgeGoalNode => {
  const goal: EdgeGoalNode = {
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
  };
  return goal;
};

describe('edgeV2 AND anyOrder', () => {
  before(() => {
    initLogger('anyOrder-test', false, true);
  });

  describe('pursueAndAnyOrderGoal', () => {
    it('matches the reference flexible pursue guards (N=2)', () => {
      const goal = andParent(
        { type: 'anyOrder', anyOrder: ['G1', 'G2'] },
        ['G1', 'G2'],
      );

      assert.strictEqual(
        pursueAndAnyOrderGoal(goal, ['G1', 'G2'], 'G1'),
        'G0_achievable*N > decision_G0 & g2_state=0 & G1_relative*N > _decision_G0',
      );
      assert.strictEqual(
        pursueAndAnyOrderGoal(goal, ['G1', 'G2'], 'G2'),
        'G0_achievable*N > decision_G0 & g1_state=0 & G2_relative*N > _decision_G0 & !(G1_relative*N > _decision_G0)',
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
        '[skip_G0] !g0_achieved & g0_state=1 & g1_state=0 & g2_state=0 & G0_achievable*N <= decision_G0 -> (g0_state\'=0);',
      );
    });

    it('includes parent skip threshold for sequence', () => {
      const goal = andParent(
        { type: 'sequence', sequence: ['G1', 'G2'] },
        ['G1', 'G2'],
      );
      assert.strictEqual(
        skipStatement(goal),
        '[skip_G0] !g0_achieved & g0_state=1 & g1_state=0 & g2_state=0 & G0_achievable*N <= decision_G0 -> (g0_state\'=0);',
      );
    });
  });

  describe('achievableGoalFormula', () => {
    it('emits the remaining-achievability product for anyOrder parents', () => {
      const goal = andParent(
        { type: 'anyOrder', anyOrder: ['G1', 'G2'] },
        ['G1', 'G2'],
      );
      assert.strictEqual(
        achievableGoalFormula(goal),
        'formula G0_achievable = g0_achieved ? 0 : (!g1_achieved ? G1_achievable : 1) * (!g2_achieved ? G2_achievable : 1);',
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
        'G0_achievable*N > decision_G0 & g1_achieved & g1_state=0',
      );
    });
  });
});
