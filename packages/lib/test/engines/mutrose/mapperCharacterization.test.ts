/**
 * What MutRoSe's mapper produces today for every property it reads
 * (goal-controller#187 phase 2 pre-work): the values for representative
 * inputs, as written and padded, empty or absent, and every message it
 * throws, so the migration to typed values can show nothing changed. A test
 * marked `#187: invalid value` feeds a value the dialect flags: after the
 * migration the mapper sees `undefined` for it instead of the text.
 */
import * as assert from 'assert';
import { describe, it } from 'mocha';
import { GoalTree, Model } from '@goal-controller/goal-tree';
import {
  mutrose,
  mutroseEngineMapper,
  type MutroseGoalNode,
} from '../../../src/engines/mutrose';
import { model } from '../goda/support';

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

/** G1 (its properties, its text) → AT1 (its properties): the tree the mapper builds. */
const treeOf = (goal: Props, task: Props = {}, goalText = 'G1: Root') =>
  GoalTree.fromModel(
    Model.parse(
      model(
        [
          ['g1', 'Goal', goalText, goal],
          ['t1', 'Task', 'AT1: Do', task],
        ],
        [['t1', 'g1']],
      ),
      mutrose,
    ),
    mutroseEngineMapper,
  ).nodes[0] as MutroseGoalNode;

/** G1's engine properties, the console silent. */
const goalOf = (goal: Props, goalText?: string) => {
  const { value, said } = consoleOf(() => treeOf(goal, {}, goalText));
  assert.deepStrictEqual(said, []);
  return value.properties.engine;
};

/** AT1's engine properties, the console silent. */
const taskOf = (task: Props) => {
  const { value, said } = consoleOf(() => treeOf({}, task));
  assert.deepStrictEqual(said, []);
  return value.tasks![0]!.properties.engine;
};

/** The message the mapper throws for G1's and AT1's properties. */
const thrown = (goal: Props, task: Props = {}): string => {
  try {
    consoleOf(() => treeOf(goal, task));
  } catch (error) {
    return (error as Error).message;
  }
  throw new Error('the mapper threw nothing');
};

/** What a goal reads with no properties: every default. */
const DEFAULTS = {
  goalType: 'Perform',
  controls: [],
  monitors: [],
  group: true,
  divisible: true,
  annotation: null,
};

