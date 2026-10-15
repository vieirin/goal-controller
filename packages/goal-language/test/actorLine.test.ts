/**
 * Actor lines (goal-controller#109): an actor's properties written at the
 * top of the Notation view, read, mapped back and checked; and completion
 * and hover on link and actor lines (src/notation/actorLine.ts,
 * completion.ts, navigation.ts).
 */
import {
  defineDialect,
  type AnyDialect,
  type DocumentActor,
  type DocumentTree,
} from '@goal-controller/dialect';
import { expect } from 'chai';
import {
  actorLine,
  actorNames,
  completionsAt,
  contextFromView,
  documentDiagnostics,
  hoverAt,
  notationDocument,
  notationEdits,
  readActorLine,
  readLine,
  takesPosition,
} from '../src/index.js';
import { node, toy } from '../../dialect/test/support/toy.js';

const crew = defineDialect({
  ...toy,
  id: 'crew',
  name: 'Crew',
  links: {
    'istar.ContributionLink': [
      { key: 'weight', value: { type: 'int' }, help: 'how much it adds' },
    ],
  },
  actors: [
    {
      key: 'importance',
      value: {
        type: 'enum',
        options: [
          { value: 'High', label: 'High' },
          { value: 'Low', label: 'Low' },
        ],
      },
      help: 'how much it matters',
    },
    {
      key: 'budget',
      value: { type: 'int', min: 0 },
      help: 'what an agent may spend',
      kinds: ['istar.Agent'],
    },
  ],
});

const actor = (
  iStarId: string,
  name: string,
  kind: string,
  properties: Record<string, string>,
): DocumentActor => ({ iStarId, kind, name, properties, elements: [] });

const ACTORS = [
  actor('a1', 'Ann', 'istar.Actor', { importance: 'High', Description: '' }),
  actor('b1', 'Bob', 'istar.Agent', { budget: '3' }),
  actor('r1', 'Robot', 'istar.Role', {}),
  actor('r2', 'Robot', 'istar.Role', { importance: 'Low' }),
];

const TREE: DocumentTree = {
  nodes: new Map([
    ['G1', node({ id: 'G1', kind: 'goal', name: 'Go', children: ['T1'] })],
    ['T1', node({ id: 'T1', kind: 'task', name: 'Drive' })],
  ]),
  roots: ['G1'],
  links: [
    {
      iStarId: 'l1',
      kind: 'istar.ContributionLink',
      source: 'T1',
      target: 'G1',
      properties: { weight: '50' },
    },
  ],
  actors: ACTORS,
};

const DOC = [
  'actor "Ann" {importance = High}',
  'actor "Bob" {budget = 3}',
  'actor "Robot"#2 {importance = Low}',
  'G1: Go',
  '  T1: Drive',
  '    link G1 {weight = 50}',
].join('\n');

