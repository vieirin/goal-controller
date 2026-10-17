/**
 * Contextual goal models: the resources (situations, logical relations;
 * #153 item 3), contexts as formulas (Fig. 4's α), a situation's contexts
 * and contributions (Code 3, Example 1), the cost rule (#151 D11), and
 * RE-Context's DLV encoding of each seed (Codes 2–4; #153 item 4).
 */
import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { describe, it } from 'mocha';
import { readAssertion } from '@goal-controller/goal-language';
import {
  contextsHolding,
  contributionSign,
  costOfTasks,
  dlvGuardAtom,
  evaluate,
  expandToFacts,
  namesOf,
  parseRelations,
  parseSituations,
  reContextDlv,
  readCgmModel,
  readRelationSets,
  readSituations,
  resourceFiles,
  smtFormula,
} from '../../../src/engines/cgm';
import { EXAMPLES, SEEDS, seedModel, seedResource } from './support';

const situationsOf = (seed: (typeof SEEDS)[number]) =>
  readSituations(resourceFiles(seedResource(seed, 'situations'))).situations;

describe('Contextual goal models: situations and logical relations', () => {
  it("reads the seeds' situations and relations, without a problem", () => {
    for (const seed of SEEDS) {
      const situations = parseSituations(
        resourceFiles(seedResource(seed, 'situations')),
      );
      const relations = parseRelations(
        resourceFiles(seedResource(seed, 'relations')),
      );
      assert.deepStrictEqual(
        [situations.diagnostics, relations.diagnostics],
        [[], []],
        seed,
      );
    }
    const [code3] = situationsOf('museum-guide-costs');
    assert.deepStrictEqual(
      [code3!.contexts, code3!.facts, code3!.priorities],
      [['C6', 'C10', 'C12', 'C14', 'C15'], [], { SG1: 3, SG2: 1 }],
    );
    const [rej] = readRelationSets(
      resourceFiles(seedResource('museum-guide', 'relations')),
    ).relations;
    assert.deepStrictEqual(
      rej!.absolute.map((r) => r.text),
      ['!F8.1 | !F7.1', '!F7.1 | !F1.1', '!C13 | C12'],
    );
  });

  it('reports what a situation or a relations file gets wrong, where it is', () => {
    const situations = parseSituations([
      { path: 'situations/a.json', text: '{ "priorities": {} }' },
      {
        path: 'situations/b.json',
        text: '{ "contexts": { "C1": 1 }, "priorities": { "SG1": -2 } }',
      },
      { path: 'situations/c.json', text: '{ "contexts":' },
    ]);
    assert.deepStrictEqual(
      situations.diagnostics.map((d) => [
        d.path,
        d.message.replace(/: Unexpected.*|: Expected.*/, ''),
      ]),
      [
        [
          'situations/a.json',
          'A situation states the contexts that hold, the facts that do, or both: `contexts`, `facts`',
        ],
        ['situations/b.json', 'C1 holds or not: true or false'],
        ['situations/b.json', "SG1's priority is an integer, 0 or more"],
        ['situations/c.json', 'Not valid JSON'],
      ],
    );
    const relations = parseRelations([
      {
        path: 'relations/a.json',
        text: '{ "absolute": ["C1 &", 3], "environments": { "dark": "!F3" } }',
      },
    ]);
    assert.deepStrictEqual(
      relations.diagnostics.map((d) => d.message),
      [
        'dark is a list of relations',
        'Not a relation: "C1 &" (an assertion, `!C13 | C12`)',
        'Not a relation: 3 (an assertion, `!C13 | C12`)',
      ],
    );
  });

  it('reads an environment’s relations beside the absolute ones (REJ 2010 §5.1)', () => {
    const [set] = readRelationSets([
      {
        path: 'relations/x.json',
        text: '{ "absolute": ["!C13 | C12"], "environments": { "dark museum": ["!F3"] } }',
      },
    ]).relations;
    assert.deepStrictEqual(Object.keys(set!.environments), ['dark museum']);
    assert.deepStrictEqual(
      set!.environments['dark museum']!.map((r) => r.text),
      ['!F3'],
    );
  });
});