describe('mutroseEngineMapper today (#187): a goal', () => {
  it('reads every default without properties, and no key it does not know', () => {
    assert.deepStrictEqual(goalOf({}), DEFAULTS);
    assert.deepStrictEqual(goalOf({ Foo: 'bar', Location: 'room' }), DEFAULTS);
  });

  describe('GoalType', () => {
    it('reads Perform, Achieve and Query, trimmed', () => {
      assert.strictEqual(goalOf({ GoalType: 'Perform' }).goalType, 'Perform');
      assert.strictEqual(goalOf({ GoalType: 'Achieve' }).goalType, 'Achieve');
      assert.strictEqual(goalOf({ GoalType: ' Query ' }).goalType, 'Query');
    });

    it('reads Perform when empty or absent', () => {
      assert.strictEqual(goalOf({ GoalType: '' }).goalType, 'Perform');
      assert.strictEqual(goalOf({ GoalType: '   ' }).goalType, 'Perform');
    });

    it('reads Perform for another case or another word: the dialect reports it, and generation refuses it (#274)', () => {
      // #187: invalid value
      assert.strictEqual(goalOf({ GoalType: 'achieve' }).goalType, 'Perform');
      // #187: invalid value
      assert.strictEqual(goalOf({ GoalType: 'QUERY' }).goalType, 'Perform');
      // #187: invalid value
      assert.strictEqual(goalOf({ GoalType: 'Bogus' }).goalType, 'Perform');
    });
  });

  describe('Description', () => {
    it('is kept as written, spaces and all; empty is left out', () => {
      assert.strictEqual(
        goalOf({ Description: '  what for  ' }).description,
        '  what for  ',
      );
      assert.strictEqual(goalOf({ Description: '   ' }).description, '   ');
      assert.ok(!('description' in goalOf({ Description: '' })));
    });
  });

  describe('Controls and Monitors', () => {
    it('reads `name : Type` items, comma-separated, padded; a Monitors item usually untyped', () => {
      assert.deepStrictEqual(
        goalOf({ Controls: ' a : Room ,b:Sequence(Room), c ' }).controls,
        [
          { name: 'a', type: 'Room' },
          { name: 'b', type: 'Sequence(Room)' },
          { name: 'c', type: '' },
        ],
      );
      assert.deepStrictEqual(goalOf({ Monitors: 'a, b : T' }).monitors, [
        { name: 'a', type: '' },
        { name: 'b', type: 'T' },
      ]);
    });

    it('reads no variables when empty or blank', () => {
      assert.deepStrictEqual(goalOf({ Controls: '' }).controls, []);
      assert.deepStrictEqual(goalOf({ Controls: '   ' }).controls, []);
      assert.deepStrictEqual(goalOf({ Monitors: '' }).monitors, []);
      assert.deepStrictEqual(goalOf({ Monitors: ' \t ' }).monitors, []);
    });

    it("reads an item's first word as its name, the rest ignored", () => {
      assert.deepStrictEqual(goalOf({ Controls: 'a b : Room' }).controls, [
        { name: 'a', type: 'Room' },
      ]);
    });

    it('throws for an item without a name, quoting it between its commas', () => {
      assert.strictEqual(
        thrown({ Controls: ': Room' }),
        'Invalid variable declaration : Room in GM. (node G1)',
      );
      assert.strictEqual(
        thrown({ Controls: 'a : Room,' }),
        'Invalid variable declaration  in GM. (node G1)',
      );
      assert.strictEqual(
        thrown({ Monitors: 'a,,b' }),
        'Invalid variable declaration  in GM. (node G1)',
      );
    });

    it('reads what it can of a value that is not OCL', () => {
      // #187: invalid value
      assert.deepStrictEqual(goalOf({ Controls: 'a § b' }).controls, [
        { name: 'a', type: '' },
      ]);
      // #187: invalid value
      assert.deepStrictEqual(goalOf({ Controls: 'a : R§' }).controls, [
        { name: 'a', type: 'R' },
      ]);
      // #187: invalid value
      assert.deepStrictEqual(goalOf({ Monitors: 'a§' }).monitors, [
        { name: 'a', type: '' },
      ]);
    });
  });

  describe('AchieveCondition', () => {
    it('reads a forAll: what it iterates, with which variable, its condition', () => {
      assert.deepStrictEqual(
        goalOf({ AchieveCondition: 'rooms->forAll(r | r.clean)' })
          .achieveCondition,
        {
          forAll: { iterated: 'rooms', iteration: 'r', condition: ' r.clean' },
          text: 'rooms->forAll(r | r.clean)',
        },
      );
    });

    it('reads any other text as a plain condition, trimmed', () => {
      assert.deepStrictEqual(
        goalOf({ AchieveCondition: '  r.clean ' }).achieveCondition,
        { forAll: null, text: 'r.clean' },
      );
      // #187: invalid value
      assert.deepStrictEqual(
        goalOf({ AchieveCondition: 'a # b' }).achieveCondition,
        { forAll: null, text: 'a # b' },
      );
    });

    it('leaves it out when empty or blank, on an Achieve goal too', () => {
      assert.ok(!('achieveCondition' in goalOf({ AchieveCondition: '' })));
      assert.ok(!('achieveCondition' in goalOf({ AchieveCondition: '  ' })));
      assert.deepStrictEqual(goalOf({ GoalType: 'Achieve' }), {
        ...DEFAULTS,
        goalType: 'Achieve',
      });
    });

    it('throws for a text with `forAll` not of its shape, padding included', () => {
      assert.strictEqual(
        thrown({ AchieveCondition: 'rooms->forAll(r r.clean)' }),
        'Invalid forAll statement rooms->forAll(r r.clean) in GM. (node G1)',
      );
      assert.strictEqual(
        thrown({ AchieveCondition: 'rooms -> forAll(r | r.clean)' }),
        'Invalid forAll statement rooms -> forAll(r | r.clean) in GM. (node G1)',
      );
      assert.strictEqual(
        thrown({ AchieveCondition: 'forAll' }),
        'Invalid forAll statement forAll in GM. (node G1)',
      );
      // #237: the check reads it trimmed, as the mapper does: a padded forAll reads
      assert.deepStrictEqual(
        goalOf({ AchieveCondition: '  rooms->forAll(r | r.clean)  ' })
          .achieveCondition?.text,
        'rooms->forAll(r | r.clean)',
      );
    });

    it("on an Achieve goal, throws for a forAll's variables its goal does not have", () => {
      assert.strictEqual(
        thrown({
          GoalType: 'Achieve',
          AchieveCondition: 'rooms->forAll(r | r.clean)',
        }),
        "Did not find iterated variable rooms in G1's controlled variables list (node G1)",
      );
      assert.strictEqual(
        thrown({
          GoalType: 'Achieve',
          Monitors: 'rooms',
          AchieveCondition: 'rooms->forAll(r | r.clean)',
        }),
        "Did not find iteration variable r in G1's monitored variables list (node G1)",
      );
      // GoalType trimmed: a padded Achieve is one
      assert.strictEqual(
        thrown({
          GoalType: ' Achieve ',
          AchieveCondition: 'rooms->forAll(r | r.clean)',
        }),
        "Did not find iterated variable rooms in G1's controlled variables list (node G1)",
      );
      assert.deepStrictEqual(
        goalOf({
          GoalType: 'Achieve',
          Monitors: 'rooms',
          Controls: 'r : Room',
          AchieveCondition: 'rooms->forAll(r | r.clean)',
        }).achieveCondition,
        {
          forAll: { iterated: 'rooms', iteration: 'r', condition: ' r.clean' },
          text: 'rooms->forAll(r | r.clean)',
        },
      );
    });
  });

  describe('QueriedProperty', () => {
    const QUERY = 'world_db->select(r:Room | r.dirty)';
    const SELECT = {
      source: 'world_db',
      variable: 'r',
      type: 'Room',
      condition: 'r.dirty',
    };

    it('reads a select: its source, variable, type and condition', () => {
      assert.deepStrictEqual(
        goalOf({
          GoalType: 'Query',
          Controls: 'rs : Sequence(Room)',
          QueriedProperty: QUERY,
        }).queriedProperty,
        SELECT,
      );
      // read on any goal; its Query rules only on a Query goal
      assert.deepStrictEqual(
        goalOf({ GoalType: 'Perform', QueriedProperty: QUERY }).queriedProperty,
        SELECT,
      );
    });

    it('leaves it out when empty, on a Query goal too', () => {
      assert.ok(!('queriedProperty' in goalOf({ QueriedProperty: '' })));
      assert.deepStrictEqual(goalOf({ GoalType: 'Query' }), {
        ...DEFAULTS,
        goalType: 'Query',
      });
    });

    it('throws for a text not of its shape; padded reads, blank is none (#237)', () => {
      assert.strictEqual(
        thrown({ QueriedProperty: 'world_db->select(r | r.dirty)' }),
        'Invalid select statement world_db->select(r | r.dirty) in GM. (node G1)',
      );
      // #237: the check reads it trimmed, as the mapper does
      assert.deepStrictEqual(
        goalOf({ QueriedProperty: ` ${QUERY} ` }).queriedProperty,
        goalOf({ QueriedProperty: QUERY }).queriedProperty,
      );
      // #237: blank is none, as an empty AchieveCondition or CreationCondition is
      assert.ok(!('queriedProperty' in goalOf({ QueriedProperty: '   ' })));
    });

    it('on a Query goal, throws without a controlled variable, or one of another type', () => {
      assert.strictEqual(
        thrown({ GoalType: 'Query', QueriedProperty: QUERY }),
        'No controlled variable was declared for Query goal [G1] (node G1)',
      );
      assert.strictEqual(
        // #187: invalid value
        thrown({
          GoalType: 'Query',
          Controls: 'r : R',
          QueriedProperty: 'world_db->select(r:Room | §)',
        }),
        'Query variable [r] type + [Room] is different than the base type of the first controlled variable [r] ([R]) (node G1)',
      );
    });
  });

  describe('CreationCondition', () => {
    it('reads `assertion condition "expr"` and `assertion trigger "Event"`, trimmed, its words in any case', () => {
      assert.deepStrictEqual(
        goalOf({ CreationCondition: ' assertion condition "r.dirty" ' })
          .creationCondition,
        { kind: 'condition', value: 'r.dirty' },
      );
      assert.deepStrictEqual(
        goalOf({ CreationCondition: 'Assertion TRIGGER "Ev"' })
          .creationCondition,
        { kind: 'trigger', value: 'Ev' },
      );
    });

    it('reads its quoted text as written, OCL or not', () => {
      assert.deepStrictEqual(
        goalOf({ CreationCondition: 'assertion condition "§"' })
          .creationCondition,
        { kind: 'condition', value: '§' },
      );
    });

    it('leaves it out when empty or blank', () => {
      assert.ok(!('creationCondition' in goalOf({ CreationCondition: '' })));
      assert.ok(!('creationCondition' in goalOf({ CreationCondition: '  ' })));
    });

    it('throws for any other text', () => {
      assert.strictEqual(
        thrown({ CreationCondition: 'when open' }),
        'A CreationCondition is assertion condition "expr" or assertion trigger "Event" (node G1)',
      );
    });
  });

  describe('Group and Divisible', () => {
    it('read false for `false` in any case, padded', () => {
      for (const text of ['false', ' False ', 'FALSE', 'fAlSe']) {
        assert.strictEqual(goalOf({ Group: text }).group, false, text);
        assert.strictEqual(goalOf({ Divisible: text }).divisible, false, text);
      }
    });

    it('read true for anything else: empty, `true`, `0`, `no`', () => {
      for (const text of ['', '  ', 'true', 'TRUE', '0', '1', 'no']) {
        assert.strictEqual(goalOf({ Group: text }).group, true, text);
        assert.strictEqual(goalOf({ Divisible: text }).divisible, true, text);
      }
    });
  });

  describe('its runtime annotation (the line, not a property)', () => {
    it('reads its bracket in the goal language', () => {
      assert.deepStrictEqual(goalOf({}, 'G1: Root [AT1]').annotation, {
        kind: 'ref',
        id: 'AT1',
      });
      assert.deepStrictEqual(
        goalOf({}, 'G1: Root [AT1#AT2;FALLBACK(AT3,AT4)]').annotation,
        {
          kind: 'binary',
          operator: ';',
          left: {
            kind: 'binary',
            operator: '#',
            left: { kind: 'ref', id: 'AT1' },
            right: { kind: 'ref', id: 'AT2' },
          },
          right: {
            kind: 'call',
            name: 'FALLBACK',
            args: [
              { kind: 'ref', id: 'AT3' },
              { kind: 'ref', id: 'AT4' },
            ],
          },
        },
      );
    });

    it('keeps what it read of a bracket with errors, the parser saying so on the console', () => {
      const partial = consoleOf(() => treeOf({}, {}, 'G1: Root [AT1;;]'));
      assert.deepStrictEqual(partial.value.properties.engine.annotation, {
        kind: 'ref',
        id: 'AT1',
      });
      assert.deepStrictEqual(partial.said, [
        "error: line 1:14 Expecting: one of these possible Token sequences: … but found: ';'",
        "error: line 1:15 Expecting: one of these possible Token sequences: … but found: ']'",
      ]);
      const junk = consoleOf(() => treeOf({}, {}, 'G1: Root [%%]'));
      assert.strictEqual(junk.value.properties.engine.annotation, null);
      assert.deepStrictEqual(junk.said, [
        "error: line 1:10 token recognition error at: '%'",
        "error: line 1:11 token recognition error at: '%'",
        "error: line 1:12 Expecting: one of these possible Token sequences: … but found: ']'",
      ]);
    });
  });

  it('throws at the first property in the definition’s order, whatever the order written', () => {
    assert.strictEqual(
      thrown({ CreationCondition: 'bad', Controls: ': x' }),
      'Invalid variable declaration : x in GM. (node G1)',
    );
  });
});

