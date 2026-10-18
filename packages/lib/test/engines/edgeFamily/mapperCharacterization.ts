/**
 * What edge/mapper.ts and edgeV2/mapper.ts (copies of each other, one per dialect)
 * produce today for every custom property they read, driven through
 * GoalTree.fromModel: the characterization goal-controller#187's migration to typed
 * values must leave unchanged. Each engine's mapperCharacterization.test.ts runs it.
 *
 * `// #187: invalid value` marks a value the dialect flags (valueProblem): since the
 * migration the mapper gets it unset. `// #187: changed` marks what the migration
 * changed on purpose: the dialect's reading is the source of truth (a blank value is
 * unset, a choice is trimmed).
 */
import * as assert from 'assert';
import { afterEach, beforeEach, describe, it } from 'mocha';
import { GoalTree, Model } from '@goal-controller/goal-tree';
import type { EdgeGoalPropsResolved } from '../../../src/engines/edge/mapper';
import type {
  EdgeResourceProps,
  EdgeTaskProps,
} from '../../../src/engines/edge/types';

type IStarModel = ReturnType<typeof Model.load>;
type EdgeTree = GoalTree<
  EdgeGoalPropsResolved,
  EdgeTaskProps,
  EdgeResourceProps
>;

/** G1 [T1#T2], G7 maintain [T4], G12 and G13 under G4's degradation, T8 needing R0. */
const MODEL = (engine: 'edge' | 'edgeV2') =>
  `../../examples/${engine}/experiments/10-minimalMaintainResource/10-minimalMaintainResource.txt`;

/** The calls a console method gets while it is stubbed. */
const stubbed = (method: 'warn' | 'error') => {
  const calls: string[] = [];
  let original: (typeof console)[typeof method];
  beforeEach(() => {
    calls.length = 0;
    original = console[method];
    console[method] = (...args: unknown[]) => {
      calls.push(args.join(' '));
    };
  });
  afterEach(() => {
    console[method] = original;
  });
  return calls;
};

