import { expect } from 'chai';
import {
  constructDefinition,
  constructOf,
  declarationOf,
  constructsWith,
  defineDialect,
  elementLine,
  evaluateCondition,
  fillOf,
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
  inputOf,
  isValidName,
  writeDeclaration,
  type DocumentNode,
  type DialectDefinition,
} from '@goal-controller/dialect';
import { edge, edgeLangium, edgeV2 } from '../../src';
import { node } from './support/document';

describe('defineDialect', () => {
  it('freezes the definition', () => {
    expect(Object.isFrozen(edgeV2.notation.operators)).to.equal(true);
    expect(() => {
      (edgeV2.notation.operators as unknown as unknown[]).push(1);
    }).to.throw();
  });

  it('rejects names it does not declare', () => {
    const bad = (change: (d: DialectDefinition) => DialectDefinition) => () =>
      defineDialect(change(structuredClone(edgeV2) as DialectDefinition));
    expect(
      bad((d) => ({
        ...d,
        notation: {
          ...d.notation!,
          operators: [
            { symbol: '%', form: 'infix', construct: 'nope', assoc: 'left' },
          ],
        },
      })),
    ).to.throw(/unknown construct nope/);
    expect(
      bad((d) => ({ ...d, propertyLineOrder: d.propertyLineOrder.slice(1) })),
    ).to.throw(/propertyLineOrder/);
    expect(
      bad((d) => ({
        ...d,
        properties: {
          ...d.properties,
          task: [
            {
              key: 'x',
              value: { type: 'expression', language: 'nope' },
              help: '',
            },
          ],
        },
        propertyLineOrder: [...d.properties.goal.map((p) => p.key), 'x'],
      })),
    ).to.throw(/unknown language nope/);
  });

  it('derives edgeLangium from edgeV2', () => {
    expect(edgeLangium.parser).to.equal('langium');
    expect(edgeLangium.notation).to.equal(edgeV2.notation);
    expect(edgeLangium.properties).to.equal(edgeV2.properties);
  });

  it('shares one property list across the Edge engines', () => {
    expect(edge.properties).to.equal(edgeV2.properties);
  });
});

describe('operatorsFor', () => {
  // the inspector's hand-written operator arrays (main @ 34ba682)
  it('gives EdgeV2 its buttons in the inspector order', () => {
    const { constructs } = operatorsFor(edgeV2);
    expect(constructs.map((b) => [b.symbol, b.construct])).to.deep.equal([
      [';', 'sequence'],
      ['+', 'anyOrder'],
      ['#', 'interleaved'],
      ['|', 'alternative'],
      ['?', 'choice'],
      ['->', 'degradation'],
    ]);
    expect(constructs[0]!.title).to.equal(
      'Sequence: does every child, one after another',
    );
    expect(constructs[0]!.write(['G2', 'G3'])).to.equal('G2;G3');
  });

  it('gives Edge its operators with the standalone choice last', () => {
    const { constructs } = operatorsFor(edge);
    expect(constructs.map((b) => [b.symbol, b.construct])).to.deep.equal([
      [';', 'sequence'],
      ['#', 'interleaved'],
      ['|', 'alternative'],
      ['->', 'degradation'],
      ['+', 'choice'],
    ]);
    const choice = constructs[4]!;
    expect(choice.title).to.equal('Choice (Edge notation: a standalone +)');
    expect(choice.write(['G2', 'G3'])).to.equal('+');
  });

  it('offers the retry argument in degradations', () => {
    const [retry] = operatorsFor(edgeV2).arguments;
    expect(retry!.text).to.equal('@3');
    expect(retry!.label).to.equal('retries');
    expect(retry!.appliesTo).to.deep.equal(['degradation']);
    expect(retry!.title).to.equal(
      'Retry the first child up to 3 times before falling back',
    );
    expect(retry!.write('G2->G3')).to.equal('G2@3->G3');
    expect(retry!.write('T1.2->G3')).to.equal('T1.2@3->G3');
    expect(retry!.present('G2@3->G3')).to.equal(true);
    expect(retry!.present('G2->G3')).to.equal(false);
  });

  it('reads constructs and relations', () => {
    expect(constructOf(edgeV2, '?')).to.equal('choice');
    expect(constructOf(edge, '+')).to.equal('choice');
    expect(constructOf(edgeV2, '@')).to.equal(null);
    expect(constructsWith(edgeV2, 'and')).to.deep.equal([
      'sequence',
      'anyOrder',
      'interleaved',
    ]);
    expect(constructsWith(edgeV2, 'or')).to.deep.equal([
      'alternative',
      'choice',
      'degradation',
    ]);
    expect(relationMismatch(edgeV2, 'sequence', 'and')).to.equal(null);
    expect(relationMismatch(edgeV2, 'decisionMaking', 'or')).to.equal(null);
    expect(relationMismatch(edgeV2, 'sequence', 'or')).to.equal(
      'Sequence needs AND refinement links, but this goal is refined with OR links (the engine ignores the notation)',
    );
  });
});

