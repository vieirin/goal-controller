/** What a notation says in a dialect (src/notation/reading.ts). */
import { expect } from 'chai';
import {
  documentDiagnostics,
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
