/**
 * The pool's protocol (#82), form by form: YAML and XML files, a record's
 * keys, first uses, paths up and out (`../`, `^`, `previous`), links and
 * `through`, types, the goal model with values written in a Langium
 * language, and the engine's messages for what resolves to nothing.
 */
import { expect } from 'chai';
import * as z from 'zod/mini';
import {
  completionsAt,
  createPool,
  definitionAt,
  type PoolDocument,
} from '../../src/engines/definitionPool';
import {
  defineEngine,
  defineFile,
  defines,
  goalModel,
  json,
  langium,
  link,
  poolOf,
  refersTo,
  scope,
  written,
  xml,
  yaml,
  type Definition,
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
  parser: goalModel,
  schema: z.object({
    key: z.string(),
    id: z.string().check(defines('g.task')),
    kind: z.literal('task'),
    name: z
      .string()
      .check(
        refersTo('g.plant', undefined, { name: firstWord }),
        link('grows'),
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
          refersTo('g.task', undefined, {
            unresolved: { severity: 'error', message: 'g.noTask' },
          }),
        ),
        beds: z.array(
          z.object({
            varieties: z.array(
              z
                .string()
                .check(
                  refersTo('g.variety', scope.through('grows', '../task')),
                ),
            ),
          }),
        ),
      }),
    ),
    look: z.tuple([
      z.string().check(refersTo('g.plant')),
      z
        .string()
        .check(refersTo('g.variety', scope.owner(scope.previous('nothing')))),
      z
        .string()
        .check(
          refersTo('g.shade', scope.through('type', scope.previous('nothing'))),
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
      'E1',
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
      'E2',
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
  roots: ['E2'],
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
      document: 'model:E1:id',
      from: 0,
      to: 2,
    });
    // the goal isn't the schema's: left out
    expect(definition('g.task', 'G1')).to.equal(undefined);
    // the name's first word refers to a plant
    expect(
      definitionAt(index, { document: 'model:E1:name', offset: 1 }),
    ).to.deep.equal(definition('g.plant', 'rose')!.location);
    // a thing in Things: at its offsets in the field, owned by the task (`^id`)
    const spade = definition('toy.thing', 'spade')!;
    expect(spade).to.include({ owner: 'g.task:T1' });
    expect(spade.location).to.deep.equal({
      document: 'model:E1:Things',
      from: 6,
      to: 11,
    });
    // a part is its thing's (Langium's lexical owner)
    expect(definition('toy.part', 'blade')!.owner).to.equal(spade.id);
  });

  it('looks up through a link (`../task` grows a plant), a type, and the item before', () => {
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

  it('gives checks typed definitions, their links and their types', () => {
    let seen: { links: string[]; type?: string; parent: unknown } | undefined;
    const probe = defineEngine({
      ...garden,
      checks: [
        (pool) => {
          const task = pool.find('g.task', 'T1')!;
          const red: Definition = pool.find(
            'g.variety',
            'red',
            pool.find('g.plant', 'rose'),
          )!;
          seen = {
            links: pool.links('grows', task).map((d) => d.name),
            type: pool.typeOf(red)?.name,
            parent: red.parent,
          };
          return [];
        },
      ],
    });
    createPool(poolOf(probe)).update(documents);
    expect(seen).to.deep.equal({
      links: ['rose'],
      type: 'Colour',
      parent: ['red', 'white'],
    });
  });

  it('refuses a kind the engine doesn’t declare', () => {
    expect(() => poolOf(defineEngine({ files: [plan], kinds: {} }))).to.throw(
      /plan names g.task, which the engine's kinds don't declare/,
    );
  });
});
