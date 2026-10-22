/**
 * The `kaos` dialect's operation and object models (goal-controller#194):
 * its `kaosOperations` kinds and links on the KAOS root, their keys, and its
 * Problems: a monitoring's or a control's attribute its object doesn't
 * declare (D2, #137's member resolution), and the responsibility,
 * operationalisation and performance triangle (#210), a declared closure.
 */
import { expect } from 'chai';
import { readFileSync } from 'fs';
import { join } from 'path';
import { goalView, openClosures } from '@goal-controller/goal-tree';
import {
  contextFromView,
  documentDiagnostics,
  notationDocument,
} from '@goal-controller/goal-language';
import { type AnyDialect } from '@goal-controller/dialect';
import { kaos, kaosOperations } from '../../src';
import { kaosNativeFile } from '../../src/importers/kaos';
import { parseModel } from '../../../ui/lib/workbench/dialects';
import { frameworkProblems } from '../../../ui/lib/workbench/frameworkProblems';

const FIXTURE = readFileSync(
  join(__dirname, '../importers/fixtures/kaos/pump-operations.kaos'),
  'utf8',
);

type Json = Record<string, any>;
/** A `.kaos` text's model, as its piStar JSON. */
const jsonOf = (text: string): Json => {
  const { model, diagnostics } = kaosNativeFile.read(text, { modelName: 'm' });
  if (!model) throw new Error(JSON.stringify(diagnostics));
  return model as Json;
};
/** A model's JSON as the workbench reads it, in the `kaos` mode. */
const modelOf = (json: Json) =>
  parseModel(JSON.stringify(json), 'kaos', 'kaos');
const problemsOf = (json: Json) =>
  frameworkProblems(modelOf(json), kaos).map(
    ({ elementId, code, message }) => ({
      elementId,
      code,
      message,
    }),
  );
const linkOf = (json: Json, id: string) =>
  json.links.find((l: Json) => l.id === id);

