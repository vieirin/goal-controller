import * as assert from 'assert';
import { describe, it } from 'mocha';
// edgeV2's goal texts: the reader goal-tree derives from its definition (these tests read RTRegex.g4's before)
import { goalNameParserFor } from '@goal-controller/goal-language';
import { edgeV2 } from '../../../src/engines/edgeV2/definition';

const getGoalDetail = goalNameParserFor(edgeV2);

describe('GoalNameParser (edgeV2 grammar)', () => {
  describe('getGoalDetail', () => {
    it('should parse G6: Deliver Sample to Lab [G10;G11;G12] correctly', () => {
      const goalText = 'G6: Deliver Sample to Lab [G10;G11;G12]';
      const result = getGoalDetail({ goalText });

      assert.deepStrictEqual(result, {
        id: 'G6',
        goalName: 'Deliver Sample to Lab',
        executionDetail: {
          type: 'sequence',
          ids: ['G10', 'G11', 'G12'],
          modifiers: {},
        },
      });
    });

    it('should handle simple goal without execution detail', () => {
      const goalText = 'G1: Simple Goal';
      const result = getGoalDetail({ goalText });

      assert.deepStrictEqual(result, {
        id: 'G1',
        goalName: 'Simple Goal',
        executionDetail: null,
      });
    });

    it('should handle alternative goals', () => {
      const goalText = 'G2: Alternative Goal [G3|G4]';
      const result = getGoalDetail({ goalText });

      assert.deepStrictEqual(result, {
        id: 'G2',
        goalName: 'Alternative Goal',
        executionDetail: {
          type: 'alternative',
          ids: ['G3', 'G4'],
          modifiers: {},
        },
      });
    });

    it('should handle interleaved goals', () => {
      const goalText = 'G5: Interleaved Goal [G6#G7]';
      const result = getGoalDetail({ goalText });

      assert.deepStrictEqual(result, {
        id: 'G5',
        goalName: 'Interleaved Goal',
        executionDetail: {
          type: 'interleaved',
          ids: ['G6', 'G7'],
          modifiers: {},
        },
      });
    });

    it('should handle any-order (unordered AND) goals', () => {
      const goalText = 'G0: Any Order Goal [G1+G2]';
      const result = getGoalDetail({ goalText });

      assert.deepStrictEqual(result, {
        id: 'G0',
        goalName: 'Any Order Goal',
        executionDetail: {
          type: 'anyOrder',
          ids: ['G1', 'G2'],
          modifiers: {},
        },
      });
    });

    it('should handle any-order with multiple children', () => {
      const goalText = 'G1: Unordered Tasks [G2+G3+G4+G5]';
      const result = getGoalDetail({ goalText });

      assert.deepStrictEqual(result, {
        id: 'G1',
        goalName: 'Unordered Tasks',
        executionDetail: {
          type: 'anyOrder',
          ids: ['G2', 'G3', 'G4', 'G5'],
          modifiers: {},
        },
      });
    });

    it('should handle degradation goals', () => {
      const goalText = 'G8: Degradation Goal [G9->G10]';
      const result = getGoalDetail({ goalText });

      assert.deepStrictEqual(result, {
        id: 'G8',
        goalName: 'Degradation Goal',
        executionDetail: {
          type: 'degradation',
          ids: ['G9', 'G10'],
          modifiers: {},
        },
      });
    });

    it('should handle choice goals', () => {
      const goalText = 'G11: Choice Goal [G12?G13]';
      const result = getGoalDetail({ goalText });

      assert.deepStrictEqual(result, {
        id: 'G11',
        goalName: 'Choice Goal',
        executionDetail: {
          type: 'choice',
          ids: ['G12', 'G13'],
          modifiers: {},
        },
      });
    });

    it('should handle choice with multiple children', () => {
      const goalText = 'G1: Multiple Choices [G2?G3?G4?G5]';
      const result = getGoalDetail({ goalText });

      assert.deepStrictEqual(result, {
        id: 'G1',
        goalName: 'Multiple Choices',
        executionDetail: {
          type: 'choice',
          ids: ['G2', 'G3', 'G4', 'G5'],
          modifiers: {},
        },
      });
    });

    it('should handle degradation goals with retry map', () => {
      const goalText = 'G1: Support in emergency [G3->G4@3]';
      const result = getGoalDetail({ goalText });

      assert.deepStrictEqual(result, {
        id: 'G1',
        goalName: 'Support in emergency',
        executionDetail: {
          type: 'degradation',
          ids: ['G3', 'G4'],
          modifiers: { retry: { G4: 3 } },
        },
      });
    });

    it('should handle sequence with multiple children', () => {
      const goalText = 'G1: Complex Process [G2;G3;G4;G5;G6]';
      const result = getGoalDetail({ goalText });

      assert.deepStrictEqual(result, {
        id: 'G1',
        goalName: 'Complex Process',
        executionDetail: {
          type: 'sequence',
          ids: ['G2', 'G3', 'G4', 'G5', 'G6'],
          modifiers: {},
        },
      });
    });

    it('should handle alternative with multiple children', () => {
      const goalText = 'G1: Multiple Options [G2|G3|G4|G5]';
      const result = getGoalDetail({ goalText });

      assert.deepStrictEqual(result, {
        id: 'G1',
        goalName: 'Multiple Options',
        executionDetail: {
          type: 'alternative',
          ids: ['G2', 'G3', 'G4', 'G5'],
          modifiers: {},
        },
      });
    });

    it('should handle interleaved with multiple children', () => {
      const goalText = 'G1: Parallel Tasks [G2#G3#G4#G5]';
      const result = getGoalDetail({ goalText });

      assert.deepStrictEqual(result, {
        id: 'G1',
        goalName: 'Parallel Tasks',
        executionDetail: {
          type: 'interleaved',
          ids: ['G2', 'G3', 'G4', 'G5'],
          modifiers: {},
        },
      });
    });

    it('should handle degradation with multiple children', () => {
      const goalText = 'G1: Multi-level Degradation [G2->G3->G4->G5]';
      const result = getGoalDetail({ goalText });

      assert.deepStrictEqual(result, {
        id: 'G1',
        goalName: 'Multi-level Degradation',
        executionDetail: {
          type: 'degradation',
          ids: ['G2', 'G3', 'G4', 'G5'],
          modifiers: {},
        },
      });
    });

    it('should handle sequence with retry map (retry map ignored)', () => {
      const goalText = 'G1: Process with Retries [G2;G3@2;G4;G5@1]';
      const result = getGoalDetail({ goalText });

      assert.deepStrictEqual(result, {
        id: 'G1',
        goalName: 'Process with Retries',
        executionDetail: {
          type: 'sequence',
          ids: ['G2', 'G3', 'G4', 'G5'],
          modifiers: {},
        },
      });
    });

    it('should handle alternative with retry map (retry map ignored)', () => {
      const goalText = 'G1: Options with Retries [G2@1|G3|G4@3|G5]';
      const result = getGoalDetail({ goalText });

      assert.deepStrictEqual(result, {
        id: 'G1',
        goalName: 'Options with Retries',
        executionDetail: {
          type: 'alternative',
          ids: ['G2', 'G3', 'G4', 'G5'],
          modifiers: {},
        },
      });
    });

    it('should handle interleaved with retry map (retry map ignored)', () => {
      const goalText = 'G1: Parallel with Retries [G2#G3@2#G4#G5@1]';
      const result = getGoalDetail({ goalText });

      assert.deepStrictEqual(result, {
        id: 'G1',
        goalName: 'Parallel with Retries',
        executionDetail: {
          type: 'interleaved',
          ids: ['G2', 'G3', 'G4', 'G5'],
          modifiers: {},
        },
      });
    });

    it('should handle complex degradation with retry map', () => {
      const goalText = 'G1: Complex Degradation [G2->G3@2->G4->G5@1]';
      const result = getGoalDetail({ goalText });

      assert.deepStrictEqual(result, {
        id: 'G1',
        goalName: 'Complex Degradation',
        executionDetail: {
          type: 'degradation',
          ids: ['G2', 'G3', 'G4', 'G5'],
          modifiers: { retry: { G3: 2, G5: 1 } },
        },
      });
    });
  });
});
