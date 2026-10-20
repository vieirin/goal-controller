/** MutRoSe's language (src/engines/mutrose/language): names and their ranges. */
import * as assert from 'assert';
import { describe, it } from 'mocha';
import {
  OCL_BOOLEANS,
  OCL_OPERATIONS,
  OCL_OPERATORS,
} from '@goal-controller/goal-language';
import { AstUtils, GrammarAST } from 'langium';
import { MutRoSeGrammar } from '../../../src/engines/mutrose/language/generated/grammar';
import {
  readCreationCondition,
  readForAll,
  readNames,
  readOclExpression,
  readOclVariables,
  readRobotNumber,
  readSelect,
  readVariableItems,
  readVariableType,
  type OclName,
} from '../../../src/engines/mutrose/language';

const rule = (name: string) => {
  const found = MutRoSeGrammar().rules.find((r) => r.name === name);
  assert.ok(found, `no rule ${name}`);
  return found;
};
const keywords = (name: string) =>
  AstUtils.streamAllContents(rule(name))
    .filter(GrammarAST.isKeyword)
    .map((k) => k.value)
    .toArray();

/** The `nth` occurrence of a word in a text, as a name (offsets plus `offset`). */
const at = (text: string, word: string, nth = 0, offset = 0): OclName => {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = [...text.matchAll(new RegExp(`\\b${escaped}\\b`, 'g'))][nth];
  if (!match) throw new Error(`no ${word} #${nth} in ${text}`);
  const from = offset + match.index!;
  return { name: word, from, to: from + word.length };
};
/** a span: a part of the text as written */
const span = (text: string, part: string, offset = 0) => {
  const from = offset + text.indexOf(part);
  return { text: part, from, to: from + part.length };
};

const read = (text: string) => {
  const { value, errors } = readOclExpression(text);
  assert.deepStrictEqual(errors, [], text);
  return value;
};
const fails = (reader: (text: string) => { errors: unknown[] }, text: string) =>
  assert.ok(reader(text).errors.length > 0, text);

describe('mutrose.langium’s OCL vocabulary and the catalog (#172)', () => {
  it('keeps OclOperation in sync with the catalog’s collection operations', () => {
    assert.deepEqual(
      new Set(keywords('OclOperation')),
      new Set(OCL_OPERATIONS.map((operation) => operation.name)),
    );
  });

  it('keeps OclComparator a subset of the catalog’s operators, plus `in`', () => {
    for (const comparator of keywords('OclComparator'))
      assert.ok(
        comparator === 'in' ||
          (OCL_OPERATORS as readonly string[]).includes(comparator),
        comparator,
      );
  });

  it('keeps OclPrimary’s booleans in sync with the catalog', () => {
    const booleans = keywords('OclPrimary').filter(
      (k) => k !== '(' && k !== ')',
    );
    assert.deepEqual(new Set(booleans), new Set(OCL_BOOLEANS));
  });
});

