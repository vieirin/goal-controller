/**
 * A property record read against a dialect (goal-controller#187): each
 * stored string read as its property's type, typed by the dialect; a value
 * written with an error is unset, its text kept.
 */
import { actors, links, property } from '@goal-controller/dialect';
import { expect } from 'chai';
import {
  parseValue,
  readProperties,
  valueProblem,
  type Assertion,
  type PairList,
  type AssertionTree,
  type PropertyValues,
  type RefList,
} from '../src/index.js';

const dialect = {
  properties: {
    goal: [
      property.int('maxRetries', { min: 0, help: '' }),
      property.number('utility', { help: '' }),
      property.bool('maintain', { help: '' }),
      property.enum('type', ['', 'achieve', 'maintain'], { help: '' }),
      property.enum('mode', ['fast'], { open: true, help: '' }),
      property.refList('dependsOn', 'goal', { help: '' }),
      property.pairList('variables', 'int', { help: '' }),
      property.assertion('assertion', { resolves: ['variable'], help: '' }),
      property.text('note', { help: '' }),
      property.probability('chance', { help: '' }),
      property.reference('anchor', ['goal'], { help: '' }),
      property.conditional(
        'bound',
        {
          when: { key: 'type', equals: 'maintain' },
          matching: { type: 'assertion', resolves: ['variable'] },
          otherwise: { type: 'int' },
        },
        { help: '' },
      ),
    ],
    task: [property.text('note', { help: '' })],
  },
  actors: actors([
    property.int('importance', { help: '' }),
    property.text('role', { kinds: ['istar.Role'], help: '' }),
  ]),
  links: links({
    'istar.ContributionLink': [property.int('weight', { help: '' })],
  }),
};

type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const same = <T extends true>(): T => true as T;

