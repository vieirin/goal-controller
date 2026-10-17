/**
 * What edgeFamily/checks.ts says today, beyond edgeChecks.test.ts: the edge cases
 * of its hand parsers (parseInt, split(','), trim), which key a message is attached
 * to, and which issue wins (goal-controller#187's migration must keep them).
 *
 * `// #187: invalid value` marks a value the dialect flags (valueProblem).
 */
import * as assert from 'assert';
import { describe, it } from 'mocha';
import {
  edgeCheckRegistry,
  edgeGoalChecks,
  edgeResourceChecks,
  edgeTaskChecks,
} from '../../../src/engines/edgeFamily/checks';

const noDeps = { self: '', kindOf: () => undefined };

describe('edgeChecks characterization (#187)', () => {
  describe('maxRetries', () => {
    it('is fine when empty, zero or a non-negative integer', () => {
      for (const maxRetries of ['', '0', '007', ' 3 ', '-0']) {
        assert.strictEqual(
          edgeGoalChecks.maxRetries?.({ maxRetries }, noDeps),
          null,
          maxRetries,
        );
        assert.strictEqual(
          edgeTaskChecks.maxRetries?.({ maxRetries }, noDeps),
          null,
          maxRetries,
        );
      }
    });

    it('is fine with what parseInt reads leading digits of', () => {
      for (const maxRetries of ['1.5', '3abc', '1e3', '+2', '0x10'])
        // #187: invalid value
        assert.strictEqual(
          edgeGoalChecks.maxRetries?.({ maxRetries }, noDeps),
          null,
          maxRetries,
        );
    });

    it('flags a negative value on a task, a non-numeric one on a goal', () => {
      // #187: invalid value
      assert.strictEqual(
        edgeTaskChecks.maxRetries?.({ maxRetries: '-1' }, noDeps),
        '[INVALID TASK]: maxRetries must be a non-negative integer: got "-1"',
      );
      // #187: invalid value
      assert.strictEqual(
        edgeGoalChecks.maxRetries?.({ maxRetries: 'abc' }, noDeps),
        '[INVALID GOAL]: maxRetries must be a non-negative integer: got "abc"',
      );
    });

    it('flags a blank value, which the dialect reads as unset', () => {
      assert.strictEqual(
        edgeGoalChecks.maxRetries?.({ maxRetries: ' ' }, noDeps),
        '[INVALID GOAL]: maxRetries must be a non-negative integer: got " "',
      );
    });
  });

  describe('variables (decision)', () => {
    const variables = (value: string) =>
      edgeGoalChecks.variables?.({ variables: value }, noDeps);
    const shape = (got: string) =>
      `[INVALID DECISION]: decision must be a variable and space: got ${got}, expected format variable:space`;

    it('is fine when absent, empty, or pairs (padded, negative)', () => {
      assert.strictEqual(edgeGoalChecks.variables?.({}, noDeps), null);
      for (const value of ['', 'x:3,y:2', ' x : 3 , y: 2 ', 'x:-1'])
        assert.strictEqual(variables(value), null, value);
    });

    it('is fine with an empty name, or a space parseInt reads leading digits of', () => {
      for (const value of [':3', 'x:1.5', 'x:3abc'])
        // #187: invalid value
        assert.strictEqual(variables(value), null, value);
    });

    it('flags a pair without exactly one colon, quoting the whole value', () => {
      for (const value of ['x:3:4', 'x:3,', ',x:3', 'x:3, y'])
        // #187: invalid value
        assert.strictEqual(variables(value), shape(value), value);
    });

    it('flags a blank value, which the dialect reads as unset', () => {
      assert.strictEqual(variables(' '), shape(' '));
    });

    it('flags an empty or non-numeric space, quoting it', () => {
      // #187: invalid value
      assert.strictEqual(
        variables('x:'),
        '[INVALID DECISION]: space must be a number: got ',
      );
      // #187: invalid value
      assert.strictEqual(
        variables('x:3,y:b'),
        '[INVALID DECISION]: space must be a number: got b',
      );
    });

    it('says only the first bad pair, pair by pair (shape, then space)', () => {
      // #187: invalid value
      assert.strictEqual(
        variables('x:a,y:b'),
        '[INVALID DECISION]: space must be a number: got a',
      );
      // #187: invalid value
      assert.strictEqual(
        variables('x:a,y'),
        '[INVALID DECISION]: space must be a number: got a',
      );
      // #187: invalid value
      assert.strictEqual(variables('y,x:a'), shape('y,x:a'));
    });

    it('is a goal check only: the task checks have no variables', () => {
      assert.ok(!('variables' in edgeTaskChecks));
    });
  });

  describe('maintain and assertion', () => {
    const message = (got: string) =>
      `[INVALID MODEL]: Maintain condition for goal must have 'maintain' and 'assertion'; ${got}`;

    it('are fine for any type but exactly maintain', () => {
      for (const type of ['', 'Maintain', ' maintain', 'achieve']) {
        const raw = { type, maintain: '', assertion: '' };
        assert.strictEqual(edgeGoalChecks.maintain?.(raw, noDeps), null, type);
        assert.strictEqual(edgeGoalChecks.assertion?.(raw, noDeps), null, type);
      }
      assert.strictEqual(edgeGoalChecks.maintain?.({}, noDeps), null);
    });

    it('maintain: quotes the assertion trimmed, or as empty', () => {
      assert.strictEqual(
        edgeGoalChecks.maintain?.(
          { type: 'maintain', assertion: ' inFlight ' },
          noDeps,
        ),
        message('got maintain: none, assertion: inFlight'),
      );
      assert.strictEqual(
        edgeGoalChecks.maintain?.(
          { type: 'maintain', assertion: '  ' },
          noDeps,
        ),
        message("got maintain: none, assertion: 'empty condition'"),
      );
      assert.strictEqual(
        edgeGoalChecks.maintain?.({ type: 'maintain' }, noDeps),
        message("got maintain: none, assertion: 'empty condition'"),
      );
    });

    it('assertion: says nothing while maintain is missing (maintain says it)', () => {
      const raw = { type: 'maintain', maintain: ' ', assertion: '' };
      assert.strictEqual(edgeGoalChecks.assertion?.(raw, noDeps), null);
      assert.strictEqual(
        edgeGoalChecks.maintain?.(raw, noDeps),
        message("got maintain: none, assertion: 'empty condition'"),
      );
    });

    it('assertion: quotes maintain as written, flags a blank assertion', () => {
      const raw = { type: 'maintain', maintain: ' commLink ', assertion: '  ' };
      assert.strictEqual(
        edgeGoalChecks.assertion?.(raw, noDeps),
        message("got maintain:  commLink , assertion: 'empty condition'"),
      );
      assert.strictEqual(edgeGoalChecks.maintain?.(raw, noDeps), null);
      assert.strictEqual(
        edgeGoalChecks.assertion?.(
          { type: 'maintain', maintain: 'commLink' },
          noDeps,
        ),
        message("got maintain: commLink, assertion: 'empty condition'"),
      );
    });

    it('do not read the conditions themselves', () => {
      // #187: invalid value
      const raw = {
        type: 'maintain',
        maintain: 'inFlight &',
        assertion: 'battery!=low',
      };
      assert.strictEqual(edgeGoalChecks.maintain?.(raw, noDeps), null);
      assert.strictEqual(edgeGoalChecks.assertion?.(raw, noDeps), null);
    });
  });

  describe('dependsOn', () => {
    const kinds: Record<string, 'goal' | 'task' | 'resource'> = {
      G1: 'goal',
      G2: 'goal',
      T1: 'task',
      R1: 'resource',
    };
    const context = { self: 'G1', kindOf: (id: string) => kinds[id] };
    const dependsOn = (value: string) =>
      edgeGoalChecks.dependsOn?.({ dependsOn: value }, context);

    it('is fine when absent, empty, blank, or only separators', () => {
      assert.strictEqual(edgeGoalChecks.dependsOn?.({}, context), null);
      assert.strictEqual(dependsOn(''), null);
      assert.strictEqual(dependsOn(' '), null);
      // #187: invalid value
      assert.strictEqual(dependsOn(' ,, '), null);
    });

    it('is fine for padded goal ids, the element itself among them', () => {
      // #187: invalid value
      assert.strictEqual(dependsOn(' G2 ,, G1, '), null);
    });

    it('says the first id that fails, trimmed', () => {
      assert.strictEqual(
        dependsOn('  G9 , T1'),
        '[INVALID MODEL]: Dependency G9 not found for node G1',
      );
      assert.strictEqual(
        dependsOn('G2, T1, G9'),
        '[INVALID MODEL]: Dependency T1 for node G1 must be a goal, got task',
      );
      assert.strictEqual(
        dependsOn('R1'),
        '[INVALID MODEL]: Dependency R1 for node G1 must be a goal, got resource',
      );
      // #187: invalid value
      assert.strictEqual(
        dependsOn('G2 G3'),
        '[INVALID MODEL]: Dependency G2 G3 not found for node G1',
      );
    });
  });

  describe('resource', () => {
    const all = (raw: Record<string, string>) => ({
      type: edgeResourceChecks.type?.(raw, noDeps),
      initialValue: edgeResourceChecks.initialValue?.(raw, noDeps),
      lowerBound: edgeResourceChecks.lowerBound?.(raw, noDeps),
      upperBound: edgeResourceChecks.upperBound?.(raw, noDeps),
    });
    const fine = {
      type: null,
      initialValue: null,
      lowerBound: null,
      upperBound: null,
    };

    it('bool: true or false, the bounds not read', () => {
      assert.deepStrictEqual(all({ type: 'bool', initialValue: 'true' }), fine);
      assert.deepStrictEqual(
        // #187: invalid value
        all({ type: 'bool', initialValue: 'false', lowerBound: 'x' }),
        fine,
      );
    });

    it('bool: flags any other initial value, at initialValue only', () => {
      const bool = (got: string) => ({
        ...fine,
        initialValue: `[INVALID RESOURCE]: Boolean resource must have initialValue of 'true' or 'false', got: ${got}`,
      });
      assert.deepStrictEqual(all({ type: 'bool' }), bool('undefined'));
      assert.deepStrictEqual(
        all({ type: 'bool', initialValue: '' }),
        bool('""'),
      );
      assert.deepStrictEqual(
        all({ type: 'bool', initialValue: ' true' }),
        bool('" true"'),
      );
      // #187: invalid value
      assert.deepStrictEqual(
        all({ type: 'bool', initialValue: 'True' }),
        bool('"True"'),
      );
    });

    it('int: flags only the missing (or empty) keys', () => {
      const missing =
        '[INVALID RESOURCE]: Integer resource must have an initial value, lower bound, and upper bound';
      assert.deepStrictEqual(
        all({ type: 'int', lowerBound: '0', upperBound: '5' }),
        { ...fine, initialValue: missing },
      );
      assert.deepStrictEqual(
        // #187: invalid value
        all({
          type: 'int',
          initialValue: 'x',
          lowerBound: '',
          upperBound: '5',
        }),
        { ...fine, lowerBound: missing },
      );
    });

    it('int: flags both bad bounds, before the initial value', () => {
      const bounds =
        '[INVALID RESOURCE]: Resource must have valid numeric lower and upper bounds';
      // #187: invalid value
      assert.deepStrictEqual(
        all({
          type: 'int',
          initialValue: 'x',
          lowerBound: 'a',
          upperBound: 'b',
        }),
        { ...fine, lowerBound: bounds, upperBound: bounds },
      );
      // #187: invalid value
      const order =
        '[INVALID RESOURCE]: Resource lower bound (5) must be less than or equal to upper bound (2)';
      assert.deepStrictEqual(
        all({
          type: 'int',
          initialValue: 'x',
          lowerBound: '5',
          upperBound: '2',
        }),
        { ...fine, lowerBound: order, upperBound: order },
      );
    });

    it('int: reads the values with parseInt', () => {
      // #187: invalid value
      assert.deepStrictEqual(
        all({
          type: 'int',
          initialValue: '2.9',
          lowerBound: '0.5',
          upperBound: '5y',
        }),
        fine,
      );
      assert.deepStrictEqual(
        all({
          type: 'int',
          initialValue: ' 3 ',
          lowerBound: '-05',
          upperBound: '010',
        }),
        fine,
      );
      // parseInt('0.5') is 0, so 0 is within [0.5, 5]
      // #187: invalid value
      assert.deepStrictEqual(
        all({
          type: 'int',
          initialValue: '0',
          lowerBound: '0.5',
          upperBound: '5',
        }),
        fine,
      );
    });

    it('int: flags a blank initial value, which the dialect reads as unset', () => {
      assert.deepStrictEqual(
        all({
          type: 'int',
          initialValue: '  ',
          lowerBound: '0',
          upperBound: '5',
        }),
        {
          ...fine,
          initialValue:
            '[INVALID RESOURCE]: Resource must have a valid numeric initial value, got: "  "',
        },
      );
    });

    it('any other type: flagged at type only, the values not read', () => {
      const unsupported = (type: string) => ({
        ...fine,
        type: `[INVALID RESOURCE]: Unsupported resource type: ${type}`,
      });
      assert.deepStrictEqual(all({}), unsupported('undefined'));
      assert.deepStrictEqual(
        all({ type: '', initialValue: 'true' }),
        unsupported(''),
      );
      assert.deepStrictEqual(
        all({ type: ' int', initialValue: 'true' }),
        unsupported(' int'),
      );
      // #187: invalid value
      assert.deepStrictEqual(
        all({ type: 'Int', initialValue: '3', lowerBound: 'a' }),
        unsupported('Int'),
      );
    });
  });

  describe('edgeCheckRegistry', () => {
    it('names each check of the goal, task and resource checks', () => {
      assert.deepStrictEqual(edgeCheckRegistry, {
        'edge.goal.variables': edgeGoalChecks.variables,
        'edge.goal.maintain': edgeGoalChecks.maintain,
        'edge.goal.assertion': edgeGoalChecks.assertion,
        'edge.goal.maxRetries': edgeGoalChecks.maxRetries,
        'edge.goal.dependsOn': edgeGoalChecks.dependsOn,
        'edge.task.maxRetries': edgeTaskChecks.maxRetries,
        'edge.resource.type': edgeResourceChecks.type,
        'edge.resource.initialValue': edgeResourceChecks.initialValue,
        'edge.resource.lowerBound': edgeResourceChecks.lowerBound,
        'edge.resource.upperBound': edgeResourceChecks.upperBound,
      });
    });
  });
});
