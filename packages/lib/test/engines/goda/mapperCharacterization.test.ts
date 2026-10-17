/**
 * What GODA's mapper produces today for every property it reads
 * (goal-controller#187 phase 2 pre-work): `selected` (`isSelected`),
 * `creationProperty` (`contextsOf`, split at `%`), and the element's line (its
 * RT regex, a leaf's cost bracket), for representative inputs, so the
 * migration to typed values can show nothing changed. A test marked `#187:
 * invalid value` feeds a value the dialect flags: after the migration the
 * mapper sees `undefined` for it instead of the text.
 */
import * as assert from 'assert';
import { describe, it } from 'mocha';
import { GoalTree, Model } from '@goal-controller/goal-tree';
import {
  goda,
  godaEngineMapper,
  godaCheckRegistry,
  godaGoalModel,
  godaOutput,
  type GodaGoalNode,
} from '../../../src';
import { model } from './support';

type Props = Record<string, string>;

/** What the console said while `run` ran, a parser's expected tokens elided. */
const consoleOf = <T>(run: () => T): { value: T; said: string[] } => {
  const said: string[] = [];
  const { warn, error } = console;
  const say =
    (kind: string) =>
    (...args: unknown[]) =>
      said.push(`${kind}: ${args.join(' ').replace(/\n[^]*\n/, ' … ')}`);
  console.warn = say('warn');
  console.error = say('error');
  try {
    return { value: run(), said };
  } finally {
    Object.assign(console, { warn, error });
  }
};

/** G1 (its text, properties) → T1 (its text, properties): the root the mapper builds, and what the console said. */
const read = (
  goal: Props,
  task: Props = {},
  { goalText = 'G1: Root', taskText = 'T1: Do' } = {},
) =>
  consoleOf(
    () =>
      GoalTree.fromModel(
        Model.parse(
          model(
            [
              ['g1', 'Goal', goalText, goal],
              ['t1', 'Task', taskText, task],
            ],
            [['t1', 'g1']],
          ),
          goda,
        ),
        godaEngineMapper,
      ).nodes[0] as GodaGoalNode,
  );

/** G1's engine properties, the console silent. */
const goalOf = (goal: Props, goalText?: string) => {
  const { value, said } = read(goal, {}, { goalText });
  assert.deepStrictEqual(said, []);
  return value.properties.engine;
};

/** T1's engine properties, and what the console said. */
const taskRead = (task: Props, taskText?: string) => {
  const { value, said } = read({}, task, { taskText });
  return { engine: value.tasks![0]!.properties.engine, said };
};
/** T1's engine properties, the console silent. */
const taskOf = (task: Props, taskText?: string) => {
  const { engine, said } = taskRead(task, taskText);
  assert.deepStrictEqual(said, []);
  return engine;
};

