import * as assert from 'assert';
import { before, describe, it } from 'mocha';
import {
  pursueAlternativeGoal,
  pursueChoiceGoal,
  pursueDegradationGoal,
} from '../../../../../../../../src/engines/edgeV2/template/modules/goalModule/template/pursue/orGoal';
import { decisionVariableNamesForGoal } from '../../../../../../../../src/engines/edgeV2/template/decisionVariables';
import { relativeFormulas } from '../../../../../../../../src/engines/edgeV2/template/modules/goalModule/template/formulas';
import { initLogger } from '../../../../../../../../src/engines/edgeV2/logger/logger';
import type {
  Decision,
  EdgeGoalNode,
} from '../../../../../../../../src/engines/edgeV2/types';

const emptyDecision: Decision = {
  decisionVars: [],
  hasDecision: false,
};

const childGoal = (id: string, maxRetries = 0): EdgeGoalNode => ({
  iStarId: id,
  id,
  kind: 'istar.Goal',
  type: 'goal',
  name: id,
  relationToChildren: null,
  children: [],
  tasks: [],
  properties: {
    engine: {
      utility: '',
      cost: '',
      dependsOn: [],
      executionDetail: null,
      decision: emptyDecision,
      maxRetries,
    },
  },
});

const orParent = (
  executionDetail: EdgeGoalNode['properties']['engine']['executionDetail'],
  children: EdgeGoalNode[],
): EdgeGoalNode => ({
  iStarId: 'G0',
  id: 'G0',
  kind: 'istar.Goal',
  type: 'goal',
  name: 'Parent',
  relationToChildren: 'or',
  children,
  tasks: [],
  properties: {
    engine: {
      utility: '',
      cost: '',
      dependsOn: [],
      executionDetail,
      decision: emptyDecision,
      maxRetries: 0,
    },
  },
});

describe('edgeV2 OR child selection (EDGE-XT 3094b5d)', () => {
  before(() => {
    initLogger('orGoal-test', false, true);
  });

  describe('pursueAlternativeGoal (reference non-idempotent)', () => {
    const goal = orParent(
      { type: 'alternative', ids: ['G1', 'G2'], modifiers: {} },
      [childGoal('G1'), childGoal('G2')],
    );

    it('compares the first child against its own threshold', () => {
      assert.strictEqual(
        pursueAlternativeGoal(goal, 'G1'),
        'G0_achievable*N > decision_G0 & g2_state=0 & G1_relative*N > _decision_G1',
      );
    });

    it("negates the higher-priority sibling's own threshold, not the current child's", () => {
      assert.strictEqual(
        pursueAlternativeGoal(goal, 'G2'),
        'G0_achievable*N > decision_G0 & g1_state=0 & G2_relative*N > _decision_G2 & !(G1_relative*N > _decision_G1)',
      );
    });
  });

  describe('pursueChoiceGoal (reference committed)', () => {
    const goal = orParent(
      { type: 'choice', ids: ['G1', 'G2'], modifiers: {} },
      [childGoal('G1'), childGoal('G2')],
    );

    it('chooses once against the per-child threshold, then keeps the commitment', () => {
      const [chooseOnce, continueChosen] = pursueChoiceGoal(
        goal,
        ['G1', 'G2'],
        'G2',
      );
      assert.strictEqual(
        chooseOnce?.left,
        'g0_chosen=0 & G0_achievable*N > decision_G0 & g1_state=0 & G2_relative*N > _decision_G2 & !(G1_relative*N > _decision_G1)',
      );
      assert.strictEqual(
        continueChosen?.left,
        'g0_chosen=2 & G2_achievable*N > decision_G2',
      );
    });
  });

  describe('pursueDegradationGoal (reference preferred)', () => {
    const goal = orParent(
      { type: 'degradation', ids: ['G1', 'G2'], modifiers: {} },
      [childGoal('G1', 2), childGoal('G2')],
    );

    it('retries the preferred child against its own threshold', () => {
      const [retry] = pursueDegradationGoal(goal, ['G1', 'G2'], 'G1');
      assert.strictEqual(
        retry?.left,
        'g1_failed<2 & G1_achievable*N > decision_G1',
      );
    });

    it('falls back to the cascade, each child against its own threshold, once retries are exhausted', () => {
      const [, fallbackG1] = pursueDegradationGoal(goal, ['G1', 'G2'], 'G1');
      assert.strictEqual(
        fallbackG1?.left,
        'g1_failed=2 & G0_achievable*N > decision_G0 & g2_state=0 & G1_relative*N > _decision_G1',
      );

      const [fallbackG2] = pursueDegradationGoal(goal, ['G1', 'G2'], 'G2');
      assert.strictEqual(
        fallbackG2?.left,
        'g1_failed=2 & G0_achievable*N > decision_G0 & g1_state=0 & G2_relative*N > _decision_G2 & !(G1_relative*N > _decision_G1)',
      );
    });
  });

  describe('decisionVariableNamesForGoal', () => {
    it('emits one per-child _decision for OR alternative parents', () => {
      const goal = orParent(
        { type: 'alternative', ids: ['G1', 'G2'], modifiers: {} },
        [childGoal('G1'), childGoal('G2')],
      );
      assert.deepStrictEqual(decisionVariableNamesForGoal(goal), [
        'decision_G0',
        '_decision_G1',
        '_decision_G2',
      ]);
    });

    it('emits one per-child _decision for OR choice parents', () => {
      const goal = orParent(
        { type: 'choice', ids: ['G1', 'G2'], modifiers: {} },
        [childGoal('G1'), childGoal('G2')],
      );
      assert.deepStrictEqual(decisionVariableNamesForGoal(goal), [
        'decision_G0',
        '_decision_G1',
        '_decision_G2',
      ]);
    });

    it('emits one per-child _decision for OR degradation parents', () => {
      const goal = orParent(
        { type: 'degradation', ids: ['G1', 'G2'], modifiers: {} },
        [childGoal('G1', 2), childGoal('G2')],
      );
      assert.deepStrictEqual(decisionVariableNamesForGoal(goal), [
        'decision_G0',
        '_decision_G1',
        '_decision_G2',
      ]);
    });
  });

  describe('relativeFormulas', () => {
    it('emits the achievement-aware share for alternative, choice and degradation, not just anyOrder', () => {
      const alternative = orParent(
        { type: 'alternative', ids: ['G1', 'G2'], modifiers: {} },
        [childGoal('G1'), childGoal('G2')],
      );
      assert.strictEqual(
        relativeFormulas(alternative),
        'formula G1_relative = g1_achieved ? 0 : G1_achievable/(G1_achievable + (g2_achieved ? 0 : G2_achievable));\n' +
          'formula G2_relative = g2_achieved ? 0 : G2_achievable/(G2_achievable + (g1_achieved ? 0 : G1_achievable));',
      );
    });
  });
});
