/**
 * What edgeFamily/checks.ts says today, beyond edgeChecks.test.ts: the edge cases
 * of its hand parsers (parseInt, split(','), trim), which key a message is attached
 * to, and which issue wins (goal-controller#187's migration must keep them).
 *
 * `// #187: invalid value` marks a value the dialect flags (valueProblem): since the
 * migration a check says nothing of a value the dialect cannot read (its value check
 * does). `// #187: changed` marks what the migration changed on purpose: the
 * dialect's reading is the source of truth (a blank value is unset, a choice trimmed).
 */
import * as assert from 'assert';
import { describe, it } from 'mocha';
import { valueProblem } from '@goal-controller/goal-language';
import { edge } from '../../../src/engines/edge/definition';
import {
  edgeCheckRegistry,
  edgeGoalChecks,
  edgeResourceChecks,
  edgeTaskChecks,
} from '../../../src/engines/edgeFamily/checks';

const noDeps = { self: '', kindOf: () => undefined };

describe('edgeChecks characterization (#187)', () => {
  describe('maxRetries: no check of its own, the dialect’s value check says it', () => {
    // #251: changed: the engine's maxRetries checks (null for every value
    // since #249) are gone; an int with a min is the dialect's
    const maxRetries = (kind: 'goal' | 'task') =>
      edge.properties[kind].find((p) => p.key === 'maxRetries')!;
    const problem = (kind: 'goal' | 'task', value: string) =>
      valueProblem(maxRetries(kind).value, value);

    it('has no check, on goals or tasks', () => {
      assert.ok(!('maxRetries' in edgeGoalChecks));
      assert.ok(!('maxRetries' in edgeTaskChecks));
      assert.ok(!('check' in maxRetries('goal')));
      assert.ok(!('check' in maxRetries('task')));
    });

    it('is fine when empty, blank, zero or a non-negative integer', () => {
      for (const kind of ['goal', 'task'] as const)
        for (const value of ['', ' ', '0', '007', ' 3 ', '-0'])
          assert.strictEqual(problem(kind, value), null, `${kind} ${value}`);
    });

    it('flags what is no integer, and a negative one', () => {
      // #187: invalid value (the engine's check said nothing of them)
      for (const value of ['1.5', '3abc', '1e3', '+2', '0x10', 'abc'])
        assert.strictEqual(
          problem('goal', value),
          `Not an integer: ${value}`,
          value,
        );
      // #249: invalid value, changed (was the engine's own message)
      assert.strictEqual(problem('task', '-1'), 'At least 0');
    });
  });

  describe('variables (decision): no check of its own, the dialect’s value check says it', () => {
    // #187: changed: the engine's variables check (its own split(',') /
    // split(':') / parseInt, '[INVALID DECISION]: …') is gone; a pairList of
    // int is the dialect's, and its value check reports what it can't read
    const variables = edge.properties.goal.find((p) => p.key === 'variables')!;
    const problem = (value: string) => valueProblem(variables.value, value);
    const SHAPE = 'name:value pairs, comma-separated (x:3, y:2)';

    it('has no check, on goals or tasks', () => {
      assert.ok(!('variables' in edgeGoalChecks));
      assert.ok(!('variables' in edgeTaskChecks));
      assert.ok(!('check' in variables));
    });

    it('is fine when empty, blank, or pairs (padded, negative)', () => {
      // #187: changed: blank (' ') is unset (was the shape message)
      for (const value of ['', ' ', 'x:3,y:2', ' x : 3 , y: 2 ', 'x:-1'])
        assert.strictEqual(problem(value), null, value);
    });

    it('flags a pair that is no name:int pair', () => {
      // #187: invalid value; #187: changed: an empty name (':3') is flagged
      // (was fine), and 'x:' is the shape (was "space must be a number")
      for (const value of [
        ':3',
        'x:3:4',
        'x:3,',
        ',x:3',
        'x:3, y',
        'x:',
        'x:a,y',
        'y,x:a',
      ])
        assert.strictEqual(problem(value), SHAPE, value);
    });

    it('flags a space that is no int, naming its pair', () => {
      // #187: invalid value; #187: changed: '1.5' and '3abc' are flagged (were
      // fine: parseInt's leading digits)
      assert.strictEqual(problem('x:1.5'), 'x: Not an integer: 1.5');
      assert.strictEqual(problem('x:3abc'), 'x: Not an integer: 3abc');
      assert.strictEqual(problem('x:3,y:b'), 'y: Not an integer: b');
      assert.strictEqual(problem('x:a,y:b'), 'x: Not an integer: a');
    });
  });

  describe('maintain and assertion', () => {
    const message = (got: string) =>
      `[INVALID MODEL]: Maintain condition for goal must have 'maintain' and 'assertion'; ${got}`;

    it('are fine for any type but maintain', () => {
      for (const type of ['', 'Maintain', 'achieve']) {
        const raw = { type, maintain: '', assertion: '' };
        assert.strictEqual(edgeGoalChecks.maintain?.(raw, noDeps), null, type);
        assert.strictEqual(edgeGoalChecks.assertion?.(raw, noDeps), null, type);
      }
      assert.strictEqual(edgeGoalChecks.maintain?.({}, noDeps), null);
    });

    it("read ' maintain' as maintain, as the dialect does (its choices are trimmed)", () => {
      // #187: changed (was fine: not exactly maintain)
      assert.strictEqual(
        edgeGoalChecks.maintain?.(
          { type: ' maintain', maintain: '', assertion: '' },
          noDeps,
        ),
        message("got maintain: none, assertion: 'empty condition'"),
      );
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
    });

    it('says nothing of ids without commas (the dialect does)', () => {
      // #187: invalid value, #187: changed (was "Dependency G2 G3 not found")
      assert.strictEqual(dependsOn('G2 G3'), null);
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
    });

    it('bool: reads a padded initial value, says nothing of an unreadable one', () => {
      // #187: changed (was the bool message: the dialect reads it trimmed)
      assert.deepStrictEqual(
        all({ type: 'bool', initialValue: ' true' }),
        fine,
      );
      // #187: invalid value, #187: changed (was the bool message)
      assert.deepStrictEqual(all({ type: 'bool', initialValue: 'True' }), fine);
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

    it('int: says nothing of unreadable values, which are missing (before the order)', () => {
      // #187: invalid value, #187: changed (was the bounds message on both)
      assert.deepStrictEqual(
        all({
          type: 'int',
          initialValue: 'x',
          lowerBound: 'a',
          upperBound: 'b',
        }),
        fine,
      );
      // #187: invalid value, #187: changed (was the order message on both bounds)
      assert.deepStrictEqual(
        all({
          type: 'int',
          initialValue: 'x',
          lowerBound: '5',
          upperBound: '2',
        }),
        fine,
      );
    });

    it('int: flags lower above upper on both bounds', () => {
      const order =
        '[INVALID RESOURCE]: Resource lower bound (5) must be less than or equal to upper bound (2)';
      assert.deepStrictEqual(
        all({
          type: 'int',
          initialValue: '3',
          lowerBound: '5',
          upperBound: '2',
        }),
        { ...fine, lowerBound: order, upperBound: order },
      );
    });

    it('int: reads the values as integers', () => {
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

    it('int: flags a blank initial value, which the dialect reads as unset, as missing', () => {
      // #187: changed (was "a valid numeric initial value")
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
            '[INVALID RESOURCE]: Integer resource must have an initial value, lower bound, and upper bound',
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
      // #187: invalid value, #187: changed (was unsupported('Int'): the mapper
      // still throws it)
      assert.deepStrictEqual(
        all({ type: 'Int', initialValue: '3', lowerBound: 'a' }),
        fine,
      );
    });

    it("int: reads ' int' as int, as the dialect does (its choices are trimmed)", () => {
      const missing =
        '[INVALID RESOURCE]: Integer resource must have an initial value, lower bound, and upper bound';
      // #187: changed (was unsupported(' int'))
      assert.deepStrictEqual(all({ type: ' int', initialValue: 'true' }), {
        ...fine,
        initialValue: missing,
        lowerBound: missing,
        upperBound: missing,
      });
    });
  });

  describe('edgeCheckRegistry', () => {
    it('names each check of the goal, task and resource checks', () => {
      assert.deepStrictEqual(edgeCheckRegistry, {
        'edge.goal.maintain': edgeGoalChecks.maintain,
        'edge.goal.assertion': edgeGoalChecks.assertion,
        'edge.goal.dependsOn': edgeGoalChecks.dependsOn,
        'edge.resource.type': edgeResourceChecks.type,
        'edge.resource.initialValue': edgeResourceChecks.initialValue,
        'edge.resource.lowerBound': edgeResourceChecks.lowerBound,
        'edge.resource.upperBound': edgeResourceChecks.upperBound,
      });
    });
  });
});
