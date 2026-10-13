/**
 * The pool's protocol (#82), form by form: YAML and XML files, a record's
 * keys, first uses, paths up and out (`../`, `^`, `previous`), what leads
 * where (`leadsTo`), types, the goal model with values written in a Langium
 * language, the goal model's tree (ids scoped by their goal, the children a
 * notation names), and the engine's messages for what resolves to nothing.
 */
import { expect } from 'chai';
import * as z from 'zod/mini';
import {
  completionsAt,
  createPool,
  definitionAt,
  symbolAt,
  type PoolDocument,
} from '../../src/engines/definitionPool';
import {
  defineEngine,
  defineFile,
  defines,
  goalModel,
  json,
  langium,
  leadsTo,
  poolOf,
  refersTo,
  scope,
  written,
  xml,
  yaml,
} from '../../src/pool';
import { toyLanguage } from './toy/language';

const firstWord = (text: string) => {
  const word = /\S+/.exec(text);
  return word ? { text: word[0], offset: word.index } : null;
};

// plants.yaml: plants with their varieties; sizes by key, typed as written
const plants = defineFile({
  kind: 'plants',
  parser: yaml,
  schema: z.object({
    plants: z.array(
      z.object({
        name: z.string().check(defines('g.plant')),
        varieties: z.array(
          z.string().check(
            defines('g.variety', {
              owner: 'name',
              type: { literal: 'Colour' },
            }),
          ),
        ),
      }),
    ),
    colours: z.array(
      z.object({
        name: z.string().check(defines('g.colour')),
        shades: z.array(
          z.string().check(defines('g.shade', { owner: 'name' })),
        ),
      }),
    ),
    sizes: z.record(
      z.string().check(
        defines('g.size', {
          type: ([size]) =>
            /\./.test(size!.text(size!.value as string) ?? '')
              ? 'Real'
              : 'Integer',
        }),
      ),
      z.number(),
    ),
  }),
});

// beds.xml: a bed's tag is its class, defined where first written
const element: z.ZodMiniType = z.object({
  name: z.string().check(defines('g.bedClass', { firstUse: true })),
  close: z.optional(
    z.string().check(defines('g.bedClass', { firstUse: true })),
  ),
  attributes: z.record(z.string(), z.string()),
  children: z.array(z.lazy(() => element)),
  text: z.optional(z.string()),
});
const beds = defineFile({ kind: 'beds', parser: xml, schema: element });

// the goal model: a task grows the plant its name's first word names, and
// its Things are written in the toy's language, owned by the task
const model = defineFile({
  kind: 'model',
  parser: goalModel(),
  schema: z.object({
    key: z.string(),
    id: z.string().check(defines('g.task')),
    kind: z.literal('task'),
    name: z
      .string()
      .check(
        refersTo('g.plant', 'global', { name: firstWord }),
        leadsTo('grows'),
      ),
    properties: z.object({
      Things: z.optional(
        z.string().check(
          written(
            langium(toyLanguage, {
              start: 'Model',
              kinds: { Thing: 'toy.thing', Part: 'toy.part' },
              annotate: {
                Thing: { name: [defines('toy.thing', { owner: '^id' })] },
              },
            }),
          ),
        ),
      ),
    }),
  }),
});

// plan.json: a task's varieties are its plant's; a look is a plant, its variety, a shade of the variety's colour
const plan = defineFile({
  kind: 'plan',
  parser: json,
  schema: z.object({
    tasks: z.array(
      z.object({
        task: z.string().check(
          refersTo('g.task', 'global', {
            unresolved: { severity: 'error', message: 'g.noTask' },
          }),
        ),
        beds: z.array(
          z.object({
            varieties: z.array(
              z
                .string()
                .check(
                  refersTo('g.variety', scope.leadsTo('grows', '../task')),
                ),
            ),
          }),
        ),
      }),
    ),
    look: z.tuple([
      z.string().check(refersTo('g.plant', 'global')),
      z
        .string()
        .check(refersTo('g.variety', scope.owner(scope.previous('nothing')))),
      z
        .string()
        .check(
          refersTo('g.shade', scope.leadsTo('type', scope.previous('nothing'))),
        ),
    ]),
  }),
});

const garden = defineEngine({
  files: [plants, beds, model, plan],
  kinds: {
    'g.plant': { label: 'plant' },
    'g.variety': {
      label: 'variety',
      scope: 'owner',
      typeOf: { kinds: ['g.colour'] },
    },
    'g.colour': { label: 'colour' },
    'g.shade': { label: 'shade', scope: 'owner' },
    'g.size': { label: 'size' },
    'g.bedClass': { label: 'bed class' },
    'g.task': { label: 'task', rename: false },
    'toy.thing': { label: 'thing' },
    'toy.part': { label: 'part', scope: 'owner' },
  },
  messages: {
    'g.noTask': '{name} is no task of the model (it has {candidates})',
  },
});