const RESOURCE = edgeV2.elements.resource.declaration;

describe('lines', () => {
  it('writes and reads element lines', () => {
    const line = elementLine(edgeV2, {
      id: 'G1',
      name: ' Go ',
      notation: ' G2;G3 ',
    });
    expect(line).to.equal('G1: Go [G2;G3]');
    expect(
      elementLine(edgeV2, { id: 'G1', name: 'Go', notation: '  ' }),
    ).to.equal('G1: Go');
    expect(readElementLine(edgeV2, '  G1: Go [G2;G3]')).to.deep.equal({
      id: 'G1',
      name: 'Go',
      notation: 'G2;G3',
    });
    expect(lineId(edgeV2, '    T1.2: Do it')).to.equal('T1.2');
    expect(lineId(edgeV2, 'maintain x > 2')).to.equal(null);
  });

  it('writes and reads property lines', () => {
    expect(propertyLine(edgeV2, 'maintain', ' battery > 20 ')).to.equal(
      'maintain battery > 20',
    );
    expect(propertyLine(edgeV2, 'root', '')).to.equal('root');
    expect(readPropertyLine(edgeV2, '   maintain battery > 20 ')).to.deep.equal(
      {
        key: 'maintain',
        value: 'battery > 20',
      },
    );
    expect(readPropertyLine(edgeV2, '  root')).to.deep.equal({
      key: 'root',
      value: '',
    });
    expect(readPropertyLine(edgeV2, 'unknown 3')).to.equal(null);
  });

  it('finds the declaration on the element that has one', () => {
    expect(declarationOf(edgeV2, 'resource')).to.equal(RESOURCE);
    expect(declarationOf(edgeV2, 'goal')).to.equal(undefined);
    expect(declarationOf(edgeV2, 'quality')).to.equal(undefined);
  });

  it('writes and reads declarations', () => {
    const int = {
      type: 'int',
      lowerBound: '0',
      upperBound: '100',
      initialValue: '80',
    };
    expect(writeDeclaration(RESOURCE, int)).to.equal('{int 0..100 = 80}');
    expect(
      writeDeclaration(RESOURCE, { type: 'bool', initialValue: 'false' }),
    ).to.equal('{bool = false}');
    expect(
      writeDeclaration(RESOURCE, { type: 'int', lowerBound: '0' }),
    ).to.equal('{int}');
    expect(writeDeclaration(RESOURCE, { initialValue: '3' })).to.equal(null);
    expect(
      readDeclaration(RESOURCE, 'R1: Battery {int 0 .. 100=80}'),
    ).to.deep.equal({
      text: 'R1: Battery',
      declared: true,
      properties: int,
    });
    expect(readDeclaration(RESOURCE, 'R1: Battery {int 0..}')).to.deep.equal({
      text: 'R1: Battery',
      declared: true,
      properties: null,
    });
    expect(readDeclaration(RESOURCE, 'R1: Battery').declared).to.equal(false);
  });
});

