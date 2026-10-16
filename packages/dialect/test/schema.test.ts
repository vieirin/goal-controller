/** What defineDialect and defineExtension check, and that they freeze (src/schema.ts). */
import { expect } from 'chai';
import {
  defineDialect,
  defineExtension,
  hasIds,
  type AnyDialect,
  type CheckNameOf,
  type ConstructOf,
  type ExtensionDefinition,
  type ProjectResourceKindOf,
  type PropertyKeyOf,
} from '../src';
import { toy, toyDialect } from './support/toy';

type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const same = <T extends true>(): T => true as T;

describe('defineDialect', () => {
  const bad = (change: (d: AnyDialect) => AnyDialect) => () =>
    defineDialect(change(structuredClone(toy) as AnyDialect));

  it('freezes the definition', () => {
    expect(Object.isFrozen(toy.notation.operators)).to.equal(true);
    expect(() => {
      (toy.notation.operators as unknown as unknown[]).push(1);
    }).to.throw();
  });

  it('reads its names at the type level', () => {
    same<Same<ConstructOf<typeof toy>, 'sequence' | 'fallback' | 'any'>>();
    same<
      Same<CheckNameOf<typeof toy>, 'toy.goal.deadline' | 'toy.resource.bounds'>
    >();
    same<
      Same<
        PropertyKeyOf<typeof toy, 'goal'>,
        'priority' | 'deadline' | 'hidden'
      >
    >();
  });

  it('rejects constructs it does not declare', () => {
    expect(
      bad((d) => ({
        ...d,
        notation: {
          ...d.notation!,
          operators: { ...d.notation!.operators, '^': 'nope' },
        },
      })),
    ).to.throw(/toy: operator \^: unknown construct nope/);
    expect(
      bad((d) => ({
        ...d,
        notation: { ...d.notation!, standalone: { '#': 'nope' } },
      })),
    ).to.throw(/toy: standalone #: unknown construct nope/);
    expect(
      bad((d) => ({
        ...d,
        notation: {
          ...d.notation!,
          operators: { ';': 'sequence', '|': 'fallback' },
        },
      })),
    ).to.throw(/toy: modifier retry: no operator means it/);
    expect(
      bad((d) => ({
        ...d,
        notation: {
          ...d.notation!,
          defaultConstruct: { and: 'sequence', or: 'nope' },
        },
      })),
    ).to.throw(/unknown default construct nope/);
  });

  it('rejects keys and conditions it does not declare', () => {
    expect(
      bad((d) => ({
        ...d,
        properties: {
          ...d.properties,
          quality: [
            {
              key: 'x',
              value: { type: 'int' },
              applies: { when: { key: 'y', equals: '1' } },
              help: '',
            },
          ],
        },
      })),
    ).to.throw(/quality.x depends on unknown y/);
    expect(
      bad((d) => ({
        ...d,
        properties: {
          ...d.properties,
          quality: [
            { key: 'x', value: { type: 'int' }, help: '' },
            { key: 'x', value: { type: 'int' }, help: '' },
          ],
        },
      })),
    ).to.throw(/repeated quality property key/);
    expect(
      bad((d) => ({
        ...d,
        properties: {
          ...d.properties,
          resource: d.properties.resource!.filter(
            (p) => p.key !== 'initialValue',
          ),
        },
      })),
    ).to.throw(/resource line declares unknown initialValue/);
  });

  it('needs the property-line order to list each line key once', () => {
    expect(
      bad((d) => ({ ...d, propertyLineOrder: d.propertyLineOrder.slice(1) })),
    ).to.throw(/propertyLineOrder/);
    expect(
      bad((d) => ({
        ...d,
        propertyLineOrder: [...d.propertyLineOrder, 'robot'],
      })),
    ).to.throw(/propertyLineOrder/);
  });

  it('declares the project resources it reads, and checks where they are kept', () => {
    const world = {
      label: 'World knowledge',
      format: 'xml',
      role: 'knowledge',
      path: 'knowledge/world_db.xml',
      accept: ['.xml'],
    } as const;
    const withResources = (resources: Record<string, unknown>) =>
      bad((d) => ({ ...d, projectResources: resources }) as AnyDialect);
    expect(
      withResources({
        world,
        properties: {
          label: 'Properties',
          format: 'pctl',
          many: true,
          path: 'props/',
        },
      }),
    ).not.to.throw();
    expect(withResources({ world: { ...world, format: 'yaml' } })).to.throw(
      /project resource world: unknown format yaml/,
    );
    expect(
      withResources({ world: { ...world, path: '../world.xml' } }),
    ).to.throw(
      /project resource world: its path is relative to the project, inside it/,
    );
    expect(withResources({ world: { ...world, path: '/world.xml' } })).to.throw(
      /inside it/,
    );
    expect(withResources({ world: { ...world, many: true } })).to.throw(
      /a list of files is kept in a folder/,
    );
    expect(withResources({ world: { ...world, path: 'knowledge/' } })).to.throw(
      /one file is kept at a file path/,
    );
    expect(withResources({ world: { ...world, accept: ['xml'] } })).to.throw(
      /xml is not an extension/,
    );
    const resources = defineDialect({
      ...(structuredClone(toy) as AnyDialect),
      projectResources: { world },
    } as const);
    same<Same<ProjectResourceKindOf<typeof resources>, 'world'>>();
    same<Same<ProjectResourceKindOf<typeof toy>, never>>();
  });

  it('declares its views by kinds, and checks every kind is iStar’s or its extension’s (#162)', () => {
    const withViews = (views: Record<string, unknown>) =>
      bad(
        (d) =>
          ({
            ...d,
            extension: structuredClone(toyDialect),
            views,
          }) as AnyDialect,
      );
    const goals = {
      label: 'Goals',
      kinds: ['istar.Role', 'istar.Goal', 'toyish.Box'],
      links: ['istar.AndRefinementLink', 'toyish.Feeds'],
    };
    expect(
      withViews({ goals, all: { label: 'All', kinds: ['istar.Goal'] } }),
    ).not.to.throw();
    const failures: [Record<string, unknown>, RegExp][] = [
      [{ 'a b': goals }, /view a b: its id is a name/],
      [{ goals: { ...goals, label: '' } }, /view goals: no label/],
      [{ goals: { ...goals, kinds: [] } }, /view goals: shows no kind/],
      [
        { goals: { ...goals, kinds: ['istar.Goal', 'istar.Goal'] } },
        /view goals: a kind twice/,
      ],
      [
        { goals: { ...goals, kinds: ['toyish.Nope'] } },
        /view goals: unknown kind toyish\.Nope/,
      ],
      [
        { goals: { ...goals, kinds: ['istar.AndRefinementLink'] } },
        /unknown kind istar\.AndRefinementLink/,
      ],
      [
        { goals: { ...goals, links: ['istar.Goal'] } },
        /view goals: unknown link kind istar\.Goal/,
      ],
    ];
    for (const [views, message] of failures)
      expect(withViews(views)).to.throw(message);
  });

  it('declares its native files, and checks their extensions, schema, functions and lossy paths (#143)', () => {
    const read = () => ({ model: null, dialectRecord: null, diagnostics: [] });
    const shelf = {
      label: 'Shelf XMI',
      extensions: ['.shelf', '.shelfx'],
      format: 'xmi',
      schema: { kind: 'ecore', path: 'schema/shelf.ecore' },
      read,
      write: () => ({ text: '<shelf/>', diagnostics: [] }),
      canonical: (text: string) => text.trim(),
      lossy: ['actors.*.nodes.*.x', 'display'],
    } as const;
    const withFiles = (files: Record<string, unknown>) =>
      bad((d) => ({ ...d, nativeFiles: files }) as AnyDialect);
    expect(withFiles({ shelf })).not.to.throw();
    const failures: [Record<string, unknown>, RegExp][] = [
      [{ 'a b': shelf }, /native file a b: its id is a name/],
      [{ shelf: { ...shelf, label: '' } }, /native file shelf: no label/],
      [{ shelf: { ...shelf, format: 'yaml' } }, /unknown format yaml/],
      [{ shelf: { ...shelf, extensions: [] } }, /no extension/],
      [
        { shelf: { ...shelf, extensions: ['shelf'] } },
        /shelf is not an extension/,
      ],
      [
        { shelf: { ...shelf, extensions: ['.Shelf'] } },
        /\.Shelf is not an extension/,
      ],
      [
        { shelf: { ...shelf, extensions: ['.json'] } },
        /\.json opens a piStar model/,
      ],
      [
        { shelf: { ...shelf, extensions: ['.txt'] } },
        /\.txt opens a piStar model/,
      ],
      [
        { shelf, other: { ...shelf, extensions: ['.shelfx'] } },
        /native file other: \.shelfx is native file shelf’s too/,
      ],
      [
        { shelf: { ...shelf, schema: { kind: 'dtd', path: 'a.dtd' } } },
        /unknown schema kind dtd/,
      ],
      [
        { shelf: { ...shelf, schema: { kind: 'langium', path: 'a.langium' } } },
        /a langium schema describes text, not xmi/,
      ],
      [
        { shelf: { ...shelf, schema: { kind: 'ecore', path: '../a.ecore' } } },
        /its schema is a file in the engine’s folder/,
      ],
      [{ shelf: { ...shelf, read: undefined } }, /read is a function/],
      [{ shelf: { ...shelf, write: 'yes' } }, /write is a function/],
      [
        {
          shelf: {
            ...shelf,
            language: { id: 'shelf', highlight: () => [] },
          },
        },
        /a language is a text format's, not xmi's/,
      ],
      [
        { shelf: { ...shelf, lossy: ['actors..x'] } },
        /lossy actors\.\.x is not a piStar path/,
      ],
      [{ shelf: { ...shelf, lossy: ['display', 'display'] } }, /lossy repeats/],
    ];
    for (const [files, why] of failures) expect(withFiles(files)).to.throw(why);
    // a text format with its language, a reader only
    expect(
      withFiles({
        notes: {
          label: 'Notes',
          extensions: ['.notes'],
          format: 'text',
          schema: { kind: 'langium', path: 'language/notes.langium' },
          read,
          language: { id: 'notes', highlight: () => [] },
        },
      }),
    ).not.to.throw();
  });
  it('completes from the project resources it declares only', () => {
    const ocl = (candidates: { resource: string; category: string }) =>
      bad(
        (d) =>
          ({
            ...d,
            projectResources: {
              world: { label: 'World', format: 'xml', path: 'world.xml' },
            },
            properties: {
              ...d.properties,
              quality: [
                {
                  key: 'Controls',
                  value: {
                    type: 'ocl',
                    candidates,
                    memberCandidates: candidates,
                  },
                  help: '',
                },
              ],
            },
          }) as AnyDialect,
      );
    expect(ocl({ resource: 'world', category: 'classes' })).not.to.throw();
    expect(ocl({ resource: 'hddl', category: 'tasks' })).to.throw(
      /quality.Controls completes from unknown project resource hddl/,
    );
  });

  it('declares properties on links by link kind, iStar’s or an extension’s (#107)', () => {
    const weight = {
      key: 'weight',
      value: { type: 'int' as const },
      help: 'how much',
    };
    const withLinks = (links: AnyDialect['links']) =>
      bad((d) => ({ ...d, links }) as AnyDialect);
    expect(
      withLinks({
        'istar.ContributionLink': [weight],
        'toy.Trace': [weight],
      }),
    ).not.to.throw();
    expect(withLinks({ 'istar.Contribution': [weight] })).to.throw(
      /links: unknown link kind istar.Contribution/,
    );
    expect(withLinks({ contribution: [weight] })).to.throw(
      /links: unknown link kind contribution/,
    );
    expect(withLinks({ 'istar.ContributionLink': [weight, weight] })).to.throw(
      /repeated istar.ContributionLink property key/,
    );
    expect(
      withLinks({
        'istar.ContributionLink': [
          { ...weight, applies: { when: { key: 'kind', equals: 'x' } } },
        ],
      }),
    ).to.throw(/istar.ContributionLink.weight depends on unknown kind/);
    // `link` is the key a link's properties are written with, in a dialect with links
    const linkKey = (links: AnyDialect['links']) =>
      bad(
        (d) =>
          ({
            ...d,
            links,
            properties: {
              ...d.properties,
              quality: [{ key: 'link', value: { type: 'text' }, help: '' }],
            },
          }) as AnyDialect,
      );
    expect(linkKey(undefined)).not.to.throw();
    expect(linkKey({ 'istar.ContributionLink': [weight] })).to.throw(
      /quality.link: the key a link's properties are written with/,
    );
  });

  it('declares properties on actors, narrowed by actor kind (#107)', () => {
    const importance = {
      key: 'importance',
      value: { type: 'int' as const },
      help: 'how much it matters',
    };
    const withActors = (actors: AnyDialect['actors']) =>
      bad((d) => ({ ...d, actors }) as AnyDialect);
    expect(
      withActors([
        importance,
        { ...importance, key: 'role', kinds: ['istar.Role', 'toy.Team'] },
      ]),
    ).not.to.throw();
    expect(withActors([importance, importance])).to.throw(
      /repeated actor property key/,
    );
    expect(withActors([{ ...importance, kinds: ['istar.Goal'] }])).to.throw(
      /actor.importance: unknown actor kind istar.Goal/,
    );
    // `actor` is the key an actor's properties are written with (#109)
    const actorKey = (actors: AnyDialect['actors']) =>
      bad(
        (d) =>
          ({
            ...d,
            actors,
            properties: {
              ...d.properties,
              quality: [{ key: 'actor', value: { type: 'text' }, help: '' }],
            },
          }) as AnyDialect,
      );
    expect(actorKey(undefined)).not.to.throw();
    expect(actorKey([importance])).to.throw(
      /quality.actor: the key an actor's properties and links are written with/,
    );
    // and its links' (#162): a dialect with links reserves it too
    expect(
      bad(
        (d) =>
          ({
            ...d,
            links: { 'istar.ContributionLink': [importance] },
            properties: {
              ...d.properties,
              quality: [{ key: 'actor', value: { type: 'text' }, help: '' }],
            },
          }) as AnyDialect,
      ),
    ).to.throw(/quality.actor: the key an actor's properties and links/);
  });

  it('has ids on every line or on none', () => {
    expect(hasIds(toy)).to.equal(true);
    expect(
      bad((d) => ({
        ...d,
        elements: { ...d.elements, quality: { fill: '#000' } },
      })),
    ).to.throw(/either every element has an id prefix, or none has/);
    const noIds = (d: AnyDialect): AnyDialect => ({
      ...d,
      notation: undefined,
      elements: Object.fromEntries(
        Object.entries(d.elements).map(([kind, e]) => [
          kind,
          { fill: e!.fill },
        ]),
      ),
    });
    // without ids, its kinds' properties are property lines too
    // (goal-controller#138): the resource's, which declared none, now listed
    const plain = noIds(structuredClone(toy) as AnyDialect);
    expect(bad(noIds)).to.throw(/propertyLineOrder must list each/);
    expect(
      defineDialect({
        ...plain,
        propertyLineOrder: [
          ...toy.propertyLineOrder,
          'type',
          'lowerBound',
          'upperBound',
          'initialValue',
        ],
      }).propertyLineOrder,
    ).to.include('initialValue');
    expect(
      hasIds(
        defineDialect({
          ...noIds(structuredClone(toy) as AnyDialect),
          properties: { goal: [], task: [], resource: [], quality: [] },
          propertyLineOrder: [],
        }),
      ),
    ).to.equal(false);
  });
});

describe('defineExtension', () => {
  const bad = (change: Partial<ExtensionDefinition>) => () =>
    defineExtension({
      ...(structuredClone(toyDialect) as ExtensionDefinition),
      ...change,
    });

  it('freezes the dialect', () => {
    expect(Object.isFrozen(toyDialect.elements[0])).to.equal(true);
  });

  it('rejects kinds outside its namespace', () => {
    expect(
      bad({ elements: [{ kind: 'other.Plan', category: 'node' }] }),
    ).to.throw(/toyish: other.Plan is not in the toyish namespace/);
  });

  it('rejects names it does not declare', () => {
    expect(
      bad({ elements: [{ kind: 'toyish.Plan', behavesLike: 'istar.Nope' }] }),
    ).to.throw(/behaves like unknown istar.Nope/);
    expect(bad({ elements: [{ kind: 'toyish.Plan' }] })).to.throw(
      /needs a category/,
    );
    expect(
      bad({
        links: [
          {
            kind: 'toyish.L',
            rules: { sources: ['toyish.Nope'], targets: ['*'] },
          },
        ],
      }),
    ).to.throw(/joins unknown toyish.Nope/);
    expect(bad({ links: [{ kind: 'toyish.L' }] })).to.throw(
      /needs rules or a kind it behaves like/,
    );
    expect(
      bad({ links: [{ kind: 'toyish.L', behavesLike: 'istar.Nope' }] }),
    ).to.throw(/behaves like unknown istar.Nope/);
    expect(bad({ groupers: { g: ['istar.Nope'] } })).to.throw(
      /grouper g names unknown istar.Nope/,
    );
    expect(bad({ stereotypes: [{ name: 's', appliesTo: ['nope'] }] })).to.throw(
      /s applies to unknown nope/,
    );
  });

  it('knows the kinds of the dialect it extends', () => {
    expect(() =>
      defineExtension(
        {
          ...(structuredClone(toyDialect) as ExtensionDefinition),
          name: 'more',
          elements: [],
          links: [],
          groupers: {},
          stereotypes: [{ name: 'boxy', appliesTo: ['toyish.Box', 'agents'] }],
          taggedValues: [],
        },
        toyDialect as ExtensionDefinition,
      ),
    ).to.not.throw();
  });
});
