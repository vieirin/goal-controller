/** A dialect as data, and the definitions read with it (src/derive/extensions.ts). */
import { expect } from 'chai';
import {
  dialectDefinition,
  extensionCatalog,
  fileLineOf,
  fileShapeOf,
  hasIds,
  istarKindOf,
  kindLabel,
  lineOfFile,
  metamodelExtensionOf,
  profileOf,
  profileProperties,
  shapeOfFile,
  specsFromDefinition,
  withExtension,
  ISTAR_ACTOR_KINDS,
  ISTAR_NODE_KINDS,
  type ExtensionDefinition,
} from '../src';
import { toy, toyDialect } from './support/toy';

const dialect = toyDialect as ExtensionDefinition;

describe('the metamodel extension', () => {
  it('is the dialect without its presentation', () => {
    expect(metamodelExtensionOf(dialect)).to.deep.equal({
      name: 'toyish',
      elements: [
        {
          kind: 'toyish.Plan',
          behavesLike: 'istar.Task',
          pistarType: 'istar.Plan',
        },
        { kind: 'toyish.Box', category: 'node' },
      ],
      links: [
        {
          kind: 'toyish.Feeds',
          rules: { sources: ['toyish.Box'], targets: ['istar.Goal'] },
        },
      ],
    });
  });

  it('keeps a kind’s description (istar-ts#241), presentation still left out', () => {
    const extension: ExtensionDefinition = {
      ...dialect,
      elements: [
        {
          kind: 'toyish.Box',
          category: 'node',
          shape: 'M 0 0 L 10 0 L 10 10 Z',
          textBox: { top: 0.1, right: 0.1, bottom: 0.1, left: 0.1 },
          description: 'A box that holds things.',
        },
      ],
      links: [
        {
          kind: 'toyish.Feeds',
          rules: { sources: ['toyish.Box'], targets: ['istar.Goal'] },
          line: { dash: 'dashed' },
          description: 'Feeds a goal.',
        },
      ],
    };
    expect(metamodelExtensionOf(extension)).to.deep.equal({
      name: 'toyish',
      elements: [
        {
          kind: 'toyish.Box',
          category: 'node',
          description: 'A box that holds things.',
        },
      ],
      links: [
        {
          kind: 'toyish.Feeds',
          rules: { sources: ['toyish.Box'], targets: ['istar.Goal'] },
          description: 'Feeds a goal.',
        },
      ],
    });
  });
});

describe('the metamodel extension: where a node may be (#194)', () => {
  it('carries a kind’s info, which a framework without actors needs (on the paper)', () => {
    const onPaper = {
      canBeInnerElement: false,
      canBeDependum: false,
      canBeOnPaper: true,
    };
    const extension: ExtensionDefinition = {
      ...dialect,
      elements: [{ kind: 'toyish.Box', category: 'node', info: onPaper }],
      links: [],
    };
    expect(metamodelExtensionOf(extension).elements).to.deep.equal([
      { kind: 'toyish.Box', category: 'node', info: onPaper },
    ]);
  });
});

describe('a kind’s shape and line, converted between a dialect’s own and a model’s file-format (#457)', () => {
  // every shape an engine's dialect declares (rg 'shape:' packages/lib/src/engines),
  // round-tripped through a model's file-format shape (istar-ts's `KindShape`) and back
  const SHAPES = [
    'M 2 2 L 78 2 L 78 34 L 2 34 Z', // cgm's context
    'M 4 2 L 96 2 L 96 32 L 50 48 L 4 32 Z', // grl's indicator
    'M 2 10 A 8 8 0 1 0 18 10 A 8 8 0 1 0 2 10 Z M 10 2 L 10 18 M 2 10 L 18 10', // istardt's effect group
    'M 2 2 L 98 2 L 98 38 L 2 38 Z', // tropos4as' artifact
    'M 9.1814481,1.0179789 H 65.503448 L 65.025854,14.532293 72.4491,14.819567 73.29006,4.9 85.2,19.8 73.29006,30.6 72.4491,22.6 65.025854,22.6 65.503448,38.6 H 9.1814481 L 1,19.8 Z', // iStar4RationalAgents' Planning
  ];

  it('is a dialect’s shape (an SVG path string) as a model’s file-format shape (a path), and back unchanged', () => {
    for (const shape of SHAPES) {
      const file = fileShapeOf(shape);
      expect(file).to.deep.equal({ path: shape });
      expect(shapeOfFile(file)).to.equal(shape);
    }
  });

  // every line.dash an engine's dialect declares (rg 'line:' packages/lib/src/engines):
  // cgm, grl 'dotted'; istar-dt and tropos4as all three
  const LINES = [
    { dash: 'continuous' },
    { dash: 'dashed' },
    { dash: 'dotted' },
  ] as const;

  it('is a dialect’s line (its dash enum) as a model’s file-format line (a raw dash array), and back unchanged', () => {
    for (const line of LINES)
      expect(lineOfFile(fileLineOf(line))).to.deep.equal(line);
    // the dash arrays themselves, as @istar-ts/react's own LINE_DASHES draws them
    expect(fileLineOf({ dash: 'continuous' })).to.deep.equal({});
    expect(fileLineOf({ dash: 'dashed' })).to.deep.equal({ dash: '10,5' });
    expect(fileLineOf({ dash: 'dotted' })).to.deep.equal({ dash: '1,3' });
  });

  it('carries a line’s marker and markerFilled across both ways', () => {
    const line = {
      dash: 'dashed',
      marker: 'M 0 0 L 4 4',
      markerFilled: true,
    } as const;
    expect(lineOfFile(fileLineOf(line))).to.deep.equal(line);
  });

  it('reads a model’s file-format line without a marker as none (false reads as none too)', () => {
    expect(lineOfFile({ dash: '10,5', marker: false })).to.deep.equal({
      dash: 'dashed',
    });
  });

  it('reads a model’s own hand-written dash, not one of the presets, as dashed (the closest meaning)', () => {
    expect(lineOfFile({ dash: '4 2 1' })).to.deep.equal({ dash: 'dashed' });
  });
});

