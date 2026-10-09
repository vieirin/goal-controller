/** What is derived from a definition: operators, lines, properties, specs, documents. */
import { expect } from 'chai';
import {
  constructDefinition,
  constructOf,
  constructsWith,
  declarationOf,
  elementLine,
  evaluateCondition,
  fillOf,
  inputOf,
  isValidName,
  lineId,
  notationDocument,
  notationEdits,
  operatorsFor,
  propertyKeys,
  propertyLine,
  readDeclaration,
  readElementLine,
  readPropertyLine,
  relationMismatch,
  specsFromDefinition,
  writeDeclaration,
  type DocumentNode,
} from '../src';
import { node, toy } from './support/toy';

describe('operatorsFor', () => {
  it('gives the constructs in operator order, the standalone last', () => {
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
    expect(retry!.present('G2@2|G3')).to.equal(true);
    expect(retry!.present('G2|G3')).to.equal(false);
  });

  it('reads constructs and relations', () => {
    expect(constructOf(toy, '|')).to.equal('fallback');
    expect(constructOf(toy, '*')).to.equal('any');
    expect(constructOf(toy, '@')).to.equal(null);
    expect(constructsWith(toy, 'and')).to.deep.equal(['sequence']);
    expect(constructsWith(toy, 'or')).to.deep.equal(['fallback']);
    expect(relationMismatch(toy, 'sequence', 'and')).to.equal(null);
    expect(relationMismatch(toy, 'any', 'or')).to.equal(null);
    expect(relationMismatch(toy, 'sequence', 'or')).to.equal(
      'Sequence needs AND, has OR',
    );
    expect(constructDefinition(toy, 'fallback')?.relation).to.equal('or');
    expect(constructDefinition(toy, 'nope')).to.equal(undefined);
  });
});

const DECLARATION = toy.elements.resource.declaration;

