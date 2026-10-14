/**
 * The `.jucm` importer (goal-controller#106): the committed seeds (our
 * model of every construct, jUCMNav's 2014 SmartHome2) and what is wrong
 * with a file. TURNtoURN's and GoalCat's files are `pnpm stress:grl`'s
 * (fetched, not committed).
 */
import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { describe, it } from 'mocha';
import { importJucm } from '../../../src/importers/jucm';
import { readStrategies } from '../../../src/engines/grl';

const PROJECTS = path.join(__dirname, '../../../../../examples/projects');
const read = (file: string) =>
  fs.readFileSync(path.join(PROJECTS, file), 'utf8');

type Json = Record<string, any>;
const imported = (text: string) => {
  const result = importJucm(text);
  assert.ok(result.model, JSON.stringify(result.diagnostics));
  return result as Required<typeof result> & { model: Json };
};
/** every node of a piStar file, by id */
const nodesOf = (model: Json): Map<string, Json> =>
  new Map(
    [
      ...model.actors.flatMap((a: Json) => a.nodes),
      ...model.orphans,
      ...model.dependencies,
    ].map((n: Json) => [n.id, n]),
  );

describe('importJucm: our model of every construct (grl-own.jucm)', () => {
  const { model, dialectRecord, diagnostics } = imported(
    read('grl-own/grl-own.jucm'),
  );
  const nodes = nodesOf(model);
  const links = new Map<string, Json>(model.links.map((l: Json) => [l.id, l]));

  it('records the GRL engine and the grl kinds, and says nothing is wrong', () => {
    assert.strictEqual(model.diagram.customProperties.engine, 'grl');
    assert.strictEqual(dialectRecord!.engine, 'grl');
    assert.deepStrictEqual(
      model.metamodel.elements.map((e: Json) => e.kind),
      ['grl.Indicator', 'grl.Belief'],
    );
    assert.deepStrictEqual(diagnostics, []);
  });

  it('keeps the file’s ids, and maps each type to its kind', () => {
    assert.deepStrictEqual(
      ['2', '3', '4', '7', '8', '70'].map((id) => nodes.get(id)?.type),
      [
        'istar.Quality',
        'istar.Goal',
        'istar.Task',
        'grl.Indicator',
        'istar.Resource',
        'grl.Belief',
      ],
    );
    assert.strictEqual(nodes.size, 11);
  });

  it('puts elements in the actors whose boxes draw them, with the actors’ importance', () => {
    const owner = model.actors.find((a: Json) => a.id === '1');
    assert.deepStrictEqual(owner.customProperties, {
      importance: 'High',
      importanceQuantitative: '80',
    });
    assert.deepStrictEqual(owner.nodes.map((n: Json) => n.id).sort(), [
      '10',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      '9',
    ]);
    assert.deepStrictEqual(model.display['1'], { width: 820, height: 520 });
  });

  it('writes decompositions as refinements, a Xor one as Or with its type kept', () => {
    assert.strictEqual(links.get('20')!.type, 'istar.OrRefinementLink');
    assert.strictEqual(links.get('22')!.type, 'istar.AndRefinementLink');
    assert.deepStrictEqual(nodes.get('3')!.customProperties, {
      importance: 'High',
      importanceQuantitative: '100',
      decompositionType: 'Xor',
    });
  });

  it('writes a contribution’s GRL values as its properties, its iStar value as its label', () => {
    assert.deepStrictEqual(links.get('25'), {
      id: '25',
      type: 'istar.ContributionLink',
      source: '5',
      target: '2',
      label: 'break',
      customProperties: {
        contribution: 'Break',
        quantitativeContribution: '-100',
      },
    });
    // the metamodel's defaults: Help, 25
    assert.deepStrictEqual(links.get('29')!.customProperties, {
      contribution: 'Help',
      quantitativeContribution: '25',
    });
    assert.deepStrictEqual(links.get('32')!.customProperties, {
      contribution: 'SomePositive',
      quantitativeContribution: '10',
      correlation: 'true',
    });
  });

  it('writes a dependency through its dependum, from depender to dependee', () => {
    const dependum = model.dependencies.find((d: Json) => d.id === '8');
    assert.deepStrictEqual([dependum.source, dependum.target], ['3', '12']);
    assert.deepStrictEqual(
      ['30', '31'].map((id) => [
        links.get(id)!.type,
        links.get(id)!.source,
        links.get(id)!.target,
      ]),
      [
        ['istar.DependencyLink', '3', '8'],
        ['istar.DependencyLink', '8', '12'],
      ],
    );
  });

  it('writes a belief and its link', () => {
    assert.strictEqual(
      nodes.get('70')!.customProperties.Description,
      'Winters here rarely go below -5 degrees C',
    );
    assert.ok(
      model.links.some(
        (l: Json) =>
          l.type === 'grl.BeliefLink' && l.source === '70' && l.target === '4',
      ),
    );
  });

  it('writes the strategies as the strategies resource, an include and a KPI value set kept', () => {
    const files = dialectRecord!.projectResources.strategies!;
    assert.deepStrictEqual(Object.keys(files), ['strategies/Heating.json']);
    const { strategies, diagnostics: problems } = readStrategies(
      Object.entries(files).map(([p, text]) => ({ path: p, text })),
    );
    assert.deepStrictEqual(problems, []);
    const gas = strategies.find((s) => s.id === '42')!;
    // the heat pump's first (included), then its own
    assert.strictEqual(gas.evaluations.get('10')!.value, 100);
    assert.strictEqual(gas.evaluations.get('5')!.value, 100);
    assert.strictEqual(gas.evaluations.get('7')!.kpi!.evaluationValue, '19.5');
  });
});

