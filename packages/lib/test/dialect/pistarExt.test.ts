/**
 * piStar-ext's stereotypes and tagged values as element-line annotations
 * (iStar4RationalAgents' over EdgeV2, src/extensions): written from
 * properties, read back as property edits, checked, offered in the inspector.
 * The engines without annotations read as before (the harness).
 */
import { expect } from 'chai';
import {
  completionsAt,
  contextFromView,
  defineDialect,
  documentDiagnostics,
  inputOf,
  lineId,
  notationDocument,
  notationEdits,
  readAnnotations,
  readElementLine,
  specsFromDefinition,
  splitAnnotations,
  writeAnnotations,
  type DocumentNode,
  type DocumentTree,
  type AnyDialect,
  type DialectDefinition,
} from '@goal-controller/dialect';
import { edgeV2, istar4RationalAgents } from '../../src';
import { node } from './support/document';
import { ra, withStereotypes } from './support/extensions';

const { stereotype: stereotypeAnnotation, taggedValue: taggedValueAnnotation } =
  istar4RationalAgents.annotations;
const annotations = [stereotypeAnnotation, taggedValueAnnotation];

/** The document nodes' properties after a document's edits. */
const applied = (tree: DocumentTree, doc: string): DocumentTree => {
  const nodes = new Map(
    [...tree.nodes].map(([id, n]) => [
      id,
      { ...n, properties: { ...n.properties } } as DocumentNode,
    ]),
  );
  const byIStarId = new Map([...nodes.values()].map((n) => [n.iStarId, n]));
  for (const edit of notationEdits(ra, doc, tree)) {
    const target = byIStarId.get(edit.iStarId)!;
    const properties = target.properties as Record<string, string>;
    if (!('key' in edit)) continue;
    if (edit.value === null) delete properties[edit.key];
    else properties[edit.key] = edit.value;
  }
  return { ...tree, nodes };
};

