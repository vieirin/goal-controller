import * as assert from 'assert';
import { describe, it } from 'mocha';
import { runCheck, type CheckContext } from '../../src/engines/checks';
import { valueProblem } from '@goal-controller/goal-language';
import { edge } from '../../src/engines/edge/definition';
import {
  edgeGoalChecks,
  edgeTaskChecks,
  edgeResourceChecks,
} from '../../src/engines/edgeFamily/checks';

const noDeps = { self: '', kindOf: () => undefined };

/**
 * A check run as the editors run it (#222): given the record the dialect reads, and
 * only when its key's value reads as its type.
 */
const goalCheck = (
  key: keyof typeof edgeGoalChecks,
  raw: Record<string, string>,
  context: CheckContext,
) =>
  runCheck(edge, { element: 'goal' }, key, raw, edgeGoalChecks[key], context);
const resourceCheck = (
  key: keyof typeof edgeResourceChecks,
  raw: Record<string, string>,
  context: CheckContext,
) =>
  runCheck(
    edge,
    { element: 'resource' },
    key,
    raw,
    edgeResourceChecks[key],
    context,
  );

describe('edgeChecks (shared by edge and edgeV2)', () => {
  describe('maxRetries: the dialect’s int with a min, no check of its own (#251)', () => {
    const maxRetries = (kind: 'goal' | 'task') =>
      edge.properties[kind].find((p) => p.key === 'maxRetries')!;

    it('has no engine check, on goals or tasks', () => {
      for (const kind of ['goal', 'task'] as const)
        assert.strictEqual('check' in maxRetries(kind), false, kind);
      assert.strictEqual('maxRetries' in edgeGoalChecks, false);
      assert.strictEqual('maxRetries' in edgeTaskChecks, false);
    });

    // #249: changed (was the engine's own message): a negative value is below
    // the dialect's min, and its value check reports it
    it('flags a negative value on a goal or a task', () => {
      for (const kind of ['goal', 'task'] as const)
        assert.strictEqual(
          valueProblem(maxRetries(kind).value, '-1'),
          'At least 0',
          kind,
        );
    });

    it('flags a non-numeric value', () => {
      assert.strictEqual(
        valueProblem(maxRetries('task').value, 'abc'),
        'Not an integer: abc',
      );
    });

    it('is fine when a non-negative integer', () => {
      assert.strictEqual(valueProblem(maxRetries('goal').value, '3'), null);
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
        goalCheck(
          'maintain',
          { type: 'maintain', assertion: 'battery > 20' },
          noDeps,
        ),
        "[INVALID MODEL]: Maintain condition for goal must have 'maintain' and 'assertion'; got maintain: none, assertion: battery > 20",
      );
    });

    it('flags type: maintain with a blank maintain value', () => {
      assert.strictEqual(
        goalCheck(
          'maintain',
          { type: 'maintain', maintain: '  ', assertion: 'battery > 20' },
          noDeps,
        ),
        "[INVALID MODEL]: Maintain condition for goal must have 'maintain' and 'assertion'; got maintain: none, assertion: battery > 20",
      );
    });

    it('flags type: maintain with maintain set but assertion blank', () => {
      assert.strictEqual(
        goalCheck(
          'assertion',
          { type: 'maintain', maintain: 'battery > 0', assertion: '' },
          noDeps,
        ),
        "[INVALID MODEL]: Maintain condition for goal must have 'maintain' and 'assertion'; got maintain: battery > 0, assertion: 'empty condition'",
      );
    });

    it('is fine once maintain and assertion are present', () => {
      assert.strictEqual(
        goalCheck(
          'maintain',
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
        goalCheck(
          'dependsOn',
          { dependsOn: 'G9' },
          { self: 'G1', kindOf: () => undefined },
        ),
        '[INVALID MODEL]: Dependency G9 not found for node G1',
      );
    });

    it('flags a non-goal id with the mapper\'s "must be a goal" message', () => {
      assert.strictEqual(
        goalCheck(
          'dependsOn',
          { dependsOn: 'T1' },
          { self: 'G1', kindOf: () => 'istar.Task' },
        ),
        '[INVALID MODEL]: Dependency T1 for node G1 must be a goal, got task',
      );
    });

    it('is fine when every id is a goal', () => {
      assert.strictEqual(
        goalCheck(
          'dependsOn',
          { dependsOn: 'G2, G3' },
          { self: 'G1', kindOf: () => 'istar.Goal' },
        ),
        null,
      );
    });
  });

  describe('resource', () => {
    it('bool: rejects an empty initial value', () => {
      assert.strictEqual(
        resourceCheck(
          'initialValue',
          { type: 'bool', initialValue: '' },
          noDeps,
        ),
        "[INVALID RESOURCE]: Boolean resource must have initialValue of 'true' or 'false', got: \"\"",
      );
    });

    it("bool: says nothing of anything else but true/false: the dialect's value check does (#187)", () => {
      assert.strictEqual(
        resourceCheck(
          'initialValue',
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
      assert.strictEqual(resourceCheck('initialValue', raw, noDeps), message);
      assert.strictEqual(resourceCheck('lowerBound', raw, noDeps), message);
      assert.strictEqual(resourceCheck('upperBound', raw, noDeps), message);
    });

    it("int: says nothing of a non-numeric bound: the dialect's value check does (#187)", () => {
      const raw = {
        type: 'int',
        initialValue: '1',
        lowerBound: 'a',
        upperBound: '5',
      };
      assert.strictEqual(resourceCheck('lowerBound', raw, noDeps), null);
      assert.strictEqual(resourceCheck('upperBound', raw, noDeps), null);
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
      assert.strictEqual(resourceCheck('lowerBound', raw, noDeps), message);
      assert.strictEqual(resourceCheck('upperBound', raw, noDeps), message);
    });

    it("int: says nothing of a non-numeric initial value: the dialect's value check does (#187)", () => {
      const raw = {
        type: 'int',
        initialValue: 'x',
        lowerBound: '0',
        upperBound: '5',
      };
      assert.strictEqual(resourceCheck('initialValue', raw, noDeps), null);
    });

    it('int: flags an out-of-bounds initial value, attached to initialValue', () => {
      const raw = {
        type: 'int',
        initialValue: '9',
        lowerBound: '0',
        upperBound: '5',
      };
      assert.strictEqual(
        resourceCheck('initialValue', raw, noDeps),
        '[INVALID RESOURCE]: Initial value (9) must be within bounds [0, 5]',
      );
      assert.strictEqual(resourceCheck('lowerBound', raw, noDeps), null);
    });

    it('is fine for a valid int resource', () => {
      const raw = {
        type: 'int',
        initialValue: '3',
        lowerBound: '0',
        upperBound: '5',
      };
      assert.strictEqual(resourceCheck('initialValue', raw, noDeps), null);
      assert.strictEqual(resourceCheck('lowerBound', raw, noDeps), null);
      assert.strictEqual(resourceCheck('upperBound', raw, noDeps), null);
    });

    it('rejects an unset type', () => {
      assert.strictEqual(
        resourceCheck('type', { type: '' }, noDeps),
        '[INVALID RESOURCE]: Unsupported resource type: ',
      );
    });

    it("says nothing of a type not among its options: the dialect's value check does (#187)", () => {
      assert.strictEqual(
        resourceCheck('type', { type: 'string' }, noDeps),
        null,
      );
    });
  });
});