describe('readOclExpression', () => {
  it('reads a select on the world: its variable and type, and no source', () => {
    const text = 'world_db->select(r:Room | r.name = "Kitchen")';
    assert.deepStrictEqual(read(text), {
      paths: [{ head: at(text, 'r', 1), attributes: [at(text, 'name')] }],
      selects: [
        { variable: at(text, 'r'), type: at(text, 'Room'), source: null },
      ],
      forAlls: [],
    });
  });

  it('reads a select on a path, its source a path too', () => {
    const text = 'current_room.objects->select(o:Object | !o.is_picked)';
    const source = {
      head: at(text, 'current_room'),
      attributes: [at(text, 'objects')],
    };
    assert.deepStrictEqual(read(text), {
      paths: [
        source,
        { head: at(text, 'o', 1), attributes: [at(text, 'is_picked')] },
      ],
      selects: [{ variable: at(text, 'o'), type: at(text, 'Object'), source }],
      forAlls: [],
    });
  });

  it('reads a select with an empty body, its pipe right after its type', () => {
    const text = 'world_db->select(d:Delivery| )';
    assert.deepStrictEqual(read(text).selects, [
      { variable: at(text, 'd'), type: at(text, 'Delivery'), source: null },
    ]);
  });

  it('reads a forAll: the path it iterates and its variable', () => {
    const text = 'rooms->forAll(current_room | current_room.num_objects = 0)';
    const rooms = { head: at(text, 'rooms'), attributes: [] };
    assert.deepStrictEqual(read(text), {
      paths: [
        rooms,
        {
          head: at(text, 'current_room', 1),
          attributes: [at(text, 'num_objects')],
        },
      ],
      selects: [],
      forAlls: [{ iterated: rooms, iteration: at(text, 'current_room') }],
    });
  });

  it('reads a forAll with an empty body, with or without a space', () => {
    for (const text of [
      'rooms->forAll(current_room | )',
      'deliveries_requested->forAll(current_delivery |)',
    ])
      assert.strictEqual(read(text).forAlls.length, 1, text);
  });

  it('reads `!`, `not`, `&&`, `||`, `and`, `or` and parentheses', () => {
    const text = '!a.x && (not b || c and d) or e';
    assert.deepStrictEqual(
      read(text).paths.map((path) => path.head),
      ['a', 'b', 'c', 'd', 'e'].map((name) => at(text, name)),
    );
  });

  it('reads comparisons and `in`, with strings, numbers and booleans', () => {
    const text =
      'l.name in current_agent.location && r.staphylococcus > 1.5 && r.pending = True && s <> "x"';
    assert.deepStrictEqual(read(text).paths, [
      { head: at(text, 'l'), attributes: [at(text, 'name')] },
      { head: at(text, 'current_agent'), attributes: [at(text, 'location')] },
      { head: at(text, 'r'), attributes: [at(text, 'staphylococcus')] },
      { head: at(text, 'r', 1), attributes: [at(text, 'pending')] },
      { head: at(text, 's'), attributes: [] },
    ]);
  });

  it('reads `!=` as a synonym of `<>` (#172)', () => {
    const text = 'r.x != 0';
    assert.deepStrictEqual(read(text).paths, [
      { head: at(text, 'r'), attributes: [at(text, 'x')] },
    ]);
  });

  it('reads a condition’s words as names', () => {
    const text = 'assertion.condition && trigger';
    assert.deepStrictEqual(
      read(text).paths.map((path) => path.head.name),
      ['assertion', 'trigger'],
    );
  });

  it('reads no keyword written as a name, and no world', () => {
    assert.deepStrictEqual(read('self = null && world_db.x'), {
      paths: [],
      selects: [],
      forAlls: [],
    });
    const text = 'self.x';
    assert.deepStrictEqual(read(text).paths, [
      { head: at(text, 'self'), attributes: [at(text, 'x')] },
    ]);
  });

  it('reads the other operations’ bodies; a chain’s later operation has no source path', () => {
    const text = 'a->exists(x | x.b)->forAll(y | y)';
    const reading = read(text);
    assert.deepStrictEqual(
      reading.paths.map((path) => path.head.name),
      ['a', 'x', 'y'],
    );
    assert.deepStrictEqual(reading.forAlls, [
      { iterated: null, iteration: at(text, 'y') },
    ]);
  });

  it('offsets its ranges and its errors', () => {
    const text = 'rooms->forAll(r | r.clean)';
    assert.deepStrictEqual(readOclExpression(text, 25).value.forAlls, [
      {
        iterated: { head: at(text, 'rooms', 0, 25), attributes: [] },
        iteration: at(text, 'r', 0, 25),
      },
    ]);
    const { errors } = readOclExpression('a = = b', 10);
    assert.deepStrictEqual(
      errors.map((error) => error.offset),
      [14],
    );
  });

  it('reads an empty text without errors, and reports what is not OCL', () => {
    assert.deepStrictEqual(readOclExpression('').errors, []);
    assert.deepStrictEqual(readOclExpression('  ').errors, []);
    for (const text of [
      'a ||',
      'rooms->forAll(r',
      'a ? b',
      'x->select(:T | y)',
    ])
      fails(readOclExpression, text);
  });

  it('keeps what it could read before an error', () => {
    const text = 'world_db->select(r:Room | r.x && )';
    const { value, errors } = readOclExpression(text);
    assert.ok(errors.length > 0);
    assert.deepStrictEqual(value.paths, [
      { head: at(text, 'r', 1), attributes: [at(text, 'x')] },
    ]);
  });
});

