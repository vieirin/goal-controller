/**
 * Element lines `kind id: name` (goal-controller#518): a line's head (its
 * kind's word and the id after it) read before the grammar; elements made
 * and removed in the text, named by their ids, never by their positions;
 * the short id (a piStar id's first characters) of an element without one
 * written; orphan links; completion and highlight of the word; what is
 * reported of a line's head (src/notation/{head,lines,document,
 * diagnostics}.ts, src/print.ts).
 */
import {
  defineDialect,
  defineExtension,
  withExtension,
  type DocumentTree,
  type ExtensionDefinition,
} from '@goal-controller/dialect';
import { expect } from 'chai';
import {
  annotatedProperties,
  completionsAt,
  contextFromView,
  documentDiagnostics,
  highlightLine,
  notationDocument,
  notationEdits,
  readHead,
  readLine,
} from '../src/index.js';
import { node, toy, toyDialect } from '../../dialect/test/support/toy.js';

/** A framework-like extension: kinds whose words are snake_case. */
const framework = defineExtension({
  name: 'fw',
  label: 'Framework',
  elements: [
    { kind: 'fw.BehavioralGoal', category: 'node' },
    { kind: 'fw.Agent', category: 'node' },
  ],
  links: [],
  groupers: {},
  stereotypes: [],
  taggedValues: [],
  defaultTags: [],
});

/** No prefixes: any id may be written, or none (a short id is shown). */
const plain = defineDialect({
  id: 'plainFramework',
  name: 'Plain framework',
  extension: framework,
  elements: {
    'fw.BehavioralGoal': { fill: '#FFFFFF' },
    'fw.Agent': { fill: '#FFFFFF' },
  },
  defaultFill: '#FFFFFF',
  properties: {
    'fw.BehavioralGoal': [
      { key: 'priority', value: { type: 'text' }, help: 'how urgent' },
    ],
    'fw.Agent': [],
  },
  propertyLineOrder: ['priority'],
  indent: '  ',
  problems: toy.problems,
});

/** The toy (prefixes G, T, R) with an annotating dialect. */
const annotated = withExtension(toy, toyDialect as ExtensionDefinition);

const emptyTree: DocumentTree = { nodes: new Map(), roots: [] };

/** piStar ids `7857cb0n-…`, in order, from n = 0. */
const ids = () => {
  let n = 0;
  return () => `7857cb0${n++}-1111-2222`;
};

/** Diagnostics as [text, message]. */
const said = (
  definition: Parameters<typeof documentDiagnostics>[0] &
    Parameters<typeof contextFromView>[0],
  doc: string,
  tree: DocumentTree,
) =>
  documentDiagnostics(
    definition,
    doc,
    contextFromView(definition, tree, []),
  ).map((d) => [doc.slice(d.from, d.to), d.message]);

