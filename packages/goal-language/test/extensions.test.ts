/** A dialect's annotations on an engine's lines, and a dialect's own document (src/notation). */
import {
  dialectDefinition,
  withExtension,
  type DocumentNode,
  type DocumentTree,
  type ExtensionDefinition,
} from '@goal-controller/dialect';
import { expect } from 'chai';
import {
  completionsAt,
  contextFromView,
  documentDiagnostics,
  lineId,
  notationDocument,
  notationEdits,
} from '../src/index.js';
import { node, toy, toyDialect } from '../../dialect/test/support/toy.js';

const dialect = toyDialect as ExtensionDefinition;

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
          name: 'Go',
          children: ['T1'],
          properties: { tag: 'Id', tagValue: '7' },
        }),
      ],
      [
        'T1',
        node({
          id: 'T1',
          kind: 'task',
          name: 'Do',
          properties: { stereotype: 'urgent', robot: 'r2' },
        }),
      ],
    ]),
  };

  it("writes the dialect's annotations before the kind word, and reads them back", () => {
    const { text } = notationDocument(both, tree);
    expect(text).to.equal(
      '{Id = 7} goal G1: Go\n  <<urgent>> task T1: Do\n    robot r2',
    );
    expect(lineId(both, '  <<urgent>> task T1: Do')).to.equal('T1');
    expect(
      notationEdits(both, text.replace('<<urgent>>', '{kind = may}'), tree),
    ).to.deep.equal([
      { iStarId: 'i-T1', key: 'stereotype', value: null },
      { iStarId: 'i-T1', key: 'tag', value: 'kind' },
      { iStarId: 'i-T1', key: 'tagValue', value: 'may' },
    ]);
    // the engine alone reads the same model without them
    expect(notationDocument(toy, tree).text).to.equal(
      'goal G1: Go\n  task T1: Do\n    robot r2',
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
  // no id written: each line shows its element's piStar id's first characters
  const doc =
    '<<smart>> agent a1: Robot\n  {Id = G1} goal g1: Deliver\n  plan p1: Plan it';

  it('writes its lines, and reads them by the ids they show (goal-controller#518)', () => {
    expect(notationDocument(definition, tree).text).to.equal(doc);
    expect(lineId(definition, '<<smart>> agent a1: Robot')).to.equal('a1');
    expect(
      notationEdits(
        definition,
        doc.replace(
          '{Id = G1} goal g1: Deliver',
          '{Id = G2} goal g1: Delivered',
        ),
        tree,
      ),
    ).to.deep.equal([
      { iStarId: 'g1', key: 'tagValue', value: 'G2' },
      { iStarId: 'g1', text: 'Delivered' },
    ]);
    // lines in another order: each still its own element's
    const moved =
      '<<smart>> agent a1: Robot\n  plan p1: Planned\n  {Id = G1} goal g1: Deliver';
    expect(notationEdits(definition, moved, tree)).to.deep.equal([
      { iStarId: 'p1', text: 'Planned' },
    ]);
  });

  it('checks its lines against the elements, by their ids', () => {
    const context = contextFromView(definition, tree, []);
    expect(documentDiagnostics(definition, doc, context)).to.deep.equal([]);
    // a line without its kind's word
    expect(
      documentDiagnostics(definition, `${doc}\n  Extra`, context),
    ).to.deep.equal([
      {
        from: doc.length + 3,
        to: doc.length + 8,
        severity: 'error',
        message:
          'An element line starts with its kind: actor, agent, role, goal, quality, resource, task, plan, box',
      },
    ]);
    expect(
      documentDiagnostics(
        definition,
        doc.replace('<<smart>> agent', '<<smart>> {} agent'),
        context,
      ),
    ).to.deep.equal([
      {
        from: 10,
        to: 12,
        severity: 'error',
        message: 'This annotation cannot be read',
        // on the line of the element its id names
        elementId: 'a1',
      },
    ]);
    // in a stereotype: the dialect's stereotypes; elsewhere on a name: nothing
    expect(
      completionsAt(definition, doc, 3, context)!.options.map((o) => o.label),
    ).to.deep.equal(['smart', 'urgent']);
    expect(completionsAt(definition, doc, 22, context)).to.equal(null);
  });

  describe('lines with ids', () => {
    // the same model, its goal and plan with ids their texts give them
    const withIds: DocumentTree = {
      roots: tree.roots,
      nodes: new Map(
        [...tree.nodes].map(([key, n]) => [
          key,
          key === 'g1'
            ? { ...n, id: 'G1', hasId: true }
            : key === 'p1'
              ? { ...n, id: 'T1', hasId: true }
              : n,
        ]),
      ),
    };
    const doc =
      '<<smart>> agent a1: Robot\n  {Id = G1} goal G1: Deliver\n  plan T1: Plan it';

    it('writes the id an element’s text gives it, and reads it back', () => {
      expect(notationDocument(definition, withIds).text).to.equal(doc);
      expect(lineId(definition, '  {Id = G1} goal G1: Deliver')).to.equal('G1');
      expect(notationEdits(definition, doc, withIds)).to.deep.equal([]);
    });

    it('maps every line by its id, wherever it is', () => {
      // the two id lines swapped: each still edits its own element
      const swapped =
        '<<smart>> agent a1: Robot\n  plan T1: Plan it now\n  goal G1: Deliver';
      expect(notationEdits(definition, swapped, withIds)).to.deep.equal([
        { iStarId: 'p1', text: 'T1: Plan it now' },
        { iStarId: 'g1', key: 'tag', value: null },
        { iStarId: 'g1', key: 'tagValue', value: null },
      ]);
    });

    it('reports a duplicate id; an id that names no element creates one', () => {
      const context = contextFromView(definition, withIds, []);
      expect(documentDiagnostics(definition, doc, context)).to.deep.equal([]);
      const bad =
        '<<smart>> agent a1: Robot\n  goal G1: Deliver\n  goal G1: Again';
      expect(
        documentDiagnostics(definition, bad, context).map((d) => [
          bad.slice(d.from, d.to),
          d.message,
        ]),
      ).to.deep.equal([['G1', 'Duplicate id G1']]);
      const unknown =
        '<<smart>> agent a1: Robot\n  goal G7: Deliver\n  plan T1: Plan it';
      expect(documentDiagnostics(definition, unknown, context)).to.deep.equal(
        [],
      );
      // its id alone differs, between the same lines: the element is renamed
      // (its `{Id = G1}` annotation is gone from the line: its tags clear)
      expect(
        notationEdits(definition, unknown, withIds, { newId: () => 'n1' }),
      ).to.deep.equal([
        { iStarId: 'g1', key: 'tag', value: null },
        { iStarId: 'g1', key: 'tagValue', value: null },
        { iStarId: 'g1', text: 'Deliver' },
        { iStarId: 'g1', key: 'writtenId', value: 'G7' },
      ]);
      // another kind of line is a new element
      const added =
        '<<smart>> agent a1: Robot\n  {Id = G1} goal G1: Deliver\n  goal G7: Again\n  plan T1: Plan it';
      expect(
        notationEdits(definition, added, withIds, { newId: () => 'n1' }),
      ).to.deep.equal([
        {
          create: {
            iStarId: 'n1',
            kind: 'istar.Goal',
            text: 'Again',
            properties: { writtenId: 'G7' },
            after: 'g1',
            line: 2,
            writeId: null,
          },
        },
      ]);
    });
  });
});
