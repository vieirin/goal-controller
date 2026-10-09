/** A dialect as data, and the definitions read with it (src/derive/extensions.ts). */
import { expect } from 'chai';
import {
  annotationsFor,
  completionsAt,
  contextFromView,
  dialectDefinition,
  documentDiagnostics,
  extensionCatalog,
  hasIds,
  kindLabel,
  lineId,
  metamodelExtensionOf,
  notationDocument,
  notationEdits,
  profileOf,
  profileProperties,
  readAnnotations,
  specsFromDefinition,
  withExtension,
  writeAnnotations,
  ISTAR_ACTOR_KINDS,
  ISTAR_NODE_KINDS,
  type DocumentNode,
  type DocumentTree,
  type ExtensionDefinition,
} from '../src';
import { node, toy, toyDialect } from './support/toy';

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
    const { stereotype, taggedValue } = dialect.annotations;
    expect(annotationsFor(dialect, 'istar.Goal')).to.deep.equal([
      stereotype,
      taggedValue,
    ]);
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

  it('writes and reads annotations', () => {
    const annotations = annotationsFor(dialect, 'istar.Task');
    expect(
      writeAnnotations(annotations, {
        stereotype: 'urgent',
        tag: 'kind',
        tagValue: 'must',
      }),
    ).to.equal('<<urgent>> {kind = must}');
    expect(writeAnnotations(annotations, { tagValue: 'x' })).to.equal(null);
    expect(readAnnotations(annotations, ['{Id}', '<<urgent>>'])).to.deep.equal({
      properties: { tag: 'Id', tagValue: undefined, stereotype: 'urgent' },
      read: [{ tag: 'Id', tagValue: undefined }, { stereotype: 'urgent' }],
    });
    expect(readAnnotations(annotations, ['<<a>>', '<<b>>']).read).to.deep.equal(
      [{ stereotype: 'a' }, null],
    );
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

describe('an engine with a dialect', () => {
  const both = withExtension(toy, dialect);
  const tree: DocumentTree = {
    roots: ['G1'],
    nodes: new Map<string, DocumentNode>([
      [
        'G1',
        node({
          id: 'G1',
          kind: 'goal',
          children: ['T1'],
          properties: { tag: 'Id', tagValue: '7' },
        }),
      ],
      [
        'T1',
        node({
          id: 'T1',
          kind: 'task',
          properties: { stereotype: 'urgent', robot: 'r2' },
        }),
      ],
    ]),
  };

  it("writes the dialect's annotations before the ids, and reads them back", () => {
    expect(both.id).to.equal('toy+toyish');
    const { text } = notationDocument(both, tree);
    expect(text).to.equal('{Id = 7} G1: G1\n  <<urgent>> T1: T1\n    robot r2');
    expect(lineId(both, '  <<urgent>> T1: T1')).to.equal('T1');
    expect(
      notationEdits(both, text.replace('<<urgent>>', '{kind = may}'), tree),
    ).to.deep.equal([
      { iStarId: 'i-T1', key: 'stereotype', value: null },
      { iStarId: 'i-T1', key: 'tag', value: 'kind' },
      { iStarId: 'i-T1', key: 'tagValue', value: 'may' },
    ]);
    // the engine alone reads the same model without them
    expect(notationDocument(toy, tree).text).to.equal(
      'G1: G1\n  T1: T1\n    robot r2',
    );
  });
});

describe('a dialect of its own (no engine)', () => {
  const definition = dialectDefinition(dialect);
  const tree: DocumentTree = {
    roots: ['a1'],
    nodes: new Map<string, DocumentNode>([
      [
        'a1',
        {
          ...node({
            id: 'a1',
            kind: 'istar.Agent',
            name: 'Robot',
            properties: { stereotype: 'smart' },
          }),
          iStarId: 'a1',
          children: ['g1', 'p1'],
        },
      ],
      [
        'g1',
        {
          ...node({
            id: 'g1',
            kind: 'istar.Goal',
            name: 'Deliver',
            properties: { tag: 'Id', tagValue: 'G1' },
          }),
          iStarId: 'g1',
        },
      ],
      [
        'p1',
        {
          ...node({ id: 'p1', kind: 'toyish.Plan', name: 'Plan it' }),
          iStarId: 'p1',
        },
      ],
    ]),
  };
  const doc = '<<smart>> Robot\n  {Id = G1} Deliver\n  Plan it';

  it('has every iStar kind and its own, lines without ids, no notation', () => {
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

  it('writes its lines, and reads them by position', () => {
    expect(notationDocument(definition, tree).text).to.equal(doc);
    expect(lineId(definition, 'Robot')).to.equal(null);
    expect(
      notationEdits(
        definition,
        doc.replace('{Id = G1} Deliver', '{Id = G2} Delivered'),
        tree,
      ),
    ).to.deep.equal([
      { iStarId: 'g1', key: 'tagValue', value: 'G2' },
      { iStarId: 'g1', text: 'Delivered' },
    ]);
  });

  it('checks its lines against the elements, in order', () => {
    const context = contextFromView(definition, tree, []);
    expect(context.order).to.deep.equal(['a1', 'g1', 'p1']);
    expect(documentDiagnostics(definition, doc, context)).to.deep.equal([]);
    expect(
      documentDiagnostics(definition, `${doc}\n  Extra`, context),
    ).to.deep.equal([
      {
        from: 0,
        to: doc.length + 8,
        severity: 'error',
        message:
          "4 lines for 3 elements: each line is an element's, in order (add or remove elements in the diagram)",
      },
    ]);
    expect(
      documentDiagnostics(
        definition,
        doc.replace('<<smart>> Robot', '<<smart>> {} Robot'),
        context,
      ),
    ).to.deep.equal([
      {
        from: 10,
        to: 12,
        severity: 'error',
        message: 'This annotation cannot be read',
      },
    ]);
    expect(completionsAt(definition, doc, 3, context)).to.equal(null);
  });
});
