/**
 * The `.jucm` writer (goal-controller#144 item 1): a model read from a
 * committed seed, written and read again, is the same model with the same
 * strategies; a second write is the first byte for byte; and what the
 * format can't carry is said. That jUCMNav evaluates the written file as
 * it does the seed is `pnpm stress:grl --oracle`'s (Docker).
 */
import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { describe, it } from 'mocha';
import { modelDifference } from '@goal-controller/dialect';
import { importJucm } from '../../../src/importers/jucm';
import { grl } from '../../../src/engines/grl';
import {
  canonicalJucm,
  JUCM_LOSSY,
  writeJucm,
} from '../../../src/engines/grl/jucm';
import { describeNativeRoundTrips } from '../../support/nativeRoundTrip';

const PROJECTS = path.join(__dirname, '../../../../../examples/grl');
const read = (file: string) =>
  fs.readFileSync(path.join(PROJECTS, file), 'utf8');
const SEEDS = ['grl-own/grl-own.jucm', 'grl-smart-home/SmartHome2.jucm'];

// #143's contract; neither seed is lossless (an author, UCM maps, metadata)
describeNativeRoundTrips(
  grl,
  SEEDS.map((seed) => ({
    name: path.basename(seed),
    file: 'jucm',
    text: read(seed),
  })),
);

type Json = Record<string, any>;
const imported = (text: string) => {
  const result = importJucm(text);
  assert.ok(result.model, JSON.stringify(result.diagnostics));
  return result as Required<typeof result> & { model: Json };
};
const written = (result: ReturnType<typeof imported>) =>
  writeJucm(result.model, result.dialectRecord);

for (const seed of SEEDS)
  describe(`writeJucm: ${seed}`, () => {
    const first = imported(read(seed));
    const { text, diagnostics } = written(first);
    const second = imported(text);

    it('writes a file that reads back to the same model and strategies', () => {
      assert.strictEqual(
        modelDifference(first.model, second.model, JUCM_LOSSY),
        null,
      );
      assert.deepStrictEqual(second.dialectRecord, first.dialectRecord);
    });

    it('says nothing is lost, and reads back without a warning', () => {
      assert.deepStrictEqual(diagnostics, []);
      assert.deepStrictEqual(
        second.diagnostics.filter((d) => d.severity !== 'info'),
        [],
      );
    });

    it('writes its own file again byte for byte', () => {
      assert.strictEqual(written(second).text, text);
    });
  });

describe('canonicalJucm', () => {
  it('renumbers ids in the file’s order, references with them, sorts attributes and leaves defaults out', () => {
    const text = `<?xml version="1.0" encoding="UTF-8"?>
<urn:URNspec name="m" nextGlobalID="99" created="today">
  <grlspec>
    <intElements name="a" id="7" linksSrc="9" type="Goal"/>
    <intElements id="3" name="b" linksDest="9" type="Softgoal" importance="None"/>
    <links xsi:type="grl:Decomposition" id="9" src="7" dest="3"/>
  </grlspec>
</urn:URNspec>`;
    assert.strictEqual(
      canonicalJucm(text),
      `<?xml version="1.0" encoding="UTF-8"?>
<urn:URNspec name="m">
  <grlspec>
    <intElements id="1" linksSrc="3" name="a" type="Goal"/>
    <intElements id="2" linksDest="3" name="b"/>
    <links dest="2" id="3" src="1" xsi:type="grl:Decomposition"/>
  </grlspec>
</urn:URNspec>
`,
    );
  });

  it('is the text as it is when it isn’t XML', () => {
    assert.strictEqual(canonicalJucm('<urn:URNspec>'), '<urn:URNspec>');
  });
});