describe('readOclVariables', () => {
  it('reads names, their types as written, and their classes', () => {
    const text = 'rooms : Sequence(Room), current_room:Room, c';
    const { value, errors } = readOclVariables(text);
    assert.deepStrictEqual(errors, []);
    assert.deepStrictEqual(value, [
      {
        name: at(text, 'rooms'),
        type: 'Sequence(Room)',
        typeName: at(text, 'Room'),
      },
      {
        name: at(text, 'current_room'),
        type: 'Room',
        typeName: at(text, 'Room', 1),
      },
      { name: at(text, 'c'), type: '' },
    ]);
  });

  it('offsets its ranges, and reads an empty list', () => {
    const text = 'current_patient, delivery_room';
    assert.deepStrictEqual(
      readOclVariables(text, 7).value.map((v) => v.name),
      [at(text, 'current_patient', 0, 7), at(text, 'delivery_room', 0, 7)],
    );
    assert.deepStrictEqual(readOclVariables(''), { value: [], errors: [] });
  });

  it('reports an item without a name, at the item', () => {
    const { value, errors } = readOclVariables('a, : Room', 3);
    assert.deepStrictEqual(
      value.map((v) => v.name.name),
      ['a'],
    );
    assert.deepStrictEqual(
      errors.map(({ offset, length }) => [offset, length]),
      [[5, 7]],
    );
  });
});

describe('readVariableItems: as parse_vars reads them', () => {
  it('takes an item’s first word as its name, and the first word after its colon as its type', () => {
    const text = ' 1st x y : Sequence(Room) z : w, _b';
    const items = readVariableItems(text);
    assert.deepStrictEqual(
      items.map(({ item, name, type, typeName }) => ({
        item: item.text,
        name: name?.name,
        type,
        typeName: typeName?.name,
      })),
      [
        {
          item: ' 1st x y : Sequence(Room) z : w',
          name: 'st',
          type: 'Sequence(Room)',
          typeName: 'Room',
        },
        { item: ' _b', name: 'b', type: '', typeName: undefined },
      ],
    );
    assert.deepStrictEqual(items[0]!.typeName, at(text, 'Room'));
  });

  it('gives an item without a word no name', () => {
    assert.deepStrictEqual(
      readVariableItems('a,  : Room').map((item) => [
        item.item.text,
        item.name,
        item.type,
      ]),
      [
        ['a', at('a,  : Room', 'a'), ''],
        ['  : Room', null, 'Room'],
      ],
    );
  });
});

describe('readVariableType', () => {
  it('reads a type’s word, and the class in its parentheses', () => {
    const text = 'Sequence(Room)';
    assert.deepStrictEqual(readVariableType(text, 4), {
      value: {
        name: at(text, 'Sequence', 0, 4),
        element: at(text, 'Room', 0, 4),
      },
      errors: [],
    });
    assert.deepStrictEqual(readVariableType('Room').value, {
      name: at('Room', 'Room'),
      element: null,
    });
  });

  it('reads no type a variable list does not declare', () => {
    for (const text of [
      '',
      'Sequence( Room )',
      'Sequence(R1)',
      'a.b',
      'Room x',
    ])
      assert.strictEqual(readVariableType(text).value, null, text);
  });
});

describe('readNames', () => {
  it('reads names, comma-separated, spaces around them aside', () => {
    const text = ' current_room , obj';
    assert.deepStrictEqual(readNames(text, 2), {
      value: [
        {
          item: span(text, 'current_room', 2),
          name: at(text, 'current_room', 0, 2),
        },
        { item: span(text, 'obj', 2), name: at(text, 'obj', 0, 2) },
      ],
      errors: [],
    });
  });

  it('reports an item that is not one name', () => {
    for (const text of ['room hall', '1room', 'a,', 'a-b', 'a.b'])
      fails(readNames, text);
    const { value } = readNames('room hall, ');
    assert.deepStrictEqual(
      value.map(({ item, name }) => [item.text, name]),
      [
        ['room hall', null],
        ['', null],
      ],
    );
  });
});

