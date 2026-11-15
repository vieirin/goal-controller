/**
 * A kind's word that is also a key a line starts with (goal-controller#518,
 * tropos4as's `failure`: a kind, and a goal's property): the line is an
 * element's only when an id and a colon follow the word; otherwise it is
 * the property line it was.
 */
import {
  WRITTEN_ID_KEY,
  type AnyDialect,
  type DocumentTree,
} from '@goal-controller/dialect';
import { expect } from 'chai';
import {
  completionsAt,
  contextFromView,
  documentDiagnostics,
  notationEdits,
  readHead,
  readLine,
} from '../src/index.js';

const problems = {
  notAChild: { severity: 'error', message: 'Not a child' },
  missingFromNotation: { severity: 'warning', message: 'Missing' },
  relationMismatch: { severity: 'error', message: 'Mismatch' },
  notInDiagram: { severity: 'error', message: 'Not in the diagram' },
} as const;

/** goals G, tasks T and failures F, a goal's `failure` a property line */
const prefixed = {
  id: 'failing',
  name: 'Failing',
  elements: {
    goal: { prefix: 'G', fill: '' },
    task: { prefix: 'T', fill: '' },
    'x.Failure': { prefix: 'F', fill: '' },
  },
  defaultFill: '',
  properties: {
    goal: [{ key: 'failure', value: { type: 'text' } }],
    task: [],
    'x.Failure': [],
  },
  propertyLineOrder: ['failure'],
  indent: '  ',
  problems,
} as unknown as AnyDialect;

/** the same without ids (tropos4as's) */
const plain = {
  ...prefixed,
  id: 'plainFailing',
  elements: {
    goal: { fill: '' },
    task: { fill: '' },
    'x.Failure': { fill: '' },
  },
} as unknown as AnyDialect;

const EMPTY: DocumentTree = { nodes: new Map(), roots: [] };

for (const [name, definition, id] of [
  ['a prefixed dialect', prefixed, 'F1'],
  ['a dialect without prefixes', plain, 'net_down'],
] as const)
  describe(`a kind word that is a property line's key, in ${name} (#518)`, () => {
    it('reads the key as a property line, and the word with an id as an element line', () => {
      expect(readHead(definition, '  failure x > 3')).to.equal(null);
      const property = readLine(definition, '  failure x > 3');
      expect(property.kind === 'property' && property.key).to.equal('failure');
      const element = readLine(definition, `failure ${id}: Cannot reach`);
      expect(
        element.kind === 'element' && [
          element.word?.kind,
          element.id,
          element.text,
          element.errors.length,
        ],
      ).to.deep.equal(['x.Failure', id, `${id}: Cannot reach`, 0]);
    });

    it('creates the element its line writes, and gives the goal above its property', () => {
      const doc = `goal G1: Deliver\n  failure late\nfailure ${id}: Cannot reach`;
      const edits = notationEdits(definition, doc, EMPTY, {
        newId: () => 'new-id-0001',
      });
      expect(
        edits.map((edit) =>
          'create' in edit
            ? [edit.create.kind, edit.create.text, edit.create.properties]
            : edit,
        ),
      ).to.deep.equal(
        // where ids are any, the written id is kept apart from the name
        definition === plain
          ? [
              [
                'istar.Goal',
                'Deliver',
                { failure: 'late', [WRITTEN_ID_KEY]: 'G1' },
              ],
              ['x.Failure', 'Cannot reach', { [WRITTEN_ID_KEY]: id }],
            ]
          : [
              ['istar.Goal', 'G1: Deliver', { failure: 'late' }],
              ['x.Failure', `${id}: Cannot reach`, {}],
            ],
      );
      expect(
        documentDiagnostics(
          definition,
          doc,
          contextFromView(definition, EMPTY, []),
        ),
      ).to.deep.equal([]);
    });

    it('offers the word at a line’s head', () => {
      const doc = 'goal G1: Deliver\n  fail';
      const found = completionsAt(
        definition,
        doc,
        doc.length,
        contextFromView(definition, EMPTY, []),
      );
      expect(found?.options.map((o) => o.label)).to.include('failure');
    });
  });