describe('Contextual goal models: contexts as formulas', () => {
  it("C1's analysis (Fig. 4), down to facts, is α as printed, its parenthesis restored", () => {
    const cgm = readCgmModel(seedModel('museum-guide'));
    const expanded = expandToFacts(readAssertion('ST1.2'), cgm.lookup);
    // α = ((f1 & f2) v f3) & (((f4 v f5) & f6) v f7) & f8 & (f9 v … v f13) & (f14 v f15)
    const alpha = readAssertion(
      '((F1 & F2) | F3) & (((F4 | F5) & F6) | F7) & F8 & (F9 | F10 | F11 | F12 | F13) & (F14 | F15)',
    );
    const facts = Array.from({ length: 15 }, (_, i) => `F${i + 1}`);
    assert.deepStrictEqual(namesOf(expanded).sort(), [...facts].sort());
    // a truth table: 2^15 assignments
    for (let bits = 0; bits < 1 << 15; bits++) {
      const value = (name: string) =>
        (bits >> (Number(name.slice(1)) - 1)) & 1 ? true : false;
      assert.strictEqual(
        evaluate(expanded, value),
        evaluate(alpha, value),
        String(bits),
      );
    }
  });

  it("ϕ1's analysis (IST 2013 Fig. 2), down to facts, is its printed formula, its parenthesis restored", () => {
    const cgm = readCgmModel(seedModel('smart-home'));
    const expanded = expandToFacts(readAssertion('C1'), cgm.lookup);
    const printed = readAssertion(
      'F1 & ((F2 & F3 & F4) | F5 | F6 | ((F7 | F8) & F9 & F10))',
    );
    for (let bits = 0; bits < 1 << 10; bits++) {
      const value = (name: string) =>
        (bits >> (Number(name.slice(1)) - 1)) & 1 ? true : false;
      assert.strictEqual(
        evaluate(expanded, value),
        evaluate(printed, value),
        String(bits),
      );
    }
  });

  it('writes a formula in SMT-LIB 2 for the oracle, and its guard atom for DLV', () => {
    assert.strictEqual(
      smtFormula(readAssertion('!F8.1 | !F7.1 & C2')),
      '(or (not |F8.1|) (and (not |F7.1|) |C2|))',
    );
    assert.strictEqual(
      dlvGuardAtom({ condition: readAssertion('C7 & !C8')!, holds: true }),
      'c7_and_not_c8',
    );
    assert.strictEqual(
      dlvGuardAtom({ condition: readAssertion('C2')!, holds: false }),
      'not_c2',
    );
  });
});

describe('Contextual goal models: situations, contributions and costs', () => {
  it("a situation's contexts: those it lists, and those its facts make hold (§3.4)", () => {
    const cgm = readCgmModel(seedModel('smart-home'));
    const [anxious] = situationsOf('smart-home');
    // ϕ1 = f1 ∧ st1, st1 through st2 (f2 ∧ f3 ∧ f4); ϕ7 needs wp7.1 too; ϕ10 isn't given
    assert.deepStrictEqual(
      [...contextsHolding(cgm, anxious!)],
      ['C0', 'C1', 'C4', 'C9', 'C11'],
    );
  });

  it("a contribution's sign: Code 3's, and Example 1's when C14 is false (#151 D10)", () => {
    const cgm = readCgmModel(seedModel('museum-guide-costs'));
    // a contribution by its ends' ids, `G10 SG1`
    const sign = (ends: string, holding: string[]) =>
      contributionSign(
        cgm.contributions.find(
          (l) => `${cgm.idOf(l.source)} ${cgm.idOf(l.target)}` === ends,
        )!,
        (formula) => evaluate(formula, (n) => holding.includes(n)),
      );
    assert.deepStrictEqual(
      ['G10 SG1', 'G10 SG2', 'G11 SG1', 'G11 SG2'].map((id) => [
        sign(id, ['C14']),
        sign(id, []),
      ]),
      [
        ['pos', 'pos'],
        ['pos', 'neg'],
        ['neg', 'neg'],
        ['pos', 'pos'],
      ],
    );
  });

  it('costs a set of tasks pairwise (#151 D11): Fig. 13’s 340 for all, 215 for its answer', () => {
    const cgm = readCgmModel(seedModel('museum-guide-costs'));
    const tasks = (ids: string) => ids.split(' ').map((id) => cgm.byId(id)!.id);
    assert.strictEqual(
      costOfTasks(cgm, tasks('T1 T2 T3 T4 T5 T6 T7 T8 T9 T10 T11 T12')),
      340,
    );
    assert.strictEqual(costOfTasks(cgm, tasks('T1 T4 T5 T7 T8 T9')), 215);
    assert.strictEqual(costOfTasks(cgm, tasks('T5 T7 T8 T9')), 155);
  });
});

