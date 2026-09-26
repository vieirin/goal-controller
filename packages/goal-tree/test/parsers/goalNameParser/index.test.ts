import * as assert from 'assert';
import { describe, it } from 'mocha';
import { getGoalDetail } from '../../../src/parsers/goalNameParser';

describe('GoalNameParser grammar selection', () => {
  it('defaults to the edge grammar (standalone + is choice)', () => {
    const result = getGoalDetail({ goalText: 'G11: Choice Goal +' });
    assert.deepStrictEqual(result.executionDetail, { type: 'choice' });
  });

  it('parses + as any-order with the edgeV2 grammar', () => {
    const result = getGoalDetail({
      goalText: 'G0: Any Order Goal [G1+G2]',
      grammar: 'edgeV2',
    });
    assert.deepStrictEqual(result.executionDetail, {
      type: 'anyOrder',
      anyOrder: ['G1', 'G2'],
    });
  });

  it('parses ? as choice with the edgeV2 grammar', () => {
    const result = getGoalDetail({
      goalText: 'G11: Choice Goal [G12?G13]',
      grammar: 'edgeV2',
    });
    assert.deepStrictEqual(result.executionDetail, { type: 'choice' });
  });
});
