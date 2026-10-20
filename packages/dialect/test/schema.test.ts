/** What defineDialect and defineExtension check, and that they freeze (src/schema.ts). */
import { expect } from 'chai';
import {
  defineDialect,
  defineExtension,
  hasIds,
  keyedKey,
  keyedKeyOf,
  probabilityOf,
  propertyOf,
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

  it('keys a property by a project resource it declares only (#190)', () => {
    const keyed = (keyedBy: string) =>
      bad(
        (d) =>
          ({
            ...d,
            projectResources: {
              expert: {
                label: 'Experts',
                format: 'json',
                path: 'experts.json',
              },
            },
            properties: {
              ...d.properties,
              quality: [
                {
                  key: 'Probability',
                  value: { type: 'distribution', point: true },
                  keyed: keyedBy,
                  help: '',
                },
              ],
            },
          }) as AnyDialect,
      );
    expect(keyed('expert')).not.to.throw();
    expect(keyed('judge')).to.throw(
      /quality.Probability is keyed by unknown project resource judge/,
    );
    const dialect = {
      properties: {
        quality: [
          {
            key: 'Probability',
            value: { type: 'probability' },
            keyed: 'expert',
            help: '',
          },
          { key: 'Weight', value: { type: 'int' }, help: '' },
        ],
      },
    } as unknown as AnyDialect;
    // its names' keys on disk are it; another property's aren't
    expect(propertyOf(dialect, 'quality', 'Probability[e1]')?.key).to.equal(
      'Probability',
    );
    expect(propertyOf(dialect, 'quality', 'Weight[e1]')).to.equal(undefined);
    expect(keyedKeyOf('Probability[e1]')).to.deep.equal({
      key: 'Probability',
      name: 'e1',
    });
    expect(keyedKeyOf('Probability')).to.equal(null);
    expect(keyedKey('Probability', 'e2')).to.equal('Probability[e2]');
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
      /quality.actor: the key an actor's properties are written with/,
    );
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

describe('defineDialect: frameworks besides iStar 2.0 (#171)', () => {
  const kaos = {
    id: 'kaos-test',
    name: 'KAOS',
    framework: 'kaos',
    elements: {
      'kaos.BehavioralGoal': { prefix: 'G', fill: '#fff' },
      'kaos.Softgoal': { prefix: 'G', fill: '#fff' },
      'kaos.Agent': { prefix: 'A', fill: '#fff' },
      'kaos.DomainProperty': { prefix: 'DP', fill: '#fff' },
    },
    defaultFill: '#fff',
    properties: {
      'kaos.BehavioralGoal': [
        { key: 'FitCriterion', value: { type: 'text' }, help: 'how to tell' },
      ],
      // the hub its n-ary refinement generates: no line, but properties
      'kaos.RefinementLinkHub': [
        { key: 'Tactic', value: { type: 'text' }, help: 'which tactic' },
      ],
    },
    links: {
      'kaos.Conflict': [
        {
          key: 'BoundaryCondition',
          value: { type: 'text' },
          help: 'when they conflict',
        },
      ],
    },
    propertyLineOrder: ['FitCriterion'],
    indent: '  ',
    problems: {
      notAChild: { severity: 'error', message: '' },
      missingFromNotation: { severity: 'error', message: '' },
      relationMismatch: { severity: 'error', message: '' },
      notInDiagram: { severity: 'error', message: '' },
    },
  } as const satisfies AnyDialect;
  const bad = (change: (d: AnyDialect) => AnyDialect) => () =>
    defineDialect(change(structuredClone(kaos) as unknown as AnyDialect));

  it('reads its root kinds, shared prefixes and the generated hub', () => {
    const defined = defineDialect(kaos);
    expect(defined.framework).to.equal('kaos');
    expect(Object.isFrozen(defined.elements)).to.equal(true);
    same<
      Same<PropertyKeyOf<typeof kaos, 'kaos.RefinementLinkHub'>, 'Tactic'>
    >();
  });

  it('defaults to iStar 2.0, whose rules still hold', () => {
    expect((toy as AnyDialect).framework).to.equal(undefined);
    expect(
      defineDialect({
        ...(structuredClone(toy) as AnyDialect),
        framework: 'istar-2.0',
      }).framework,
    ).to.equal('istar-2.0');
    expect(bad((d) => ({ ...d, framework: 'istar-2.0' }))).to.throw(
      /kaos\.BehavioralGoal is not a node kind of its extension/,
    );
  });

  it('rejects another framework, iStar kinds, and kinds its root does not have', () => {
    expect(bad((d) => ({ ...d, framework: 'tropos' as 'kaos' }))).to.throw(
      /unknown framework tropos/,
    );
    expect(
      bad((d) => ({
        ...d,
        elements: { ...d.elements, goal: { prefix: 'G', fill: '#fff' } },
      })),
    ).to.throw(/elements: goal is not a node kind of kaos/);
    expect(
      bad((d) => ({
        ...d,
        elements: { ...d.elements, 'nfr.Claim': { prefix: 'C', fill: '#fff' } },
      })),
    ).to.throw(/elements: nfr\.Claim is not a node kind of kaos/);
    expect(
      bad((d) => ({ ...d, properties: { ...d.properties, task: [] } })),
    ).to.throw(/properties: task is not a node kind of kaos/);
    expect(
      bad((d) => ({ ...d, links: { 'istar.ContributionLink': [] } })),
    ).to.throw(
      /links: unknown link kind istar\.ContributionLink \(not one of kaos's\)/,
    );
    expect(bad((d) => ({ ...d, framework: 'nfr' }))).to.throw(
      /elements: kaos\.BehavioralGoal is not a node kind of nfr/,
    );
  });

  it("rejects iStar's actors and notation, and prefixes no line can start with", () => {
    expect(bad((d) => ({ ...d, actors: [] }))).to.throw(
      /actors: a kaos dialect has none/,
    );
    expect(
      bad((d) => ({ ...d, notation: toy.notation }) as AnyDialect),
    ).to.throw(/notation: a kaos dialect has none/);
    for (const prefix of ['X', 'W', 'ABC', 'g'])
      expect(
        bad((d) => ({
          ...d,
          elements: {
            ...d.elements,
            'kaos.Agent': { prefix, fill: '#fff' },
          },
        })),
        prefix,
      ).to.throw(/kaos\.Agent: its prefix is one or two capitals/);
    expect(
      bad((d) => ({
        ...d,
        elements: { ...d.elements, 'kaos.Agent': { fill: '#fff' } },
      })),
    ).to.throw(/either every element has an id prefix, or none has/);
  });
});

describe('defineDialect: a framework dialect’s extension, link and leg properties (#181)', () => {
  /** a KAOS extension: a node kind, and an n-ary link joining goals to it */
  const voting = {
    name: 'vote',
    label: 'Voting',
    elements: [{ kind: 'vote.Ballot', category: 'node' }],
    links: [
      {
        kind: 'vote.TallyLink',
        arity: 'n',
        rules: { sources: ['kaos.BehavioralGoal'], targets: ['vote.Ballot'] },
      },
      {
        kind: 'vote.CastLink',
        rules: { sources: ['kaos.Agent'], targets: ['vote.Ballot'] },
      },
    ],
    groupers: {},
    stereotypes: [],
    taggedValues: [],
    defaultTags: [],
  } as const satisfies ExtensionDefinition;
  const voted = {
    id: 'voted',
    name: 'Voted KAOS',
    framework: 'kaos',
    extension: voting,
    elements: {
      'kaos.BehavioralGoal': { prefix: 'G', fill: '#fff' },
      'vote.Ballot': { prefix: 'B', fill: '#fff' },
    },
    defaultFill: '#fff',
    properties: {
      'kaos.BehavioralGoal': [
        {
          key: 'Anchor',
          value: { type: 'reference', kinds: ['vote.Ballot'] },
          help: 'its ballot',
        },
      ],
      'vote.Ballot': [
        {
          key: 'Spec',
          value: { type: 'formula', language: 'ltl' },
          help: 'when it closes',
        },
      ],
      // the hub of its n-ary link
      'vote.TallyLinkHub': [{ key: 'Rule', value: { type: 'text' }, help: '' }],
    },
    links: {
      // a leg of the root's n-ary refinement, and one of its own
      'kaos.RefinementLinkStart': [
        { key: 'P', value: { type: 'probability' }, help: 'its case' },
      ],
      'vote.TallyLinkStart': [
        { key: 'Weight', value: { type: 'probability' }, help: '' },
      ],
      'vote.CastLink': [{ key: 'At', value: { type: 'text' }, help: '' }],
    },
    propertyLineOrder: ['Anchor', 'Spec'],
    indent: '  ',
    problems: {
      notAChild: { severity: 'error', message: '' },
      missingFromNotation: { severity: 'error', message: '' },
      relationMismatch: { severity: 'error', message: '' },
      notInDiagram: { severity: 'error', message: '' },
    },
  } as const satisfies AnyDialect;
  const bad = (change: (d: AnyDialect) => AnyDialect) => () =>
    defineDialect(change(structuredClone(voted) as unknown as AnyDialect));

  it('extends its root with kinds, typed links, an n-ary link’s hub and legs', () => {
    const defined = defineDialect(voted);
    expect(defined.extension!.links[0]!.arity).to.equal('n');
    same<Same<PropertyKeyOf<typeof voted, 'vote.TallyLinkHub'>, 'Rule'>>();
    // an iStar dialect may declare an n-ary link too
    expect(() =>
      defineExtension({
        ...voting,
        links: [
          {
            kind: 'vote.TallyLink',
            arity: 'n',
            rules: { sources: ['istar.Goal'], targets: ['vote.Ballot'] },
          },
        ],
      }),
    ).not.to.throw();
  });

  it('lets its extension’s links refine and be leaf targets, as its root’s are', () => {
    expect(
      bad((d) => ({
        ...d,
        refinements: { 'vote.TallyLink': 'and' },
        leafTargets: ['vote.CastLink'],
      })),
    ).not.to.throw();
    expect(bad((d) => ({ ...d, leafTargets: ['vote.Urn'] }))).to.throw(
      /leafTargets: vote\.Urn is not a link kind of kaos/,
    );
  });

  it('rejects an extension in its root’s namespace, or naming iStar’s kinds', () => {
    expect(
      bad((d) => ({
        ...d,
        extension: {
          ...voting,
          name: 'kaos',
          elements: [{ kind: 'kaos.Ballot', category: 'node' }],
          links: [],
        },
      })),
    ).to.throw(/extension: kaos: its namespace is kaos's root's/);
    expect(
      bad((d) => ({
        ...d,
        extension: {
          ...voting,
          elements: [{ kind: 'vote.Ballot', behavesLike: 'istar.Task' }],
        },
      })),
    ).to.throw(
      /extension: vote: vote\.Ballot behaves like unknown istar\.Task/,
    );
    expect(
      bad((d) => ({
        ...d,
        extension: {
          ...voting,
          links: [
            {
              kind: 'vote.CastLink',
              rules: { sources: ['istar.Actor'], targets: ['vote.Ballot'] },
            },
          ],
        },
      })),
    ).to.throw(/extension: vote: vote\.CastLink joins unknown istar\.Actor/);
  });

  it('names its generated kinds only for n-ary links, and references known kinds', () => {
    expect(
      bad((d) => ({
        ...d,
        links: { ...d.links, 'vote.CastLinkStart': [] },
      })),
    ).to.throw(
      /links: unknown link kind vote\.CastLinkStart \(not one of kaos's\)/,
    );
    expect(
      bad((d) => ({
        ...d,
        properties: { ...d.properties, 'vote.CastLinkHub': [] },
      })),
    ).to.throw(/properties: vote\.CastLinkHub is not a node kind of kaos/);
    expect(
      bad((d) => ({
        ...d,
        properties: {
          ...d.properties,
          'kaos.BehavioralGoal': [
            {
              key: 'Anchor',
              value: { type: 'reference', kinds: ['vote.Urn'] },
              help: '',
            },
          ],
        },
      })),
    ).to.throw(/kaos\.BehavioralGoal\.Anchor names unknown kind vote\.Urn/);
  });
});

describe('probabilityOf (#181)', () => {
  it('reads a decimal or a percentage in [0, 1]', () => {
    for (const [text, value] of [
      ['0.8', 0.8],
      ['.8', 0.8],
      ['80%', 0.8],
      ['20.00%', 0.2],
      ['1', 1],
      ['0', 0],
      [' 95 % ', 0.95],
    ] as const)
      expect(probabilityOf(text), text).to.be.closeTo(value, 1e-12);
    for (const text of ['', '1.5', '120%', '-0.1', 'high', '0.8.1', '%'])
      expect(probabilityOf(text), text).to.equal(null);
  });
});

describe('defineDialect: a framework’s refinements and link labels (#171)', () => {
  const nfr = {
    id: 'nfr-test',
    name: 'NFR',
    framework: 'nfr',
    elements: { 'nfr.NFR': { prefix: 'S', fill: '#fff' } },
    defaultFill: '#fff',
    properties: {},
    propertyLineOrder: [],
    indent: '  ',
    refinements: {
      'nfr.AndRefinementLink': 'and',
      'nfr.OrRefinementLink': 'or',
    },
    linkLabels: { 'nfr.ContributionLink': ['+', '-'] },
    problems: {
      notAChild: { severity: 'error', message: '' },
      missingFromNotation: { severity: 'error', message: '' },
      relationMismatch: { severity: 'error', message: '' },
      notInDiagram: { severity: 'error', message: '' },
    },
  } as const satisfies AnyDialect;
  const bad = (change: (d: AnyDialect) => AnyDialect) => () =>
    defineDialect(change(structuredClone(nfr) as unknown as AnyDialect));

  it('reads the link kinds that refine, and the labels a link kind takes', () => {
    const defined = defineDialect(nfr);
    expect(defined.refinements).to.deep.equal(nfr.refinements);
    expect(defined.linkLabels).to.deep.equal(nfr.linkLabels);
  });

  it('rejects them in iStar, on link kinds its root does not have, and bad values', () => {
    expect(
      defineDialect.bind(null, {
        ...(structuredClone(toy) as AnyDialect),
        refinements: { 'nfr.AndRefinementLink': 'and' },
      }),
    ).to.throw(/refinements: iStar's links are its own/);
    expect(
      bad((d) => ({ ...d, refinements: { 'kaos.RefinementLink': 'and' } })),
    ).to.throw(/refinements: kaos\.RefinementLink is not a link kind of nfr/);
    expect(bad((d) => ({ ...d, linkLabels: { 'nfr.Claim': ['+'] } }))).to.throw(
      /linkLabels: nfr\.Claim is not a link kind of nfr/,
    );
    expect(
      bad(
        (d) =>
          ({
            ...d,
            refinements: { 'nfr.AndRefinementLink': 'xor' },
          }) as unknown as AnyDialect,
      ),
    ).to.throw(/is an and or an or, not xor/);
    for (const labels of [[], ['+', '+']])
      expect(
        bad((d) => ({ ...d, linkLabels: { 'nfr.ContributionLink': labels } })),
      ).to.throw(/labels are some, each once/);
  });

  it('names the link kinds whose target is a leaf, of its root (#181)', () => {
    expect(
      bad((d) => ({ ...d, leafTargets: ['nfr.ContributionLink'] })),
    ).not.to.throw();
    expect(
      defineDialect.bind(null, {
        ...(structuredClone(toy) as AnyDialect),
        leafTargets: ['istar.ContributionLink'],
      }),
    ).to.throw(/leafTargets: iStar's links are its own/);
    expect(bad((d) => ({ ...d, leafTargets: ['nfr.Claim'] }))).to.throw(
      /leafTargets: nfr\.Claim is not a link kind of nfr/,
    );
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
