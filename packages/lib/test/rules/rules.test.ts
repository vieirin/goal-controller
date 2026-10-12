/**
 * The rule layer (goal-controller#74): the core rules on small fact sets;
 * #63's fixtures (its extracted facts, its engines' rules in Nemo's syntax)
 * giving #63's problems and resolutions; and a toy dialect bringing its own
 * rule file, with no change to the layer.
 */
import { expect } from 'chai';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { gunzipSync } from 'zlib';
import * as nemo from 'nemo-wasm';
import {
  evaluateRules,
  FactSet,
  prepareRules,
  renameConflicts,
  type NemoModule,
  type PreparedRules,
} from '../../src/rules';

const NEMO = nemo as unknown as NemoModule;
const FIXTURES = join(__dirname, 'fixtures');

const problemsOf = async (rules: PreparedRules, facts: FactSet) =>
  (await evaluateRules(rules, facts)).problems
    .map((p) => `${p.id} ${p.severity} ${p.check}`)
    .sort();

describe('the rule layer’s core rules', () => {
  const rules = prepareRules(NEMO);
  after(() => rules.free());

  /** a definition, its kind global unless said */
  const project = () =>
    new FactSet()
      .add('kindScope', 'thing', 'global')
      .add('kindScope', 'member', 'owner')
      .add('kindScope', 'maybe', 'optional')
      .add('defines', 'thing:a', 'thing', 'a')
      .add('defines', 'thing:b', 'thing', 'b')
      .add('defines', 'member:a/x', 'member', 'x')
      .add('owns', 'thing:a', 'member:a/x');

  it('resolves a global reference by name, and reports one to nothing', async () => {
    const facts = project()
      .add('refers', 'r1', 'thing', 'a')
      .add('refers', 'r2', 'thing', 'zzz');
    const { resolves, problems } = await evaluateRules(rules, facts);
    expect(resolves).to.deep.equal([
      { reference: 'r1', definition: 'thing:a' },
    ]);
    expect(problems.map((p) => `${p.id} ${p.check}`)).to.deep.equal([
      'r2 unresolved',
    ]);
  });

  it('resolves a scoped reference among its owner’s members only', async () => {
    const facts = project()
      .add('refers', 'r1', 'member', 'x')
      .add('scoped', 'r1')
      .add('scope', 'r1', 'thing:a')
      .add('refers', 'r2', 'member', 'x')
      .add('scoped', 'r2')
      .add('scope', 'r2', 'thing:b');
    const { resolves, problems } = await evaluateRules(rules, facts);
    expect(resolves).to.deep.equal([
      { reference: 'r1', definition: 'member:a/x' },
    ]);
    expect(problems.map((p) => `${p.id} ${p.check}`)).to.deep.equal([
      'r2 unresolved',
    ]);
  });

  it('scopes a reference through another’s target: its type, or an engine’s resolver', async () => {
    const facts = project()
      .add('defines', 'var:v', 'var', 'v')
      .add('kindScope', 'var', 'global')
      .add('typeBase', 'var:v', 'a')
      .add('refers', 'head', 'var', 'v')
      .add('refers', 'path', 'member', 'x')
      .add('scoped', 'path')
      .add('via', 'path', 'head', 'type')
      // an engine's resolver: `stands` leads from b to a
      .add('through', 'stands', 'thing:b', 'thing:a')
      .add('refers', 'tb', 'thing', 'b')
      .add('refers', 'other', 'member', 'x')
      .add('scoped', 'other')
      .add('via', 'other', 'tb', 'stands');
    const { resolves, problems } = await evaluateRules(rules, facts);
    expect(
      resolves.map((r) => `${r.reference}>${r.definition}`).sort(),
    ).to.deep.equal([
      'head>var:v',
      'other>member:a/x',
      'path>member:a/x',
      'tb>thing:b',
    ]);
    expect(problems).to.deep.equal([]);
  });

  it('reports an ambiguous reference once, and an optional kind’s miss not at all', async () => {
    const facts = project()
      .add('defines', 'thing:a2', 'thing', 'a')
      .add('refers', 'r1', 'thing', 'a')
      .add('kindScope', 'maybe', 'optional')
      .add('refers', 'r2', 'maybe', 'nothing');
    expect(await problemsOf(rules, facts)).to.deep.equal([
      'r1 warning ambiguous',
    ]);
  });

  it('finds a rename’s conflicts: the same kind in the same scope', async () => {
    const facts = project()
      .add('defines', 'member:a/y', 'member', 'y')
      .add('owns', 'thing:a', 'member:a/y');
    expect(await renameConflicts(rules, facts, 'thing:a', 'b')).to.deep.equal([
      'thing:b',
    ]);
    expect(await renameConflicts(rules, facts, 'thing:a', 'c')).to.deep.equal(
      [],
    );
    expect(
      await renameConflicts(rules, facts, 'member:a/x', 'y'),
    ).to.deep.equal(['member:a/y']);
    // a global name isn't a member's: no clash
    expect(
      await renameConflicts(rules, facts, 'member:a/x', 'b'),
    ).to.deep.equal([]);
  });
});

