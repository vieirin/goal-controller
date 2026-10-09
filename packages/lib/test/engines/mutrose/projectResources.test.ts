/** MutRoSe's project resources, parsed: world knowledge, HDDL domain, configuration. */
import { expect } from 'chai';
import {
  mutroseProjectResources,
  parseConfiguration,
  parseHddl,
  parseWorld,
} from '../../../src';
import { readXml } from '../../../src/engines/mutrose/projectResources/xml';

const WORLD = `<?xml version="1.0"?>
<!-- the ward -->
<world_db>
  <Room>
    <name>Ward1</name>
    <is_clean>False</is_clean>
  </Room>
  <Room name="Ward2"><is_clean>True</is_clean></Room>
  <Nurse>
    <name>Ana</name>
    <shift>day</shift>
  </Nurse>
</world_db>
`;

const HDDL = `; a small delivery domain
(define (domain delivery)
  (:types room nurse - object robot)
  (:predicates (delivered ?r - room) (at ?b - robot ?r - room))
  (:task deliver-medicine :parameters (?r - room ?n - nurse))
  (:task patrol :parameters (?r))
  (:method m-deliver :parameters (?r - room ?n - nurse ?b - robot)
    :task (deliver-medicine ?r ?n)
    :ordered-subtasks (and (t1 (move ?b ?r))))
  (:action move :parameters (?b - robot ?r - room)
    :effect (at ?b ?r))
)
`;

const CONFIGURATION = JSON.stringify(
  {
    world_db: {
      type: 'file',
      file_type: 'xml',
      path: 'knowledge/world_db.xml',
      xml_root: 'world_db',
    },
    location_types: ['Room'],
    type_mapping: [{ hddl_type: 'room', ocl_type: 'Room' }],
    var_mapping: [
      { task_id: 'AT1', map: [{ gm_var: 'current_room', hddl_var: '?r' }] },
    ],
  },
  null,
  2,
);

const file = (path: string, text: string) => [{ path, text }];

describe('MutRoSe world knowledge', () => {
  it('reads its classes, their attributes and their entities', () => {
    const { data, symbols, diagnostics } = parseWorld(
      file('knowledge/world_db.xml', WORLD),
    );
    expect(diagnostics).to.deep.equal([]);
    expect(data).to.deep.equal({
      root: 'world_db',
      classes: {
        Room: {
          attributes: ['name', 'is_clean'],
          instances: ['Ward1', 'Ward2'],
        },
        Nurse: { attributes: ['name', 'shift'], instances: ['Ana'] },
      },
    });
    expect(
      symbols.classes!.map((c) => [c.name, c.members!.map((m) => m.name)]),
    ).to.deep.equal([
      ['Room', ['name', 'is_clean']],
      ['Nurse', ['name', 'shift']],
    ]);
    expect(
      symbols.instances!.map((i) => `${i.name}:${i.detail}`),
    ).to.deep.equal(['Ward1:Room', 'Ward2:Room', 'Ana:Nurse']);
    // it crosses to the language server as JSON
    expect(JSON.parse(JSON.stringify(data))).to.deep.equal(data);
  });

  it('says what is wrong in the XML, where', () => {
    const text =
      '<world_db>\n  <Room><name>A</nme></Room>\n  <Nurse>\n</world_db>';
    const { diagnostics } = parseWorld(file('w.xml', text));
    const at = (message: RegExp) => {
      const found = diagnostics.find((d) => message.test(d.message));
      expect(found, String(message)).to.not.equal(undefined);
      return text.slice(found!.from, found!.to);
    };
    expect(at(/<\/nme> closes <name>/)).to.equal('</nme>');
    expect(at(/<\/world_db> closes <Nurse>/)).to.equal('</world_db>');
    expect(diagnostics.every((d) => d.path === 'w.xml')).to.equal(true);
    const nameless = parseWorld(
      file('w.xml', '<world_db><Room><is_clean>x</is_clean></Room></world_db>'),
    );
    expect(
      nameless.diagnostics.map((d) => [d.severity, d.message]),
    ).to.deep.equal([
      [
        'warning',
        'This Room has no name: the decomposer names entities by their `name`',
      ],
    ]);
    expect(
      parseWorld(file('w.xml', '')).diagnostics.map((d) => d.message),
    ).to.deep.equal(['No root element']);
  });

  it('reads entities, attributes and comments as XML has them', () => {
    const { root, problems } = readXml(
      '<a x="1" y=\'&lt;2&gt;\'><!-- c --><b/><c>t &amp; u</c></a>',
    );
    expect(problems).to.deep.equal([]);
    expect(root!.attributes).to.deep.equal({ x: '1', y: '<2>' });
    expect(root!.children.map((c) => [c.name, c.text])).to.deep.equal([
      ['b', ''],
      ['c', 't & u'],
    ]);
    expect(readXml('<a></a><b/>').problems.map((p) => p.message)).to.deep.equal(
      ['<b>: a document has one root element'],
    );
    expect(readXml('<a><b>').problems.map((p) => p.message)).to.deep.equal([
      '<a> is not closed',
      '<b> is not closed',
    ]);
  });
});

