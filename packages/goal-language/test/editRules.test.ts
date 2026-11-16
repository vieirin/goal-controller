/**
 * What an edited notation document changes in the model, rule by rule
 * (goal-controller#518, second review of #528): the edits are read from a
 * line diff between the document as written from the model and the
 * document as edited (src/notation/document.ts, its header; lineDiff.ts).
 */
import {
  MISSING_END_ID_KEYS,
  WRITTEN_ID_KEY,
  defineDialect,
  defineExtension,
  type DocumentTree,
} from '@goal-controller/dialect';
import { expect } from 'chai';
import {
  notationDocument,
  notationEdits,
  notationReading,
  type DocumentBase,
} from '../src/index.js';
import { lineDiff } from '../src/notation/lineDiff.js';
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
  id: 'plainRules',
  name: 'Plain rules',
  extension: framework,
  elements: {
    'fw.BehavioralGoal': { fill: '#FFFFFF' },
    'fw.Agent': { fill: '#FFFFFF' },
  },
  defaultFill: '#FFFFFF',
  properties: {
    'fw.BehavioralGoal': [
      { key: 'priority', value: { type: 'text' }, help: 'how urgent' },
      { key: 'description', value: { type: 'text' }, help: 'what it is' },
    ],
    'fw.Agent': [],
  },
  propertyLineOrder: ['priority', 'description'],
  indent: '  ',
  problems: toy.problems,
});

const goal = (
  key: string,
  name: string,
  properties: Record<string, string> = {},
  children: string[] = [],
) =>
  node({
    id: key,
    iStarId: `${key.repeat(8)}-0000-${key}`,
    kind: 'fw.BehavioralGoal',
    name,
    hasId: false,
    properties,
    children,
  });

const tree: DocumentTree = {
  roots: ['a', 'b', 'c'],
  nodes: new Map([
    [
      'a',
      goal('a', 'Back up', { priority: 'high', description: 'nightly' }, ['d']),
    ],
    ['d', goal('d', 'Copy', { priority: 'mid' })],
    ['b', goal('b', 'Restore', { priority: 'low' })],
    [
      'c',
      node({
        id: 'c',
        iStarId: 'cccccccc-0000-c',
        kind: 'fw.Agent',
        name: 'Operator',
        hasId: false,
      }),
    ],
  ]),
};
const A = 'aaaaaaaa-0000-a';
const B = 'bbbbbbbb-0000-b';
const D = 'dddddddd-0000-d';
const doc = notationDocument(plain, tree).text;
const lines = doc.split('\n');
const ids = () => {
  let n = 0;
  return () => `7857cb0${n++}-1111-2222`;
};
const edited = (
  text: string,
  from: DocumentTree = tree,
  options: { base?: DocumentBase } = {},
) => notationEdits(plain, text, from, { newId: ids(), ...options });
/** the document with `text` inserted after line `at` */
const insertAfter = (at: number, text: string) =>
  [...lines.slice(0, at + 1), text, ...lines.slice(at + 1)].join('\n');
const without = (at: number) => lines.filter((_, i) => i !== at).join('\n');
const replaced = (at: number, text: string) =>
  lines.map((line, i) => (i === at ? text : line)).join('\n');
const creates = (edits: ReturnType<typeof edited>) =>
  edits.flatMap((edit) => ('create' in edit ? [edit.create] : []));
const others = (edits: ReturnType<typeof edited>) =>
  edits.filter((edit) => !('create' in edit));

