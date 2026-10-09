/** The UI's React-free workbench modules built on the definitions (packages/ui/lib/workbench). */
import { expect } from 'chai';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parsePistar } from '../../goal-tree/node_modules/@istar-ts/core';
import { goalView } from '../../goal-tree/out';
import { StringStream } from '../../ui/node_modules/@codemirror/language';
import { edgeV2, type EngineDefinition } from '../src';
import { documentParser } from '../../ui/lib/workbench/definitionLanguage';
import { ra } from './support/extensions';
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

describe('ui definitionLanguage', () => {
  /** A line's tokens and styles, as the Notation view's highlighter reads them. */
  const tokens = (definition: EngineDefinition, line: string) => {
    const parser = documentParser(definition);
    const state = parser.startState!(2);
    const stream = new StringStream(line, 2, 2);
    const read: [string, string | null][] = [];
    while (!stream.eol()) {
      stream.start = stream.pos;
      const style = parser.token(stream, state);
      if (stream.current().trim()) read.push([stream.current(), style]);
    }
    return read;
  };
  const styled = (read: [string, string | null][], style: string) =>
    read
      .filter(([, s]) => s === style)
      .map(([text]) => text)
      .join('');

  it('reads annotations before the id', () => {
    const read = tokens(ra, '<<action>> {type = duty} T1: Book a room');
    expect(read.slice(0, 1)).to.deep.equal([['<<', 'brace']]);
    expect(styled(read, 'meta')).to.equal('actiontypeduty');
    expect(styled(read, 'operator')).to.equal('=');
    expect(read.find(([, s]) => s === 'labelName')).to.deep.equal([
      'T1',
      'labelName',
    ]);
  });

  it('reads a line without annotations as before', () => {
    const line = '{Id = G1} G1: A [T1;T2]';
    expect(styled(tokens(edgeV2, line), 'meta')).to.equal('');
    expect(styled(tokens(ra, line.slice(10)), 'labelName')).to.equal(
      styled(tokens(edgeV2, line.slice(10)), 'labelName'),
    );
  });
});
