import { expect } from 'chai';
import { exprText, parseAssertion, parseNodeText } from '../src/index.js';

describe('parseNodeText', () => {
  it('reads id, name and notation', () => {
    const parsed = parseNodeText('G0: Provide Health Support [G1#G2]');
    expect(parsed.errors).to.deep.equal([]);
    expect(parsed.id).to.equal('G0');
    expect(parsed.name).to.equal(' Provide Health Support ');
    expect(parsed.notation).to.deep.equal({
      kind: 'binary',
      op: '#',
      left: { kind: 'ref', id: 'G1' },
      right: { kind: 'ref', id: 'G2' },
    });
  });

  it('accepts an empty text, like the blank rule', () => {
    expect(parseNodeText('')).to.deep.equal({
      id: '',
      name: '',
      notation: null,
      errors: [],
    });
  });

  it('binds operators with edgeV2 precedence: @ | ? + # ; ->', () => {
    const parsed = parseNodeText('G1: x [G2;G3#G4->G5|G6@2]');
    expect(exprText(parsed.notation)).to.equal('G2;G3#G4->G5|G6@2');
    const top = parsed.notation;
    expect(top).to.include({ kind: 'binary', op: '->' });
    if (top?.kind !== 'binary') throw new Error('binary expected');
    expect(top.left).to.include({ kind: 'binary', op: ';' });
    expect(top.right).to.include({ kind: 'binary', op: '|' });
  });

  it('is left-associative', () => {
    const { notation } = parseNodeText('G1: x [G2;G3;G4]');
    if (notation?.kind !== 'binary') throw new Error('binary expected');
    expect(notation.left).to.include({ kind: 'binary', op: ';' });
    expect(notation.right).to.deep.equal({ kind: 'ref', id: 'G4' });
  });

  it('reads ids with decimals, X and sub-ids, and skip', () => {
    const { id, notation, errors } = parseNodeText('G1a: n [T1.2X|skip|R3X]');
    expect(errors).to.deep.equal([]);
    expect(id).to.equal('G1a');
    expect(exprText(notation)).to.equal('T1.2X|skip|R3X');
  });

  it('lexes like ANTLR: longest match, then definition order', () => {
    // `Goal` is one WORD, not the G keyword
    expect(parseNodeText('G1: Goal [G2]').name).to.equal(' Goal ');
    // a space is part of a WORD, so it is an error inside the notation
    expect(parseNodeText('G1: x [G1; G2]').errors).to.have.length.above(0);
    // `GX` is a WORD, so it cannot start a goal
    expect(parseNodeText('GX: name').errors).to.have.length.above(0);
    // `->` beats the `-` a WORD allows
    expect(parseNodeText('G1: x [G2->G3]').errors).to.deep.equal([]);
  });

  it('rejects text after the notation and line breaks', () => {
    expect(parseNodeText('G1: A [G2]G3: B').errors).to.have.length(1);
    expect(parseNodeText('G1: A\nG2: B').errors).to.have.length.above(0);
  });

  it('requires a name after the colon', () => {
    expect(parseNodeText('G1:[G2]').errors).to.have.length.above(0);
  });
});

describe('parseAssertion', () => {
  it('reads AssertionRegex.g4 conditions', () => {
    expect(parseAssertion('battery > 20 & ok = true').expr).to.deep.equal({
      kind: 'and',
      left: { kind: 'compare', variable: 'battery', op: '>', value: '20' },
      right: { kind: 'assign', variable: 'ok', value: true },
    });
    expect(parseAssertion('').errors).to.deep.equal([]);
  });

  it('negates everything after `!`, like ANTLR', () => {
    expect(parseAssertion('!a & b').expr).to.include({ kind: 'not' });
  });

  it('rejects `x > 0`: the original INT has no zero', () => {
    expect(parseAssertion('x > 0').errors).to.have.length.greaterThan(0);
  });
});

describe('notation document lines', () => {
  it('keeps property lines and resource declarations out of goal names', () => {
    expect(parseNodeText('maintain battery > 3').errors).to.have.length(1);
    expect(
      parseNodeText('R1: Battery {int 0..100 = 80}').errors,
    ).to.have.length(1);
  });
});
