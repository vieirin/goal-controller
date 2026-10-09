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
    // without ids, every property is on the element line: there are no property lines
    expect(bad(noIds)).to.throw(
      /lines without ids write every property on the element line/,
    );
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