export const characterizeEdgeMapper = (
  engine: 'edge' | 'edgeV2',
  build: (model: IStarModel) => EdgeTree,
) => {
  const original = Model.load(MODEL(engine));

  /** The model with these elements' custom properties replaced (by RT id). */
  const withProperties = (
    edits: Record<string, Record<string, string>>,
  ): IStarModel => {
    const elements = new Map(original.elements);
    for (const [id, customProperties] of Object.entries(edits)) {
      const element = [...original.elements.values()].find((e) =>
        e.name.startsWith(`${id}:`),
      );
      if (!element) throw new Error(`${id} not found in the model`);
      elements.set(element.id, { ...element, customProperties });
    }
    return { ...original, elements };
  };

  const treeWith = (edits: Record<string, Record<string, string>>) =>
    build(withProperties(edits));

  const goal = (id: string, properties: Record<string, string>) => {
    const node = GoalTree.allByType(
      treeWith({ [id]: properties }).nodes,
      'goal',
    ).find((n) => n.id === id);
    if (!node) throw new Error(`${id} not found in the tree`);
    return node.properties.engine;
  };
  const task = (id: string, properties: Record<string, string>) => {
    const node = GoalTree.allByType(
      treeWith({ [id]: properties }).nodes,
      'task',
    ).find((n) => n.id === id);
    if (!node) throw new Error(`${id} not found in the tree`);
    return node.properties.engine;
  };
  const resource = (properties: Record<string, string>) => {
    const node = GoalTree.allByType(
      treeWith({ R0: properties }).nodes,
      'resource',
    ).find((n) => n.id === 'R0');
    if (!node) throw new Error('R0 not found in the tree');
    return node.properties.engine;
  };
  const throws = (
    edits: Record<string, Record<string, string>>,
    message: string,
  ) => assert.throws(() => treeWith(edits), { message });

  describe('goal maxRetries (int, min 0)', () => {
    it('is 0 when absent or empty', () => {
      assert.strictEqual(goal('G12', {}).maxRetries, 0);
      assert.strictEqual(goal('G12', { maxRetries: '' }).maxRetries, 0);
    });

    it('reads an integer with parseInt: leading zeros, padding, -0', () => {
      assert.strictEqual(goal('G12', { maxRetries: '0' }).maxRetries, 0);
      assert.strictEqual(goal('G12', { maxRetries: '5' }).maxRetries, 5);
      assert.strictEqual(goal('G12', { maxRetries: '007' }).maxRetries, 7);
      assert.strictEqual(goal('G12', { maxRetries: ' 3 ' }).maxRetries, 3);
      // parseInt's -0, not 0 (strictEqual is Object.is)
      assert.strictEqual(goal('G12', { maxRetries: '-0' }).maxRetries, -0);
    });

    it('reads a non-integer as unset: 0', () => {
      for (const maxRetries of ['1.5', '3abc', '1e3', '+2', '0x10', 'abc'])
        // #187: invalid value, #187: changed (was parseInt's leading digits, or a throw)
        assert.strictEqual(
          goal('G12', { maxRetries }).maxRetries,
          0,
          maxRetries,
        );
    });

    it('reads a negative value as unset: 0', () => {
      // #249: invalid value, changed (was a throw): below its min, which
      // the dialect reports ("At least 0")
      assert.strictEqual(goal('G12', { maxRetries: '-1' }).maxRetries, 0);
    });

    it('reads a blank value as unset: 0', () => {
      // #187: changed (was a throw)
      assert.strictEqual(goal('G12', { maxRetries: ' ' }).maxRetries, 0);
    });
  });

  describe('task maxRetries (int, min 0)', () => {
    it('is 0 when absent or empty', () => {
      assert.strictEqual(task('T8', {}).maxRetries, 0);
      assert.strictEqual(task('T8', { maxRetries: '' }).maxRetries, 0);
    });

    it('reads an integer: leading zeros, padding', () => {
      assert.strictEqual(task('T8', { maxRetries: '0' }).maxRetries, 0);
      assert.strictEqual(task('T8', { maxRetries: '007' }).maxRetries, 7);
      assert.strictEqual(task('T8', { maxRetries: ' 3 ' }).maxRetries, 3);
      // #187: invalid value, #187: changed (was parseInt's leading digits)
      assert.strictEqual(task('T8', { maxRetries: '1.5' }).maxRetries, 0);
      // #187: invalid value, #187: changed (was parseInt's leading digits)
      assert.strictEqual(task('T8', { maxRetries: '3abc' }).maxRetries, 0);
    });

    it('reads a non-numeric or blank value as unset: 0', () => {
      // #187: invalid value, #187: changed (was a throw)
      assert.strictEqual(task('T8', { maxRetries: 'abc' }).maxRetries, 0);
      // #187: changed (was a throw)
      assert.strictEqual(task('T8', { maxRetries: ' ' }).maxRetries, 0);
    });

    it('reads a negative value as unset: 0', () => {
      // #249: invalid value, changed (was a throw): below its min, which
      // the dialect reports ("At least 0")
      assert.strictEqual(task('T8', { maxRetries: '-1' }).maxRetries, 0);
    });
  });

  describe('goal variables (pairList of int: the decision)', () => {
    it('is no decision when absent or empty', () => {
      const none = { decisionVars: [], hasDecision: false };
      assert.deepStrictEqual(goal('G1', {}).decision, none);
      assert.deepStrictEqual(goal('G1', { variables: '' }).decision, none);
    });

    it('reads name:space pairs, the names trimmed', () => {
      assert.deepStrictEqual(goal('G1', { variables: 'x:3' }).decision, {
        decisionVars: [{ variable: 'x', space: 3 }],
        hasDecision: true,
      });
      assert.deepStrictEqual(
        goal('G1', { variables: ' x : 3 , y: 2 ' }).decision,
        {
          decisionVars: [
            { variable: 'x', space: 3 },
            { variable: 'y', space: 2 },
          ],
          hasDecision: true,
        },
      );
      assert.deepStrictEqual(
        goal('G1', { variables: 'x:-1' }).decision.decisionVars,
        [{ variable: 'x', space: -1 }],
      );
    });

    it('is no decision when blank: the dialect reads it as unset', () => {
      // #187: changed (was the "[INVALID DECISION]: decision must be a
      // variable and space: got  , …" throw)
      assert.deepStrictEqual(goal('G1', { variables: ' ' }).decision, {
        decisionVars: [],
        hasDecision: false,
      });
    });

    it('is no decision when the dialect cannot read it (its value check says why)', () => {
      // #187: invalid value; #187: changed: was parseInt's leading digits
      // ('x:1.5' space 1, 'x:3abc' space 3) and an empty name (':3'); was the
      // "[INVALID DECISION]: decision must be a variable and space: got …, …"
      // throw ('x', 'x:3:4', 'x:3,', 'x:3, y'); was the "[INVALID DECISION]:
      // space must be a number: got …" throw ('x:abc', 'x:3,y:b', 'x:')
      for (const variables of [
        'x:1.5',
        'x:3abc',
        ':3',
        'x',
        'x:3:4',
        'x:3,',
        'x:3, y',
        'x:abc',
        'x:3,y:b',
        'x:',
      ])
        assert.deepStrictEqual(
          goal('G1', { variables }).decision,
          { decisionVars: [], hasDecision: false },
          variables,
        );
    });

    it('throws the maintain error before the maxRetries one, whatever the variables', () => {
      // #187: changed (was the variables error, thrown first)
      throws(
        { G7: { variables: 'x', type: 'maintain', maxRetries: '-1' } },
        "[INVALID MODEL]: Maintain condition for goal must have 'maintain' and 'assertion'; got maintain: none, assertion: 'empty condition' (node G7)",
      );
    });
  });

  describe('goal type, maintain and assertion (the exec condition)', () => {
    const warns = stubbed('warn');

    it('is a maintain condition, both sentences and their variables, for type maintain', () => {
      assert.deepStrictEqual(
        goal('G7', {
          type: 'maintain',
          maintain: 'commLink & R0 > 2',
          assertion: 'inFlight',
        }).execCondition,
        {
          maintain: {
            sentence: 'commLink & R0 > 2',
            variables: [
              { name: 'commLink', value: null },
              { name: 'R0', value: null },
            ],
          },
          assertion: {
            sentence: 'inFlight',
            variables: [{ name: 'inFlight', value: null }],
          },
        },
      );
      assert.deepStrictEqual(warns, []);
    });

    it('throws for type maintain without both conditions (never the console.warn)', () => {
      const none = "got maintain: none, assertion: 'empty condition' (node G7)";
      const message = (got: string) =>
        `[INVALID MODEL]: Maintain condition for goal must have 'maintain' and 'assertion'; ${got}`;
      throws({ G7: { type: 'maintain' } }, message(none));
      throws(
        { G7: { type: 'maintain', assertion: 'inFlight' } },
        message('got maintain: none, assertion: inFlight (node G7)'),
      );
      throws(
        { G7: { type: 'maintain', maintain: '', assertion: 'inFlight' } },
        message('got maintain: none, assertion: inFlight (node G7)'),
      );
      throws(
        { G7: { type: 'maintain', maintain: '  ', assertion: 'inFlight' } },
        message('got maintain: none, assertion: inFlight (node G7)'),
      );
      throws(
        { G7: { type: 'maintain', maintain: 'commLink' } },
        message(
          "got maintain: commLink, assertion: 'empty condition' (node G7)",
        ),
      );
      throws(
        { G7: { type: 'maintain', maintain: 'commLink', assertion: '  ' } },
        message(
          "got maintain: commLink, assertion: 'empty condition' (node G7)",
        ),
      );
      throws(
        { G7: { type: 'maintain', maintain: '', assertion: '' } },
        message(none),
      );
      assert.deepStrictEqual(warns, []);
    });

    it('reads any other type as achieve: the assertion alone, maintain ignored', () => {
      const assertionOnly = {
        assertion: {
          sentence: 'inFlight',
          variables: [{ name: 'inFlight', value: null }],
        },
      };
      const both = { maintain: 'commLink', assertion: 'inFlight' };
      assert.deepStrictEqual(
        goal('G7', { type: '', assertion: 'inFlight' }).execCondition,
        assertionOnly,
      );
      assert.deepStrictEqual(goal('G7', both).execCondition, assertionOnly);
      // #187: invalid value
      assert.deepStrictEqual(
        goal('G7', { ...both, type: 'Maintain' }).execCondition,
        assertionOnly,
      );
      // #187: invalid value
      assert.deepStrictEqual(
        goal('G7', { ...both, type: 'achieve' }).execCondition,
        assertionOnly,
      );
    });

    it("reads ' maintain' as maintain, as the dialect does (its choices are trimmed)", () => {
      // #187: changed (was achieve: the assertion alone)
      assert.deepStrictEqual(
        goal('G7', {
          type: ' maintain',
          maintain: 'commLink',
          assertion: 'inFlight',
        }).execCondition,
        {
          maintain: {
            sentence: 'commLink',
            variables: [{ name: 'commLink', value: null }],
          },
          assertion: {
            sentence: 'inFlight',
            variables: [{ name: 'inFlight', value: null }],
          },
        },
      );
    });

    it('has no exec condition without an assertion, or with an empty one', () => {
      assert.strictEqual(goal('G7', {}).execCondition, undefined);
      assert.strictEqual(
        goal('G7', { maintain: 'commLink' }).execCondition,
        undefined,
      );
      assert.strictEqual(
        goal('G7', { assertion: '' }).execCondition,
        undefined,
      );
    });

    it('keeps the assertion as written, a blank one too, and names its variables', () => {
      assert.deepStrictEqual(goal('G7', { assertion: '  ' }).execCondition, {
        assertion: { sentence: '  ', variables: [] },
      });
      assert.deepStrictEqual(
        goal('G7', { assertion: ' inFlight ' }).execCondition,
        {
          assertion: {
            sentence: ' inFlight ',
            variables: [{ name: 'inFlight', value: null }],
          },
        },
      );
      assert.deepStrictEqual(
        goal('G7', { assertion: 'R0 > 2 & !inFlight | x = true' })
          .execCondition,
        {
          assertion: {
            sentence: 'R0 > 2 & !inFlight | x = true',
            variables: [
              { name: 'R0', value: null },
              { name: 'inFlight', value: null },
              { name: 'x', value: true },
            ],
          },
        },
      );
      assert.deepStrictEqual(
        goal('G7', { assertion: 'a = 2' }).execCondition?.assertion?.variables,
        [{ name: 'a', value: null }],
      );
    });

    describe('an assertion the dialect rejects', () => {
      const errors = stubbed('error');

      it("reads battery!=low as written, its variables the reading's", () => {
        // it reads (its value check flags the != on a non-boolean)
        // #187: invalid value
        assert.deepStrictEqual(
          goal('G7', { assertion: 'battery!=low' }).execCondition,
          {
            assertion: {
              sentence: 'battery!=low',
              variables: [
                { name: 'battery', value: null },
                { name: 'low', value: null },
              ],
            },
          },
        );
        assert.deepStrictEqual(errors, []);
      });

      it('is unset when it does not read, and logs nothing', () => {
        // #187: invalid value, #187: changed (was kept, its variables read past the
        // error, the syntax error logged)
        assert.strictEqual(
          goal('G7', { assertion: 'inFlight &' }).execCondition,
          undefined,
        );
        assert.deepStrictEqual(errors, []);
      });
    });
  });

  describe('task type and assertion', () => {
    it('throws for type maintain, even with maintain and assertion (maintain is no task key)', () => {
      const message = (assertion: string) =>
        `[INVALID MODEL]: Maintain condition for task must have 'maintain' and 'assertion'; got maintain: none, assertion: ${assertion} (node T4)`;
      throws(
        {
          T4: { type: 'maintain', maintain: 'commLink', assertion: 'inFlight' },
        },
        message('inFlight'),
      );
      throws({ T4: { type: 'maintain' } }, message("'empty condition'"));
      throws(
        { T4: { type: 'maintain', assertion: '  ' } },
        message("'empty condition'"),
      );
      // the dialect reads the task's type (text) trimmed
      // #187: changed (was achieve: the assertion alone)
      throws(
        {
          T4: {
            type: ' maintain',
            maintain: 'commLink',
            assertion: 'inFlight',
          },
        },
        message('inFlight'),
      );
    });

    it('reads any other type as achieve: the assertion alone', () => {
      const assertionOnly = {
        assertion: {
          sentence: 'inFlight',
          variables: [{ name: 'inFlight', value: null }],
        },
      };
      for (const type of ['', 'achieve', 'Maintain', 'whatever'])
        assert.deepStrictEqual(
          task('T4', { type, maintain: 'commLink', assertion: 'inFlight' })
            .execCondition,
          assertionOnly,
          type,
        );
    });

    it('has no exec condition without an assertion; keeps a blank one as written', () => {
      assert.strictEqual(task('T4', {}).execCondition, undefined);
      assert.strictEqual(
        task('T4', { assertion: '' }).execCondition,
        undefined,
      );
      assert.deepStrictEqual(task('T4', { assertion: '  ' }).execCondition, {
        assertion: { sentence: '  ', variables: [] },
      });
      assert.deepStrictEqual(task('T4', { assertion: 'R0>=3' }).execCondition, {
        assertion: {
          sentence: 'R0>=3',
          variables: [{ name: 'R0', value: null }],
        },
      });
    });
  });

  describe('utility and cost (number)', () => {
    it("are the goal's texts as written, '' when absent or empty", () => {
      const g12 = goal('G12', {});
      assert.deepStrictEqual([g12.utility, g12.cost], ['', '']);
      for (const value of ['', '5', ' 5 ', '-1.5', '007']) {
        const engine = goal('G12', { utility: value, cost: value });
        assert.deepStrictEqual([engine.utility, engine.cost], [value, value]);
      }
    });

    it("are the task's texts as written", () => {
      for (const value of [' 5 ', '-1.5', '007']) {
        const engine = task('T8', { utility: value, cost: value });
        assert.deepStrictEqual([engine.utility, engine.cost], [value, value]);
      }
    });

    it("read a non-number as unset: ''", () => {
      for (const value of ['abc', '1e3']) {
        // #187: invalid value, #187: changed (was passed through)
        const g = goal('G12', { utility: value, cost: value });
        assert.deepStrictEqual([g.utility, g.cost], ['', '']);
        // #187: invalid value, #187: changed (was passed through)
        const t = task('T8', { utility: value, cost: value });
        assert.deepStrictEqual([t.utility, t.cost], ['', '']);
      }
    });
  });

  describe('goal dependsOn (refList of goals)', () => {
    const dependsOn = (value: string) =>
      goal('G12', { dependsOn: value }).dependsOn.map((node) => node.id);

    it('is [] when absent, empty or blank', () => {
      assert.deepStrictEqual(goal('G12', {}).dependsOn, []);
      assert.deepStrictEqual(dependsOn(''), []);
      assert.deepStrictEqual(dependsOn(' '), []);
    });

    it('resolves comma-separated ids to the goal nodes, in order', () => {
      assert.deepStrictEqual(dependsOn('G13'), ['G13']);
      assert.deepStrictEqual(dependsOn('G13, G6'), ['G13', 'G6']);
      const tree = treeWith({ G12: { dependsOn: 'G13' } });
      const goals = GoalTree.allByType(tree.nodes, 'goal');
      const g12 = goals.find((n) => n.id === 'G12');
      // #233: allNodes.get(id) is the tree's own node (was a pre-afterCreation copy)
      const g13 = goals.find((n) => n.id === 'G13');
      assert.strictEqual(g12?.properties.engine.dependsOn[0], g13);
      assert.deepStrictEqual(g12?.properties.engine.dependsOn[0], g13);
    });

    it('gives a dependency as the tree holds it: its own dependsOn already resolved', () => {
      const goals = GoalTree.allByType(
        treeWith({ G12: { dependsOn: 'G13' }, G13: { dependsOn: 'G6' } }).nodes,
        'goal',
      );
      const g12 = goals.find((n) => n.id === 'G12');
      const g13 = goals.find((n) => n.id === 'G13');
      assert.deepStrictEqual(
        g13?.properties.engine.dependsOn.map((n) => n.id),
        ['G6'],
      );
      // #233: was [] (stale copy); dependency is the tree's G13, already afterCreation'd
      assert.deepStrictEqual(
        g12?.properties.engine.dependsOn[0]?.properties.engine.dependsOn.map(
          (n) => n.id,
        ),
        ['G6'],
      );
    });

    it('trims ids; reads empty entries as unset: []', () => {
      assert.deepStrictEqual(dependsOn('  G13 , G6 '), ['G13', 'G6']);
      // #187: invalid value, #187: changed (was resolved, the empty entries dropped)
      assert.deepStrictEqual(dependsOn(' G13 ,, G6, '), []);
    });

    it('accepts the goal itself', () => {
      assert.deepStrictEqual(dependsOn('G12'), ['G12']);
    });

    it('throws for an id that is no node, or no goal (without a node suffix)', () => {
      throws(
        { G12: { dependsOn: 'G99' } },
        '[INVALID MODEL]: Dependency G99 not found for node G12',
      );
      throws(
        { G12: { dependsOn: 'G13,G99' } },
        '[INVALID MODEL]: Dependency G99 not found for node G12',
      );
      throws(
        { G12: { dependsOn: 'T8' } },
        '[INVALID MODEL]: Dependency T8 for node G12 must be a goal, got task',
      );
      throws(
        { G12: { dependsOn: 'R0' } },
        '[INVALID MODEL]: Dependency R0 for node G12 must be a goal, got resource',
      );
    });

    it('reads ids without commas as unset: []', () => {
      // #187: invalid value, #187: changed (was a throw for the id "G13 G6")
      assert.deepStrictEqual(dependsOn('G13 G6'), []);
    });
  });

  describe('resource type, initialValue, lowerBound, upperBound', () => {
    const throwsFor = (properties: Record<string, string>, message: string) =>
      throws({ R0: properties }, `[INVALID RESOURCE]: ${message} (node R0)`);

    it("bool: initialValue 'true' or 'false', the bounds ignored", () => {
      assert.deepStrictEqual(resource({ type: 'bool', initialValue: 'true' }), {
        variable: { type: 'boolean', initialValue: true },
      });
      assert.deepStrictEqual(
        resource({ type: 'bool', initialValue: 'false' }),
        { variable: { type: 'boolean', initialValue: false } },
      );
      assert.deepStrictEqual(
        resource({
          type: 'bool',
          initialValue: 'true',
          lowerBound: '0',
          // #187: invalid value
          upperBound: 'x',
        }),
        { variable: { type: 'boolean', initialValue: true } },
      );
    });

    it('bool: throws for any other initialValue, case included', () => {
      const message = (got: string) =>
        `Boolean resource must have initialValue of 'true' or 'false', got: ${got}`;
      // #187: invalid value
      throwsFor({ type: 'bool', initialValue: 'True' }, message('"True"'));
      // #187: invalid value
      throwsFor({ type: 'bool', initialValue: '1' }, message('"1"'));
      throwsFor({ type: 'bool', initialValue: '' }, message('""'));
      throwsFor({ type: 'bool' }, message('undefined'));
    });

    it('bool: reads a padded initialValue, as the dialect does', () => {
      // #187: changed (was a throw)
      assert.deepStrictEqual(
        resource({ type: 'bool', initialValue: ' true' }),
        { variable: { type: 'boolean', initialValue: true } },
      );
    });

    it('int: the three values, as integers', () => {
      const int = (
        initialValue: number,
        lowerBound: number,
        upperBound: number,
      ) => ({
        variable: { type: 'int', initialValue, lowerBound, upperBound },
      });
      assert.deepStrictEqual(
        resource({
          type: 'int',
          initialValue: '5',
          lowerBound: '0',
          upperBound: '5',
        }),
        int(5, 0, 5),
      );
      assert.deepStrictEqual(
        resource({
          type: 'int',
          initialValue: '0',
          lowerBound: '0',
          upperBound: '0',
        }),
        int(0, 0, 0),
      );
      assert.deepStrictEqual(
        resource({
          type: 'int',
          initialValue: '-3',
          lowerBound: '-5',
          upperBound: '-1',
        }),
        int(-3, -5, -1),
      );
      assert.deepStrictEqual(
        resource({
          type: 'int',
          initialValue: '007',
          lowerBound: '00',
          upperBound: '010',
        }),
        int(7, 0, 10),
      );
      assert.deepStrictEqual(
        resource({
          type: 'int',
          initialValue: ' 3 ',
          lowerBound: ' 0',
          upperBound: '5 ',
        }),
        int(3, 0, 5),
      );
    });

    it('int: reads a non-integer as unset, so throws for a missing value', () => {
      const missing =
        'Integer resource must have an initial value, lower bound, and upper bound';
      // #187: invalid value, #187: changed (were parseInt's leading digits)
      throwsFor(
        {
          type: 'int',
          initialValue: '2.9',
          lowerBound: '0.5',
          upperBound: '5.7',
        },
        missing,
      );
      // #187: invalid value, #187: changed (were parseInt's leading digits)
      throwsFor(
        {
          type: 'int',
          initialValue: '3abc',
          lowerBound: '0x',
          upperBound: '5y',
        },
        missing,
      );
      // #187: invalid value, #187: changed (was parseInt's leading digits)
      throwsFor(
        { type: 'int', initialValue: '1e3', lowerBound: '0', upperBound: '5' },
        missing,
      );
    });

    it('int: throws for a missing or empty value first', () => {
      const missing =
        'Integer resource must have an initial value, lower bound, and upper bound';
      throwsFor({ type: 'int' }, missing);
      throwsFor(
        { type: 'int', initialValue: '', lowerBound: '0', upperBound: '5' },
        missing,
      );
      throwsFor(
        { type: 'int', initialValue: '3', lowerBound: '', upperBound: '5' },
        missing,
      );
      throwsFor({ type: 'int', initialValue: '3', lowerBound: '0' }, missing);
    });

    it('int: a non-numeric or blank value is missing, before lower above upper', () => {
      const missing =
        'Integer resource must have an initial value, lower bound, and upper bound';
      // #187: invalid value, #187: changed (was "valid numeric lower and upper bounds")
      throwsFor(
        { type: 'int', initialValue: '3', lowerBound: 'a', upperBound: 'b' },
        missing,
      );
      // #187: invalid value, #187: changed (was "valid numeric lower and upper bounds")
      throwsFor(
        { type: 'int', initialValue: '3', lowerBound: '0', upperBound: 'b' },
        missing,
      );
      // #187: invalid value, #187: changed (was lower above upper)
      throwsFor(
        { type: 'int', initialValue: 'x', lowerBound: '5', upperBound: '2' },
        missing,
      );
      // #187: invalid value, #187: changed (was "a valid numeric initial value")
      throwsFor(
        { type: 'int', initialValue: 'x', lowerBound: '0', upperBound: '5' },
        missing,
      );
      // #187: invalid value, #187: changed (was "a valid numeric initial value")
      throwsFor(
        { type: 'int', initialValue: 'true', lowerBound: '0', upperBound: '5' },
        missing,
      );
      // blank: the dialect reads it as unset
      // #187: changed (was "a valid numeric initial value")
      throwsFor(
        { type: 'int', initialValue: '  ', lowerBound: '0', upperBound: '5' },
        missing,
      );
    });

    it('int: then for lower above upper, then an initial value out of bounds', () => {
      throwsFor(
        { type: 'int', initialValue: '3', lowerBound: '5', upperBound: '2' },
        'Resource lower bound (5) must be less than or equal to upper bound (2)',
      );
      throwsFor(
        { type: 'int', initialValue: '6', lowerBound: '0', upperBound: '5' },
        'Initial value (6) must be within bounds [0, 5]',
      );
      throwsFor(
        { type: 'int', initialValue: '-1', lowerBound: '0', upperBound: '5' },
        'Initial value (-1) must be within bounds [0, 5]',
      );
    });

    it('throws for any other type, case and padding included', () => {
      const valid = { initialValue: '3', lowerBound: '0', upperBound: '5' };
      // #187: invalid value
      throwsFor({ ...valid, type: 'Int' }, 'Unsupported resource type: Int');
      // #187: invalid value
      throwsFor(
        { type: 'BOOL', initialValue: 'true' },
        'Unsupported resource type: BOOL',
      );
      // #187: invalid value
      throwsFor(
        { type: 'string', initialValue: 'a' },
        'Unsupported resource type: string',
      );
      // #234: changed (was "Integer resource must have an initial value, …":
      // initialValue's condition read the type untrimmed, so '3' as a bool's):
      // the dialect reads ' int' as int, its conditions too, so it is an int
      // resource like 'int'
      assert.deepStrictEqual(
        resource({ ...valid, type: ' int' }),
        resource({ ...valid, type: 'int' }),
      );
      throwsFor(
        { type: '', initialValue: 'true' },
        'Unsupported resource type: ',
      );
      throwsFor(
        { initialValue: 'true' },
        'Unsupported resource type: undefined',
      );
    });
  });
};
