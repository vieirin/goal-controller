/** What a notation says in a dialect (src/notation/reading.ts). */
import { expect } from 'chai';
import {
  assertionVariables,
  documentDiagnostics,
  goalNameParserFor,
  operandIds,
  parseElementLine,
  readNotation,
} from '../src/index.js';
import { toy } from '../../dialect/test/support/toy.js';

const tree = (notation: string) =>
  parseElementLine(`G1: Go [${notation}]`).value!.notation;
const read = (notation: string) => readNotation(toy, tree(notation));

describe('readNotation', () => {
  it('keeps each construct’s last (outermost) operands, innermost read first', () => {
    const said = read('G2;G3|G4;T5');
    // `;` binds looser than `|`: (G2 ; (G3|G4)) ; T5
    expect([...said.constructs]).to.deep.equal([
      ['fallback', ['G3', 'G4']],
      ['sequence', ['G2', 'G3', 'G4', 'T5']],
    ]);
  });

  it('reads a group as opaque to its parent, its own construct kept', () => {
    expect([...read('[G2;G3]|G4').constructs]).to.deep.equal([
      ['sequence', ['G2', 'G3']],
      ['fallback', ['G4']],
    ]);
  });

  it('reads modifiers by the modified operand’s text, standalone constructs', () => {
    const said = read('G2@2@3|[G4;T5]@4');
    expect(said.modifiers.get('retry')).to.deep.equal({
      G2: 2,
      'G2@2': 3,
      '[G4;T5]': 4,
    });
    expect([...read('*').standalone]).to.deep.equal(['any']);
  });

  it('lists the operators the dialect does not enable, as the validator reports them', () => {
    const said = read('G2+G3?[+]');
    // G2 + (G3 ? [+]), innermost first
    expect(said.disabled).to.deep.equal(['+', '?', '+']);
    expect([...said.constructs]).to.deep.equal([]);
    const context = {
      elements: {
        G1: { kind: 'goal', children: ['G2', 'G3'], properties: {} },
        G2: { kind: 'goal', children: [], properties: {} },
        G3: { kind: 'goal', children: [], properties: {} },
      },
      variables: [],
    };
    const doc = 'G1: Go [G2+G3?[+]]';
    expect(
      documentDiagnostics(toy, doc, context)
        .filter((d) => /not (an operator|a construct)/.test(d.message))
        .map((d) => doc.slice(d.from, d.to))
        .sort(),
    ).to.deep.equal([...said.disabled].sort());
  });

  it('collects an operand’s ids through operators, not through groups', () => {
    expect(operandIds(tree('G2@2;!T3|skip'))).to.deep.equal([
      'G2',
      'T3',
      'skip',
    ]);
    expect(operandIds(tree('[G2;G3]'))).to.deep.equal([]);
  });
});

describe('goalNameParserFor: the reader derived from a dialect', () => {
  const read = (goalText: string) => {
    const errors: string[] = [];
    const reading = goalNameParserFor(toy)({
      goalText,
      onSyntaxError: (message) => errors.push(message),
    });
    return { ...reading, errors };
  };

  it('gives the outermost enabled operator’s construct, its operands in order', () => {
    expect(read('G1: Go [G2|G3;T4]')).to.deep.equal({
      id: 'G1',
      goalName: 'Go',
      executionDetail: {
        type: 'sequence',
        ids: ['G2', 'G3', 'T4'],
        modifiers: {},
      },
      errors: [],
    });
  });

  it('carries the modifiers that apply to the construct', () => {
    expect(read('G1: Go [G2@2|G3]').executionDetail).to.deep.equal({
      type: 'fallback',
      ids: ['G2', 'G3'],
      modifiers: { retry: { G2: 2 } },
    });
    // retry applies to fallback only
    expect(read('G1: Go [G2@2;G3]').executionDetail?.modifiers).to.deep.equal(
      {},
    );
  });

  it('gives a standalone construct when one is written', () => {
    expect(read('G1: Go [*]').executionDetail).to.deep.equal({
      type: 'any',
      ids: [],
      modifiers: {},
    });
  });

  it('reports what the dialect does not enable, and reads under it', () => {
    const reading = read('G1: Go [G2+T3]');
    expect(reading.errors).to.deep.equal([
      '1:10 `+` is not an operator of Toy',
    ]);
    expect(reading.executionDetail).to.equal(null);
  });

  it('reads ids and names only in a dialect without a notation', () => {
    expect(
      goalNameParserFor({ name: 'Plain' })({ goalText: 'G1: Go [G2;G3]' }),
    ).to.deep.equal({ id: 'G1', goalName: 'Go', executionDetail: null });
  });
});

describe('assertionVariables', () => {
  it('names the variables in order, a value where one is set', () => {
    expect(assertionVariables('x > 0 & !(y = true | x) & z')).to.deep.equal([
      { name: 'x', value: null },
      { name: 'y', value: true },
      { name: 'z', value: null },
    ]);
    expect(assertionVariables('')).to.deep.equal([]);
  });
});