describe('notation edits, read from a line diff (#518)', () => {
  it('writes the document these tests edit', () => {
    expect(lines).to.deep.equal([
      'behavioral_goal aaaaaaaa: Back up',
      '  priority high',
      '  description nightly',
      '  behavioral_goal dddddddd: Copy',
      '    priority mid',
      'behavioral_goal bbbbbbbb: Restore',
      '  priority low',
      'agent cccccccc: Operator',
    ]);
    expect(edited(doc)).to.deep.equal([]);
  });

  describe('lineDiff', () => {
    it('matches the unchanged lines and gives the changed ones as hunks', () => {
      const same = lineDiff(['a', 'b'], ['a', 'b']);
      expect([...same.matched]).to.deep.equal([0, 1]);
      expect(same.hunks).to.deep.equal([]);
      const diff = lineDiff(['a', 'b', 'c', 'd'], ['a', 'x', 'c', 'y', 'z']);
      expect([...diff.matched]).to.deep.equal([0, -1, 2, -1, -1]);
      expect(diff.hunks).to.deep.equal([
        { removed: [1], added: [1] },
        { removed: [3], added: [3, 4] },
      ]);
      expect([...diff.hunkOf]).to.deep.equal([-1, 0, -1, 1, 1]);
      // a moved line: one removed, one added
      const moved = lineDiff(['a', 'b', 'c'], ['b', 'c', 'a']);
      expect([...moved.matched]).to.deep.equal([1, 2, -1]);
      expect(lineDiff([], ['a']).hunks).to.deep.equal([
        { removed: [], added: [0] },
      ]);
    });
  });

  describe('1. an unchanged line keeps its element', () => {
    it('an element line added between an element’s line and its property lines takes none of them', () => {
      const edits = edited(insertAfter(0, 'behavioral_goal Archive'));
      expect(others(edits)).to.deep.equal([]);
      expect(creates(edits)).to.have.length(1);
      expect(creates(edits)[0]).to.deep.include({
        text: 'Archive',
        properties: {},
        after: 'a',
        line: 1,
      });
    });

    it('stays its element’s in a text the model has changed since (the editor keeps what is typed)', () => {
      // Archive and its own priority typed under A's line: created, the
      // model has them, the text stays as typed
      const text = insertAfter(
        0,
        'behavioral_goal x1: Archive\n  priority urgent',
      );
      const first = notationReading(plain, text, tree, { newId: ids() });
      expect(first.edits).to.have.length(1);
      expect(creates(first.edits)[0]!.properties).to.deep.equal({
        [WRITTEN_ID_KEY]: 'x1',
        priority: 'urgent',
      });
      const now: DocumentTree = {
        ...tree,
        roots: [...tree.roots, 'x1'],
        nodes: new Map([
          ...tree.nodes,
          [
            'x1',
            node({
              id: 'x1',
              iStarId: '7857cb00-1111-2222',
              kind: 'fw.BehavioralGoal',
              name: 'Archive',
              hasId: true,
              properties: { priority: 'urgent', [WRITTEN_ID_KEY]: 'x1' },
            }),
          ],
        ]),
      };
      const base = first.base;
      expect(base.lines).to.deep.equal(text.split('\n'));
      expect(edited(text, now, { base })).to.deep.equal([]);
      // A's own line, changed where it is, is still A's
      expect(
        edited(text.replace('priority high', 'priority top'), now, { base }),
      ).to.deep.equal([{ iStarId: A, key: 'priority', value: 'top' }]);
      // and removed, A's property is unset, Archive's stays
      expect(
        edited(text.replace('\n  priority high', ''), now, { base }),
      ).to.deep.equal([{ iStarId: A, key: 'priority', value: null }]);
    });
  });

  describe('2. a new property line is the element line’s above it, by indentation', () => {
    it('under a new element line: the new element’s (N1)', () => {
      const edits = edited(
        insertAfter(0, 'behavioral_goal X\n  description newdesc'),
      );
      expect(others(edits)).to.deep.equal([]);
      expect(creates(edits)).to.have.length(1);
      expect(creates(edits)[0]!.properties).to.deep.equal({
        description: 'newdesc',
      });
    });

    it('the nearest element line indented less: after a child’s lines, the parent’s', () => {
      // indented as A's property lines: A's (its value now the last line's)
      expect(edited(insertAfter(4, '  priority top'))).to.deep.equal([
        { iStarId: A, key: 'priority', value: 'top' },
      ]);
      // indented as D's: D's
      expect(edited(insertAfter(4, '    description copied'))).to.deep.equal([
        { iStarId: D, key: 'description', value: 'copied' },
      ]);
    });
  });

  describe('3. a property line removed unsets its property; one changed sets it', () => {
    it('on its element', () => {
      expect(edited(without(6))).to.deep.equal([
        { iStarId: B, key: 'priority', value: null },
      ]);
      expect(edited(replaced(6, '  priority none'))).to.deep.equal([
        { iStarId: B, key: 'priority', value: 'none' },
      ]);
    });

    it('changed in place under an element line added above it: still its element’s', () => {
      const text = replaced(
        1,
        'behavioral_goal Archive\n  priority top',
      ).replace('behavioral_goal Archive', 'behavioral_goal Archive');
      const edits = edited(text);
      expect(others(edits)).to.deep.equal([
        { iStarId: A, key: 'priority', value: 'top' },
      ]);
      expect(creates(edits)[0]!.properties).to.deep.equal({});
    });
  });

  describe('4. an element line replaced in place is the same element', () => {
    it('its id alone changed: a rename; its name alone: a relabel; both: another element', () => {
      expect(
        edited(replaced(5, 'behavioral_goal net_up: Restore')),
      ).to.deep.equal([{ iStarId: B, key: WRITTEN_ID_KEY, value: 'net_up' }]);
      expect(
        edited(replaced(5, 'behavioral_goal bbbbbbbb: Bring back')),
      ).to.deep.equal([{ iStarId: B, text: 'Bring back' }]);
      // its id taken off: it shows its short id again, and is the same element
      expect(edited(replaced(5, 'behavioral_goal Restore'))).to.deep.equal([]);
      const both = edited(replaced(5, 'behavioral_goal net_up: Bring back'));
      expect(creates(both)).to.have.length(1);
      expect(both.filter((e) => 'remove' in e)).to.deep.equal([{ remove: B }]);
    });

    it('also when a line is added in the same edit (N3): one rename, one create, nothing removed', () => {
      for (const text of [
        replaced(5, 'behavioral_goal chg_1: Restore\nbehavioral_goal NewOne'),
        replaced(5, 'behavioral_goal NewOne\nbehavioral_goal chg_1: Restore'),
        // and a line removed elsewhere
        replaced(
          5,
          'behavioral_goal chg_1: Restore\nbehavioral_goal NewOne',
        ).replace('\n  description nightly', ''),
      ]) {
        const edits = edited(text);
        expect(
          edits.filter((e) => 'remove' in e),
          text,
        ).to.deep.equal([]);
        expect(
          edits.filter((e) => 'key' in e && e.key === WRITTEN_ID_KEY),
        ).to.deep.equal([{ iStarId: B, key: WRITTEN_ID_KEY, value: 'chg_1' }]);
        expect(creates(edits).map((c) => c.text)).to.deep.equal(['NewOne']);
      }
    });

    it('two adjacent ids swapped: two renames, each element keeps its name, links and place', () => {
      const pair: DocumentTree = {
        roots: ['p', 'q'],
        nodes: new Map([
          ['p', goal('p', 'Plan')],
          ['q', goal('q', 'Queue')],
        ]),
      };
      const text = notationDocument(plain, pair).text;
      expect(text).to.equal(
        'behavioral_goal pppppppp: Plan\nbehavioral_goal qqqqqqqq: Queue',
      );
      expect(
        notationEdits(
          plain,
          'behavioral_goal qqqqqqqq: Plan\nbehavioral_goal pppppppp: Queue',
          pair,
        ),
      ).to.deep.equal([
        { iStarId: 'pppppppp-0000-p', key: WRITTEN_ID_KEY, value: 'qqqqqqqq' },
        { iStarId: 'qqqqqqqq-0000-q', key: WRITTEN_ID_KEY, value: 'pppppppp' },
      ]);
      // the lines swapped whole: a move, nothing changes
      expect(
        notationEdits(
          plain,
          'behavioral_goal qqqqqqqq: Queue\nbehavioral_goal pppppppp: Plan',
          pair,
        ),
      ).to.deep.equal([]);
    });

    it('an engine element’s runtime id, in its name', () => {
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
        notationEdits(
          toy,
          `${text.replace('G1: Go', 'G9: Go')}\n  task T2: Walk`,
          engine,
          { newId: ids() },
        ).filter((e) => !('create' in e)),
      ).to.deep.equal([{ iStarId: 'i-G1', text: 'G9: Go' }]);
      // an id of another kind's prefix: an error, nothing changes
      expect(
        notationEdits(toy, text.replace('G1: Go', 'T9: Go'), engine),
      ).to.deep.equal([]);
    });
  });

  describe('5. a line only added creates; an element no line names is removed', () => {
    it('a line moved is its element: nothing changes', () => {
      const moved = [...lines.slice(5), ...lines.slice(0, 5)].join('\n');
      expect(edited(moved)).to.deep.equal([]);
    });

    it('creates and removes, the removed element’s written id with it', () => {
      expect(creates(edited(`${doc}\nagent Auditor`))).to.deep.equal([
        {
          iStarId: '7857cb00-1111-2222',
          kind: 'fw.Agent',
          text: 'Auditor',
          properties: {},
          after: 'c',
          line: 8,
          writeId: '7857cb00',
        },
      ]);
      expect(edited(lines.slice(0, 7).join('\n'))).to.deep.equal([
        { remove: 'cccccccc-0000-c' },
      ]);
      const named: DocumentTree = {
        roots: ['net_up'],
        nodes: new Map([
          [
            'net_up',
            {
              ...goal('n', 'Network', { [WRITTEN_ID_KEY]: 'net_up' }),
              id: 'net_up',
              hasId: true,
            },
          ],
        ]),
      };
      expect(notationDocument(plain, named).text).to.equal(
        'behavioral_goal net_up: Network',
      );
      expect(notationEdits(plain, '', named)).to.deep.equal([
        { remove: 'nnnnnnnn-0000-n', writtenId: 'net_up' },
      ]);
    });

    it('an unchanged line of an element removed is read as a new line', () => {
      // B's line gone: its priority line is under A's lines, A's (the last of its key)
      expect(edited(without(5))).to.deep.equal([
        { iStarId: A, key: 'priority', value: 'low' },
        { remove: B },
      ]);
    });

    describe('an orphan is repaired by its element’s line written again', () => {
      const MISSING = 'f00dcafe-1111-4000-8000-000000000001';
      const orphaned = (
        missing: readonly string[],
        properties: Record<string, string> = {},
      ): DocumentTree => ({
        roots: ['a'],
        nodes: new Map([['a', goal('a', 'Back up')]]),
        links: missing.map((end, i) => ({
          iStarId: `link-${i}`,
          kind: 'x',
          source: 'a',
          target: null,
          ends: {
            source: { iStarId: A, kind: 'fw.BehavioralGoal' },
            target: { iStarId: end, kind: null },
          },
          properties: i === 0 ? properties : {},
        })),
        orphans: missing.map((end, i) => ({
          iStarId: `link-${i}`,
          kind: 'x',
          source: 'a',
          target: null,
          missing: [end],
        })),
      });
      const again = (text: string, from: DocumentTree) =>
        notationEdits(
          plain,
          `behavioral_goal aaaaaaaa: Back up\n${text}`,
          from,
          { newId: ids() },
        );

      it('by its short id', () => {
        expect(
          creates(again('behavioral_goal f00dcafe: Gone', orphaned([MISSING]))),
        ).to.deep.include.members([
          {
            iStarId: MISSING,
            kind: 'fw.BehavioralGoal',
            text: 'Gone',
            properties: {},
            after: 'a',
            line: 1,
            writeId: null,
          },
        ]);
      });

      it('by the id its author wrote, kept on its orphans, which is cleared (N2)', () => {
        const from = orphaned([MISSING], {
          [MISSING_END_ID_KEYS.target]: 'net_up',
        });
        expect(
          again('behavioral_goal net_up: Internet connection available', from),
        ).to.deep.equal([
          {
            create: {
              iStarId: MISSING,
              kind: 'fw.BehavioralGoal',
              text: 'Internet connection available',
              properties: { [WRITTEN_ID_KEY]: 'net_up' },
              after: 'a',
              line: 1,
              writeId: null,
            },
          },
          { link: 'link-0', key: MISSING_END_ID_KEYS.target, value: null },
        ]);
        // by its short id too
        expect(
          creates(again('behavioral_goal f00dcafe: Internet', from))[0],
        ).to.have.property('iStarId', MISSING);
        // not by another id
        expect(
          creates(again('behavioral_goal other: Internet', from))[0],
        ).to.have.property('iStarId', '7857cb00-1111-2222');
      });

      it('not when two missing ends show the id: a new element, the orphans stay', () => {
        const twin = 'f00dcafe-2222-4000-8000-000000000002';
        const both = orphaned([MISSING, twin]);
        expect(
          creates(again('behavioral_goal f00dcafe: Gone', both))[0],
        ).to.have.property('iStarId', '7857cb00-1111-2222');
        // the id its author wrote tells them apart
        const told = orphaned([MISSING, twin], {
          [MISSING_END_ID_KEYS.target]: 'net_up',
        });
        expect(
          creates(again('behavioral_goal net_up: Gone', told))[0],
        ).to.have.property('iStarId', MISSING);
      });
    });
  });

  describe('6. a line being typed, or an error, edits nothing and changes no other line', () => {
    it('in place of an element line: the element stays, its lines its own', () => {
      for (const typing of [
        'behavioral_g',
        'behavioral_goal',
        'zzz foo: Bar',
        '  agent',
      ])
        expect(edited(replaced(5, typing)), typing).to.deep.equal([]);
    });

    it('in place of a property line: the property stays', () => {
      expect(edited(replaced(6, '  prio'))).to.deep.equal([]);
      expect(edited(replaced(1, '  descr'))).to.deep.equal([]);
    });

    it('another kind’s word on an element’s line: the element stays, unchanged', () => {
      expect(
        edited(replaced(7, 'behavioral_goal cccccccc: Operator')),
      ).to.deep.equal([]);
    });

    it('a second line with an element’s id (a copy): nothing', () => {
      expect(edited(insertAfter(0, lines[0]!))).to.deep.equal([]);
      expect(edited(insertAfter(6, lines[0]!))).to.deep.equal([]);
      expect(
        edited(insertAfter(6, 'behavioral_goal aaaaaaaa: Copy')),
      ).to.deep.equal([]);
      // two new lines with one id
      expect(edited(`${doc}\nagent ops: One\nagent ops: Two`)).to.deep.equal(
        [],
      );
      // renamed to an id another line shows
      expect(
        edited(replaced(5, 'behavioral_goal aaaaaaaa: Restore')),
      ).to.deep.equal([]);
    });

    it('elsewhere, a complete line still creates, a line removed still removes', () => {
      const text = `${insertAfter(6, '  zz')}\nagent Auditor`;
      expect(creates(edited(text))).to.have.length(1);
      expect(
        edited(
          insertAfter(0, '  zz').replace('\nagent cccccccc: Operator', ''),
        ),
      ).to.deep.equal([{ remove: 'cccccccc-0000-c' }]);
    });

    it('the lines under one being typed are none’s', () => {
      expect(
        edited(insertAfter(6, 'behavioral_goal\n  priority top')),
      ).to.deep.equal([]);
    });
  });
});