describe('actor lines (#109)', () => {
  it('reads an actor line’s value: the name in quotes, then {key = value} each', () => {
    const read = readActorLine('"Robot"#2 {importance = Low}');
    expect('value' in read && read.value.target).to.equal('"Robot"#2');
    expect('value' in read && read.value.properties[0]!.key).to.equal(
      'importance',
    );
    expect(readActorLine('Ann {importance = High}')).to.deep.equal({
      error: {
        message:
          'An actor line names its actor by its name, in quotes: actor "Name" {key = value}',
        from: 0,
        to: 23,
      },
    });
  });

  it('writes an actor’s declared properties its kind has, `#n` among actors of one name', () => {
    const names = actorNames(ACTORS);
    expect(actorLine(crew, ACTORS[0]!, names)).to.equal(
      'actor "Ann" {importance = High}',
    );
    expect(actorLine(crew, ACTORS[3]!, names)).to.equal(
      'actor "Robot"#2 {importance = Low}',
    );
    // a budget is an agent's: an actor\'s is not written
    expect(
      actorLine(
        crew,
        actor('a2', 'Eve', 'istar.Actor', { importance: 'Low', budget: '9' }),
        names,
      ),
    ).to.equal('actor "Eve" {importance = Low}');
  });

  it('writes the actors with properties at the top, in the model’s order; none in a dialect without actors', () => {
    expect(notationDocument(crew, TREE)).to.deep.equal({
      text: DOC,
      ids: ['G1', 'T1', 'T1'],
    });
    expect(notationDocument(toy, TREE).text).to.equal('G1: Go\n  T1: Drive');
  });

  it('maps actor lines back to the actors’ properties, wherever the line is', () => {
    expect(notationEdits(crew, DOC, TREE)).to.deep.equal([]);
    const changed = DOC.replace(
      '{budget = 3}',
      '{budget = 4} {importance = Low}',
    )
      .replace('actor "Ann" {importance = High}\n', '')
      // an actor line under the elements still names its actor
      .concat('\nactor "Robot"#1 {importance = High}');
    expect(notationEdits(crew, changed, TREE)).to.deep.equal([
      { actor: 'a1', key: 'importance', value: null },
      { actor: 'b1', key: 'importance', value: 'Low' },
      { actor: 'b1', key: 'budget', value: '4' },
      { actor: 'r1', key: 'importance', value: 'High' },
    ]);
  });

  it('changes nothing while a line names no actor, or one is written twice', () => {
    // being typed: no actor so named yet, the others keep theirs
    const typing = DOC.replace('actor "Bob" {budget = 3}', 'actor "Bo');
    expect(notationEdits(crew, typing, TREE)).to.deep.equal([]);
    const ambiguous = DOC.replace('"Robot"#2', '"Robot"');
    expect(notationEdits(crew, ambiguous, TREE)).to.deep.equal([]);
    const twice = `${DOC}\nactor "Ann" {importance = Low}`;
    expect(
      notationEdits(crew, twice, TREE).filter(
        (e) => 'actor' in e && e.actor === 'a1',
      ),
    ).to.deep.equal([]);
  });

  describe('diagnostics', () => {
    const context = contextFromView(crew, TREE, []);
    const messages = (doc: string) =>
      documentDiagnostics(crew, doc, context).map((d) => [
        doc.slice(d.from, d.to),
        d.message,
      ]);

    it('says nothing of the lines it writes', () => {
      expect(messages(DOC)).to.deep.equal([]);
    });

    it('reports the actor, a name several share, an actor written twice, a key and a value', () => {
      expect(messages(DOC.replace('"Ann"', '"Anna"'))).to.deep.equal([
        ['"Anna"', 'No actor "Anna"'],
      ]);
      expect(messages(DOC.replace('"Robot"#2', '"Robot"'))).to.deep.equal([
        ['"Robot"', '2 actors are named "Robot": write "Robot"#1, "Robot"#2'],
      ]);
      expect(messages(`${DOC}\nactor "Bob" {budget = 1}`)).to.deep.equal([
        ['"Bob"', 'The actor "Bob" is written twice'],
      ]);
      expect(
        messages(
          DOC.replace('{importance = High}', '{budget = 2} {importance = Mid}'),
        ),
      ).to.deep.equal([
        ['budget', 'Not a property of a Actor'],
        ['Mid', 'One of High, Low, not Mid'],
      ]);
      expect(
        messages(DOC.replace('"Bob" {budget = 3}', 'Bob {budget = 3}')),
      ).to.deep.equal([
        [
          'Bob {budget = 3}',
          'An actor line names its actor by its name, in quotes: actor "Name" {key = value}',
        ],
      ]);
    });

    it('keeps `actor` an unknown key in a dialect without actors', () => {
      const [found] = documentDiagnostics(
        toy,
        DOC,
        contextFromView(toy, TREE, []),
      );
      expect(found?.message).to.equal(
        'A property belongs under an element line',
      );
    });
  });

  it('reads a document without ids’ actor lines as its link lines: no element’s, taking no position', () => {
    const plain = defineDialect({
      ...(crew as unknown as AnyDialect),
      id: 'plain',
      notation: undefined,
      elements: { goal: { fill: '#fff' }, task: { fill: '#fff' } },
      properties: { goal: [], task: [] },
      propertyLineOrder: [],
    });
    const line = 'actor "Ann" {importance = High}';
    const read = readLine(plain, line);
    expect(read.kind === 'property' && [read.key, read.value]).to.deep.equal([
      'actor',
      '"Ann" {importance = High}',
    ]);
    expect(takesPosition(plain, line)).to.equal(false);
    const { text } = notationDocument(plain, TREE);
    expect(text.split('\n').slice(0, 3)).to.deep.equal([
      'actor "Ann" {importance = High}',
      'actor "Bob" {budget = 3}',
      'actor "Robot"#2 {importance = Low}',
    ]);
    expect(notationEdits(plain, text, TREE)).to.deep.equal([]);
    expect(
      notationEdits(plain, text.replace('{budget = 3}', '{budget = 5}'), TREE),
    ).to.deep.equal([{ actor: 'b1', key: 'budget', value: '5' }]);
    expect(
      documentDiagnostics(plain, text, contextFromView(plain, TREE, [])),
    ).to.deep.equal([]);
  });
});

describe('completion and hover on link and actor lines (#109)', () => {
  const context = contextFromView(crew, TREE, []);
  const labels = (doc: string, pos = doc.length) =>
    completionsAt(crew, doc, pos, context)?.options.map((o) => o.label);
  const head = 'G1: Go\n  T1: Drive\n    ';

  it('completes a link line’s target: what the source links to, of kinds with properties', () => {
    expect(labels(`${head}link `)).to.deep.equal(['G1']);
    // a goal links to nothing
    expect(labels('G1: Go\n  link ')).to.deep.equal([]);
  });

  it('completes the keys a link’s kind declares, inside { }', () => {
    expect(labels(`${head}link G1 {`)).to.deep.equal(['weight']);
    expect(labels(`${head}link G1 {weight = 5} {`)).to.deep.equal([]);
    // after `=`, the value: not a key
    const typed = `${head}link G1 {weight = `;
    expect(completionsAt(crew, typed, typed.length, context)).to.equal(null);
  });

  it('completes an actor line’s actor, by its name as the line writes it, then the keys its kind has', () => {
    expect(labels('actor ')).to.deep.equal([
      '"Ann"',
      '"Bob"',
      '"Robot"#1',
      '"Robot"#2',
    ]);
    expect(labels('actor "Ann" {')).to.deep.equal(['importance']);
    expect(labels('actor "Bob" {importance = Low} {')).to.deep.equal([
      'budget',
    ]);
  });

  it('shows a key’s help on hover, as the line’s link or actor kind declares it', () => {
    const doc = `${DOC}`;
    const at = (needle: string) => doc.indexOf(needle) + 1;
    expect(hoverAt(crew, doc, at('weight'), context)?.markdown).to.equal(
      '**weight**: how much it adds',
    );
    expect(hoverAt(crew, doc, at('budget'), context)?.markdown).to.equal(
      '**budget**: what an agent may spend',
    );
    const hover = hoverAt(crew, doc, at('importance'), context)!;
    expect(doc.slice(hover.from, hover.to)).to.equal('importance');
    expect(hoverAt(crew, doc, 1, context)?.markdown).to.match(
      /^\*\*actor\*\*: an actor's properties/,
    );
    // on the actor's name: nothing to explain
    expect(hoverAt(crew, doc, at('"Ann"') + 1, context)).to.equal(null);
  });
});