describe('lines', () => {
  it('writes and reads element lines', () => {
    expect(
      elementLine(toy, { id: 'G1', name: ' Go ', notation: ' G2;T3 ' }),
    ).to.equal('G1: Go [G2;T3]');
    expect(elementLine(toy, { id: 'G1', name: 'Go', notation: '  ' })).to.equal(
      'G1: Go',
    );
    expect(readElementLine(toy, '  G1: Go [G2;T3]')).to.deep.equal({
      id: 'G1',
      name: 'Go',
      notation: 'G2;T3',
    });
    expect(lineId(toy, '    T12: Do it')).to.equal('T12');
    expect(lineId(toy, 'robot r2')).to.equal(null);
  });

  it('writes and reads property lines', () => {
    expect(propertyLine(toy, 'robot', ' r2 ')).to.equal('robot r2');
    expect(propertyLine(toy, 'hidden', '')).to.equal('hidden');
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

  it('finds the declaration on the element that has one', () => {
    expect(declarationOf(toy, 'resource')).to.equal(DECLARATION);
    expect(declarationOf(toy, 'goal')).to.equal(undefined);
  });

  it('writes and reads declarations, optional groups only when complete', () => {
    const int = { type: 'int', low: '0', high: '9', initial: '5' };
    expect(writeDeclaration(DECLARATION, int)).to.equal('{int 0..9 = 5}');
    expect(
      writeDeclaration(DECLARATION, { type: 'bool', initial: 'yes' }),
    ).to.equal('{bool = yes}');
    expect(writeDeclaration(DECLARATION, { type: 'int', low: '0' })).to.equal(
      '{int}',
    );
    expect(writeDeclaration(DECLARATION, { initial: '3' })).to.equal(null);
    expect(
      readDeclaration(DECLARATION, 'R1: Fuel {int 0 .. 9=5}'),
    ).to.deep.equal({
      text: 'R1: Fuel',
      declared: true,
      properties: int,
    });
    expect(readDeclaration(DECLARATION, 'R1: Fuel {int 0..}')).to.deep.equal({
      text: 'R1: Fuel',
      declared: true,
      properties: null,
    });
    expect(readDeclaration(DECLARATION, 'R1: Fuel').declared).to.equal(false);
  });

  it('checks names with the kind charset', () => {
    expect(isValidName(toy, 'goal', "Don't stop")).to.equal(true);
    expect(isValidName(toy, 'goal', 'G2 [x]')).to.equal(false);
    expect(isValidName(toy, 'quality', 'any: thing')).to.equal(true);
  });
});

describe('properties', () => {
  it('lists the keys per kind', () => {
    const goal: readonly ('priority' | 'deadline' | 'hidden')[] = propertyKeys(
      toy,
      'goal',
    );
    expect(goal).to.deep.equal(['priority', 'deadline', 'hidden']);
    expect(propertyKeys(toy, 'quality')).to.deep.equal([]);
  });

  it('evaluates conditions', () => {
    const when = { when: { key: 'type', equals: 'int' } } as const;
    expect(evaluateCondition(when, { type: 'int' }, false)).to.equal(true);
    expect(evaluateCondition(when, {}, false)).to.equal(false);
    expect(evaluateCondition({ not: when }, {}, false)).to.equal(true);
    expect(evaluateCondition('always', {}, false)).to.equal(true);
    expect(evaluateCondition(undefined, {}, true)).to.equal(true);
  });

  it('falls back to the default fill', () => {
    expect(fillOf(toy, 'resource')).to.equal('#FFFF00');
    expect(fillOf(toy, 'goal')).to.equal('#00FF00');
    expect(fillOf(toy, 'nope')).to.equal('#FFFFFF');
  });

  it('builds specs, binding checks by name', () => {
    const calls: string[] = [];
    type Check = (properties: object, context: object) => string | null;
    const registry: Record<string, Check> = {
      'toy.goal.deadline': () => (calls.push('deadline'), null),
      'toy.resource.bounds': () => (calls.push('bounds'), 'out of bounds'),
    };
    const specs = specsFromDefinition(toy, registry);
    expect(specs.goal.map((s) => s.key)).to.deep.equal([
      'priority',
      'deadline',
    ]);
    const initial = specs.resource.find((s) => s.key === 'initial')!;
    expect(inputOf(initial, { type: 'int' })).to.deep.equal({
      kind: 'integer',
    });
    expect(inputOf(initial, { type: 'bool' }).kind).to.equal('select');
    const low = specs.resource.find((s) => s.key === 'low')!;
    expect(low.notApplying!({})).to.equal(
      'Bounds are for int resources (type is unset)',
    );
    expect(low.validate!({}, { self: 'R1', kindOf: () => undefined })).to.equal(
      'out of bounds',
    );
    expect(calls).to.deep.equal(['bounds']);
    expect(() => specsFromDefinition(toy, {})).to.throw(/no check named/);
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
          notation: 'T1;G2',
          children: ['T1', 'G2', 'R1'],
          properties: { deadline: '9', priority: 'high' },
        }),
      ],
      ['T1', node({ id: 'T1', kind: 'task', properties: { robot: 'r2' } })],
      ['G2', node({ id: 'G2', kind: 'goal' })],
      [
        'R1',
        node({
          id: 'R1',
          kind: 'resource',
          properties: { type: 'bool', initial: 'yes' },
        }),
      ],
    ]),
  };

  it('writes the model in property-line order, indented by depth', () => {
    expect(notationDocument(toy, tree)).to.deep.equal({
      text: 'G1: G1 [T1;G2]\n  priority high\n  deadline 9\n  T1: T1\n    robot r2\n  G2: G2\n  R1: R1 {bool = yes}',
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
      .replace('G2: G2', 'G2: Later');
    expect(notationEdits(toy, edited, tree)).to.deep.equal([
      // an element's text is its line (id and notation included), without its declaration
      { iStarId: 'i-G2', text: 'G2: Later' },
      { iStarId: 'i-R1', key: 'initial', value: 'no' },
      { iStarId: 'i-G1', key: 'deadline', value: null },
      { iStarId: 'i-T1', key: 'robot', value: 'r3' },
    ]);
    // an unreadable line keeps the element's properties
    expect(
      notationEdits(toy, text.replace('  deadline 9', '  dead'), tree),
    ).to.deep.equal([]);
  });
});