describe('profiles', () => {
  it('resolves stereotypes through groupers, by kind name', () => {
    for (const kind of ['istar.Agent', 'istar.Role'])
      expect(profileOf(dialect, kind).stereotypes).to.deep.equal(['smart']);
    expect(profileOf(dialect, 'istar.Actor').stereotypes).to.deep.equal([]);
    expect(profileOf(dialect, 'istar.Task')).to.deep.equal({
      stereotypes: ['urgent'],
      tags: ['Id', 'Note', { name: 'kind', values: ['must', 'may'] }],
    });
    // a Plan behaves like a task, but is not one
    expect(profileOf(dialect, 'toyish.Plan').stereotypes).to.deep.equal([]);
  });

  it('gives every kind its stereotype, then its tagged value, as open enums', () => {
    const [kindStereotype, tag, value] = profileProperties(
      dialect,
      'istar.Task',
    );
    expect(kindStereotype).to.deep.include({
      key: 'stereotype',
      value: {
        type: 'enum',
        options: [
          { value: '', label: 'none' },
          { value: 'urgent', label: 'urgent' },
        ],
        open: true,
      },
    });
    expect(tag?.value).to.include({ type: 'enum', open: true });
    expect(value?.key).to.equal('tagValue');
  });
});

describe('extensionCatalog', () => {
  it("lists a dialect's stereotypes, tagged values and groupers, with what they apply to", () => {
    expect(kindLabel('toyish.Box')).to.equal('Box');
    expect(extensionCatalog(dialect)).to.deep.equal([
      {
        id: 'stereotypes',
        label: 'Stereotype',
        entries: [
          { name: 'smart', appliesTo: ['agents'] },
          { name: 'urgent', appliesTo: ['Task'] },
        ],
      },
      {
        id: 'taggedValues',
        label: 'Tagged Value',
        entries: [{ name: 'kind', appliesTo: ['Task'] }],
      },
      {
        id: 'groupers',
        label: 'Grouper',
        entries: [{ name: 'agents', appliesTo: ['Agent', 'Role'] }],
      },
    ]);
  });
});

describe('definitions with a dialect', () => {
  it('annotates the lines of every kind an engine has', () => {
    const both = withExtension(toy, dialect);
    expect(both.id).to.equal('toy+toyish');
    expect(both.elements.goal).to.deep.equal({
      prefix: 'G',
      fill: '#00FF00',
      annotated: true,
    });
    expect(
      both.properties.task!.map((p: { key: string }) => p.key).slice(-3),
    ).to.deep.equal(['stereotype', 'tag', 'tagValue']);
  });

  it('has every iStar kind and its own, lines without ids, no notation', () => {
    const definition = dialectDefinition(dialect);
    expect(definition.id).to.equal('toyish');
    expect(definition.notation).to.equal(undefined);
    expect(hasIds(definition)).to.equal(false);
    expect(Object.keys(definition.elements)).to.deep.equal([
      ...ISTAR_ACTOR_KINDS,
      ...ISTAR_NODE_KINDS,
      'toyish.Plan',
      'toyish.Box',
    ]);
    expect(definition.propertyLineOrder).to.deep.equal([]);
    expect(
      specsFromDefinition(definition, {})['istar.Role']!.map((s) => s.key),
    ).to.deep.equal(['stereotype', 'tag', 'tagValue']);
  });
});

describe('istarKindOf', () => {
  it("is an engine kind's iStar kind, and any other kind as it is", () => {
    expect(istarKindOf('goal')).to.equal('istar.Goal');
    expect(istarKindOf('task')).to.equal('istar.Task');
    expect(istarKindOf('resource')).to.equal('istar.Resource');
    expect(istarKindOf('quality')).to.equal('istar.Quality');
    expect(istarKindOf('istar.Goal')).to.equal('istar.Goal');
    expect(istarKindOf('kaos.Agent')).to.equal('kaos.Agent');
  });
});