describe('kaos: the operation and object models (#194)', () => {
  it('extends the KAOS root with its kinds, on the paper, saved as kaos.*', () => {
    expect(kaos.extension).to.equal(kaosOperations);
    expect(
      kaosOperations.elements.map((e) => [e.kind, e.pistarType, e.info]),
    ).to.deep.equal(
      ['Operation', 'Entity', 'Association', 'Event', 'Predicate', 'Type'].map(
        (name) => [
          `kaosOperations.${name}`,
          `kaos.${name}`,
          {
            canBeInnerElement: false,
            canBeDependum: false,
            canBeOnPaper: true,
          },
        ],
      ),
    );
    expect(
      kaosOperations.links.map((l) => [
        l.kind,
        l.rules?.sources,
        l.rules?.targets,
      ]),
    ).to.deep.equal([
      [
        'kaosOperations.OperationalisationLink',
        ['kaosOperations.Operation'],
        ['kaos.BehavioralGoal'],
      ],
      [
        'kaosOperations.PerformanceLink',
        ['kaos.Agent', 'kaos.EnvironmentAgent'],
        ['kaosOperations.Operation'],
      ],
      ...['MonitoringLink', 'ControlLink'].map((link) => [
        `kaosOperations.${link}`,
        ['kaos.Agent', 'kaos.EnvironmentAgent'],
        [
          'kaosOperations.Entity',
          'kaosOperations.Association',
          'kaosOperations.Event',
          'kaos.Agent',
          'kaos.EnvironmentAgent',
          'kaosOperations.Predicate',
        ],
      ]),
      [
        'kaosOperations.CauseLink',
        ['kaosOperations.Event'],
        ['kaosOperations.Operation'],
      ],
      [
        'kaosOperations.InputLink',
        [
          'kaosOperations.Entity',
          'kaosOperations.Association',
          'kaosOperations.Event',
          'kaos.Agent',
          'kaos.EnvironmentAgent',
        ],
        ['kaosOperations.Operation'],
      ],
      [
        'kaosOperations.OutputLink',
        ['kaosOperations.Operation'],
        [
          'kaosOperations.Entity',
          'kaosOperations.Association',
          'kaosOperations.Event',
          'kaos.Agent',
          'kaos.EnvironmentAgent',
        ],
      ],
      [
        'kaosOperations.AssociationLink',
        ['kaosOperations.Association'],
        [
          'kaosOperations.Entity',
          'kaosOperations.Association',
          'kaosOperations.Event',
          'kaos.Agent',
          'kaos.EnvironmentAgent',
        ],
      ],
    ]);
  });

  it('types each key: the conditions ltl formulas, an object’s Attributes name:type pairs, Monitors and Controls a reference with a member', () => {
    const keys = (list: readonly { key: string }[]) => list.map((p) => p.key);
    const { properties, links } = kaos;
    expect(keys(properties['kaosOperations.Operation'])).to.deep.equal([
      'DomPre',
      'DomPost',
      'Description',
    ]);
    expect(keys(properties['kaosOperations.Entity'])).to.deep.equal([
      'EntityType',
      'Attributes',
      'Initially',
      'Description',
    ]);
    expect(keys(properties['kaosOperations.Event'])).to.deep.equal([
      'Frequency',
      'Attributes',
      'Initially',
      'Description',
    ]);
    expect(keys(properties['kaosOperations.Predicate'])).to.deep.equal([
      'Arguments',
      'FormalSpec',
      'Default',
      'Description',
    ]);
    expect(keys(properties['kaos.Agent'])).to.deep.equal([
      'Description',
      'Load',
      'Attributes',
      'Initially',
    ]);
    for (const key of ['DomPre', 'DomPost'])
      expect(
        properties['kaosOperations.Operation'].find((p) => p.key === key)!
          .value,
      ).to.deep.equal({ type: 'formula', language: 'ltl' });
    expect(
      links['kaosOperations.OperationalisationLink'].map((p) => [
        p.key,
        p.value,
      ]),
    ).to.deep.equal(
      ['ReqPre', 'ReqTrig', 'ReqPost'].map((key) => [
        key,
        { type: 'formula', language: 'ltl' },
      ]),
    );
    expect(links['kaosOperations.MonitoringLink'][0]!.value).to.deep.equal({
      type: 'reference',
      target: {
        kinds: [
          'kaosOperations.Entity',
          'kaosOperations.Association',
          'kaosOperations.Event',
          'kaos.Agent',
          'kaos.EnvironmentAgent',
          'kaosOperations.Predicate',
        ],
      },
      members: { from: 'Attributes' },
    });
    expect(
      properties['kaosOperations.Entity'].find((p) => p.key === 'EntityType')!
        .value,
    ).to.deep.include({ type: 'enum' });
    expect(keys(links['kaosOperations.CauseLink'])).to.deep.equal(['Delay']);
    expect(keys(links['kaosOperations.AssociationLink'])).to.deep.equal([
      'Multiplicity',
      'Role',
    ]);
  });

  describe('Problems', () => {
    it('none on the fixture', () => {
      expect(problemsOf(jsonOf(FIXTURE))).to.deep.equal([]);
    });

    it('a Monitors or Controls naming an attribute its object doesn’t declare, or no object: an error on the link', () => {
      const json = jsonOf(FIXTURE);
      linkOf(json, 'controller-monitors-sump').customProperties.Monitors =
        'sump.dirty';
      linkOf(json, 'controller-controls-controller').customProperties.Controls =
        'nothing.level';
      expect(problemsOf(json)).to.deep.equal([
        {
          elementId: 'controller-monitors-sump',
          code: 'unknown-member',
          message:
            'Monitors: sump has no member dirty (its members: highWater, level)',
        },
        {
          elementId: 'controller-controls-controller',
          code: 'dangling-reference',
          message: 'Controls: nothing is not an element of this model',
        },
      ]);
      // an object that declares no attributes, and one of another kind
      const read = jsonOf(`declare agent [ a ]
  monitors tank.level
end
declare goal [ g ] end`);
      linkOf(read, 'a-monitors-tank').customProperties.Monitors = 'g.level';
      expect(problemsOf(read)).to.deep.equal([
        {
          elementId: 'a-monitors-tank',
          code: 'dangling-reference',
          message:
            'Monitors: g is a kaos.BehavioralGoal, not a kaosOperations.Entity or kaosOperations.Association or kaosOperations.Event or kaos.Agent or kaos.EnvironmentAgent or kaosOperations.Predicate',
        },
      ]);
      const none = jsonOf(`declare agent [ a ]
  monitors tank.level
end`);
      expect(problemsOf(none)).to.deep.equal([
        {
          elementId: 'a-monitors-tank',
          code: 'unknown-member',
          message: 'Monitors: tank has no member level (it declares none)',
        },
      ]);
    });

    it('the triangle: an agent performing an operation that operationalises a requirement it isn’t responsible for, an error on the performance (#210)', () => {
      const broken = FIXTURE.replace(
        '  assignedto controller\n',
        '  assignedto operator\n',
      ).replace(
        'declare entity [ sump ]',
        'declare agent [ operator ]\n  name "Operator"\nend\n\ndeclare entity [ sump ]',
      );
      expect(problemsOf(jsonOf(broken))).to.deep.equal([
        {
          elementId: 'controller-performs-switch_pump_on',
          code: 'open-closure',
          message:
            '"PumpController" performs "SwitchPumpOn", which operationalises "Maintain [PumpOnWhenHighWater]", but is not responsible for it: assign "Maintain [PumpOnWhenHighWater]" to "PumpController"',
        },
      ]);
      // each chain once: two performers, one of them responsible
      const shared = broken.replace(
        '  performedby controller\n',
        '  performedby controller, operator\n',
      );
      const open = openClosures(modelOf(jsonOf(shared)), kaos);
      expect(
        open.map(({ start, via, end }) => [start, via, end]),
      ).to.deep.equal([
        ['controller', 'switch_pump_on', 'pump_on_when_high_water'],
      ]);
    });
  });

  it('the Notation view: a Monitors naming an attribute its object doesn’t declare is a diagnostic on its link line', () => {
    // the elements named with their kinds' ids, as the Notation view writes them
    const json = jsonOf(FIXTURE);
    const prefixes = kaos.elements as Readonly<
      Record<string, { prefix: string }>
    >;
    const model = modelOf(json);
    const count = new Map<string, number>();
    for (const node of json.orphans) {
      const prefix = prefixes[model.elements.get(node.id)!.kind]!.prefix;
      count.set(prefix, (count.get(prefix) ?? 0) + 1);
      node.text = `${prefix}${count.get(prefix)}: ${node.text}`;
    }
    const definition = kaos as unknown as AnyDialect;
    const view = goalView(modelOf(json) as never, definition);
    const context = contextFromView(definition, view, []);
    const doc = notationDocument(definition, view).text;
    expect(doc).to.include('  link EN1 {Monitors = sump.highWater}');
    expect(documentDiagnostics(definition, doc, context)).to.deep.equal([]);
    const bad = doc.replace(
      '{Monitors = sump.highWater}',
      '{Monitors = sump.dirty}',
    );
    expect(
      documentDiagnostics(definition, bad, context).map((d) => d.message),
    ).to.deep.equal([
      'sump has no member dirty (its members: highWater, level)',
    ]);
  });
});