const PLANTS = `plants:
  - name: rose
    varieties: [red, white]
  - name: fern
    varieties: []
colours:
  - name: Colour
    shades: [light, dark]
sizes:
  small: 1
  big: 2.5
`;
const BEDS = '<Bed><Bed/><Bed>soil</Bed></Bed>';
const PLAN = `{
  "tasks": [
    { "task": "T1", "beds": [{ "varieties": ["red", "pink"] }] },
    { "task": "T9", "beds": [] }
  ],
  "look": ["rose", "white", "dark"]
}`;
const MODEL = {
  nodes: new Map([
    [
      'T1',
      {
        iStarId: 'E1',
        id: 'T1',
        kind: 'task',
        name: 'rose the beds',
        notation: null,
        properties: { Things: 'thing spade { part blade }' },
        children: [],
      },
    ],
    [
      'G1',
      {
        iStarId: 'E2',
        id: 'G1',
        kind: 'goal',
        name: 'a garden',
        notation: null,
        properties: {},
        children: [],
      },
    ],
  ]),
  roots: ['G1'],
};
const documents: PoolDocument[] = [
  { id: 'plants.yaml', kind: 'plants', text: PLANTS },
  { id: 'beds.xml', kind: 'beds', text: BEDS },
  { id: 'model', kind: 'model', value: MODEL },
  { id: 'plan.json', kind: 'plan', text: PLAN },
];

const offset = (text: string, word: string, nth = 0) => {
  let from = -1;
  for (let i = 0; i <= nth; i += 1) from = text.indexOf(word, from + 1);
  return from;
};