describe('piStar-ext annotations', () => {
  const tree: DocumentTree = {
    roots: ['G1'],
    nodes: new Map<string, DocumentNode>([
      [
        'G1',
        node({
          id: 'G1',
          kind: 'goal',
          name: 'Accommodation booked',
          notation: 'T1;T2',
          children: ['T1', 'T2', 'R1'],
          properties: { tag: 'Id', tagValue: 'G1' },
        }),
      ],
      [
        'T1',
        node({
          id: 'T1',
          kind: 'task',
          name: 'Book a room',
          properties: {
            stereotype: 'action',
            tag: 'type',
            tagValue: 'duty',
            cost: '2',
          },
        }),
      ],
      ['T2', node({ id: 'T2', kind: 'task', name: 'Pay' })],
      [
        'R1',
        node({
          id: 'R1',
          kind: 'resource',
          name: 'Budget',
          properties: {
            type: 'int',
            lowerBound: '0',
            upperBound: '100',
            initialValue: '80',
            tag: 'Status',
          },
        }),
      ],
    ]),
  };
  const expected = [
    '{Id = G1} G1: Accommodation booked [T1;T2]',
    '  <<action>> {type = duty} T1: Book a room',
    '    cost 2',
    '  T2: Pay',
    '  {Status} R1: Budget {int 0..100 = 80}',
  ].join('\n');

  describe('the definition', () => {
    it('declares the profile on top of EdgeV2', () => {
      expect(ra.elements.task?.annotations).to.deep.equal(annotations);
      expect(ra.elements.goal?.annotations).to.deep.equal(annotations);
      expect(ra.notation).to.equal(edgeV2.notation);
      // what annotations write is not a property line
      expect(ra.propertyLineOrder).to.equal(edgeV2.propertyLineOrder);
      expect(edgeV2.elements.task).not.to.have.property('annotations');
    });

    it('rejects an annotation writing a property the kind does not have', () => {
      const base = structuredClone(edgeV2) as DialectDefinition;
      expect(() =>
        defineDialect({
          ...base,
          elements: {
            ...base.elements,
            goal: { ...base.elements.goal!, annotations },
          },
        }),
      ).to.throw(/goal line declares unknown stereotype/);
    });

    it('expresses a grouper as one profile on several kinds', () => {
      const grouped = withStereotypes(
        { intentional: ['istar.Goal', 'istar.Task'] },
        [{ name: 'Business', appliesTo: ['intentional'] }],
      );
      expect(
        grouped.properties.goal!.find((p) => p.key === 'stereotype'),
      ).to.deep.equal(
        grouped.properties.task!.find((p) => p.key === 'stereotype'),
      );
    });
  });

  describe('lines', () => {
    it('reads the id and name after the annotations', () => {
      const line = '  <<action>> {type = duty} T1: Book a room';
      expect(lineId(ra, line)).to.equal('T1');
      expect(readElementLine(ra, line)).to.deep.equal({
        id: 'T1',
        name: 'Book a room',
        notation: null,
      });
      expect(splitAnnotations(ra, line)).to.deep.equal({
        groups: [
          { text: '<<action>>', from: 2 },
          { text: '{type = duty}', from: 13 },
        ],
        rest: ' T1: Book a room',
        offset: 26,
      });
      // a definition without annotations reads the whole line
      expect(splitAnnotations(edgeV2, line).rest).to.equal(line);
    });

    it("reads piStar-ext's own spacing, and writes the paper's", () => {
      const read = readAnnotations(annotations, ['<<goal-based>>', '{Id=G1}']);
      expect(read.properties).to.deep.equal({
        stereotype: 'goal-based',
        tag: 'Id',
        tagValue: 'G1',
      });
      expect(writeAnnotations(annotations, read.properties)).to.equal(
        '<<goal-based>> {Id = G1}',
      );
      // multi-word stereotypes and tag names (Reference to)
      expect(
        readAnnotations(annotations, [
          '<<model-based reflex>>',
          '{Reference to = R2}',
        ]).properties,
      ).to.deep.equal({
        stereotype: 'model-based reflex',
        tag: 'Reference to',
        tagValue: 'R2',
      });
    });

    it('reads each annotation once, in any order', () => {
      expect(
        readAnnotations(annotations, ['{Id}', '<<action>>']),
      ).to.deep.equal({
        properties: { tag: 'Id', tagValue: undefined, stereotype: 'action' },
        read: [{ tag: 'Id', tagValue: undefined }, { stereotype: 'action' }],
      });
      expect(
        readAnnotations(annotations, ['<<a>>', '<<b>>']).read,
      ).to.deep.equal([{ stereotype: 'a' }, null]);
      expect(readAnnotations(annotations, ['{}']).read).to.deep.equal([null]);
    });

    it('writes nothing when the first property is unset', () => {
      expect(writeAnnotations(annotations, { tagValue: 'x' })).to.equal(null);
      expect(writeAnnotations(annotations, {})).to.equal(null);
    });
  });

  describe('document', () => {
    it('writes annotations before the element lines', () => {
      expect(notationDocument(ra, tree).text).to.equal(expected);
      // EdgeV2 reads the same model without them
      expect(notationDocument(edgeV2, tree).text).to.equal(
        expected
          .replace('{Id = G1} ', '')
          .replace('<<action>> {type = duty} ', '')
          .replace('{Status} ', ''),
      );
    });

    it('maps annotation edits back to properties', () => {
      expect(notationEdits(ra, expected, tree)).to.deep.equal([]);
      const edited = expected
        .replace('<<action>> {type = duty}', '<<action>> {type=right}')
        .replace('{Id = G1} ', '')
        .replace('  T2: Pay', '  <<action>> T2: Pay')
        .replace('{Status}', '{Status = done}');
      expect(notationEdits(ra, edited, tree)).to.deep.equal([
        { iStarId: 'i-G1', key: 'tag', value: null },
        { iStarId: 'i-G1', key: 'tagValue', value: null },
        { iStarId: 'i-T1', key: 'tagValue', value: 'right' },
        { iStarId: 'i-T2', key: 'stereotype', value: 'action' },
        { iStarId: 'i-R1', key: 'tagValue', value: 'done' },
      ]);
      // the element text is not touched: annotations are properties
      expect(
        notationEdits(ra, edited, tree).some((edit) => 'text' in edit),
      ).to.equal(false);
    });

    it('round-trips: doc → edits → model → doc', () => {
      const edited = expected
        .replace('{type = duty}', '{type=right}')
        .replace('  T2: Pay', '  <<action>> {Logic = A and B} T2: Pay');
      const next = applied(tree, edited);
      const doc = notationDocument(ra, next).text;
      expect(doc).to.equal(
        expected
          .replace('{type = duty}', '{type = right}')
          .replace('  T2: Pay', '  <<action>> {Logic = A and B} T2: Pay'),
      );
      expect(notationEdits(ra, doc, next)).to.deep.equal([]);
    });

    it('changes no annotation while one cannot be read', () => {
      const edited = expected.replace(
        '<<action>> {type = duty}',
        '<<action>> {}',
      );
      expect(notationEdits(ra, edited, tree)).to.deep.equal([]);
    });

    it('still edits names and notations on annotated lines', () => {
      const edited = expected
        .replace('Accommodation booked [T1;T2]', 'Room booked [T2;T1]')
        .replace('T1: Book a room', 'T1: Book');
      expect(notationEdits(ra, edited, tree)).to.deep.equal([
        { iStarId: 'i-G1', text: 'G1: Room booked [T2;T1]' },
        { iStarId: 'i-T1', text: 'T1: Book' },
      ]);
    });
  });

  describe('inspector', () => {
    const specs = specsFromDefinition(
      ra,
      new Proxy({}, { get: () => () => null }),
    );

    it('offers the stereotypes and tags the kind declares', () => {
      const task = specs.task!.map((s) => s.key);
      expect(task.slice(-3)).to.deep.equal(['stereotype', 'tag', 'tagValue']);
      // a goal has none declared, but may carry one: the select has only "none"
      const goalStereotype = specs.goal!.find((s) => s.key === 'stereotype')!;
      expect(inputOf(goalStereotype, {})).to.deep.equal({
        kind: 'select',
        options: [{ value: '', label: 'none' }],
      });
      const stereotype = specs.task!.find((s) => s.key === 'stereotype')!;
      expect(inputOf(stereotype, {})).to.deep.equal({
        kind: 'select',
        options: [
          { value: '', label: 'none' },
          { value: 'action', label: 'action' },
        ],
      });
      const tag = specs.task!.find((s) => s.key === 'tag')!;
      expect(inputOf(tag, {})).to.have.nested.property(
        'options[5].value',
        'type',
      );
    });

    it("lists a tag's values when they are listed", () => {
      const value = specs.task!.find((s) => s.key === 'tagValue')!;
      expect(inputOf(value, { tag: 'type' })).to.deep.equal({
        kind: 'select',
        options: [
          { value: '', label: 'none' },
          { value: 'duty', label: 'duty' },
          { value: 'right', label: 'right' },
        ],
      });
      expect(inputOf(value, { tag: 'Id' })).to.deep.equal({ kind: 'text' });
    });
  });

  describe('diagnostics and completion', () => {
    const context = contextFromView(ra, tree, []);

    it('points at the id after the annotations', () => {
      const doc = '{Id = G9} G9: Missing';
      expect(documentDiagnostics(ra, doc, context)).to.deep.equal([
        {
          from: 10,
          to: 12,
          severity: 'error',
          message: 'Add this element in the diagram',
        },
      ]);
    });

    it('flags an annotation the kind cannot read', () => {
      // each annotation once: a second stereotype is not read
      const doc = expected.replace(
        '{Id = G1}',
        '<<Business>> <<Other>> {Id = G1}',
      );
      const [diagnostic] = documentDiagnostics(ra, doc, context);
      expect(diagnostic).to.deep.equal({
        from: 13,
        to: 22,
        severity: 'error',
        message: 'This annotation cannot be read',
      });
    });

    it('places notation problems after the annotations', () => {
      const doc = expected.replace('[T1;T2]', '[T1;T3]');
      const at = doc.indexOf('T3');
      expect(
        documentDiagnostics(ra, doc, context).filter(
          (d) => d.message === 'Not a child of this goal',
        ),
      ).to.deep.equal([
        {
          from: at,
          to: at + 2,
          severity: 'error',
          message: 'Not a child of this goal',
        },
      ]);
    });

    it('runs the checks an annotated property names', () => {
      const checked = withStereotypes({}, []);
      const withCheck = defineDialect({
        ...checked,
        properties: {
          ...checked.properties,
          task: checked.properties.task!.map((p) =>
            p.key === 'tagValue' ? { ...p, check: 'tag.value' } : p,
          ),
        },
      } as AnyDialect);
      const doc = '{Id = bad} T1: Book a room';
      const found = documentDiagnostics(
        withCheck,
        doc,
        contextFromView(withCheck, tree, []),
        { runCheck: (_, p) => (p.tagValue === 'bad' ? 'Bad value' : null) },
      );
      expect(found).to.deep.equal([
        { from: 0, to: 10, severity: 'error', message: 'Bad value' },
      ]);
      // a stereotype none declares is still read (written as typed)
      expect(lineId(withCheck, `<<x>> ${doc}`)).to.equal('T1');
    });

    it('completes children inside an annotated notation', () => {
      const doc = '{Id = G1} G1: Accommodation booked [T';
      expect(
        completionsAt(ra, doc, doc.length, context)?.options.map(
          (o) => o.label,
        ),
      ).to.include.members(['T1', 'T2']);
    });
  });
});