describe('godaEngineMapper today (#187): a goal', () => {
  it('reads its text as written, not selected, no contexts and no annotation without properties', () => {
    assert.deepStrictEqual(goalOf({}), {
      text: 'G1: Root',
      selected: false,
      contexts: [],
      annotation: null,
    });
    assert.strictEqual(goalOf({}, 'G1:   Root  ').text, 'G1:   Root  ');
  });

  describe('selected (isSelected)', () => {
    it('is true for `true`, padded too', () => {
      assert.strictEqual(goalOf({ selected: 'true' }).selected, true);
      assert.strictEqual(goalOf({ selected: ' true ' }).selected, true);
    });

    it('is false when empty or blank', () => {
      assert.strictEqual(goalOf({ selected: '' }).selected, false);
      assert.strictEqual(goalOf({ selected: '  ' }).selected, false);
    });

    it('is false for any other text: another case, `false`, `1`, `yes`', () => {
      // #187: invalid value
      assert.strictEqual(goalOf({ selected: 'True' }).selected, false);
      // #187: invalid value
      assert.strictEqual(goalOf({ selected: 'TRUE' }).selected, false);
      // #187: invalid value
      assert.strictEqual(goalOf({ selected: 'false' }).selected, false);
      // #187: invalid value
      assert.strictEqual(goalOf({ selected: '1' }).selected, false);
      // #187: invalid value
      assert.strictEqual(goalOf({ selected: 'yes' }).selected, false);
    });

    it('is not read on a task', () => {
      assert.ok(!('selected' in taskOf({ selected: 'true' })));
    });

    it('is what the engine generates from: a padded `true` is one, `True` none', () => {
      const output = (selected: string) =>
        godaOutput(
          godaGoalModel(
            Model.parse(
              model(
                [
                  ['g1', 'Goal', 'G1: Root', { selected }],
                  ['t1', 'Task', 'T1: Do'],
                ],
                [['t1', 'g1']],
              ),
              goda,
            ),
          ),
          { modelName: 'model.txt' },
        );
      assert.ok(output(' true ').files.length > 0);
      // #187: invalid value
      assert.throws(
        () => output('True'),
        /^Error: GODA generates from the selected goal: set selected to true on one goal$/,
      );
    });

    it('two selected goals: the mapper reads both, the engine names them', () => {
      const text = model(
        [
          ['g1', 'Goal', 'G1: Root', { selected: 'true' }],
          ['g2', 'Goal', 'G2: Sub', { selected: ' true' }],
          ['t1', 'Task', 'T1: Do'],
        ],
        [
          ['g2', 'g1'],
          ['t1', 'g2'],
        ],
      );
      const root = GoalTree.fromModel(Model.parse(text, goda), godaEngineMapper)
        .nodes[0] as GodaGoalNode;
      assert.deepStrictEqual(
        [root, root.children![0] as GodaGoalNode].map(
          (goal) => goal.properties.engine.selected,
        ),
        [true, true],
      );
      assert.throws(
        () =>
          godaOutput(godaGoalModel(Model.parse(text, goda)), {
            modelName: 'model.txt',
          }),
        /^Error: GODA generates from one selected goal: G1, G2 are selected$/,
      );
    });

    it('its check reads it as the mapper does: a padded `true` is a second, `True` none', () => {
      const check = godaCheckRegistry['goda.goal.selected'];
      const across = (other: string) =>
        check(
          { selected: 'true' },
          {
            self: 'G1',
            kindOf: () => undefined,
            elements: {
              G1: {
                kind: 'goal',
                children: [],
                properties: { selected: 'true' },
              },
              G2: {
                kind: 'goal',
                children: [],
                properties: { selected: other },
              },
            },
          },
        );
      assert.strictEqual(
        across(' true '),
        'Only one goal is selected: G2 is selected too',
      );
      // #187: invalid value
      assert.strictEqual(across('True'), null);
      // a goal not selected is checked for nothing
      assert.strictEqual(
        check({ selected: 'True' }, { self: 'G1', kindOf: () => undefined }),
        null,
      );
    });
  });

  describe('creationProperty (contextsOf)', () => {
    it('reads one condition as written', () => {
      assert.deepStrictEqual(
        goalOf({ creationProperty: 'assertion condition a = 1' }).contexts,
        ['assertion condition a = 1'],
      );
    });

    it('reads none when empty or blank', () => {
      assert.deepStrictEqual(goalOf({ creationProperty: '' }).contexts, []);
      assert.deepStrictEqual(goalOf({ creationProperty: '   ' }).contexts, []);
    });

    it('splits at `%`, each part untrimmed, blank parts dropped', () => {
      // #187: invalid value
      assert.deepStrictEqual(
        goalOf({
          creationProperty:
            'assertion condition a = 1%assertion condition b = 2',
        }).contexts,
        ['assertion condition a = 1', 'assertion condition b = 2'],
      );
      // #187: invalid value
      assert.deepStrictEqual(
        goalOf({
          creationProperty:
            '  assertion condition a = 1 %  assertion trigger b = 2  ',
        }).contexts,
        ['  assertion condition a = 1 ', '  assertion trigger b = 2  '],
      );
      // #187: invalid value
      assert.deepStrictEqual(
        goalOf({ creationProperty: '%assertion condition a = 1%%  %' })
          .contexts,
        ['assertion condition a = 1'],
      );
      // #187: invalid value
      assert.deepStrictEqual(goalOf({ creationProperty: '%%' }).contexts, []);
    });

    it('keeps a condition as written whatever it says', () => {
      // #187: invalid value
      assert.deepStrictEqual(goalOf({ creationProperty: 'a = 1' }).contexts, [
        'a = 1',
      ]);
      // #187: invalid value
      assert.deepStrictEqual(
        goalOf({ creationProperty: 'assertion trigger' }).contexts,
        ['assertion trigger'],
      );
    });
  });

  describe('its RT regex (the line, not a property)', () => {
    it('reads a decision, its spaces ignored, and a parallel AND', () => {
      assert.deepStrictEqual(
        goalOf({}, 'G1: Root [DM( T1 , T2 )]').annotation,
        {
          kind: 'call',
          name: 'DM',
          args: [
            { kind: 'ref', id: 'T1' },
            { kind: 'ref', id: 'T2' },
          ],
        },
      );
      assert.deepStrictEqual(goalOf({}, 'G1: Root [T1#T2]').annotation, {
        kind: 'binary',
        operator: '#',
        left: { kind: 'ref', id: 'T1' },
        right: { kind: 'ref', id: 'T2' },
      });
    });

    it('reads no annotation of a goal’s cost bracket', () => {
      assert.strictEqual(goalOf({}, 'G1: Root [W = 0.1]').annotation, null);
    });

    it('keeps what it read of a bracket with errors, the parser saying so on the console', () => {
      const { value, said } = read({}, {}, { goalText: 'G1: Root [DM(T1,]' });
      assert.deepStrictEqual(value.properties.engine.annotation, {
        kind: 'call',
        name: 'DM',
        args: [{ kind: 'ref', id: 'T1' }],
      });
      assert.deepStrictEqual(said, [
        "error: line 1:16 Expecting: one of these possible Token sequences: … but found: ']'",
      ]);
    });
  });
});