describe('the pool’s protocol, form by form', () => {
  const index = createPool(poolOf(garden)).update(documents);
  const definition = (kind: string, name: string) =>
    index.definitionsOf(kind).find((d) => d.name === name);

  it('reads YAML with positions, and a record’s keys typed by what they are written as', () => {
    expect(definition('g.plant', 'rose')!.location).to.deep.equal({
      document: 'plants.yaml',
      from: offset(PLANTS, 'rose'),
      to: offset(PLANTS, 'rose') + 4,
    });
    expect(
      index.definitionsOf('g.size').map((d) => [d.name, d.type]),
    ).to.deep.equal([
      ['small', 'Integer'],
      ['big', 'Real'],
    ]);
    // a member: its owner is the sibling `name`'s definition
    expect(definition('g.variety', 'red')!.owner).to.equal('g.plant:rose');
  });

  it('defines an XML class at its first tag, and refers to it from every other', () => {
    expect(
      index.definitionsOf('g.bedClass').map((d) => d.location.from),
    ).to.deep.equal([1]);
    const bed = definition('g.bedClass', 'Bed')!;
    // the other tags, closing ones too (a rename renames both)
    expect(
      index
        .referencesTo(bed.id)
        .map((r) => r.location.from)
        .sort((a, b) => a - b),
    ).to.deep.equal([1, 2, 3, 4].map((nth) => offset(BEDS, 'Bed', nth)));
  });

  it('reads the goal model by field, and the Langium values written in it', () => {
    expect(definition('g.task', 'T1')!.location).to.deep.equal({
      document: 'model:T1:id',
      from: 0,
      to: 2,
    });
    // the goal isn't the schema's: left out
    expect(definition('g.task', 'G1')).to.equal(undefined);
    // the name's first word refers to a plant
    expect(
      definitionAt(index, { document: 'model:T1:name', offset: 1 }),
    ).to.deep.equal(definition('g.plant', 'rose')!.location);
    // a thing in Things: at its offsets in the field, owned by the task (`^id`)
    const spade = definition('toy.thing', 'spade')!;
    expect(spade).to.include({ owner: 'g.task:T1' });
    expect(spade.location).to.deep.equal({
      document: 'model:T1:Things',
      from: 6,
      to: 11,
    });
    // a part is its thing's (Langium's lexical owner)
    expect(definition('toy.part', 'blade')!.owner).to.equal(spade.id);
  });

  it('looks up through what leads where (`../task` grows a plant), a type, and the item before', () => {
    const at = (word: string, nth = 0) =>
      definitionAt(index, {
        document: 'plan.json',
        offset: offset(PLAN, word, nth),
      });
    expect(at('red')).to.deep.equal(definition('g.variety', 'red')!.location);
    expect(at('white')).to.deep.equal(
      definition('g.variety', 'white')!.location,
    );
    expect(at('dark')).to.deep.equal(definition('g.shade', 'dark')!.location);
  });

  it('completes an empty name through its scope (`../task` grows rose)', () => {
    const typed = PLAN.replace('"pink"', '""');
    const pool = createPool(poolOf(garden)).update(
      documents.map((d) => (d.id === 'plan.json' ? { ...d, text: typed } : d)),
    );
    expect(
      completionsAt(pool, {
        document: 'plan.json',
        offset: typed.indexOf('""') + 1,
      }).map((c) => c.label),
    ).to.deep.equal(['red', 'white']);
  });

  it('says what resolves to nothing, in the pool’s words or the engine’s', () => {
    expect(
      index.diagnostics.map((d) => [d.check, d.severity, d.message]),
    ).to.deep.equal([
      ['unresolved-reference', 'warning', 'pink is no variety of rose'],
      ['g.noTask', 'error', 'T9 is no task of the model (it has T1)'],
    ]);
  });

  it('gives checks typed definitions, what they lead to and their types', () => {
    let seen: { leadsTo: string[]; type?: string; parent: unknown } | undefined;
    const probe = defineEngine({
      ...garden,
      checks: [
        (pool) => {
          const task = pool.find('g.task', 'T1')!;
          const red = pool.find(
            'g.variety',
            'red',
            pool.find('g.plant', 'rose'),
          )!;
          seen = {
            leadsTo: pool.leadsTo('grows', task).map((d) => d.name),
            type: pool.typeOf(red)?.name,
            parent: red.parent,
          };
          return [];
        },
      ],
    });
    createPool(poolOf(probe)).update(documents);
    expect(seen).to.deep.equal({
      leadsTo: ['rose'],
      type: 'Colour',
      parent: ['red', 'white'],
    });
  });

  it('owns only what the grammar defines lexically: a first use annotated on a cross-reference is global', () => {
    // `part a of box`: box, a thing, is defined where first written (not
    // as a's member); a plain `thing box` wins over every first use
    const kinds = defineEngine({
      files: [
        defineFile({
          kind: 'things',
          parser: langium(toyLanguage, {
            kinds: { Thing: 'toy.thing', Part: 'toy.part' },
            annotate: {
              Part: { kind: [defines('toy.thing', { firstUse: true })] },
            },
          }),
        }),
      ],
      kinds: {
        'toy.thing': { label: 'thing' },
        'toy.part': { label: 'part', scope: 'owner' },
      },
    });
    const things = (text: string) => {
      const pool = createPool(poolOf(kinds)).update([
        { id: 'a.toy', kind: 'things', text },
      ]);
      return {
        defined: pool
          .definitionsOf('toy.thing')
          .map((d) => [d.name, d.owner, d.location.from]),
        diagnostics: pool.diagnostics.map((d) => d.check),
      };
    };
    const byUse = 'thing a { part p of box } thing b { part q of box }';
    expect(things(byUse)).to.deep.equal({
      defined: [
        ['a', undefined, 6],
        ['b', undefined, 32],
        ['box', undefined, offset(byUse, 'box')],
      ],
      diagnostics: [],
    });
    const declared = `${byUse} thing box`;
    expect(
      things(declared).defined.map(([name, , from]) => [name, from]),
    ).to.deep.equal([
      ['a', 6],
      ['b', 32],
      ['box', offset(declared, 'box', 2)],
    ]);
  });

  it('makes an ambiguous reference an error, and still resolves it to the first kind', () => {
    // a pick is a plant or a colour: `rose` is both
    const picks = defineEngine({
      files: [
        defineFile({
          kind: 'picks',
          parser: json,
          schema: z.object({
            plants: z.array(z.string().check(defines('p.plant'))),
            colours: z.array(z.string().check(defines('p.colour'))),
            picks: z.array(
              z.string().check(refersTo(['p.plant', 'p.colour'], 'global')),
            ),
          }),
        }),
      ],
      kinds: {
        'p.plant': { label: 'plant' },
        'p.colour': { label: 'colour' },
      },
    });
    const text =
      '{ "plants": ["rose", "fern"], "colours": ["rose", "blue"], "picks": ["rose", "fern", "blue"] }';
    const pool = createPool(poolOf(picks)).update([
      { id: 'picks.json', kind: 'picks', text },
    ]);
    const rose = offset(text, 'rose', 2);
    expect(
      pool.diagnostics.map((d) => [d.check, d.severity, d.message, d.from]),
    ).to.deep.equal([
      [
        'ambiguous-reference',
        'error',
        'rose is both a plant and a colour',
        rose,
      ],
    ]);
    // while it is fixed, go-to-definition still goes to the plant
    expect(
      definitionAt(pool, { document: 'picks.json', offset: rose }),
    ).to.deep.equal({
      document: 'picks.json',
      from: offset(text, 'rose'),
      to: offset(text, 'rose') + 4,
    });
  });

  it('refuses a kind the engine doesn’t declare', () => {
    expect(() => poolOf(defineEngine({ files: [plan], kinds: {} }))).to.throw(
      /plan names g.task, which the engine's kinds don't declare/,
    );
  });
});

