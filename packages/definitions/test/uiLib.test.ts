/** The UI's React-free workbench modules built on the definitions (packages/ui/lib/workbench). */
import { expect } from 'chai';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parsePistar } from '../../goal-tree/node_modules/@istar-ts/core';
import { goalView } from '../../goal-tree/out';
import { StringStream } from '../../ui/node_modules/@codemirror/language';
import { edgeV2, type AnyDefinition } from '../src';
import { documentParser } from '../../ui/lib/workbench/definitionLanguage';
import { ra } from './support/extensions';
import {
  applyNotationEdits,
  contextOf,
  elementOfLine,
  notationDocument,
  notationEdits,
  savedLines,
} from '../../ui/lib/workbench/notationDocument';
import { ENGINE_DEFINITIONS } from '../../ui/lib/workbench/definitions';
import {
  DIALECT_DEFINITIONS,
  dialectThatReads,
  dialectTree,
  parseModel,
  recordedModeOf,
} from '../../ui/lib/workbench/dialects';
import { jsonProblem } from '../../ui/lib/workbench/localProblems';
import { planConversion, serializeModel } from '../../ui/lib/workbench/pistar';
import { models } from './support/models';

const MODEL = readFileSync(
  join(__dirname, '../../../examples/edgeV2/goalModel_TAS_3_.txt'),
  'utf8',
);

/** A line's tokens and styles, as the Notation view's highlighter reads them. */
const tokens = (definition: AnyDefinition, line: string) => {
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
  // a piStar-ext model, as piStar-ext saves it: no mode recorded
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

  it("loads a dialect's kinds only for a model recorded for it", () => {
    expect(() => parseModel(RA)).to.throw(/istar\.Planning/);
    expect(dialectThatReads(RA)).to.equal('pistarext');
    let error: Error | null = null;
    try {
      parseModel(RA);
    } catch (e) {
      error = e as Error;
    }
    expect(jsonProblem(RA, error!).message).to.match(
      /this is a piStar-ext model\. Open it as piStar-ext/,
    );
  });

  it('converts a model to the dialect, and back only without its kinds', () => {
    const plan = planConversion(RA, 'pistarext');
    // no RT ids: the names are the dialect's labels
    expect(plan.blockers).to.deep.equal([]);
    expect(plan.changes).to.deep.equal([]);
    expect(recordedModeOf(plan.text)).to.equal('pistarext');
    const model = parseModel(plan.text);
    expect(model.elements.get('p1')?.kind).to.equal('rationalAgents.Planning');
    expect(planConversion(plan.text, 'edgev2').blockers).to.include.members([
      '1 Planning: the Edge engines do not read Plannings',
      '1 Plan: the Edge engines do not read Plans',
    ]);
    expect(planConversion(plan.text, 'pistar').blockers).to.deep.equal([
      '1 Planning: piStar has no Plannings',
      '1 Plan: piStar has no Plans',
    ]);
    expect(planConversion(plan.text, 'sleec').blockers).to.include(
      '1 Planning: SLEEC has no Plannings',
    );
  });

  it("writes the dialect's model as its lines, and reads them back", () => {
    const text = planConversion(RA, 'pistarext').text;
    const definition = DIALECT_DEFINITIONS.pistarext;
    const tree = dialectTree(parseModel(text));
    const doc = [
      '<<goal-based>> Robot',
      '  {Id = G1} Deliver sample',
      '  Plan delivery',
      '  Delivery plan',
      '  <<action>> {type = duty} Drive to lab',
    ].join('\n');
    expect(notationDocument(definition, tree).text).to.equal(doc);
    const edited = doc
      .replace('<<goal-based>> Robot', '<<utility-based>> Robot')
      .replace('Plan delivery', '{Status = done} Plan the delivery');
    const edits = notationEdits(definition, edited, tree);
    expect(edits).to.deep.equal([
      { iStarId: 'a1', key: 'stereotype', value: 'utility-based' },
      { iStarId: 'p1', key: 'tag', value: 'Status' },
      { iStarId: 'p1', key: 'tagValue', value: 'done' },
      { iStarId: 'p1', text: 'Plan the delivery' },
    ]);
    const next = applyNotationEdits(text, edits);
    expect(
      notationDocument(definition, dialectTree(parseModel(next))).text,
    ).to.equal(edited);
    // a line added or removed (an element is, in the diagram): nothing changes
    expect(notationEdits(definition, `${edited}\n  Extra`, tree)).to.deep.equal(
      [],
    );
  });

  it('highlights its lines without ids or notation', () => {
    const read = tokens(
      DIALECT_DEFINITIONS.pistarext,
      '<<goal-based>> {Id = A1} Robot',
    );
    expect(styled(read, 'meta')).to.equal('goal-basedIdA1');
    expect(styled(read, 'string')).to.equal('Robot');
  });

  it("leaves the engines' definitions without the dialect", () => {
    for (const definition of Object.values(ENGINE_DEFINITIONS))
      for (const element of Object.values(definition.elements))
        expect(element).not.to.have.property('annotations');
  });
});