describe('readRobotNumber', () => {
  it('reads `N` and `[lo,hi]`', () => {
    assert.deepStrictEqual(readRobotNumber('3'), { value: 3, errors: [] });
    assert.deepStrictEqual(readRobotNumber('[1,12]'), {
      value: [1, 12],
      errors: [],
    });
    assert.deepStrictEqual(readRobotNumber(''), { value: null, errors: [] });
  });

  it('reads no spaces, signs or decimals', () => {
    for (const text of ['[1, 2]', ' 3', '3 ', '-1', '1.5', '[1,2', '[1]'])
      assert.deepStrictEqual(readRobotNumber(text).value, null, text);
  });
});

describe('readCreationCondition', () => {
  it('reads a condition, its quoted expression read, with ranges in the value', () => {
    const text = 'assertion condition "not current_room.is_occupied"';
    const { value, errors } = readCreationCondition(text);
    assert.deepStrictEqual(errors, []);
    assert.deepStrictEqual(value, {
      kind: 'condition',
      value: span(text, 'not current_room.is_occupied'),
      reading: {
        paths: [
          {
            head: at(text, 'current_room'),
            attributes: [at(text, 'is_occupied')],
          },
        ],
        selects: [],
        forAlls: [],
      },
    });
  });

  it('reads a trigger’s event, its words in any case', () => {
    const text = '  Assertion  TRIGGER "LowBattery" ';
    assert.deepStrictEqual(readCreationCondition(text, 4), {
      value: {
        kind: 'trigger',
        value: span(text, 'LowBattery', 4),
        reading: null,
      },
      errors: [],
    });
  });

  it('requires its words and spaces between them', () => {
    for (const text of [
      'assertion condition',
      'assertioncondition "x"',
      'assertion condition"x"',
      'assertion when "x"',
      'condition "x"',
      'assertion condition "x" y',
      'assertion condition "x',
    ])
      assert.strictEqual(readCreationCondition(text).value, null, text);
  });

  it('reports a quoted condition that is not OCL, at its place in the value', () => {
    const { value, errors } = readCreationCondition(
      'assertion condition "a = = b"',
    );
    assert.strictEqual(value?.kind, 'condition');
    assert.deepStrictEqual(
      errors.map((error) => error.offset),
      [25],
    );
  });
});

describe('readForAll and readSelect: the decomposer’s shapes', () => {
  it('reads a forAll: what it iterates, with which variable, and its condition as written', () => {
    const text = 'rooms->forAll(current_room | current_room.clean)';
    assert.deepStrictEqual(readForAll(text, 1).value, {
      iterated: at(text, 'rooms', 0, 1),
      iteration: at(text, 'current_room', 0, 1),
      condition: span(text, ' current_room.clean', 1),
    });
    assert.deepStrictEqual(readForAll('rooms->forAll(r|)').value?.condition, {
      text: '',
      from: 16,
      to: 16,
    });
  });

  it('reads a forAll’s condition as any text on one line', () => {
    assert.strictEqual(
      readForAll('a.b->forAll(c.d | ?? (x)').value?.condition.text,
      ' ?? (x',
    );
  });

  it('reads no forAll the decomposer rejects', () => {
    for (const text of [
      'rooms ->forAll(r | x)',
      'rooms->forAll( r | x)',
      'rooms->forAll(r\t| x)',
      'rooms->forAll(r | x) ',
      'rooms->forAll(r | x\n)',
      '1rooms->forAll(r | x)',
      'rooms->forAll(r is_clean)',
    ])
      assert.strictEqual(readForAll(text).value, null, text);
  });

  it('reads a select: its source, variable, type, and its condition', () => {
    const text = 'world_db->select(r:Room |  r.dirty )';
    assert.deepStrictEqual(readSelect(text).value, {
      source: at(text, 'world_db'),
      variable: at(text, 'r'),
      type: at(text, 'Room'),
      condition: span(text, 'r.dirty '),
    });
  });

  it('reads no select the decomposer rejects (a one-letter type among them)', () => {
    for (const text of [
      'world_db->select(r:R | x)',
      'world_db->select(r : Room | x)',
      'world_db->select(r | r.dirty)',
      'world_db ->select(r:Room | x)',
      'world_db->select(r:Room | x) ',
    ])
      assert.strictEqual(readSelect(text).value, null, text);
  });
});