describe("Contextual goal models: RE-Context's DLV encoding (REJ 2010 Codes 2–4)", () => {
  for (const seed of SEEDS)
    it(`${seed}: Code 2, and Code 3 per situation, as committed`, () => {
      const model = seedModel(seed);
      const reference = (name: string) =>
        fs.readFileSync(
          path.join(EXAMPLES, seed, 'reference', `${name}.dlv`),
          'utf8',
        );
      assert.strictEqual(reContextDlv(model), reference(seed));
      for (const situation of situationsOf(seed))
        assert.strictEqual(
          reContextDlv(model, { situation }),
          reference(path.basename(situation.path, '.json')),
        );
    });

  it("writes Code 2's lines for Fig. 13 as the paper does, `|` for its `v`", () => {
    const text = reContextDlv(seedModel('museum-guide-costs'));
    for (const line of [
      'ach(g2) | ach(g3) :- ach(g1).',
      'c5 :- ach(g2).',
      'c6 :- ach(g3).',
      'ach(g4) :- ach(g2).',
      'ach(g5) :- ach(g2).',
      'todo(t1) | todo(t2) :- ach(g4).',
      'todo(t3) | todo(t4) :- ach(g5).',
      'ach(g1).',
    ])
      assert.ok(text.split('\n').includes(line), line);
  });

  it("writes Code 3 for Code 3's situation, the opposite as its own rule, and Code 4 as resources", () => {
    const [code3] = situationsOf('museum-guide-costs');
    const lines = reContextDlv(seedModel('museum-guide-costs'), {
      situation: code3,
    }).split('\n');
    for (const line of [
      'phi(c14).',
      'softgoal(sg1,3).',
      'softgoal(sg2,1).',
      'contrib(g10,sg1,pos).',
      'contrib(g10,sg2,pos) :- phi(c14).',
      'contrib(g10,sg2,neg) :- not phi(c14).',
      'contrib(g11,sg1,neg).',
      'contrib(g11,sg2,pos).',
      // Code 4's T1 and T2: r1 (30) shared, r2 (10) T2's own
      'cost(r_t2_t1,30) :- needed(r_t2_t1).',
      'cost(r_t2,10) :- needed(r_t2).',
      'cost(r_t1,0) :- needed(r_t1).',
      // T4 shares 90 of its 80
      'cost(r_t4,-10) :- needed(r_t4).',
    ])
      assert.ok(lines.includes(line), line);
  });

  it('writes a dropped AND child’s negated context, a formula as one atom, a dependency', () => {
    const lines = reContextDlv(seedModel('museum-guide')).split('\n');
    for (const line of [
      'ach(g12).',
      'c0 :- ach(g12).',
      'ach(g14) | drop(g14) :- ach(g13).',
      'c2 :- ach(g14).',
      'not_c2 :- drop(g14).',
      'not_c9 :- todo(t17).',
      'ach(g3_1) :- ach(g3).',
      'c10 :- ach(g3_1).',
      'ach(g3_2) :- ach(g3_1).',
    ])
      assert.ok(lines.includes(line), line);
  });
});
