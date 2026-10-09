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
  notationDocument,
  savedLines,
} from '../../ui/lib/workbench/notationDocument';
import {
  EDITOR_DEFINITIONS,
  ENGINE_DEFINITIONS,
} from '../../ui/lib/workbench/definitions';
import {
  dialectOfKey,
  labelAnnotations,
  parseModel,
} from '../../ui/lib/workbench/dialects';
import { serializeModel } from '../../ui/lib/workbench/pistar';
import { models } from './support/models';

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

describe('ui dialects', () => {
  const RA = readFileSync(
    join(__dirname, 'fixtures/rationalAgents.txt'),
    'utf8',
  );
  const EXAMPLES = [
    ...models('examples/edge'),
    ...models('examples/edgeV2'),
    ...models('dissertationExamples'),
  ];

  it('reads every example as plain iStar does, and writes it back the same', () => {
    expect(EXAMPLES.length).to.be.greaterThan(10);
    for (const { file, model } of EXAMPLES)
      expect(serializeModel(parseModel(model), model), file).to.equal(
        serializeModel(parsePistar(model), model),
      );
  });

  it("opens a model with the dialect's kinds, and writes them back", () => {
    const model = parseModel(RA);
    expect(model.elements.get('p1')?.kind).to.equal('rationalAgents.Planning');
    // the same model; istar-ts writes an actor's unknown keys (piStar-ext's
    // `extension`) after its nodes, so their order may change
    const written = serializeModel(model, RA);
    expect(JSON.parse(written)).to.deep.equal(JSON.parse(RA));
    expect(serializeModel(parseModel(written), written)).to.equal(written);
  });

  it("shows the engines' examples in their editors as before", () => {
    for (const [engine, grammar, files] of [
      ['edge', 'edge', models('examples/edge')],
      ['edgev2', 'edgeV2', models('examples/edgeV2')],
    ] as const)
      for (const { file, model } of files) {
        const tree = goalView(parsePistar(model), grammar);
        expect(
          notationDocument(EDITOR_DEFINITIONS[engine], tree),
          file,
        ).to.deep.equal(notationDocument(ENGINE_DEFINITIONS[engine], tree));
      }
  });

  it('writes the annotations an element carries', () => {
    expect(labelAnnotations({ stereotype: 'goal-based' })).to.equal(
      '<<goal-based>>',
    );
    expect(
      labelAnnotations({ stereotype: 'action', tag: 'type', tagValue: 'duty' }),
    ).to.equal('<<action>> {type = duty}');
    expect(labelAnnotations({ Description: '' })).to.equal(null);
    expect(dialectOfKey('tagValue')?.name).to.equal('rationalAgents');
    expect(dialectOfKey('maintain')).to.equal(undefined);
  });

  it("annotates the dialect's model in the Notation view", () => {
    const tree = goalView(parseModel(RA), 'edgeV2');
    expect(notationDocument(EDITOR_DEFINITIONS.edgev2, tree).text).to.equal(
      '{Id = G1} G1: Deliver sample [T1]\n  <<action>> {type = duty} T1: Drive to lab',
    );
  });
});