describe('the goal model’s tree', () => {
  // G1 refines G2 and G3, each with its own T1 (keyed G2/T1 and G3/T1, as
  // a dialect scoping ids by their goal keys them); G2's bracket names a T2
  // it hasn't, and G1's lists G2 twice
  const node = (
    id: string,
    kind: string,
    parent: string | null,
    children: string[],
    notation: string | null,
    order: string[],
  ) => ({
    id,
    kind,
    name: id,
    parent,
    children,
    notation,
    order,
    properties: {},
  });
  const TREE = {
    nodes: new Map([
      [
        'G1',
        node('G1', 'goal', null, ['G2', 'G3'], 'G2;G2 ; G3', ['G2', 'G3']),
      ],
      ['G2', node('G2', 'goal', 'G1', ['G2/T1'], 'T1;T2', ['T1', 'T2'])],
      ['G3', node('G3', 'goal', 'G1', ['G3/T1'], 'T1', ['T1'])],
      ['G2/T1', node('T1', 'task', 'G2', [], null, [])],
      ['G3/T1', node('T1', 'task', 'G3', [], null, [])],
    ]),
    roots: ['G1'],
  };
  const engine = (unresolved?: false) => {
    let values: unknown;
    const declared = defineEngine({
      files: [
        defineFile({
          kind: 'model',
          parser: goalModel({
            children: {
              kind: 't.child',
              ...(unresolved === false && { unresolved }),
            },
          }),
          // `z.object` strips what it doesn't name: the tree is kept anyway
          schema: z.union([
            z.object({
              kind: z.literal('goal'),
              id: z.string().check(defines('t.goal')),
            }),
            z.object({
              kind: z.literal('task'),
              id: z.string().check(defines('t.task')),
            }),
          ]),
        }),
      ],
      kinds: {
        't.goal': { label: 'goal', rename: false },
        't.task': { label: 'task', rename: false },
        't.child': { label: 'child', scope: 'owner', rename: false },
      },
      checks: [
        (pool) => {
          values = pool.values('model')[0]?.value;
          return [];
        },
      ],
    });
    const pool = createPool(poolOf(declared)).update([
      { id: 'model', kind: 'model', value: TREE },
    ]);
    return { pool, values };
  };
  const { pool, values } = engine();

  it('keys a repeated id by its goal, its name as written', () => {
    expect(
      pool.definitionsOf('t.task').map((d) => [d.id, d.name]),
    ).to.deep.equal([
      ['t.task:G2/T1', 'T1'],
      ['t.task:G3/T1', 'T1'],
    ]);
  });

  it('gives each element its parent, children and notation', () => {
    expect(
      (
        values as {
          key: string;
          parent: unknown;
          children: unknown;
          notation: unknown;
        }[]
      ).map(({ key, parent, children, notation }) => ({
        key,
        parent,
        children,
        notation,
      }))[1],
    ).to.deep.equal({
      key: 'G2',
      parent: 'G1',
      children: ['G2/T1'],
      notation: 'T1;T2',
    });
  });

  it('resolves a notation’s id among the element’s own children', () => {
    expect(
      definitionAt(pool, { document: 'model:G3:notation', offset: 1 }),
    ).to.deep.equal({ document: 'model:G3/T1:id', from: 0, to: 2 });
    // a repeated id is a whole token, once: G3 after the second G2
    expect(
      definitionAt(pool, {
        document: 'model:G1:notation',
        offset: 'G2;G2 ; G3'.indexOf('G3'),
      }),
    ).to.deep.equal({ document: 'model:G3:id', from: 0, to: 2 });
    // a child's id is first the child's own definition
    expect(
      symbolAt(pool, { document: 'model:G2/T1:id', offset: 1 })?.definition
        ?.kind,
    ).to.equal('t.task');
    expect(
      completionsAt(pool, { document: 'model:G2:notation', offset: 1 }).map(
        (c) => c.label,
      ),
    ).to.deep.equal(['T1']);
  });

  it('says a bracket’s id that is no child, unless the engine does', () => {
    expect(
      pool.diagnostics.map((d) => [d.document, d.from, d.to, d.message]),
    ).to.deep.equal([['model:G2:notation', 3, 5, 'T2 is no child of G2']]);
    expect(engine(false).pool.diagnostics).to.deep.equal([]);
  });
});
