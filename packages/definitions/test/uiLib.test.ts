/** The UI's React-free workbench modules built on the definitions (packages/ui/lib/workbench). */
import { expect } from 'chai';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parsePistar } from '../../goal-tree/node_modules/@istar-ts/core';
import { goalView } from '../../goal-tree/out';
import { edgeV2 } from '../src';
import {
  contextOf,
  elementOfLine,
  savedLines,
} from '../../ui/lib/workbench/notationDocument';

const MODEL = readFileSync(
  join(__dirname, '../../../examples/edgeV2/goalModel_TAS_3_.txt'),
  'utf8',
);

describe('ui notationDocument', () => {
  const tree = goalView(parsePistar(MODEL), 'edgeV2');

  it('finds the element a line belongs to', () => {
    const lines = ['G1: A', '  maintain x', '  type maintain', '  T1: B'];
    expect(elementOfLine(edgeV2, lines, 0)).to.equal('G1');
    expect(elementOfLine(edgeV2, lines, 2)).to.equal('G1');
    expect(elementOfLine(edgeV2, lines, 3)).to.equal('T1');
    expect(elementOfLine(edgeV2, ['  maintain x'], 0)).to.equal(null);
  });

  it('reads only the context variables', () => {
    const context = contextOf(edgeV2, tree, [
      { kind: 'context', name: 'night' },
      { kind: 'achievability', name: 'T1_pass' },
    ]);
    expect(context.variables).to.deep.equal(['night']);
    expect(Object.keys(context.elements)).to.include('G0');
  });

  it('keeps each saved line with its grammar error', () => {
    const saved = savedLines(edgeV2, tree);
    const g0 = tree.nodes.get('G0')!;
    expect(saved.G0).to.deep.equal({
      line: `G0: ${g0.name} [${g0.notation}]`,
      error: null,
    });
  });
});
