import * as assert from 'assert';
import { describe, it } from 'mocha';
import {
  edgeGoalChecks,
  edgeTaskChecks,
  edgeResourceChecks,
} from '../../src/engines/edgeFamily/checks';

const noDeps = { self: '', kindOf: () => undefined };

describe('edgeChecks (shared by edge and edgeV2)', () => {
  describe('maxRetries', () => {
    it('flags a negative value on a goal', () => {
      assert.strictEqual(
        edgeGoalChecks.maxRetries?.({ maxRetries: '-1' }, noDeps),
        '[INVALID GOAL]: maxRetries must be a non-negative integer: got "-1"',
      );
    });

    it('flags a non-numeric value on a task', () => {
      assert.strictEqual(
        edgeTaskChecks.maxRetries?.({ maxRetries: 'abc' }, noDeps),
        '[INVALID TASK]: maxRetries must be a non-negative integer: got "abc"',
      );
    });

    it('is fine when unset', () => {
      assert.strictEqual(edgeGoalChecks.maxRetries?.({}, noDeps), null);
    });
  });

  describe('variables (decision)', () => {
    it('flags a pair with no space', () => {
      assert.strictEqual(
        edgeGoalChecks.variables?.({ variables: 'x' }, noDeps),
        '[INVALID DECISION]: decision must be a variable and space: got x, expected format variable:space',
      );
    });

    it('flags a non-numeric space', () => {
      assert.strictEqual(
        edgeGoalChecks.variables?.({ variables: 'x:abc' }, noDeps),
        '[INVALID DECISION]: space must be a number: got abc',
      );
    });

    it('is fine when valid', () => {
      assert.strictEqual(
        edgeGoalChecks.variables?.({ variables: 'x:3' }, noDeps),
        null,
      );
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
    it('bool: rejects anything but true/false', () => {
      assert.strictEqual(
        edgeResourceChecks.initialValue?.(
          { type: 'bool', initialValue: 'yes' },
          noDeps,
        ),
        "[INVALID RESOURCE]: Boolean resource must have initialValue of 'true' or 'false', got: \"yes\"",
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

    it('int: flags non-numeric bounds, only on the bad one', () => {
      const raw = {
        type: 'int',
        initialValue: '1',
        lowerBound: 'a',
        upperBound: '5',
      };
      assert.strictEqual(
        edgeResourceChecks.lowerBound?.(raw, noDeps),
        '[INVALID RESOURCE]: Resource must have valid numeric lower and upper bounds',
      );
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

    it('int: flags a non-numeric initial value', () => {
      const raw = {
        type: 'int',
        initialValue: 'x',
        lowerBound: '0',
        upperBound: '5',
      };
      assert.strictEqual(
        edgeResourceChecks.initialValue?.(raw, noDeps),
        '[INVALID RESOURCE]: Resource must have a valid numeric initial value, got: "x"',
      );
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

    it('rejects an unsupported type', () => {
      assert.strictEqual(
        edgeResourceChecks.type?.({ type: 'string' }, noDeps),
        '[INVALID RESOURCE]: Unsupported resource type: string',
      );
    });
  });
});
