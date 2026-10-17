import * as assert from 'assert';
import { describe, it } from 'mocha';
import { valueProblem } from '@goal-controller/goal-language';
import { edge } from '../../src/engines/edge/definition';
import {
  edgeGoalChecks,
  edgeTaskChecks,
  edgeResourceChecks,
} from '../../src/engines/edgeFamily/checks';

const noDeps = { self: '', kindOf: () => undefined };

describe('edgeChecks (shared by edge and edgeV2)', () => {
  describe('maxRetries', () => {
    // #249: changed (was its own message): a negative value is below the
    // dialect's min, which reports it ("At least 0")
    it('leaves a negative value on a goal to the dialect', () => {
      assert.strictEqual(
        edgeGoalChecks.maxRetries?.({ maxRetries: '-1' }, noDeps),
        null,
      );
    });

    it('leaves a negative value on a task to the dialect', () => {
      assert.strictEqual(
        edgeTaskChecks.maxRetries?.({ maxRetries: '-1' }, noDeps),
        null,
      );
    });

    it("says nothing of a non-numeric value: the dialect's value check does (#187)", () => {
      assert.strictEqual(
        edgeTaskChecks.maxRetries?.({ maxRetries: 'abc' }, noDeps),
        null,
      );
    });

    it('is fine when unset', () => {
      assert.strictEqual(edgeGoalChecks.maxRetries?.({}, noDeps), null);
    });
  });

  describe('variables (decision): the dialect’s pairList of int, no check of its own (#187)', () => {
    const variables = edge.properties.goal.find((p) => p.key === 'variables')!;

    it('has no engine check', () => {
      assert.strictEqual('check' in variables, false);
      assert.strictEqual('variables' in edgeGoalChecks, false);
    });

    it('flags a pair with no space', () => {
      assert.strictEqual(
        valueProblem(variables.value, 'x'),
        'name:value pairs, comma-separated (x:3, y:2)',
      );
    });

    it('flags a non-numeric space', () => {
      assert.strictEqual(
        valueProblem(variables.value, 'x:abc'),
        'x: Not an integer: abc',
      );
    });

    it('is fine when valid', () => {
      assert.strictEqual(valueProblem(variables.value, 'x:3'), null);
    });
  });

  describe('maintain', () => {
    it('flags type: maintain with no maintain property', () => {
      assert.strictEqual(
        edgeGoalChecks.maintain?.(
          { type: 'maintain', assertion: 'battery > 20' },
          noDeps,
        ),
        "[INVALID MODEL]: Maintain condition for goal must have 'maintain' and 'assertion'; got maintain: none, assertion: battery > 20",
      );
    });

    it('flags type: maintain with a blank maintain value', () => {
      assert.strictEqual(
        edgeGoalChecks.maintain?.(
          { type: 'maintain', maintain: '  ', assertion: 'battery > 20' },
          noDeps,
        ),
        "[INVALID MODEL]: Maintain condition for goal must have 'maintain' and 'assertion'; got maintain: none, assertion: battery > 20",
      );
    });

    it('flags type: maintain with maintain set but assertion blank', () => {
      assert.strictEqual(
        edgeGoalChecks.assertion?.(
          { type: 'maintain', maintain: 'battery > 0', assertion: '' },
          noDeps,
        ),
        "[INVALID MODEL]: Maintain condition for goal must have 'maintain' and 'assertion'; got maintain: battery > 0, assertion: 'empty condition'",
      );
    });

    it('is fine once maintain and assertion are present', () => {
      assert.strictEqual(
        edgeGoalChecks.maintain?.(
          {
            type: 'maintain',
            maintain: 'battery > 0',
            assertion: 'battery > 20',
          },
          noDeps,
        ),
        null,
      );
    });

    it('has no task entry: a task can never satisfy it (maintain is not an allowed task key)', () => {
      assert.ok(!('maintain' in edgeTaskChecks));
    });
  });

  describe('dependsOn', () => {
    it('flags a missing id with the mapper\'s "not found" message', () => {
      assert.strictEqual(
        edgeGoalChecks.dependsOn?.(
          { dependsOn: 'G9' },
          { self: 'G1', kindOf: () => undefined },
        ),
        '[INVALID MODEL]: Dependency G9 not found for node G1',
      );
    });

    it('flags a non-goal id with the mapper\'s "must be a goal" message', () => {
      assert.strictEqual(
        edgeGoalChecks.dependsOn?.(
          { dependsOn: 'T1' },
          { self: 'G1', kindOf: () => 'task' },
        ),
        '[INVALID MODEL]: Dependency T1 for node G1 must be a goal, got task',
      );
    });

    it('is fine when every id is a goal', () => {
      assert.strictEqual(
        edgeGoalChecks.dependsOn?.(
          { dependsOn: 'G2, G3' },
          { self: 'G1', kindOf: () => 'goal' },
        ),
        null,
      );
    });
  });

  describe('resource', () => {
    it('bool: rejects an empty initial value', () => {
      assert.strictEqual(
        edgeResourceChecks.initialValue?.(
          { type: 'bool', initialValue: '' },
          noDeps,
        ),
        "[INVALID RESOURCE]: Boolean resource must have initialValue of 'true' or 'false', got: \"\"",
      );
    });

    it("bool: says nothing of anything else but true/false: the dialect's value check does (#187)", () => {
      assert.strictEqual(
        edgeResourceChecks.initialValue?.(
          { type: 'bool', initialValue: 'yes' },
          noDeps,
        ),
        null,
      );
    });

    it('int: flags each missing field', () => {
      const message =
        '[INVALID RESOURCE]: Integer resource must have an initial value, lower bound, and upper bound';
      const raw = { type: 'int' };
      assert.strictEqual(
        edgeResourceChecks.initialValue?.(raw, noDeps),
        message,
      );
      assert.strictEqual(edgeResourceChecks.lowerBound?.(raw, noDeps), message);
      assert.strictEqual(edgeResourceChecks.upperBound?.(raw, noDeps), message);
    });

    it("int: says nothing of a non-numeric bound: the dialect's value check does (#187)", () => {
      const raw = {
        type: 'int',
        initialValue: '1',
        lowerBound: 'a',
        upperBound: '5',
      };
      assert.strictEqual(edgeResourceChecks.lowerBound?.(raw, noDeps), null);
      assert.strictEqual(edgeResourceChecks.upperBound?.(raw, noDeps), null);
    });

    it('int: attaches the bounds error to both lowerBound and upperBound', () => {
      const raw = {
        type: 'int',
        initialValue: '1',
        lowerBound: '5',
        upperBound: '2',
      };
      const message =
        '[INVALID RESOURCE]: Resource lower bound (5) must be less than or equal to upper bound (2)';
      assert.strictEqual(edgeResourceChecks.lowerBound?.(raw, noDeps), message);
      assert.strictEqual(edgeResourceChecks.upperBound?.(raw, noDeps), message);
    });

    it("int: says nothing of a non-numeric initial value: the dialect's value check does (#187)", () => {
      const raw = {
        type: 'int',
        initialValue: 'x',
        lowerBound: '0',
        upperBound: '5',
      };
      assert.strictEqual(edgeResourceChecks.initialValue?.(raw, noDeps), null);
    });

    it('int: flags an out-of-bounds initial value, attached to initialValue', () => {
      const raw = {
        type: 'int',
        initialValue: '9',
        lowerBound: '0',
        upperBound: '5',
      };
      assert.strictEqual(
        edgeResourceChecks.initialValue?.(raw, noDeps),
        '[INVALID RESOURCE]: Initial value (9) must be within bounds [0, 5]',
      );
      assert.strictEqual(edgeResourceChecks.lowerBound?.(raw, noDeps), null);
    });

    it('is fine for a valid int resource', () => {
      const raw = {
        type: 'int',
        initialValue: '3',
        lowerBound: '0',
        upperBound: '5',
      };
      assert.strictEqual(edgeResourceChecks.initialValue?.(raw, noDeps), null);
      assert.strictEqual(edgeResourceChecks.lowerBound?.(raw, noDeps), null);
      assert.strictEqual(edgeResourceChecks.upperBound?.(raw, noDeps), null);
    });

    it('rejects an unset type', () => {
      assert.strictEqual(
        edgeResourceChecks.type?.({ type: '' }, noDeps),
        '[INVALID RESOURCE]: Unsupported resource type: ',
      );
    });

    it("says nothing of a type not among its options: the dialect's value check does (#187)", () => {
      assert.strictEqual(
        edgeResourceChecks.type?.({ type: 'string' }, noDeps),
        null,
      );
    });
  });
});
