/** Hover and go-to-definition in a document (src/notation/navigation.ts). */
import type { DefinitionContext } from '@goal-controller/dialect';
import { expect } from 'chai';
import { completionsAt, definitionAt, hoverAt } from '../src/index.js';
import { toy } from '../../dialect/test/support/toy.js';

const doc = [
  'G1: Go [G2;T1|G3]',
  '  priority high',
  'G2: Wait [G3@2|T1]',
  'T1: Do',
  '  guard Fuel > 3',
  'R1: Fuel {int 0..9 = 5}',
].join('\n');

const context: DefinitionContext = {
  elements: {
    G1: {
      kind: 'goal',
      children: ['G2', 'T1'],
      properties: {},
      construct: 'sequence',
    },
    G2: { kind: 'goal', children: ['G3', 'T1'], properties: {} },
    T1: { kind: 'task', children: [], properties: {} },
    R1: { kind: 'resource', children: [], properties: {} },
  },
  variables: ['night'],
};

const at = (text: string, nth = 0) => {
  let pos = -1;
  for (let i = 0; i <= nth; i++) pos = doc.indexOf(text, pos + 1);
  return pos;
};

describe('hoverAt', () => {
  it('explains an operator with the construct or modifier it is in the dialect', () => {
    const hover = hoverAt(toy, doc, at(';'), context)!;
    expect(doc.slice(hover.from, hover.to)).to.equal(';');
    expect(hover.markdown).to.equal('**Sequence** `;`: one after another');
    expect(hoverAt(toy, doc, at('@'), context)!.markdown).to.equal(
      '**Retry** `@`: tries the first child again',
    );
  });

  it('names an element, its construct, a property’s help, a resource’s declaration', () => {
    expect(hoverAt(toy, doc, at('T1', 0), context)!.markdown).to.equal(
      '**T1**: Do (a task of this model)',
    );
    expect(hoverAt(toy, doc, 1, context)!.markdown).to.equal(
      '**G1**: Go, Sequence: one after another',
    );
    expect(hoverAt(toy, doc, at('priority'), context)!.markdown).to.equal(
      '**priority**: how urgent',
    );
    expect(hoverAt(toy, doc, at('Fuel', 0), context)!.markdown).to.equal(
      '**R1**: Fuel `{int 0..9 = 5}` (a resource of this model)',
    );
  });
});

describe('definitionAt', () => {
  it('leads an id in a notation, and a name in a value, to its element line', () => {
    const toG2 = definitionAt(toy, doc, at('G2'))!;
    expect(toG2.from).to.equal(at('G2', 1));
    expect(doc.slice(toG2.from, toG2.to)).to.equal('G2');
    const toR1 = definitionAt(toy, doc, at('Fuel', 0))!;
    expect(doc.slice(toR1.from, toR1.to)).to.equal('R1');
    expect(definitionAt(toy, doc, at('G3'))).to.equal(null);
  });
});

describe('completions in values', () => {
  it('offers an enum’s options on its property line, and names in an assertion', () => {
    const enumDoc = 'G1: Go\n  priority h';
    expect(
      completionsAt(toy, enumDoc, enumDoc.length, context)!.options.map(
        (o) => o.label,
      ),
    ).to.deep.equal(['high']);
    const guard = 'T1: Do\n  guard R';
    expect(
      completionsAt(toy, guard, guard.length, context)!.options.map(
        (o) => o.label,
      ),
    ).to.deep.equal(['R1', 'night', 'true', 'false']);
  });
});
