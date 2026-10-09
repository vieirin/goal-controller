/** The UI's React-free workbench modules built on the definitions (packages/ui/lib/workbench). */
import { expect } from 'chai';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parsePistar } from '../../goal-tree/node_modules/@istar-ts/core';
import { goalView } from '../../goal-tree/out';
import { StringStream } from '../../ui/node_modules/@codemirror/language';
import {
  edgeV2,
  extensionCatalog,
  newNodeKind,
  type AnyDefinition,
} from '../src';
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
  modelDialect,
  modelExtensionOf,
  parseModel,
  recordedModeOf,
  writeModelExtension,
} from '../../ui/lib/workbench/dialects';
import { jsonProblem } from '../../ui/lib/workbench/localProblems';
import {
  planConversion,
  serializeModel,
  writeModelMode,
} from '../../ui/lib/workbench/pistar';
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
    join(__dirname, '../../../examples/pistar-ext/iStar4RationalAgents.txt'),
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

describe('ui piStar-ext examples', () => {
  const EXAMPLES = models('examples/pistar-ext', (text) =>
    parseModel(text, 'pistarext'),
  );

  it('are the three models of examples/pistar-ext', () => {
    expect(EXAMPLES.map(({ file }) => file).sort()).to.deep.equal([
      'examples/pistar-ext/iStar4RationalAgents.txt',
      'examples/pistar-ext/minimal.txt',
      'examples/pistar-ext/stereotypes-and-tags.txt',
    ]);
  });

  it('open in piStar-ext mode, and write back byte for byte', () => {
    for (const { file, model } of EXAMPLES) {
      // as the Explorer opens them: the mode recorded first
      const opened = writeModelMode(model, 'pistarext');
      expect(recordedModeOf(opened), file).to.equal('pistarext');
      expect(serializeModel(parseModel(opened), opened), file).to.equal(opened);
      // as saved by piStar-ext (no mode recorded)
      expect(
        serializeModel(parseModel(model, 'pistarext'), model),
        file,
      ).to.equal(model);
    }
  });

  it("are rejected by the Edge modes when they use the dialect's kinds, with the hint", () => {
    for (const { file, model } of EXAMPLES) {
      const kinds = [...parseModel(model, 'pistarext').elements.values()].map(
        (e) => e.kind,
      );
      if (!kinds.some((kind) => kind.startsWith('rationalAgents.'))) continue;
      let error: Error | null = null;
      try {
        parseModel(model, 'edgev2');
      } catch (e) {
        error = e as Error;
      }
      expect(error, file).not.to.equal(null);
      expect(jsonProblem(model, error!).message, file).to.match(
        /Open it as piStar-ext/,
      );
      expect(
        planConversion(
          writeModelMode(model, 'pistarext'),
          'edgev2',
        ).blockers.join('\n'),
        file,
      ).to.match(/the Edge engines do not read Plannings/);
    }
  });

  it("show every mechanism's annotations in the dialect's lines", () => {
    const { model } = EXAMPLES.find(({ file }) =>
      file.endsWith('stereotypes-and-tags.txt'),
    )!;
    expect(
      notationDocument(
        DIALECT_DEFINITIONS.pistarext,
        dialectTree(parseModel(model, 'pistarext')),
      ).text,
    ).to.equal(
      [
        '<<utility-based>> Nurse',
        '<<goal-based>> {Id = A1} Robot',
        '  {Id = G1} Sample collected',
        '  <<action>> {type = right} Collect sample',
        '  {Reference to = KIT-12} Sample kit',
        '  {Status = draft} Collected quickly',
      ].join('\n'),
    );
  });
});

describe("ui: a model's own constructs (its extension, in its file)", () => {
  const MINIMAL = readFileSync(
    join(__dirname, '../../../examples/pistar-ext/minimal.txt'),
    'utf8',
  );
  // as the workbench writes it: recorded for piStar-ext, a Mission construct
  // added with "Add new", then a Mission element in the agent
  const withMission = (() => {
    const recorded = writeModelMode(MINIMAL, 'pistarext');
    const extended = writeModelExtension(recorded, {
      elements: [
        newNodeKind('Mission', 'M 0 0 L 60 0 L 80 20 L 60 40 L 0 40 Z'),
      ],
    });
    const json = JSON.parse(extended);
    json.actors[0].nodes.push({
      id: 'm1',
      text: 'Deliver samples',
      type: 'istar.Mission',
      x: 300,
      y: 120,
      customProperties: { Description: '' },
    });
    return JSON.stringify(json, null, 2) + '\n';
  })();

  it('keeps the construct in the file, saved as piStar-ext saves it', () => {
    expect(modelExtensionOf(withMission).elements?.[0]).to.include({
      kind: 'model.Mission',
      pistarType: 'istar.Mission',
    });
    const model = parseModel(withMission);
    expect(model.elements.get('m1')?.kind).to.equal('model.Mission');
    expect(JSON.parse(withMission).actors[0].nodes[1].type).to.equal(
      'istar.Mission',
    );
  });

  it('writes back byte for byte', () => {
    expect(serializeModel(parseModel(withMission), withMission)).to.equal(
      withMission,
    );
    // and its extension, written again unchanged, too
    expect(
      writeModelExtension(withMission, modelExtensionOf(withMission)),
    ).to.equal(withMission);
  });

  it('is rejected by the Edge modes, with the hint', () => {
    let error: Error | null = null;
    try {
      parseModel(withMission, 'edgev2');
    } catch (e) {
      error = e as Error;
    }
    expect(error).not.to.equal(null);
    expect(jsonProblem(withMission, error!).message).to.match(
      /Open it as piStar-ext/,
    );
    expect(planConversion(withMission, 'edgev2').blockers.join('\n')).to.match(
      /1 Mission: the Edge engines do not read Missions/,
    );
  });

  it('rejects a construct the dialect already has', () => {
    const clash = writeModelExtension(withMission, {
      elements: [newNodeKind('Planning', undefined)],
    });
    let error: Error | null = null;
    try {
      parseModel(clash);
    } catch (e) {
      error = e as Error;
    }
    expect(error?.message).to.match(/Planning is already a kind/);
    expect(jsonProblem(clash, error!).message).to.equal(
      "This model's own extension can't be read: Planning is already a kind",
    );
  });

  it("lists the model's own entries with the dialect's", () => {
    const read = modelDialect(
      'pistarext',
      writeModelExtension(withMission, {
        elements: modelExtensionOf(withMission).elements,
        stereotypes: [{ name: 'urgent', appliesTo: ['model.Mission'] }],
      }),
    );
    expect(read.model.stereotypes).to.deep.equal([
      { name: 'urgent', appliesTo: ['model.Mission'] },
    ]);
    expect(
      extensionCatalog(read.extension)[0]!.entries.map((e) => e.name),
    ).to.include('urgent');
    expect(Object.keys(read.definition.elements)).to.include('model.Mission');
  });
});
