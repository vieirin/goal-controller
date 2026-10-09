import { expect } from 'chai';
import {
  constructDefinition,
  constructOf,
  constructsWith,
  defineDialect,
  evaluateCondition,
  fillOf,
  propertyKeys,
  relationMismatch,
  specsFromDefinition,
  inputOf,
  type DocumentNode,
  type CheckNameOf,
  type DialectDefinition,
} from '@goal-controller/dialect';
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
  writeDeclaration,
} from '@goal-controller/goal-language';
import { edge, edgeV2 } from '../../src';
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
          operators: { ...d.notation!.operators, '^': 'nope' },
        },
      })),
    ).to.throw(/unknown construct nope/);
    expect(
      bad((d) => ({ ...d, propertyLineOrder: d.propertyLineOrder.slice(1) })),
    ).to.throw(/propertyLineOrder/);
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
    const read = readLine(edgeV2, '  G1: Go [G2;G3]');
    expect(
      read.kind === 'element' && [read.id, read.name, read.notation?.text],
    ).to.deep.equal(['G1', 'Go', 'G2;G3']);
    expect(lineId(edgeV2, '    T1.2: Do it')).to.equal('T1.2');
    expect(lineId(edgeV2, 'maintain x > 2')).to.equal(null);
  });

  it('writes and reads property lines', () => {
    expect(propertyLine('maintain', ' battery > 20 ')).to.equal(
      'maintain battery > 20',
    );
    expect(propertyLine('root', '')).to.equal('root');
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

  it('declares on the resource lines only', () => {
    expect(edgeV2.elements.resource.declares).to.equal(true);
    expect(edgeV2.elements.goal).to.not.have.property('declares');
  });

  it('writes and reads declarations', () => {
    const int = {
      type: 'int',
      lowerBound: '0',
      upperBound: '100',
      initialValue: '80',
    };
    expect(writeDeclaration(int)).to.equal('{int 0..100 = 80}');
    expect(writeDeclaration({ type: 'bool', initialValue: 'false' })).to.equal(
      '{bool = false}',
    );
    expect(writeDeclaration({ type: 'int', lowerBound: '0' })).to.equal(
      '{int}',
    );
    expect(writeDeclaration({ initialValue: '3' })).to.equal(null);
    const read = readLine(edgeV2, 'R1: Battery {int 0 .. 100=80}');
    expect(
      read.kind === 'element' && [read.text, read.declaration?.properties],
    ).to.deep.equal(['R1: Battery', int]);
    const typing = readLine(edgeV2, 'R1: Battery {int 0..}');
    expect(typing.kind === 'element' && typing.text).to.equal('R1: Battery');
    expect(typing.errors).to.not.deep.equal([]);
    const none = readLine(edgeV2, 'R1: Battery');
    expect(none.kind === 'element' && none.declaration).to.equal(null);
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
    ) as Record<CheckNameOf<typeof edgeV2>, (...args: unknown[]) => null>;
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
    // edgeV2's checks are required by its type; untyped, a missing one throws
    // @ts-expect-error no check for any of edgeV2's names
    void (() => specsFromDefinition(edgeV2, {}));
    expect(() => specsFromDefinition(edgeV2 as DialectDefinition, {})).to.throw(
      /no check named/,
    );
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
          name: 'Keep',
          notation: 'T1;R1',
          children: ['T1', 'R1'],
          properties: { type: 'maintain', maintain: 'x' },
        }),
      ],
      ['T1', node({ id: 'T1', kind: 'task', name: 'Do' })],
      [
        'R1',
        node({
          id: 'R1',
          kind: 'resource',
          name: 'Alarm',
          properties: { type: 'bool', initialValue: 'true' },
        }),
      ],
      ['Q1', node({ id: 'Q1', kind: 'quality' })],
    ]),
  };

  it('writes the model, indented by depth', () => {
    expect(notationDocument(edgeV2, tree)).to.deep.equal({
      text: 'G1: Keep [T1;R1]\n  maintain x\n  type maintain\n  T1: Do\n  R1: Alarm {bool = true}',
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
  it('checks names as the language reads them', () => {
    expect(isValidName(edgeV2, 'goal', "Don't stop - go")).to.equal(true);
    expect(isValidName(edgeV2, 'goal', 'G2 [x]')).to.equal(false);
    expect(isValidName(edgeV2, 'goal', 'Step 2')).to.equal(false);
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