describe('godaEngineMapper today (#187): a task', () => {
  it('reads its text as written, no contexts, no annotation and no cost without properties', () => {
    assert.deepStrictEqual(taskOf({}), {
      text: 'T1: Do',
      contexts: [],
      annotation: null,
      cost: null,
    });
    assert.strictEqual(taskOf({}, 'T1:   Do  it  ').text, 'T1:   Do  it  ');
  });

  it('reads creationProperty as a goal does', () => {
    // #187: invalid value
    assert.deepStrictEqual(
      taskOf({ creationProperty: ' assertion trigger x > 0.5 % ' }).contexts,
      [' assertion trigger x > 0.5 '],
    );
    assert.deepStrictEqual(
      taskOf({ creationProperty: 'assertion trigger x != 1' }).contexts,
      ['assertion trigger x != 1'],
    );
  });

  it('reads a refined task’s RT regex, and no cost of it', () => {
    const { value, said } = consoleOf(
      () =>
        GoalTree.fromModel(
          Model.parse(
            model(
              [
                ['g1', 'Goal', 'G1: Root'],
                ['t1', 'Task', 'T1: Do [DM(T1.1,T1.2)]'],
                ['t11', 'Task', 'T1.1: One [W = 2]'],
                ['t12', 'Task', 'T1.2: Two'],
              ],
              [
                ['t1', 'g1'],
                ['t11', 't1', 'Or'],
                ['t12', 't1', 'Or'],
              ],
            ),
            goda,
          ),
          godaEngineMapper,
        ).nodes[0] as GodaGoalNode,
    );
    assert.deepStrictEqual(said, []);
    const t1 = value.tasks![0]!;
    assert.deepStrictEqual(t1.properties.engine, {
      text: 'T1: Do [DM(T1.1,T1.2)]',
      contexts: [],
      annotation: {
        kind: 'call',
        name: 'DM',
        args: [
          { kind: 'ref', id: 'T1.1' },
          { kind: 'ref', id: 'T1.2' },
        ],
      },
      cost: null,
    });
    assert.deepStrictEqual(
      t1.tasks!.map((task) => task.properties.engine.cost),
      [{ value: '2', variable: null }, null],
    );
  });

  describe('its cost bracket (the line, not a property)', () => {
    const costOf = (bracket: string) => taskOf({}, `T1: Do ${bracket}`).cost;

    it('reads a number, a number and a variable, or a variable, its spaces ignored', () => {
      assert.deepStrictEqual(costOf('[W = 0.1]'), {
        value: '0.1',
        variable: null,
      });
      assert.deepStrictEqual(costOf('[W = 0.1x]'), {
        value: '0.1',
        variable: 'x',
      });
      assert.deepStrictEqual(costOf('[W = x]'), { value: null, variable: 'x' });
      assert.deepStrictEqual(costOf('[W=3]'), { value: '3', variable: null });
      assert.deepStrictEqual(costOf('[W = 0.25 load]'), {
        value: '0.25',
        variable: 'load',
      });
    });

    it('keeps the number as written: a trailing point, leading zeros', () => {
      assert.deepStrictEqual(costOf('[W = 5.]'), {
        value: '5.',
        variable: null,
      });
      assert.deepStrictEqual(costOf('[W = 007]'), {
        value: '007',
        variable: null,
      });
    });

    it('reads no cost without a bracket', () => {
      assert.strictEqual(taskOf({}, 'T1: Do').cost, null);
    });

    it('reads what it can of a bracket with errors, the parser saying so on the console', () => {
      const costRead = (bracket: string) => {
        const { engine, said } = taskRead({}, `T1: Do ${bracket}`);
        assert.strictEqual(engine.annotation, null, bracket);
        return { cost: engine.cost, said };
      };
      // an exponent: a number, then a variable `e`, the rest dropped
      assert.deepStrictEqual(costRead('[W = 1e3]'), {
        cost: { value: '1', variable: 'e' },
        said: ["error: line 1:12 Expecting token of type ']' but found `3`."],
      });
      // a sign, a leading point: dropped, the number read without them
      assert.deepStrictEqual(costRead('[W = -1]'), {
        cost: { value: '1', variable: null },
        said: ["error: line 1:10 token recognition error at: '-'"],
      });
      assert.deepStrictEqual(costRead('[W = .5]'), {
        cost: { value: '5', variable: null },
        said: ["error: line 1:10 token recognition error at: '.'"],
      });
      // no value: a cost of nothing
      assert.deepStrictEqual(costRead('[W = ]'), {
        cost: { value: null, variable: null },
        said: [
          "error: line 1:10 Expecting: one of these possible Token sequences: … but found: ']'",
        ],
      });
      // no cost: a lower-case w, a word, an empty bracket
      assert.deepStrictEqual(costRead('[w = 1]'), {
        cost: null,
        said: [
          "error: line 1:9 token recognition error at: '='",
          "error: line 1:8 Expecting: one of these possible Token sequences: … but found: 'w'",
        ],
      });
      assert.deepStrictEqual(costRead('[junk]'), {
        cost: null,
        said: [
          "error: line 1:8 Expecting: one of these possible Token sequences: … but found: 'junk'",
        ],
      });
      assert.deepStrictEqual(costRead('[]'), {
        cost: null,
        said: [
          "error: line 1:8 Expecting: one of these possible Token sequences: … but found: ']'",
        ],
      });
    });
  });
});
