import * as assert from 'assert';
import { describe, it } from 'mocha';
import { getGoalDetail } from '@goal-controller/goal-tree';
import {
  edgeGoalNames,
  edgeV2GoalNames,
} from '../../../src/engines/edgeFamily/parsers';

describe('GoalNameParser: the reader an engine gives goal-tree', () => {
  it('reads a standalone + as choice with Edge’s reader', () => {
    const result = getGoalDetail({
      goalText: 'G11: Choice Goal [+]',
      grammar: edgeGoalNames,
    });
    assert.deepStrictEqual(result.executionDetail, { type: 'choice' });
  });

  it('needs the brackets around a notation (RTRegex.g4 did not)', () => {
    // a named divergence: RTRegex.g4 read `G11: Choice Goal +` as a choice
    const errors: string[] = [];
    const result = getGoalDetail({
      goalText: 'G11: Choice Goal +',
      grammar: edgeGoalNames,
      onSyntaxError: (message) => errors.push(message),
    });
    assert.strictEqual(result.executionDetail, null);
    assert.strictEqual(errors.length, 1);
  });

  it('parses + as any-order with EdgeV2’s reader', () => {
    const result = getGoalDetail({
      goalText: 'G0: Any Order Goal [G1+G2]',
      grammar: edgeV2GoalNames,
    });
    assert.deepStrictEqual(result.executionDetail, {
      type: 'anyOrder',
      anyOrder: ['G1', 'G2'],
    });
  });

  it('parses ? as choice with EdgeV2’s reader', () => {
    const result = getGoalDetail({
      goalText: 'G11: Choice Goal [G12?G13]',
      grammar: edgeV2GoalNames,
    });
    assert.deepStrictEqual(result.executionDetail, {
      type: 'choice',
      choice: ['G12', 'G13'],
    });
  });

  it('reports an operator the engine does not read, and reads the rest', () => {
    const errors: string[] = [];
    const result = getGoalDetail({
      goalText: 'G11: Choice Goal [G12?G13]',
      grammar: edgeGoalNames,
      onSyntaxError: (message) => errors.push(message),
    });
    assert.deepStrictEqual(errors, ['1:21 `?` is not an operator of Edge']);
    assert.strictEqual(result.executionDetail, null);
  });
});
