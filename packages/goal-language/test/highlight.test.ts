/** What each part of a text is, for an editor (src/notation/highlight.ts). */
import { expect } from 'chai';
import { highlightValue } from '../src/index.js';

const parts = (text: string) =>
  highlightValue({ type: 'annotatedName' }, text).map((h) => [
    text.slice(h.from, h.to),
    h.style,
    h.text,
  ]);

describe('highlightValue', () => {
  it('colours OCL by its tokens: variables, types, keywords, operators, literals', () => {
    const text =
      'world_db->select(r:Room | r.name in current.rooms and r.dirty = True), rooms : Sequence(Room), "Ev"';
    const styled = highlightValue({ type: 'ocl' }, text).map((h) => [
      text.slice(h.from, h.to),
      h.style,
    ]);
    for (const part of [
      ['world_db', 'variableName'],
      ['->', 'operator'],
      ['select', 'keyword'],
      ['Room', 'typeName'],
      ['in', 'keyword'],
      ['and', 'keyword'],
      ['True', 'atom'],
      ['Sequence', 'typeName'],
      ['"Ev"', 'string'],
    ])
      expect(styled).to.deep.include(part);
    // what a collection holds is a type too
    expect(styled.filter(([t]) => t === 'Room')).to.deep.equal([
      ['Room', 'typeName'],
      ['Room', 'typeName'],
    ]);
  });

  it('colours an enum’s value as an atom', () => {
    expect(
      highlightValue({ type: 'enum', options: [] }, 'Query').map(
        (h) => h.style,
      ),
    ).to.deep.equal(['atom']);
  });

  it('reads a call’s name as a keyword, MutRoSe’s task ids as ids', () => {
    const text = 'G1: Go [FALLBACK(AT1,G2)]';
    const styles = highlightValue({ type: 'annotatedName' }, text).map((h) => [
      text.slice(h.from, h.to),
      h.style,
    ]);
    expect(styles).to.deep.include(['FALLBACK', 'keyword']);
    expect(styles).to.deep.include(['AT1', 'labelName']);
  });

  it('tells an annotation’s stereotype, tag name and tag value apart, with their text', () => {
    expect(parts('<<goal-based>> {Reference to = KIT-12} Robot')).to.deep.equal(
      [
        ['<<', 'brace', undefined],
        ['goal-based', 'stereotype', 'goal-based'],
        ['>>', 'brace', undefined],
        ['{', 'brace', undefined],
        ['Reference to', 'tagName', undefined],
        ['=', 'operator', undefined],
        ['KIT-12', 'tagValue', 'KIT-12'],
        ['}', 'brace', undefined],
        ['Robot', 'string', undefined],
      ],
    );
  });
});