describe('element lines `kind id: name` (#518)', () => {
  describe('a line’s head', () => {
    it('reads the word, its kind, the id and their spans', () => {
      expect(readHead(toy, '  goal G1: Deliver [G2;T1]')).to.deep.equal({
        word: 'goal',
        wordSpan: { from: 2, to: 6 },
        kind: 'goal',
        id: 'G1',
        idSpan: { from: 7, to: 9 },
      });
      expect(
        readHead(plain, 'behavioral_goal 7857cb00: Achieve the backup'),
      ).to.deep.equal({
        word: 'behavioral_goal',
        wordSpan: { from: 0, to: 15 },
        kind: 'fw.BehavioralGoal',
        id: '7857cb00',
        idSpan: { from: 16, to: 24 },
      });
    });

    it('reads any id of letters, digits, `_`, `.` and `-`, of one character too', () => {
      for (const id of ['x', '7', '_x', 'net_up', 'T1.1', 'a.b-c', '9eba-0f53'])
        expect(readHead(plain, `agent ${id}: Name`)?.id, id).to.equal(id);
      expect(readHead(plain, 'agent x: Y')?.idSpan).to.deep.equal({
        from: 6,
        to: 7,
      });
      // no id written, or none of the form: the word alone
      expect(readHead(toy, 'goal')).to.include({ kind: 'goal', id: null });
      expect(readHead(toy, 'goal Deliver')).to.include({ id: null });
      expect(readHead(toy, 'goal -x: Y')).to.include({ id: null });
    });

    it('reads an unknown word as one only before an id and its colon, and no key as one', () => {
      expect(readHead(toy, 'goa x: Y')).to.deep.equal({
        word: 'goa',
        wordSpan: { from: 0, to: 3 },
        kind: null,
        id: 'x',
        idSpan: { from: 4, to: 5 },
      });
      expect(readHead(toy, 'goa Y')).to.equal(null);
      // a property line's key, and a line without a word
      expect(readHead(toy, '  robot r2: x')).to.equal(null);
      expect(readHead(toy, 'G1: Go')).to.equal(null);
      expect(readHead(toy, 'Goal G1: Go')).to.equal(null);
    });

    it('reads the word after the annotations', () => {
      const line = '<<urgent>> {kind = must} task T1: Name';
      expect(readHead(annotated, line)).to.deep.equal({
        word: 'task',
        wordSpan: { from: 25, to: 29 },
        kind: 'task',
        id: 'T1',
        idSpan: { from: 30, to: 32 },
      });
      const read = readLine(annotated, line);
      expect(
        read.kind === 'element' && annotatedProperties(read),
      ).to.deep.equal({ stereotype: 'urgent', tag: 'kind', tagValue: 'must' });
      expect(read).to.deep.include({
        word: { text: 'task', kind: 'task', span: { from: 25, to: 29 } },
        id: 'T1',
        text: 'T1: Name',
        errors: [],
      });
    });
  });

  describe('readLine', () => {
    it('reads an element line with its word, at the original line’s offsets', () => {
      const read = readLine(toy, '  goal G1: Go [G2;T1]');
      expect(read).to.deep.include({
        kind: 'element',
        word: { text: 'goal', kind: 'goal', span: { from: 2, to: 6 } },
        id: 'G1',
        idSpan: { from: 7, to: 9 },
        name: 'Go',
        text: 'G1: Go [G2;T1]',
        textSpan: { from: 7, to: 21 },
        errors: [],
      });
      expect(read.kind === 'element' && read.notation?.span).to.deep.equal({
        from: 15,
        to: 20,
      });
    });

    it('reads any id where the grammar reads none, the text from it', () => {
      expect(
        readLine(plain, 'behavioral_goal 7857cb00: Achieve it'),
      ).to.deep.include({
        id: '7857cb00',
        idSpan: { from: 16, to: 24 },
        name: 'Achieve it',
        text: '7857cb00: Achieve it',
        textSpan: { from: 16, to: 36 },
        errors: [],
      });
      expect(readLine(plain, 'agent x: Y')).to.deep.include({
        id: 'x',
        idSpan: { from: 6, to: 7 },
        name: 'Y',
        text: 'x: Y',
        errors: [],
      });
      // an engine's line with an id it doesn't read at runtime
      expect(readLine(toy, 'goal net_up: Internet')).to.deep.include({
        id: 'net_up',
        text: 'net_up: Internet',
        errors: [],
      });
      // no id: the name alone
      expect(readLine(plain, 'agent Network')).to.deep.include({
        id: null,
        idSpan: null,
        name: 'Network',
        text: 'Network',
      });
    });

    it('reads a line without a word as before, and an unknown word as no kind', () => {
      expect(readLine(toy, 'G1: Go')).to.deep.include({
        kind: 'element',
        word: null,
        id: 'G1',
      });
      expect(readLine(toy, 'goa x: Y')).to.deep.include({
        kind: 'element',
        word: { text: 'goa', kind: null, span: { from: 0, to: 3 } },
        id: 'x',
      });
      // a word with nothing readable after it: an element line with errors
      for (const line of ['goal', 'goal Deliver']) {
        const read = readLine(toy, line);
        expect(read.kind, line).to.equal('element');
        expect(read.errors, line).to.not.deep.equal([]);
      }
    });
  });

  describe('elements made from text', () => {
    it('creates an engine’s elements from an empty document, with their iStar kinds and properties', () => {
      const doc = [
        'goal G1: Deliver [T1]',
        '  priority high',
        '  task T1: Drive',
        '    robot r2',
        'resource R1: Fuel {int 0..9 = 5}',
      ].join('\n');
      expect(
        notationEdits(toy, doc, emptyTree, { newId: ids() }),
      ).to.deep.equal([
        {
          create: {
            iStarId: '7857cb00-1111-2222',
            kind: 'istar.Goal',
            text: 'G1: Deliver [T1]',
            properties: { priority: 'high' },
            after: null,
            line: 0,
            writeId: null,
          },
        },
        {
          create: {
            iStarId: '7857cb01-1111-2222',
            kind: 'istar.Task',
            text: 'T1: Drive',
            properties: { robot: 'r2' },
            after: null,
            line: 2,
            writeId: null,
          },
        },
        {
          create: {
            iStarId: '7857cb02-1111-2222',
            kind: 'istar.Resource',
            text: 'R1: Fuel',
            properties: {
              type: 'int',
              lowerBound: '0',
              upperBound: '9',
              initialValue: '5',
            },
            after: null,
            line: 4,
            writeId: null,
          },
        },
      ]);
    });

    it('creates a framework’s elements of its own kinds; a line without an id gets its short id', () => {
      const doc = [
        'behavioral_goal Achieve the backup',
        '  priority high',
        'agent net_up: Internet connection available',
      ].join('\n');
      expect(
        notationEdits(plain, doc, emptyTree, { newId: ids() }),
      ).to.deep.equal([
        {
          create: {
            iStarId: '7857cb00-1111-2222',
            kind: 'fw.BehavioralGoal',
            text: 'Achieve the backup',
            properties: { priority: 'high' },
            after: null,
            line: 0,
            writeId: '7857cb00',
          },
        },
        {
          create: {
            iStarId: '7857cb01-1111-2222',
            kind: 'fw.Agent',
            text: 'net_up: Internet connection available',
            properties: {},
            after: null,
            line: 2,
            writeId: null,
          },
        },
      ]);
    });

    it('creates an element after the line of the one above it, with its annotations', () => {
      const tree: DocumentTree = {
        roots: ['G1'],
        nodes: new Map([
          [
            'G1',
            node({ id: 'G1', kind: 'goal', name: 'Go', children: ['T1'] }),
          ],
          ['T1', node({ id: 'T1', kind: 'task', name: 'Drive' })],
        ]),
      };
      const { text } = notationDocument(annotated, tree);
      expect(
        notationEdits(
          annotated,
          `${text}\n  <<urgent>> task T2: Fly\n    robot r1`,
          tree,
          { newId: ids() },
        ),
      ).to.deep.equal([
        {
          create: {
            iStarId: '7857cb00-1111-2222',
            kind: 'istar.Task',
            text: 'T2: Fly',
            properties: { stereotype: 'urgent', robot: 'r1' },
            after: 'T1',
            line: 2,
            writeId: null,
          },
        },
      ]);
    });

    it('removes an element whose line is gone, by its piStar id', () => {
      const tree: DocumentTree = {
        roots: ['G1'],
        nodes: new Map([
          [
            'G1',
            node({ id: 'G1', kind: 'goal', name: 'Go', children: ['T1'] }),
          ],
          ['T1', node({ id: 'T1', kind: 'task', name: 'Drive' })],
        ]),
      };
      const { text } = notationDocument(toy, tree);
      expect(
        notationEdits(toy, text.replace('\n  task T1: Drive', ''), tree),
      ).to.deep.equal([{ remove: 'i-T1' }]);
      // moved elsewhere, it is the same element
      expect(
        notationEdits(toy, 'task T1: Drive\ngoal G1: Go', tree),
      ).to.deep.equal([]);
    });

    it('creates and removes nothing while a line is typed half-way; names and properties still change', () => {
      const tree: DocumentTree = {
        roots: ['G1'],
        nodes: new Map([
          [
            'G1',
            node({
              id: 'G1',
              kind: 'goal',
              name: 'Go',
              children: ['T1'],
              properties: { priority: 'high' },
            }),
          ],
          ['T1', node({ id: 'T1', kind: 'task', name: 'Drive' })],
        ]),
      };
      const { text } = notationDocument(toy, tree);
      const renamed = text
        .replace('G1: Go', 'G1: Went')
        .replace('priority high', 'priority');
      for (const typing of [
        'goa x: Y',
        'goal',
        'goal G2: Wait [G3;;]',
        'G2: Wait',
      ])
        expect(
          notationEdits(
            toy,
            renamed.replace('  task T1: Drive', typing),
            tree,
            { newId: ids() },
          ),
          typing,
        ).to.deep.equal([
          { iStarId: 'i-G1', text: 'G1: Went' },
          { iStarId: 'i-G1', key: 'priority', value: '' },
        ]);
    });

    it('changes nothing of an element whose line says another kind', () => {
      const tree: DocumentTree = {
        roots: ['G1'],
        nodes: new Map([['G1', node({ id: 'G1', kind: 'goal', name: 'Go' })]]),
      };
      expect(notationEdits(toy, 'task G1: Went', tree)).to.deep.equal([]);
    });
  });

  describe('orphans', () => {
    const tree: DocumentTree = {
      roots: ['G1'],
      nodes: new Map([
        ['G1', node({ id: 'G1', kind: 'goal', name: 'Go', children: ['T1'] })],
        ['T1', node({ id: 'T1', kind: 'task', name: 'Drive' })],
      ]),
      orphans: [
        {
          iStarId: 'a1b2c3d4-link',
          kind: 'istar.ContributionLink',
          source: 'T1',
          target: null,
          missing: ['e5f6a7b8-gone'],
        },
        {
          iStarId: 'c0ffee00-link',
          kind: 'istar.AndRefinementLink',
          source: null,
          target: null,
          missing: ['11111111-gone', '22222222-gone'],
        },
      ],
    };
    const doc = 'goal G1: Go\n  task T1: Drive';

    it('reports a link that lost an end on its remaining end’s line, else on the first', () => {
      const context = contextFromView(toy, tree, []);
      expect(context.orphans).to.have.length(2);
      expect(documentDiagnostics(toy, doc, context)).to.deep.equal([
        {
          from: doc.indexOf('task'),
          to: doc.length,
          severity: 'error',
          message:
            'ContributionLink a1b2c3d4 has lost its end e5f6a7b8: write it back, or remove the link in the diagram',
          elementId: 'T1',
          code: 'orphan',
        },
        {
          from: 0,
          to: 'goal G1: Go'.length,
          severity: 'error',
          message:
            'AndRefinementLink c0ffee00 has lost its ends 11111111, 22222222: write them back, or remove the link in the diagram',
          code: 'orphan',
        },
      ]);
    });

    it('has none without orphans', () => {
      const { orphans: _, ...whole } = tree;
      expect(contextFromView(toy, whole, [])).to.not.have.property('orphans');
      expect(said(toy, doc, whole)).to.deep.equal([]);
    });
  });

  describe('short ids', () => {
    /** Two goals whose piStar ids start alike, an agent with an id written, one without. */
    const tree: DocumentTree = {
      roots: ['a', 'b', 'c', 'd'],
      nodes: new Map([
        [
          'a',
          node({
            id: 'a',
            iStarId: 'abcdefgh-0001',
            kind: 'fw.BehavioralGoal',
            name: 'Back up',
            hasId: false,
          }),
        ],
        [
          'b',
          node({
            id: 'b',
            iStarId: 'abcdefgh-0002',
            kind: 'fw.BehavioralGoal',
            name: 'Restore',
            hasId: false,
          }),
        ],
        [
          'c',
          node({
            id: 'net_up',
            iStarId: 'cccc0000-0003',
            kind: 'fw.Agent',
            name: 'Network',
            hasId: true,
          }),
        ],
        [
          'd',
          node({
            id: 'd',
            iStarId: 'dddddddd-0004',
            kind: 'fw.Agent',
            name: 'Operator',
            properties: {},
            hasId: false,
          }),
        ],
      ]),
    };
    const doc = [
      'behavioral_goal abcdefgh: Back up',
      'behavioral_goal abcdefgh: Restore',
      'agent net_up: Network',
      'agent dddddddd: Operator',
    ].join('\n');

    it('writes each line `kindWord shownId: name`: a written id, else a short one', () => {
      expect(notationDocument(plain, tree)).to.deep.equal({
        text: doc,
        ids: ['a', 'b', 'c', 'd'],
      });
      expect(notationEdits(plain, doc, tree)).to.deep.equal([]);
    });

    it('stores no short id: a line renamed changes its name only', () => {
      expect(
        notationEdits(
          plain,
          doc.replace('dddddddd: Operator', 'dddddddd: Admin'),
          tree,
        ),
      ).to.deep.equal([{ iStarId: 'dddddddd-0004', text: 'Admin' }]);
      expect(
        notationEdits(
          plain,
          doc.replace('net_up: Network', 'net_up: Net'),
          tree,
        ),
      ).to.deep.equal([{ iStarId: 'cccc0000-0003', text: 'net_up: Net' }]);
    });

    it('reports a short id two elements show on both lines, and edits neither', () => {
      const context = contextFromView(plain, tree, []);
      const found = documentDiagnostics(plain, doc, context);
      expect(
        found.map((d) => [d.from, d.to, d.severity, d.message]),
      ).to.deep.equal([
        [16, 24, 'error', '2 elements show the id abcdefgh: give each its own'],
        [50, 58, 'error', '2 elements show the id abcdefgh: give each its own'],
      ]);
      expect(
        notationEdits(
          plain,
          doc.replace('Back up', 'Copy').replace('Restore', 'Bring back'),
          tree,
        ),
      ).to.deep.equal([]);
    });

    it('reports an engine element without a runtime id', () => {
      const engine: DocumentTree = {
        roots: ['G1'],
        nodes: new Map([
          [
            'G1',
            node({
              id: 'G1',
              kind: 'goal',
              name: 'Go',
              children: ['9eba9454'],
            }),
          ],
          [
            '9eba9454',
            node({
              id: '9eba9454-0f53',
              iStarId: '9eba9454-0f53',
              kind: 'goal',
              name: 'Wait',
              hasId: false,
            }),
          ],
        ]),
      };
      const { text } = notationDocument(toy, engine);
      expect(text).to.equal('goal G1: Go\n  goal 9eba9454: Wait');
      expect(said(toy, text, engine)).to.deep.equal([
        ['9eba9454', 'A goal needs an id G… in Toy'],
      ]);
    });
  });

  describe('diagnostics of a line’s head', () => {
    const tree: DocumentTree = {
      roots: ['G1'],
      nodes: new Map([
        ['G1', node({ id: 'G1', kind: 'goal', name: 'Go', children: ['T1'] })],
        ['T1', node({ id: 'T1', kind: 'task', name: 'Drive' })],
      ]),
    };

    it('says a line without its word, with an unknown word, or another kind’s', () => {
      expect(said(toy, 'G1: Go\n  task T1: Drive', tree)).to.deep.equal([
        [
          'G1: Go',
          'An element line starts with its kind: goal, task, resource',
        ],
      ]);
      expect(said(toy, 'goa G1: Go\n  task T1: Drive', tree)).to.deep.equal([
        ['goa', "goa is no kind of Toy's: goal, task, resource"],
      ]);
      expect(said(toy, 'task G1: Go\n  task T1: Drive', tree)).to.deep.equal([
        ['task', 'G1 is a goal, not a task'],
      ]);
    });

    it('says a new engine line has no id, or one not its kind’s', () => {
      // being typed: the word alone, or a name without an id
      for (const typed of ['task', 'task Pick'])
        expect(
          said(toy, `goal G1: Go\n  task T1: Drive\n  ${typed}`, tree),
          typed,
        ).to.deep.equal([[typed, 'A task needs an id T… in Toy']]);
      expect(
        said(toy, 'goal G1: Go\n  task T1: Drive\n  task G7: Lift', tree),
      ).to.deep.equal([['G7', 'A task needs an id T… in Toy: G7 is not one']]);
      expect(
        said(toy, 'goal G1: Go\n  task T1: Drive\n  task T7: Lift', tree),
      ).to.deep.equal([]);
    });
  });

  describe('the editor', () => {
    const context = contextFromView(toy, emptyTree, []);
    const offered = (
      definition: Parameters<typeof completionsAt>[0],
      doc: string,
    ) => {
      const found = completionsAt(definition, doc, doc.length, context);
      return found && [found.from, found.options.map((o) => o.label)];
    };

    it('completes a kind’s word at a line’s head', () => {
      expect(completionsAt(toy, '', 0, context)).to.deep.equal({
        from: 0,
        options: [
          { label: 'goal', type: 'keyword', detail: 'goal' },
          { label: 'task', type: 'keyword', detail: 'task' },
          { label: 'resource', type: 'keyword', detail: 'resource' },
        ],
      });
      expect(offered(toy, 'goal G1: Go\n  ta')).to.deep.equal([14, ['task']]);
      expect(offered(plain, 'beh')).to.deep.equal([0, ['behavioral_goal']]);
      // after the annotations
      expect(offered(annotated, '<<urgent>> ta')).to.deep.equal([11, ['task']]);
    });

    it('highlights the word as a keyword', () => {
      expect(highlightLine(toy, '  goal G1: Go')[0]).to.deep.equal({
        from: 2,
        to: 6,
        style: 'keyword',
      });
      expect(
        highlightLine(plain, 'behavioral_goal 7857cb00: Achieve')[0],
      ).to.deep.equal({ from: 0, to: 15, style: 'keyword' });
    });
  });
});