describe('mutroseEngineMapper today (#187): an abstract task', () => {
  it('reads no params and nothing else without properties, and no key it does not know', () => {
    assert.deepStrictEqual(taskOf({}), { params: [] });
    assert.deepStrictEqual(taskOf({ GoalType: 'Query', Foo: 'x' }), {
      params: [],
    });
  });

  it('keeps Description as written; empty is left out', () => {
    assert.deepStrictEqual(taskOf({ Description: ' d ' }), {
      description: ' d ',
      params: [],
    });
    assert.deepStrictEqual(taskOf({ Description: '' }), { params: [] });
  });

  describe('Location', () => {
    it('reads one variable name, trimmed; blank is left out', () => {
      assert.deepStrictEqual(taskOf({ Location: '  room  ' }), {
        location: 'room',
        params: [],
      });
      assert.deepStrictEqual(taskOf({ Location: '   ' }), { params: [] });
      assert.deepStrictEqual(taskOf({ Location: '' }), { params: [] });
    });

    it('throws for two names, or what is no name', () => {
      assert.strictEqual(
        thrown({}, { Location: 'room, hall' }),
        'A Location is one variable name, not room, hall (node AT1)',
      );
      assert.strictEqual(
        thrown({}, { Location: ' 1room ' }),
        'A Location is one variable name, not 1room (node AT1)',
      );
      // #187: invalid value
      assert.strictEqual(
        thrown({}, { Location: 'r§' }),
        'A Location is one variable name, not r§ (node AT1)',
      );
    });
  });

  describe('Params', () => {
    it('reads names, comma-separated, trimmed; empty or blank is none', () => {
      assert.deepStrictEqual(taskOf({ Params: ' a , b ' }).params, ['a', 'b']);
      assert.deepStrictEqual(taskOf({ Params: '' }).params, []);
      assert.deepStrictEqual(taskOf({ Params: '  ' }).params, []);
    });

    it('throws for an empty name, or what is no name', () => {
      assert.strictEqual(
        thrown({}, { Params: 'a,' }),
        'Params are variable names, comma-separated: not an empty name (node AT1)',
      );
      assert.strictEqual(
        thrown({}, { Params: 'a, 1b' }),
        'Params are variable names, comma-separated: not 1b (node AT1)',
      );
      assert.strictEqual(
        thrown({}, { Params: 'a.b' }),
        'Params are variable names, comma-separated: not a.b (node AT1)',
      );
      // #187: invalid value
      assert.strictEqual(
        thrown({}, { Params: 'a, §' }),
        'Params are variable names, comma-separated: not § (node AT1)',
      );
    });
  });

  describe('RobotNumber', () => {
    it('reads a number of digits, a leading zero too, padded (#237)', () => {
      assert.strictEqual(taskOf({ RobotNumber: '2' }).robotNumber, 2);
      assert.strictEqual(taskOf({ RobotNumber: '02' }).robotNumber, 2);
      // #237: trimmed, as its check reads it
      assert.strictEqual(taskOf({ RobotNumber: ' 2 ' }).robotNumber, 2);
    });

    it('reads a range `[lo,hi]`, low end first, padded (#237)', () => {
      assert.deepStrictEqual(
        taskOf({ RobotNumber: '[1,3]' }).robotNumber,
        [1, 3],
      );
      assert.deepStrictEqual(
        taskOf({ RobotNumber: '[2,2]' }).robotNumber,
        [2, 2],
      );
      assert.deepStrictEqual(
        taskOf({ RobotNumber: ' [1,3] ' }).robotNumber,
        [1, 3],
      );
    });

    it('throws for no robot, past the safe integers, or a reversed range (#237)', () => {
      // #237: each read before, as 0, 1e20 and [3,1]
      for (const [text, message] of [
        ['0', 'A RobotNumber is one robot at least, not 0'],
        ['[0,2]', 'A RobotNumber is one robot at least, not [0,2]'],
        [
          '99999999999999999999',
          `A RobotNumber is at most ${Number.MAX_SAFE_INTEGER} robots, not 99999999999999999999`,
        ],
        [
          '[3,1]',
          'A RobotNumber range is [low,high], its low end first: not [3,1]',
        ],
      ] as const)
        assert.strictEqual(
          thrown({}, { RobotNumber: text }),
          `${message} (node AT1)`,
        );
    });

    it('leaves it out when empty or blank (#237)', () => {
      assert.deepStrictEqual(taskOf({ RobotNumber: '' }), { params: [] });
      // #237: blank is none, as its check reads it
      assert.deepStrictEqual(taskOf({ RobotNumber: '  ' }), { params: [] });
    });

    it('throws for anything else, spaces inside included: signed, decimal, exponent', () => {
      for (const text of ['[1, 3]', '-1', '1.5', '1e3', 'abc'])
        assert.strictEqual(
          thrown({}, { RobotNumber: text }),
          `Invalid declaration of robot number: ${text} (node AT1)`,
        );
    });
  });
});