describe('readProperties (#187)', () => {
  it('reads each value as its type', () => {
    const { values, text } = readProperties(
      dialect,
      { element: 'goal' },
      {
        maxRetries: '3',
        utility: '0.5',
        maintain: 'true',
        type: 'achieve',
        mode: 'slow',
        dependsOn: 'G2, G3',
        variables: 'x:3, y:2',
        assertion: 'x > 3',
        note: 'a note',
        chance: '80%',
        anchor: ' G1 ',
        unknown: 'not the dialect’s',
      },
    );
    expect(values).to.deep.include({
      maxRetries: 3,
      utility: 0.5,
      maintain: true,
      type: 'achieve',
      mode: 'slow',
      dependsOn: ['G2', 'G3'],
      variables: [
        { name: 'x', value: 3 },
        { name: 'y', value: 2 },
      ],
      note: 'a note',
      chance: 0.8,
      anchor: 'G1',
    });
    expect(values.assertion?.kind).to.equal('compare');
    expect(values).not.to.have.property('unknown');
    expect(text).to.deep.equal({
      maxRetries: '3',
      utility: '0.5',
      maintain: 'true',
      type: 'achieve',
      mode: 'slow',
      dependsOn: 'G2, G3',
      variables: 'x:3, y:2',
      assertion: 'x > 3',
      note: 'a note',
      chance: '80%',
      anchor: ' G1 ',
    });
  });

  it('leaves a value with errors unset, and keeps its text', () => {
    const { values, text } = readProperties(
      dialect,
      { element: 'goal' },
      {
        maxRetries: 'three',
        utility: 'x',
        maintain: 'yes',
        type: 'perform',
        dependsOn: 'G2,,',
        chance: '120%',
      },
    );
    expect(values).to.deep.equal({});
    expect(text).to.deep.equal({
      maxRetries: 'three',
      utility: 'x',
      maintain: 'yes',
      type: 'perform',
      dependsOn: 'G2,,',
      chance: '120%',
    });
  });

  it('reads an empty value as empty, not as an error', () => {
    const { values } = readProperties(
      dialect,
      { element: 'goal' },
      { maxRetries: '', type: '', dependsOn: '' },
    );
    expect(values).to.deep.equal({
      maxRetries: null,
      type: null,
      dependsOn: [],
    });
  });

  it('reads a conditional value as the other properties make it', () => {
    const maintained = readProperties(
      dialect,
      { element: 'goal' },
      { type: 'maintain', bound: 'x > 3' },
    );
    expect((maintained.values.bound as AssertionTree)?.kind).to.equal(
      'compare',
    );
    const achieved = readProperties(
      dialect,
      { element: 'goal' },
      { type: 'achieve', bound: '4' },
    );
    expect(achieved.values.bound).to.equal(4);
  });

  it("reads an actor's properties for its kind, and a link's", () => {
    expect(
      readProperties(
        dialect,
        { actor: 'istar.Agent' },
        { importance: '2', role: 'r' },
      ),
    ).to.deep.equal({ values: { importance: 2 }, text: { importance: '2' } });
    expect(
      readProperties(
        dialect,
        { actor: 'istar.Role' },
        { importance: '2', role: 'r' },
      ).values,
    ).to.deep.equal({ importance: 2, role: 'r' });
    expect(
      readProperties(
        dialect,
        { link: 'istar.ContributionLink' },
        { weight: '50' },
      ).values,
    ).to.deep.equal({ weight: 50 });
    expect(
      readProperties(dialect, { link: 'istar.AndRefinementLink' }, { w: '1' }),
    ).to.deep.equal({ values: {}, text: {} });
  });

  it('reads a text across line breaks, as written', () => {
    const note = ' line one\n  line two\r\nline three \n';
    const { values, text } = readProperties(
      dialect,
      { element: 'goal' },
      { note, formula: 'x' },
    );
    expect(values.note).to.equal('line one\n  line two\r\nline three');
    expect(text.note).to.equal(note);
    expect(parseValue('text', note).errors).to.deep.equal([]);
    expect(valueProblem({ type: 'text' }, note)).to.equal(null);
    expect(
      readProperties(
        {
          properties: { goal: [property.formula('spec', 'ltl', { help: '' })] },
        },
        { element: 'goal' },
        { spec: 'G p\n-> F q' },
      ).values,
    ).to.deep.equal({ spec: 'G p\n-> F q' });
  });

  it('reports a typed value across line breaks, not swallowing it', () => {
    const { values, text } = readProperties(
      dialect,
      { element: 'goal' },
      { maxRetries: '3\n4', type: 'achieve\nmaintain', mode: 'fast\nslow' },
    );
    expect(values).to.deep.equal({});
    expect(text).to.deep.equal({
      maxRetries: '3\n4',
      type: 'achieve\nmaintain',
      mode: 'fast\nslow',
    });
    expect(valueProblem({ type: 'int' }, '3\n4')).to.equal(
      'Not an integer: 3\n4',
    );
    const type = {
      type: 'enum',
      options: [{ value: 'achieve', label: '' }],
    } as const;
    const mode = { ...type, open: true } as const;
    expect(valueProblem(type, 'achieve\nmaintain')).to.match(/^One of /);
    expect(valueProblem(mode, 'fast\nslow')).to.equal(
      'One line, not "fast\\nslow"',
    );
  });

  it('reads a caseInsensitive enum in any case, as its option (#227)', () => {
    const flags = {
      properties: {
        goal: [
          property.enum('closed', ['', 'true', 'false'], {
            caseInsensitive: true,
            help: '',
          }),
          property.enum('open', ['', 'false'], {
            open: true,
            caseInsensitive: true,
            help: '',
          }),
        ],
      },
    };
    const read = (stored: Record<string, string>) =>
      readProperties(flags, { element: 'goal' }, stored);
    expect(read({ closed: ' FALSE ', open: 'False' })).to.deep.equal({
      values: { closed: 'false', open: 'false' },
      text: { closed: ' FALSE ', open: 'False' },
    });
    // an open one keeps a word that is no option as written
    expect(read({ closed: 'no', open: 'No' }).values).to.deep.equal({
      open: 'No',
    });
    const [closed, open] = [
      {
        type: 'enum',
        options: [
          { value: 'true', label: '' },
          { value: 'false', label: '' },
        ],
        caseInsensitive: true,
      },
      {
        type: 'enum',
        options: [{ value: 'false', label: '' }],
        open: true,
        caseInsensitive: true,
      },
    ] as const;
    expect(valueProblem(closed, 'TRUE')).to.equal(null);
    expect(valueProblem(closed, 'no')).to.equal('One of true, false, not no');
    expect(valueProblem(open, 'whatever')).to.equal(null);
    // without the flag, case still matters
    expect(
      readProperties(dialect, { element: 'goal' }, { type: 'Achieve' }).values,
    ).to.deep.equal({});
    expect(
      valueProblem(
        {
          type: 'enum',
          options: [
            { value: 'achieve', label: '' },
            { value: 'maintain', label: '' },
          ],
        },
        'Achieve',
      ),
    ).to.equal('One of achieve, maintain, not Achieve');
  });

  it("reads a pairList's members as its value type, or leaves it unset (#235)", () => {
    const lists = {
      properties: {
        goal: [
          property.pairList('ints', 'int', { help: '' }),
          property.pairList('numbers', 'number', { help: '' }),
          property.pairList('texts', 'text', { help: '' }),
        ],
      },
    };
    const read = (stored: Record<string, string>) =>
      readProperties(lists, { element: 'goal' }, stored);
    const { values } = read({
      ints: 'x:3, y:-2',
      numbers: 'p:0.5, q:2',
      texts: 'a:on, b:3',
    });
    expect(values.ints).to.deep.equal([
      { name: 'x', value: 3 },
      { name: 'y', value: -2 },
    ]);
    expect(values.ints?.get('y')).to.equal(-2);
    expect(values.ints?.text()).to.equal('x:3, y:-2');
    expect(values.numbers?.get('p')).to.equal(0.5);
    expect(values.texts?.get('b')).to.equal('3');
    same<Same<NonNullable<typeof values.ints>, PairList<number>>>();
    same<Same<NonNullable<typeof values.numbers>, PairList<number>>>();
    same<Same<NonNullable<typeof values.texts>, PairList<string>>>();
    // a member not of its type: the whole value is unset, and reported
    for (const ints of ['x:abc', 'x:1.5', 'x:3abc', 'x:3, y:abc']) {
      const record = read({ ints });
      expect(record.values, ints).to.deep.equal({});
      expect(record.text, ints).to.deep.equal({ ints });
      expect(
        valueProblem({ type: 'pairList', value: 'int' }, ints),
        ints,
      ).to.match(/: Not an integer: /);
    }
    expect(read({ numbers: 'p:high' }).values).to.deep.equal({});
    expect(
      valueProblem({ type: 'pairList', value: 'number' }, 'p:high'),
    ).to.equal('p: Not a number: high');
    // empty: an empty list, as before
    expect([...read({ ints: '' }).values.ints!]).to.deep.equal([]);
  });

  it('leaves an int outside its bounds unset, as valueProblem reports it (#249)', () => {
    const bounded = {
      properties: {
        goal: [
          property.int('episodeLength', { min: 1, help: '' }),
          property.int('weight', { min: -100, max: 100, help: '' }),
        ],
      },
    };
    const read = (stored: Record<string, string>) =>
      readProperties(bounded, { element: 'goal' }, stored);
    expect(read({ episodeLength: '1', weight: '-100' }).values).to.deep.equal({
      episodeLength: 1,
      weight: -100,
    });
    expect(read({ weight: '100' }).values).to.deep.equal({ weight: 100 });
    for (const [key, text, problem] of [
      ['episodeLength', '-3', 'At least 1'],
      ['episodeLength', '0', 'At least 1'],
      ['weight', '101', 'At most 100'],
      ['weight', '-101', 'At least -100'],
    ] as const) {
      const record = read({ [key]: text });
      expect(record.values, text).to.deep.equal({});
      expect(record.text, text).to.deep.equal({ [key]: text });
      const config = {
        type: 'int',
        min: key === 'weight' ? -100 : 1,
        ...(key === 'weight' && { max: 100 }),
      } as const;
      expect(valueProblem(config, text), text).to.equal(problem);
    }
    // unset and empty, as before
    expect(read({ episodeLength: '' }).values).to.deep.equal({
      episodeLength: null,
    });
  });

  it('reads a conditional value by its property trimmed, as the enum reads it (#234)', () => {
    // `bound` is an assertion when type is maintain, an int otherwise
    const { values } = readProperties(
      dialect,
      { element: 'goal' },
      { type: ' maintain', bound: 'x > 3' },
    );
    expect(values.type).to.equal('maintain');
    expect(values.bound).to.have.property('kind', 'compare');
  });

  it('resolves a reference against a context: no element, or a wrong kind, unset (#243)', () => {
    const kinds: Record<string, string> = { G1: 'goal', T1: 'task' };
    const context = { kindOf: (id: string) => kinds[id] };
    const read = (anchor: string, withContext = true) =>
      readProperties(
        dialect,
        { element: 'goal' },
        { anchor },
        withContext ? context : undefined,
      );
    expect(read(' G1 ').values).to.deep.equal({ anchor: 'G1' });
    // no such element, a task where a goal is named: unset, kept as written
    expect(read('G9').values).to.deep.equal({});
    expect(read('T1')).to.deep.equal({ values: {}, text: { anchor: 'T1' } });
    expect(read('').values).to.deep.equal({ anchor: null });
    // without a context, the id as written, as before
    expect(read('G9', false).values).to.deep.equal({ anchor: 'G9' });
  });

  it('reads a list of conditions: each part a condition, or none (#232)', () => {
    const contexts = {
      type: 'assertion',
      resolves: ['variable'],
      prefixes: ['assertion condition', 'assertion trigger'],
      declaresVariables: true,
      separator: '%',
    } as const;
    const lists = {
      properties: {
        goal: [{ key: 'ctx', value: contexts, help: '' }],
      },
    } as const;
    const read = (ctx: string) =>
      readProperties(lists, { element: 'goal' }, { ctx }).values.ctx;
    const both = read('assertion condition a = 1 % assertion trigger b');
    expect(both?.map((condition) => condition.text())).to.deep.equal([
      'a = 1',
      'b',
    ]);
    same<Same<typeof both, Assertion[] | undefined>>();
    // a part that isn't a condition: the value is unset, and reported
    expect(read('assertion condition a = 1 % a = = 2')).to.equal(undefined);
    expect(
      valueProblem(contexts, 'assertion condition a = 1 % a = = 2'),
    ).to.match(/^Not a condition: /);
    expect(valueProblem(contexts, 'assertion condition a = 1 % b')).to.equal(
      'Starts with assertion condition or assertion trigger',
    );
    expect(
      valueProblem(
        contexts,
        'assertion condition a = 1 % assertion trigger b %',
      ),
    ).to.equal(null);
    expect(read('')).to.deep.equal([]);
  });

  it('types the values by the dialect', () => {
    type Goal = PropertyValues<typeof dialect.properties.goal>;
    same<Same<Goal['maxRetries'], number | null | undefined>>();
    same<Same<Goal['maintain'], boolean | null | undefined>>();
    same<Same<Goal['type'], 'achieve' | 'maintain' | null | undefined>>();
    same<Same<Goal['mode'], string | null | undefined>>();
    same<Same<Goal['dependsOn'], RefList | undefined>>();
    same<Same<Goal['variables'], PairList<number> | undefined>>();
    same<Same<Goal['chance'], number | null | undefined>>();
    same<Same<Goal['bound'], Assertion | number | null | undefined>>();
    const { values } = readProperties(
      dialect,
      { link: 'istar.ContributionLink' },
      {},
    );
    same<Same<typeof values, { weight?: number | null }>>();
    // @ts-expect-error a key the dialect doesn't give a task
    void readProperties(dialect, { element: 'task' }, {}).values.maxRetries;
  });
});