describe('properties', () => {
  it('lists the keys per kind', () => {
    const goal: readonly (
      | 'root'
      | 'type'
      | 'maintain'
      | 'assertion'
      | 'maxRetries'
      | 'utility'
      | 'cost'
      | 'dependsOn'
      | 'variables'
    )[] = propertyKeys(edgeV2, 'goal');
    expect([...goal].sort()).to.deep.equal([
      'assertion',
      'cost',
      'dependsOn',
      'maintain',
      'maxRetries',
      'root',
      'type',
      'utility',
      'variables',
    ]);
    expect(propertyKeys(edge, 'quality')).to.deep.equal([]);
  });

  it('evaluates conditions', () => {
    const when = { when: { key: 'type', equals: 'int' } } as const;
    expect(evaluateCondition(when, { type: 'int' }, false)).to.equal(true);
    expect(evaluateCondition(when, {}, false)).to.equal(false);
    expect(evaluateCondition({ not: when }, {}, false)).to.equal(true);
    expect(evaluateCondition('always', {}, false)).to.equal(true);
    expect(evaluateCondition(undefined, {}, true)).to.equal(true);
  });

  it('builds specs, binding checks by name', () => {
    const calls: string[] = [];
    const registry = new Proxy(
      {},
      {
        get: (_, name: string) => () => (calls.push(name), null),
      },
    ) as Record<string, (...args: unknown[]) => null>;
    const specs = specsFromDefinition(edgeV2, registry);
    expect(specs.goal.map((s) => s.key)).to.not.include('root');
    const initial = specs.resource.find((s) => s.key === 'initialValue')!;
    expect(inputOf(initial, { type: 'int' })).to.deep.equal({
      kind: 'integer',
    });
    expect(inputOf(initial, { type: 'bool' }).kind).to.equal('select');
    const lower = specs.resource.find((s) => s.key === 'lowerBound')!;
    expect(lower.notApplying!({})).to.equal(
      'Not used while type is unset (bounds are for int resources)',
    );
    lower.validate!({}, { self: 'R1', kindOf: () => undefined });
    expect(calls).to.deep.equal(['edge.resource.lowerBound']);
    expect(() => specsFromDefinition(edgeV2, {})).to.throw(/no check named/);
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
          notation: 'T1;R1',
          children: ['T1', 'R1'],
          properties: { type: 'maintain', maintain: 'x' },
        }),
      ],
      ['T1', node({ id: 'T1', kind: 'task' })],
      [
        'R1',
        node({
          id: 'R1',
          kind: 'resource',
          properties: { type: 'bool', initialValue: 'true' },
        }),
      ],
      ['Q1', node({ id: 'Q1', kind: 'quality' })],
    ]),
  };

  it('writes the model, indented by depth', () => {
    expect(notationDocument(edgeV2, tree)).to.deep.equal({
      text: 'G1: G1 [T1;R1]\n  maintain x\n  type maintain\n  T1: T1\n  R1: R1 {bool = true}',
      ids: ['G1', 'G1', 'G1', 'T1', 'R1'],
    });
  });

  it('maps text edits back', () => {
    const { text } = notationDocument(edgeV2, tree);
    expect(notationEdits(edgeV2, text, tree)).to.deep.equal([]);
    const edited = text
      .replace('maintain x', 'maintain y')
      .replace('  type maintain\n', '')
      .replace('{bool = true}', '{bool = false}');
    expect(notationEdits(edgeV2, edited, tree)).to.deep.equal([
      { iStarId: 'i-R1', key: 'initialValue', value: 'false' },
      { iStarId: 'i-G1', key: 'maintain', value: 'y' },
      { iStarId: 'i-G1', key: 'type', value: null },
    ]);
    // an unreadable line keeps the element's properties
    expect(
      notationEdits(edgeV2, text.replace('  type maintain', '  typ'), tree),
    ).to.deep.equal([]);
  });
});

describe('fillOf', () => {
  it('falls back to the default fill', () => {
    expect(fillOf(edgeV2, 'resource')).to.equal('#FAF383');
    expect(fillOf(edgeV2, 'goal')).to.equal('#CDFECD');
    expect(fillOf(edgeV2, 'quality')).to.equal('#CDFECD');
  });
});

describe('names and constructs', () => {
  it('checks names with the kind charset', () => {
    expect(isValidName(edgeV2, 'goal', "Don't stop - go")).to.equal(true);
    expect(isValidName(edgeV2, 'goal', 'G2 [x]')).to.equal(false);
    expect(isValidName(edgeV2, 'quality', 'any: thing')).to.equal(true);
  });

  it('looks constructs up by name', () => {
    expect(constructDefinition(edgeV2, 'choice')?.relation).to.equal('or');
    expect(constructDefinition(edgeV2, 'decisionMaking')?.relation).to.equal(
      undefined,
    );
    expect(constructDefinition(edgeV2, 'nope')).to.equal(undefined);
  });
});