describe('writeJucm: a model drawn in the workbench', () => {
  const model = {
    actors: [
      {
        id: 'a-1',
        text: 'Owner',
        type: 'istar.Actor',
        x: 10,
        y: 10,
        customProperties: {},
        nodes: [
          {
            id: 'g-1',
            text: 'Warm',
            type: 'istar.Goal',
            x: 50,
            y: 50,
            customProperties: { Description: 'a\n"b"', note: 'x' },
          },
          {
            id: 't-1',
            text: 'Heat',
            type: 'istar.Task',
            x: 50,
            y: 150,
            customProperties: {},
          },
        ],
      },
    ],
    orphans: [],
    dependencies: [],
    links: [
      {
        id: 'l-1',
        type: 'istar.OrRefinementLink',
        source: 't-1',
        target: 'g-1',
      },
      { id: 'l-2', type: 'istar.NeededByLink', source: 't-1', target: 'g-1' },
    ],
    display: {},
    diagram: { name: 'Home', customProperties: { engine: 'grl' } },
  };
  const strategies = {
    'strategies/S.json': JSON.stringify({
      group: 'S',
      strategies: [
        {
          id: 's-1',
          name: 'All',
          evaluations: { 't-1': { label: 'Satisfied' } },
        },
      ],
    }),
  };
  const { text, diagnostics } = writeJucm(model, {
    projectResources: { strategies },
  });

  it('numbers its ids as jUCMNav does, and says which', () => {
    const back = imported(text);
    const goal = back.model.actors[0].nodes[0];
    assert.strictEqual(goal.id, '1');
    assert.strictEqual(goal.customProperties.Description, 'a\n"b"');
    assert.strictEqual(back.model.links[0].type, 'istar.OrRefinementLink');
    assert.ok(diagnostics.some((d) => /renumbered \(g-1 → 1/.test(d.message)));
  });

  it('says what it leaves out', () => {
    const messages = diagnostics.map((d) => d.message).join('\n');
    assert.match(messages, /istar\.NeededByLink, which GRL has no link for/);
    assert.match(messages, /not written: note/);
  });

  it('writes a label-only evaluation with the label’s value', () => {
    assert.match(
      text,
      /<evaluations evaluation="100" qualitativeEvaluation="Satisfied" intElement="2"\/>/,
    );
  });
});

// goal-controller#217, #269: the writer reads the values the evaluation
// reads, so a value outside the dialect's range is unset there too and its
// default is written (jUCMNav evaluates the file as the model evaluates)
describe('writeJucm: values as the evaluation reads them', () => {
  const node = (id: string, type: string, importance: string) => ({
    id,
    text: id,
    type,
    x: 0,
    y: 0,
    customProperties: { importanceQuantitative: importance },
  });
  const contribution = (id: string, source: string, weight: string) => ({
    id,
    type: 'istar.ContributionLink',
    source,
    target: '3',
    label: 'help',
    customProperties: { quantitativeContribution: weight },
  });
  const { text } = writeJucm(
    {
      actors: [
        {
          id: '9',
          text: 'Owner',
          type: 'istar.Actor',
          x: 0,
          y: 0,
          customProperties: { importanceQuantitative: '150' },
          nodes: [
            node('1', 'istar.Goal', '150'),
            node('2', 'istar.Task', '40'),
            node('3', 'istar.Quality', '0'),
          ],
        },
      ],
      orphans: [],
      dependencies: [],
      links: [contribution('7', '1', '300'), contribution('8', '2', '-50')],
      display: {},
      diagram: { name: 'Ranges', customProperties: { engine: 'grl' } },
    },
    { projectResources: {} },
  );
  const tagOf = (name: string, id: string) =>
    text.match(new RegExp(`<${name} [^>]*\\bid="${id}"[^>]*>`))?.[0] ?? '';

  it('writes an importance of 150 as the default (none), and keeps 40', () => {
    assert.ok(tagOf('intElements', '1'), text);
    assert.doesNotMatch(tagOf('intElements', '1'), /importanceQuantitative=/);
    assert.doesNotMatch(tagOf('actors', '9'), /importanceQuantitative=/);
    assert.match(tagOf('intElements', '2'), /importanceQuantitative="40"/);
  });

  it('writes a contribution of 300 as the default (none: 25), and keeps -50', () => {
    assert.ok(tagOf('links', '7'), text);
    assert.doesNotMatch(tagOf('links', '7'), /quantitativeContribution=/);
    assert.match(tagOf('links', '8'), /quantitativeContribution="-50"/);
  });
});
