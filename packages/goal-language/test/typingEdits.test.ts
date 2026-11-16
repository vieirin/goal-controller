/**
 * Typing in a notation document never changes another element's properties,
 * an orphan is repaired by writing its element's line again, an id changed
 * in place renames its element, and an erroneous line edits nothing
 * (goal-controller#518, review of #528; src/notation/document.ts).
 */
import {
  WRITTEN_ID_KEY,
  defineDialect,
  defineExtension,
  type DocumentTree,
} from '@goal-controller/dialect';
import { expect } from 'chai';
import { notationDocument, notationEdits } from '../src/index.js';
import { node, toy } from '../../dialect/test/support/toy.js';

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

const tree: DocumentTree = {
  roots: ['a', 'b', 'c'],
  nodes: new Map([
    [
      'a',
      node({
        id: 'a',
        iStarId: 'aaaaaaaa-0001',
        kind: 'fw.BehavioralGoal',
        name: 'Back up',
        hasId: false,
        properties: { priority: 'high' },
      }),
    ],
    [
      'b',
      node({
        id: 'b',
        iStarId: 'bbbbbbbb-0002',
        kind: 'fw.BehavioralGoal',
        name: 'Restore',
        hasId: false,
        properties: { priority: 'low' },
      }),
    ],
    [
      'c',
      node({
        id: 'c',
        iStarId: 'cccccccc-0003',
        kind: 'fw.Agent',
        name: 'Operator',
        hasId: false,
      }),
    ],
  ]),
};
const doc = notationDocument(plain, tree).text;
const lines = doc.split('\n');
const ids = () => {
  let n = 0;
  return () => `7857cb0${n++}-1111-2222`;
};
const insertAfter = (line: number, text: string) =>
  [...lines.slice(0, line + 1), text, ...lines.slice(line + 1)].join('\n');

