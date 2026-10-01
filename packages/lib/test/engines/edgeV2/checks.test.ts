import * as assert from 'assert';
import { describe, it } from 'mocha';
import {
  edgeV2GoalChecks,
  edgeV2TaskChecks,
  edgeV2ResourceChecks,
} from '../../../src/engines/edgeV2/checks';

const noDeps = { self: '', kindOf: () => undefined };

describe('edgeV2 checks', () => {
  describe('maxRetries', () => {
    it('flags a negative value on a goal', () => {
      assert.strictEqual(
        edgeV2GoalChecks.maxRetries?.({ maxRetries: '-1' }, noDeps),
        '[INVALID GOAL]: maxRetries must be a non-negative integer: got "-1"',
      );
    });

    it('flags a non-numeric value on a task', () => {
      assert.strictEqual(
        edgeV2TaskChecks.maxRetries?.({ maxRetries: 'abc' }, noDeps),
        '[INVALID TASK]: maxRetries must be a non-negative integer: got "abc"',
      );
    });

    it('is fine when unset', () => {
      assert.strictEqual(edgeV2GoalChecks.maxRetries?.({}, noDeps), null);
    });
  });

  describe('variables (decision)', () => {
    it('flags a pair with no space', () => {
      assert.strictEqual(
        edgeV2GoalChecks.variables?.({ variables: 'x' }, noDeps),
        '[INVALID DECISION]: decision must be a variable and space: got x, expected format variable:space',
      );
    });

    it('flags a non-numeric space', () => {
      assert.strictEqual(
        edgeV2GoalChecks.variables?.({ variables: 'x:abc' }, noDeps),
        '[INVALID DECISION]: space must be a number: got abc',
      );
    });

    it('is fine when valid', () => {
      assert.strictEqual(
        edgeV2GoalChecks.variables?.({ variables: 'x:3' }, noDeps),
        null,
      );
    });
  });

  describe('maintain', () => {
    it('flags type: maintain with no maintain property', () => {
      assert.strictEqual(
        edgeV2GoalChecks.maintain?.(
          { type: 'maintain', assertion: 'battery > 20' },
          noDeps,
        ),
        "[INVALID MODEL]: Maintain condition for goal must have 'maintain' and 'assertion'; got maintain: none, assertion: battery > 20",
      );
    });

    it('is fine once maintain is present', () => {
      assert.strictEqual(
        edgeV2GoalChecks.maintain?.(
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
      assert.ok(!('maintain' in edgeV2TaskChecks));
    });
  });

  describe('dependsOn', () => {
    it('flags a missing id with the mapper\'s "not found" message', () => {
      assert.strictEqual(
        edgeV2GoalChecks.dependsOn?.(
          { dependsOn: 'G9' },
          { self: 'G1', kindOf: () => undefined },
        ),
        '[INVALID MODEL]: Dependency G9 not found for node G1',
      );
    });

    it('flags a non-goal id with the mapper\'s "must be a goal" message', () => {
      assert.strictEqual(
        edgeV2GoalChecks.dependsOn?.(
          { dependsOn: 'T1' },
          { self: 'G1', kindOf: () => 'task' },
        ),
        '[INVALID MODEL]: Dependency T1 for node G1 must be a goal, got task',
      );
    });

    it('is fine when every id is a goal', () => {
      assert.strictEqual(
        edgeV2GoalChecks.dependsOn?.(
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
        edgeV2ResourceChecks.initialValue?.(
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
        edgeV2ResourceChecks.initialValue?.(raw, noDeps),
        message,
      );
      assert.strictEqual(
        edgeV2ResourceChecks.lowerBound?.(raw, noDeps),
        message,
      );
      assert.strictEqual(
        edgeV2ResourceChecks.upperBound?.(raw, noDeps),
        message,
      );
    });

    it('int: flags non-numeric bounds, only on the bad one', () => {
      const raw = {
        type: 'int',
        initialValue: '1',
        lowerBound: 'a',
        upperBound: '5',
      };
      assert.strictEqual(
        edgeV2ResourceChecks.lowerBound?.(raw, noDeps),
        '[INVALID RESOURCE]: Resource must have valid numeric lower and upper bounds',
      );
      assert.strictEqual(edgeV2ResourceChecks.upperBound?.(raw, noDeps), null);
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
      assert.strictEqual(
        edgeV2ResourceChecks.lowerBound?.(raw, noDeps),
        message,
      );
      assert.strictEqual(
        edgeV2ResourceChecks.upperBound?.(raw, noDeps),
        message,
      );
    });

    it('int: flags a non-numeric initial value', () => {
      const raw = {
        type: 'int',
        initialValue: 'x',
        lowerBound: '0',
        upperBound: '5',
      };
      assert.strictEqual(
        edgeV2ResourceChecks.initialValue?.(raw, noDeps),
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
        edgeV2ResourceChecks.initialValue?.(raw, noDeps),
        '[INVALID RESOURCE]: Initial value (9) must be within bounds [0, 5]',
      );
      assert.strictEqual(edgeV2ResourceChecks.lowerBound?.(raw, noDeps), null);
    });

    it('is fine for a valid int resource', () => {
      const raw = {
        type: 'int',
        initialValue: '3',
        lowerBound: '0',
        upperBound: '5',
      };
      assert.strictEqual(
        edgeV2ResourceChecks.initialValue?.(raw, noDeps),
        null,
      );
      assert.strictEqual(edgeV2ResourceChecks.lowerBound?.(raw, noDeps), null);
      assert.strictEqual(edgeV2ResourceChecks.upperBound?.(raw, noDeps), null);
    });

    it('rejects an unsupported type', () => {
      assert.strictEqual(
        edgeV2ResourceChecks.type?.({ type: 'string' }, noDeps),
        '[INVALID RESOURCE]: Unsupported resource type: string',
      );
    });
  });
});
