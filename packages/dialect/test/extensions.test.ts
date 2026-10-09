/** A dialect as data, and the definitions read with it (src/derive/extensions.ts). */
import { expect } from 'chai';
import {
  dialectDefinition,
  extensionCatalog,
  hasIds,
  kindLabel,
  metamodelExtensionOf,
  profileOf,
  profileProperties,
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