describe('typing in a document (#518 review)', () => {
  it('has the lines these tests insert among', () => {
    expect(lines).to.deep.equal([
      'behavioral_goal aaaaaaaa: Back up',
      '  priority high',
      'behavioral_goal bbbbbbbb: Restore',
      '  priority low',
      'agent cccccccc: Operator',
    ]);
    expect(notationEdits(plain, doc, tree)).to.deep.equal([]);
  });

  it('changes no element’s properties for a line typed under an element line', () => {
    for (const typed of [
      '  behavioral_g',
      '  behavioral_goal',
      '  zzz',
      '  agent',
    ])
      expect(
        notationEdits(plain, insertAfter(0, typed), tree, { newId: ids() }),
        typed,
      ).to.deep.equal([]);
  });

  it('leaves the properties with their element when a complete line is added above them', () => {
    const edits = notationEdits(
      plain,
      insertAfter(0, '  behavioral_goal Archive'),
      tree,
      { newId: ids() },
    );
    expect(edits.filter((edit) => !('create' in edit))).to.deep.equal([]);
    expect(edits).to.have.length(1);
    expect(edits[0]).to.deep.include({});
    const created = (edits[0] as { create: { properties: unknown } }).create;
    expect(created.properties).to.deep.equal({});
    // a new element's own property lines are its own: the element above
    // keeps its own (N1 of the second review)
    const own = notationEdits(
      plain,
      insertAfter(0, '  behavioral_goal Archive\n    priority urgent'),
      tree,
      { newId: ids() },
    );
    expect(own.filter((edit) => !('create' in edit))).to.deep.equal([]);
    expect(own).to.have.length(1);
    expect(own[0]).to.have.nested.property('create.text', 'Archive');
    expect(
      (own[0] as { create: { properties: unknown } }).create.properties,
    ).to.deep.equal({ priority: 'urgent' });
  });

  it('edits nothing for a line that repeats another’s id', () => {
    expect(notationEdits(plain, insertAfter(0, lines[0]!), tree)).to.deep.equal(
      [],
    );
    expect(notationEdits(plain, insertAfter(1, lines[0]!), tree)).to.deep.equal(
      [],
    );
    expect(
      notationEdits(
        plain,
        insertAfter(1, 'behavioral_goal aaaaaaaa: Copy'),
        tree,
      ),
    ).to.deep.equal([]);
  });

  describe('an orphan is repaired', () => {
    const orphaned: DocumentTree = {
      roots: ['a'],
      nodes: new Map([['a', tree.nodes.get('a')!]]),
      orphans: [
        {
          iStarId: 'link-1',
          kind: 'x',
          source: 'a',
          target: null,
          missing: ['bbbbbbbb-0002-full-uuid'],
        },
      ],
    };

    it('by its line written again: the element gets the missing end’s id', () => {
      expect(
        notationEdits(
          plain,
          `${lines.slice(0, 2).join('\n')}\nbehavioral_goal bbbbbbbb: Restore`,
          orphaned,
          { newId: ids() },
        ),
      ).to.deep.equal([
        {
          create: {
            iStarId: 'bbbbbbbb-0002-full-uuid',
            kind: 'fw.BehavioralGoal',
            text: 'Restore',
            properties: {},
            after: 'a',
            line: 2,
            writeId: null,
          },
        },
      ]);
    });

    it('not by another id', () => {
      const edits = notationEdits(
        plain,
        `${lines.slice(0, 2).join('\n')}\nbehavioral_goal other: Restore`,
        orphaned,
        { newId: ids() },
      );
      expect(edits[0]).to.have.nested.property(
        'create.iStarId',
        '7857cb00-1111-2222',
      );
    });
  });

  describe('an id changed in place', () => {
    it('renames its element: where the id is stored apart from the name', () => {
      expect(
        notationEdits(
          plain,
          doc.replace('bbbbbbbb: Restore', 'zzz: Restore'),
          tree,
          { newId: ids() },
        ),
      ).to.deep.equal([
        { iStarId: 'bbbbbbbb-0002', key: WRITTEN_ID_KEY, value: 'zzz' },
      ]);
      // the name alone: a relabel
      expect(
        notationEdits(
          plain,
          doc.replace('bbbbbbbb: Restore', 'bbbbbbbb: Bring back'),
          tree,
          { newId: ids() },
        ),
      ).to.deep.equal([{ iStarId: 'bbbbbbbb-0002', text: 'Bring back' }]);
      // the id and the name: another element (created, the old one removed)
      const both = notationEdits(
        plain,
        doc.replace('bbbbbbbb: Restore', 'zzz: Bring back'),
        tree,
        { newId: ids() },
      );
      expect(both.filter((e) => 'create' in e)).to.have.length(1);
      expect(both.filter((e) => 'remove' in e)).to.deep.equal([
        { remove: 'bbbbbbbb-0002' },
      ]);
    });

    it('renames an engine element, whose id is in its name', () => {
      const engine: DocumentTree = {
        roots: ['G1'],
        nodes: new Map([
          [
            'G1',
            node({ id: 'G1', kind: 'goal', name: 'Go', children: ['T1'] }),
          ],
          ['T1', node({ id: 'T1', kind: 'task', name: 'Drive' })],
        ]),
      };
      const text = notationDocument(toy, engine).text;
      expect(
        notationEdits(toy, text.replace('G1: Go', 'G9: Go'), engine, {
          newId: ids(),
        }),
      ).to.deep.equal([{ iStarId: 'i-G1', text: 'G9: Go' }]);
    });

    it('renames each of two lines changed in place; another kind’s line is a new element', () => {
      // two ids changed at once, each in its own line's place: two renames
      const edits = notationEdits(
        plain,
        doc
          .replace('aaaaaaaa: Back up', 'x1: Back up')
          .replace('bbbbbbbb:', 'x2:'),
        tree,
        { newId: ids() },
      );
      expect(edits).to.deep.equal([
        { iStarId: 'aaaaaaaa-0001', key: WRITTEN_ID_KEY, value: 'x1' },
        { iStarId: 'bbbbbbbb-0002', key: WRITTEN_ID_KEY, value: 'x2' },
      ]);
      // a line of another kind
      const other = notationEdits(
        plain,
        doc.replace(
          'agent cccccccc: Operator',
          'behavioral_goal zzz: Operator',
        ),
        tree,
        { newId: ids() },
      );
      expect(other.filter((e) => 'create' in e)).to.have.length(1);
      expect(other.filter((e) => 'remove' in e)).to.have.length(1);
    });

    it('stores no id for a short one written back', () => {
      const renamed = tree.nodes.get('b')!;
      const stored: DocumentTree = {
        roots: ['a', 'zzz', 'c'],
        nodes: new Map([
          ['a', tree.nodes.get('a')!],
          [
            'zzz',
            {
              ...renamed,
              id: 'zzz',
              hasId: true,
              properties: { ...renamed.properties, [WRITTEN_ID_KEY]: 'zzz' },
            },
          ],
          ['c', tree.nodes.get('c')!],
        ]),
      };
      const text = notationDocument(plain, stored).text;
      expect(text).to.contain('behavioral_goal zzz: Restore');
      expect(notationEdits(plain, text, stored)).to.deep.equal([]);
      expect(
        notationEdits(
          plain,
          text.replace('zzz: Restore', 'bbbbbbbb: Restore'),
          stored,
        ),
      ).to.deep.equal([
        { iStarId: 'bbbbbbbb-0002', key: WRITTEN_ID_KEY, value: null },
      ]);
    });
  });
});
