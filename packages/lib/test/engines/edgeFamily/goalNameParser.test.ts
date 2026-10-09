import * as assert from 'assert';
import { describe, it } from 'mocha';
import { getGoalDetail } from '@goal-controller/goal-tree';
import { edge } from '../../../src/engines/edge/definition';
import { edgeV2 } from '../../../src/engines/edgeV2/definition';

describe('getGoalDetail: the reader goal-tree derives from a dialect', () => {
  it('reads a standalone + as choice with Edge’s reader', () => {
    const result = getGoalDetail({
      goalText: 'G11: Choice Goal [+]',
      dialect: edge,
    });
    assert.deepStrictEqual(result.executionDetail, {
      type: 'choice',
      ids: [],
      modifiers: {},
    });
  });

  it('needs the brackets around a notation (RTRegex.g4 did not)', () => {
    // a named divergence: RTRegex.g4 read `G11: Choice Goal +` as a choice
    const errors: string[] = [];
    const result = getGoalDetail({
      goalText: 'G11: Choice Goal +',
      dialect: edge,
      onSyntaxError: (message) => errors.push(message),
    });
    assert.strictEqual(result.executionDetail, null);
    assert.strictEqual(errors.length, 1);
  });

  it('parses + as any-order with EdgeV2’s reader', () => {
    const result = getGoalDetail({
      goalText: 'G0: Any Order Goal [G1+G2]',
      dialect: edgeV2,
    });
    assert.deepStrictEqual(result.executionDetail, {
      type: 'anyOrder',
      ids: ['G1', 'G2'],
      modifiers: {},
    });
  });

  it('parses ? as choice with EdgeV2’s reader', () => {
    const result = getGoalDetail({
      goalText: 'G11: Choice Goal [G12?G13]',
      dialect: edgeV2,
    });
    assert.deepStrictEqual(result.executionDetail, {
      type: 'choice',
      ids: ['G12', 'G13'],
      modifiers: {},
    });
  });

  it('reports an operator the engine does not read, and reads the rest', () => {
    const errors: string[] = [];
    const result = getGoalDetail({
      goalText: 'G11: Choice Goal [G12?G13]',
      dialect: edge,
      onSyntaxError: (message) => errors.push(message),
    });
    assert.deepStrictEqual(errors, ['1:21 `?` is not an operator of Edge']);
    assert.strictEqual(result.executionDetail, null);
  });

  it('reads ids and names only in a dialect without a notation (SLEEC)', () => {
    const errors: string[] = [];
    const result = getGoalDetail({
      goalText: 'G1: Keep it [G2;G3]',
      dialect: { name: 'SLEEC' },
      onSyntaxError: (message) => errors.push(message),
    });
    assert.deepStrictEqual(result, {
      id: 'G1',
      goalName: 'Keep it',
      executionDetail: null,
    });
    assert.deepStrictEqual(errors, []);
  });
});