describe('importJucm: jUCMNav’s 2014 SmartHome2.jucm', () => {
  const { model, diagnostics } = imported(
    read('grl-smart-home/SmartHome2.jucm'),
  );

  it('reads a 2014 Feature as a task, and says what it left out', () => {
    const nodes = nodesOf(model);
    assert.strictEqual(nodes.size, 20);
    assert.strictEqual(nodes.get('15')!.type, 'istar.Task');
    assert.strictEqual(model.links.length, 25);
    assert.deepStrictEqual(
      diagnostics.map((d) => d.severity),
      ['warning', 'info', 'info', 'info', 'info'],
    );
    assert.match(diagnostics[0]!.message, /9 element\(s\) are in no diagram/);
    assert.match(
      diagnostics[3]!.message,
      /Use Case Maps \(2 diagram\(s\)\) are not imported/,
    );
  });

  it('places the elements no diagram draws in a grid below the diagrams', () => {
    const unplaced = new Set([
      '15',
      '19',
      '25',
      '65',
      '80',
      '102',
      '104',
      '1372',
      '1374',
    ]);
    const ys = (inGrid: boolean) =>
      model.orphans
        .filter((n: Json) => unplaced.has(n.id) === inGrid)
        .map((n: Json) => n.y as number);
    assert.ok(Math.min(...ys(true)) > Math.max(...ys(false)));
  });
});

describe('importJucm: what isn’t a GRL model', () => {
  it('says why a text is not one', () => {
    const notXml = importJucm('<urn:URNspec><grlspec></urn:URNspec>');
    assert.strictEqual(notXml.model, null);
    assert.ok(notXml.diagnostics.some((d) => d.severity === 'error'));
    const other = importJucm('<?xml version="1.0"?><model/>');
    assert.deepStrictEqual(other.diagnostics, [
      {
        severity: 'error',
        message: 'not a jUCMNav file: its root is <model>, not <urn:URNspec>',
      },
    ]);
  });

  it('leaves out an element whose attributes don’t fit, saying which', () => {
    const { model, diagnostics } = imported(
      `<urn:URNspec><grlspec>
        <intElements name="A" id="1" importanceQuantitative="high"/>
        <intElements name="B" id="2" type="Goal"/>
      </grlspec></urn:URNspec>`,
    );
    assert.deepStrictEqual([...nodesOf(model).keys()], ['2']);
    assert.match(
      diagnostics[0]!.message,
      /^<intElements id="1">: importanceQuantitative: an integer; left out$/,
    );
  });
});
