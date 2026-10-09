/** The Notation view's lines and document, and the inspector's operator buttons (src/notation, src/print.ts). */
import type { DocumentNode } from '@goal-controller/dialect';
import { expect } from 'chai';
import {
  elementLine,
  isValidName,
  lineId,
  notationDocument,
  notationEdits,
  operatorsFor,
  propertyLine,
  readLine,
  readPropertyLine,
  writeAnnotations,
  writeDeclaration,
} from '../src/index.js';
import { node, toy } from '../../dialect/test/support/toy.js';

describe('operatorsFor', () => {
  it('gives the constructs in the constructs’ order, the standalone last', () => {
    const { constructs } = operatorsFor(toy);
    expect(constructs.map((b) => [b.symbol, b.construct])).to.deep.equal([
      [';', 'sequence'],
      ['|', 'fallback'],
      ['*', 'any'],
    ]);
    expect(constructs[0]!.title).to.equal('Sequence: one after another');
    expect(constructs[0]!.write(['G2', 'T3'])).to.equal('G2;T3');
    expect(constructs[2]!.write(['G2', 'T3'])).to.equal('*');
  });

  it('offers a postfix argument where it applies', () => {
    const [retry] = operatorsFor(toy).arguments;
    expect(retry!.text).to.equal('@2');
    expect(retry!.label).to.equal('tries');
    expect(retry!.appliesTo).to.deep.equal(['fallback']);
    expect(retry!.title).to.equal('Try the first child 2 times');
    expect(retry!.write('G2|G3')).to.equal('G2@2|G3');
    expect(retry!.write('[G2;G3]|G4')).to.equal('[G2;G3]|G4');
    expect(retry!.present('G2@2|G3')).to.equal(true);
    expect(retry!.present('G2|G3')).to.equal(false);
  });
});

describe('lines', () => {
  it('writes and reads element lines', () => {
    expect(
      elementLine(toy, { id: 'G1', name: ' Go ', notation: ' G2;T3 ' }),
    ).to.equal('G1: Go [G2;T3]');
    expect(elementLine(toy, { id: 'G1', name: 'Go', notation: '  ' })).to.equal(
      'G1: Go',
    );
    const read = readLine(toy, '  G1: Go [G2;T3]');
    expect(
      read.kind === 'element' && [read.id, read.name, read.text],
    ).to.deep.equal(['G1', 'Go', 'G1: Go [G2;T3]']);
    expect(read.kind === 'element' && read.notation?.text).to.equal('G2;T3');
    expect(lineId(toy, '    T12: Do it')).to.equal('T12');
    expect(lineId(toy, 'robot r2')).to.equal(null);
    expect(lineId(toy, '[G2]')).to.equal(null);
  });

  it('writes and reads property lines', () => {
    expect(propertyLine('robot', ' r2 ')).to.equal('robot r2');
    expect(propertyLine('hidden', '')).to.equal('hidden');
    expect(readPropertyLine(toy, '   robot r2 ')).to.deep.equal({
      key: 'robot',
      value: 'r2',
    });
    expect(readPropertyLine(toy, '  hidden')).to.deep.equal({
      key: 'hidden',
      value: '',
    });
    expect(readPropertyLine(toy, 'unknown 3')).to.equal(null);
  });

  it('writes declarations and annotations, optional parts only when complete', () => {
    const int = {
      type: 'int',
      lowerBound: '0',
      upperBound: '9',
      initialValue: '5',
    };
    expect(writeDeclaration(int)).to.equal('{int 0..9 = 5}');
    expect(writeDeclaration({ type: 'bool', initialValue: 'yes' })).to.equal(
      '{bool = yes}',
    );
    expect(writeDeclaration({ type: 'int', lowerBound: '0' })).to.equal(
      '{int}',
    );
    expect(writeDeclaration({ initialValue: '3' })).to.equal(null);
    expect(
      writeAnnotations({ stereotype: 'action', tag: 'type', tagValue: 'duty' }),
    ).to.equal('<<action>> {type = duty}');
    expect(writeAnnotations({ tag: 'Note' })).to.equal('{Note}');
    expect(writeAnnotations({})).to.equal(null);
  });

  it('reads declarations with any spacing, and where they are', () => {
    const read = readLine(toy, 'R1: Fuel {int 0 .. 9=5}');
    expect(read.kind === 'element' && read.declaration).to.deep.equal({
      properties: {
        type: 'int',
        lowerBound: '0',
        upperBound: '9',
        initialValue: '5',
      },
      span: { from: 9, to: 23 },
    });
    expect(read.kind === 'element' && read.text).to.equal('R1: Fuel');
    const typing = readLine(toy, 'R1: Fuel {int 0..}');
    expect(typing.errors).to.not.deep.equal([]);
  });

  it('checks names as the language reads them', () => {
    expect(isValidName(toy, 'goal', "Don't stop")).to.equal(true);
    expect(isValidName(toy, 'goal', 'G2 [x]')).to.equal(false);
    expect(isValidName(toy, 'goal', 'Step 2')).to.equal(false);
    expect(isValidName(toy, 'quality', 'any: thing')).to.equal(true);
  });
});

describe('document', () => {
  const tree = {
    roots: ['G1'],
    nodes: new Map<string, DocumentNode>([
      [
        'G1',
        node({
          id: 'G1',
          kind: 'goal',
          name: 'Go',
          notation: 'T1;G2',
          children: ['T1', 'G2', 'R1'],
          properties: { deadline: '9', priority: 'high' },
        }),
      ],
      [
        'T1',
        node({
          id: 'T1',
          kind: 'task',
          name: 'Do',
          properties: { robot: 'r2' },
        }),
      ],
      ['G2', node({ id: 'G2', kind: 'goal', name: 'Wait' })],
      [
        'R1',
        node({
          id: 'R1',
          kind: 'resource',
          name: 'Fuel',
          properties: { type: 'bool', initialValue: 'yes' },
        }),
      ],
    ]),
  };

  it('writes the model in property-line order, indented by depth', () => {
    expect(notationDocument(toy, tree)).to.deep.equal({
      text: 'G1: Go [T1;G2]\n  priority high\n  deadline 9\n  T1: Do\n    robot r2\n  G2: Wait\n  R1: Fuel {bool = yes}',
      ids: ['G1', 'G1', 'G1', 'T1', 'T1', 'G2', 'R1'],
    });
  });

  it('maps text edits back to properties and texts', () => {
    const { text } = notationDocument(toy, tree);
    expect(notationEdits(toy, text, tree)).to.deep.equal([]);
    const edited = text
      .replace('robot r2', 'robot r3')
      .replace('  deadline 9\n', '')
      .replace('{bool = yes}', '{bool = no}')
      .replace('G2: Wait', 'G2: Later');
    expect(notationEdits(toy, edited, tree)).to.deep.equal([
      // an element's text is its line (id and notation included), without its declaration
      { iStarId: 'i-G2', text: 'G2: Later' },
      { iStarId: 'i-R1', key: 'initialValue', value: 'no' },
      { iStarId: 'i-G1', key: 'deadline', value: null },
      { iStarId: 'i-T1', key: 'robot', value: 'r3' },
    ]);
    // an unreadable line keeps the element's properties
    expect(
      notationEdits(toy, text.replace('  deadline 9', '  dead'), tree),
    ).to.deep.equal([]);
    // and so does a declaration being typed
    expect(
      notationEdits(toy, text.replace('{bool = yes}', '{bool = '), tree),
    ).to.deep.equal([]);
  });
});
