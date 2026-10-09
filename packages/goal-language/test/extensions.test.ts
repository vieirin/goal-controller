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

  it("writes the dialect's annotations before the ids, and reads them back", () => {
    const { text } = notationDocument(both, tree);
    expect(text).to.equal('{Id = 7} G1: Go\n  <<urgent>> T1: Do\n    robot r2');
    expect(lineId(both, '  <<urgent>> T1: Do')).to.equal('T1');
    expect(
      notationEdits(both, text.replace('<<urgent>>', '{kind = may}'), tree),
    ).to.deep.equal([
      { iStarId: 'i-T1', key: 'stereotype', value: null },
      { iStarId: 'i-T1', key: 'tag', value: 'kind' },
      { iStarId: 'i-T1', key: 'tagValue', value: 'may' },
    ]);
    // the engine alone reads the same model without them
    expect(notationDocument(toy, tree).text).to.equal(
      'G1: Go\n  T1: Do\n    robot r2',
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
    // in a stereotype: the dialect's stereotypes; elsewhere on a name: nothing
    expect(
      completionsAt(definition, doc, 3, context)!.options.map((o) => o.label),
    ).to.deep.equal(['smart', 'urgent']);
    expect(completionsAt(definition, doc, 12, context)).to.equal(null);
  });

  describe('lines with ids', () => {
    // the same model, its goal and plan named with ids
    const withIds: DocumentTree = {
      roots: tree.roots,
      nodes: new Map(
        [...tree.nodes].map(([key, n]) => [
          key,
          key === 'g1'
            ? { ...n, name: 'G1: Deliver' }
            : key === 'p1'
              ? { ...n, name: 'T1: Plan it' }
              : n,
        ]),
      ),
    };
    const doc = '<<smart>> Robot\n  {Id = G1} G1: Deliver\n  T1: Plan it';

    it('writes the id an element’s name starts with, and reads it back', () => {
      expect(notationDocument(definition, withIds).text).to.equal(doc);
      expect(lineId(definition, '  {Id = G1} G1: Deliver')).to.equal('G1');
      expect(notationEdits(definition, doc, withIds)).to.deep.equal([]);
    });

    it('maps a line with an id by its id, the others by position', () => {
      // the two id lines swapped: each still edits its own element
      const swapped = '<<smart>> Robot\n  T1: Plan it now\n  G1: Deliver';
      expect(notationEdits(definition, swapped, withIds)).to.deep.equal([
        { iStarId: 'p1', text: 'T1: Plan it now' },
        { iStarId: 'g1', key: 'tag', value: null },
        { iStarId: 'g1', key: 'tagValue', value: null },
      ]);
    });

    it('reports a duplicate id and an id that names no element', () => {
      const context = contextFromView(definition, withIds, []);
      expect(context.named).to.deep.equal({ G1: 'g1', T1: 'p1' });
      expect(documentDiagnostics(definition, doc, context)).to.deep.equal([]);
      const bad = '<<smart>> Robot\n  G1: Deliver\n  G1: Again';
      expect(
        documentDiagnostics(definition, bad, context).map((d) => [
          bad.slice(d.from, d.to),
          d.message,
        ]),
      ).to.deep.equal([['G1', 'Duplicate id G1']]);
      const unknown = '<<smart>> Robot\n  G7: Deliver\n  T1: Plan it';
      expect(
        documentDiagnostics(definition, unknown, context).map((d) => [
          unknown.slice(d.from, d.to),
          d.message,
        ]),
      ).to.deep.equal([['G7', 'Add this element in the diagram']]);
    });
  });
});