describe('MutRoSe HDDL domain', () => {
  it('reads its types, predicates, tasks and actions with their parameters', () => {
    const { data, symbols, diagnostics } = parseHddl(
      file('hddl/domain.hddl', HDDL),
    );
    expect(diagnostics).to.deep.equal([]);
    expect(data.name).to.equal('delivery');
    expect(data.types).to.deep.equal(['room', 'nurse', 'robot']);
    expect(data.tasks).to.deep.equal([
      {
        name: 'deliver-medicine',
        parameters: [
          { name: '?r', type: 'room' },
          { name: '?n', type: 'nurse' },
        ],
      },
      { name: 'patrol', parameters: [{ name: '?r', type: 'object' }] },
    ]);
    expect(data.actions.map((a) => a.name)).to.deep.equal(['move']);
    expect(data.predicates.map((p) => p.name)).to.deep.equal([
      'delivered',
      'at',
    ]);
    expect(symbols.tasks![0]).to.deep.equal({
      name: 'deliver-medicine',
      detail: '?r - room ?n - nurse',
      members: [
        { name: '?r', detail: 'room' },
        { name: '?n', detail: 'nurse' },
      ],
    });
  });

  it('says what is unbalanced, and what is not a domain', () => {
    const text = '(define (domain d)\n  (:task t :parameters (?a))';
    const { diagnostics } = parseHddl(file('d.hddl', text));
    expect(
      diagnostics.map((d) => [d.message, text.slice(d.from, d.to)]),
    ).to.deep.equal([['Unclosed (', '(']]);
    expect(
      parseHddl(file('d.hddl', '(foo) )')).diagnostics.map((d) => d.message),
    ).to.deep.equal([
      'Unbalanced )',
      'An HDDL domain is `(define (domain name) …)`',
    ]);
  });
});

describe('MutRoSe configuration', () => {
  it('reads where the world is, its location types and its mappings', () => {
    const { data, symbols, diagnostics } = parseConfiguration(
      file('configuration/configuration.json', CONFIGURATION),
    );
    expect(diagnostics).to.deep.equal([]);
    expect(data).to.deep.equal({
      worldDb: { path: 'knowledge/world_db.xml', xmlRoot: 'world_db' },
      locationTypes: ['Room'],
      typeMapping: [{ hddlType: 'room', oclType: 'Room' }],
      varMapping: [
        { taskId: 'AT1', map: [{ gmVar: 'current_room', hddlVar: '?r' }] },
      ],
    });
    expect(symbols.locationTypes).to.deep.equal([
      { name: 'Room', detail: 'location type' },
    ]);
  });

  it('says what is wrong, at the key it is about', () => {
    const text =
      '{ "location_types": "Room", "type_mapping": [{ "hddl_type": "room" }] }';
    const { diagnostics } = parseConfiguration(file('c.json', text));
    expect(
      diagnostics.map((d) => [d.message, text.slice(d.from, d.to)]),
    ).to.deep.equal([
      ['`location_types` is a list of world classes', '"location_types"'],
      [
        'Each `type_mapping` entry is `{ "hddl_type": …, "ocl_type": … }`',
        '"type_mapping"',
      ],
    ]);
    const broken = parseConfiguration(file('c.json', '{ "a": }'));
    expect(broken.diagnostics).to.have.length(1);
    expect(broken.diagnostics[0]!.message).to.match(/^Not valid JSON/);
    expect(broken.diagnostics[0]!.from).to.be.within(0, 8);
  });
});

describe('MutRoSe parser registry', () => {
  it('parses every kind its definition declares', () => {
    expect(Object.keys(mutroseProjectResources).sort()).to.deep.equal([
      'configuration',
      'hddl',
      'world',
    ]);
    // no file: nothing, and nothing wrong
    for (const parse of Object.values(mutroseProjectResources))
      expect(parse([]).diagnostics).to.deep.equal([]);
  });
});
