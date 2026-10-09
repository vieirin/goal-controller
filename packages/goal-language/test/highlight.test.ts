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