type Fixture = {
  engine: string;
  tuples: [string, (string | number)[]][];
  problems: (string | number)[][];
  resolves: number;
};

/** #63's facts, as rows: a relation's dots are underscores in Nemo. */
const factsOf = (fixture: Fixture) => {
  const facts = new FactSet();
  for (const [relation, row] of fixture.tuples)
    facts.add(relation.replace(/\./g, '_'), ...row);
  return facts;
};

const fixtures = readdirSync(FIXTURES).filter((f) => /\.json(\.gz)?$/.test(f));
const readFixture = (file: string): Fixture => {
  const raw = readFileSync(join(FIXTURES, file));
  return JSON.parse(
    (file.endsWith('.gz') ? gunzipSync(raw) : raw).toString('utf8'),
  );
};

describe('#63’s fixtures on the rule layer', () => {
  const prepared = new Map<string, PreparedRules>();
  const rulesOf = (engine: string) => {
    let rules = prepared.get(engine);
    if (!rules)
      prepared.set(
        engine,
        (rules = prepareRules(NEMO, [
          readFileSync(join(FIXTURES, `${engine}.rls`), 'utf8'),
        ])),
      );
    return rules;
  };
  after(() => prepared.forEach((rules) => rules.free()));

  for (const file of fixtures)
    it(`${file}: #63’s problems and resolutions`, async function () {
      this.timeout(60000);
      const fixture = readFixture(file);
      const { problems, resolves } = await evaluateRules(
        rulesOf(fixture.engine),
        factsOf(fixture),
      );
      expect(
        problems
          .map((p) => [p.id, p.severity, p.check, p.detail].join('|'))
          .sort(),
      ).to.deep.equal(
        [
          ...new Set(fixture.problems.map((p) => p.map(String).join('|'))),
        ].sort(),
      );
      expect(resolves.length).to.equal(fixture.resolves);
    });
});

describe('a toy dialect on the rule layer', () => {
  // its own rule file: a dish nobody orders is a warning; its own relations
  const TOY = `
    menu_ordered(?S) :- resolves(_, ?S), defines(?S, "menu.dish", _) .
    problem(?S, "warning", "menu.neverOrdered", "") :- defines(?S, "menu.dish", _), ~menu_ordered(?S) .
  `;
  const rules = prepareRules(NEMO, [TOY]);
  after(() => rules.free());

  it('reports its own check and the core’s, with no change to the layer', async () => {
    const facts = new FactSet()
      .add('kindScope', 'menu.dish', 'global')
      .add('defines', 'dish:soup', 'menu.dish', 'soup')
      .add('defines', 'dish:cake', 'menu.dish', 'cake')
      .add('refers', 'order1', 'menu.dish', 'soup')
      .add('refers', 'order2', 'menu.dish', 'pie');
    expect(await problemsOf(rules, facts)).to.deep.equal([
      'dish:cake warning menu.neverOrdered',
      'order2 error unresolved',
    ]);
  });
});
