/**
 * Contextual goal models' four analyses (goal-controller#153 item 5), on
 * #152's variants and solver: #151's reference results from the seeds,
 * exactly, and the readings of #151 D13, D14, D16 on small models.
 */
import * as assert from 'assert';
import { describe, it } from 'mocha';
import { readAssertion } from '@goal-controller/goal-language';
import { runAnalysis } from '../../../src/engines/analysis';
import { implies, satisfiable } from '../../../src/engines/propositional';
import {
  cgmAnalyses,
  cgmVariants,
  contextText,
  coreGroups,
  expandToFacts,
  factContext,
  minimumCostTasks,
  readCgmModel,
  readRelationSets,
  resourceFiles,
  tasksOf,
  variantName,
  variantScore,
} from '../../../src/engines/cgm';
import { seedModel, seedResource, toy } from './support';

const variantsOf = (seed: Parameters<typeof seedModel>[0]) => {
  const cgm = readCgmModel(seedModel(seed));
  return { cgm, all: cgmVariants(cgm).flatMap((r) => r.variants) };
};
const relationsOf = (seed: Parameters<typeof seedModel>[0]) =>
  readRelationSets(resourceFiles(seedResource(seed, 'relations'))).relations;

describe('Contextual goal models: the variants (#152, #151 D13, D16)', () => {
  it("enumerates Fig. 13's thirteen variants, a dependency followed into the staff's tree", () => {
    const { cgm, all } = variantsOf('museum-guide-costs');
    assert.deepStrictEqual(
      all.map((v) => variantName(cgm, v)),
      [
        '{T1, T3}',
        '{T1, T4}',
        '{T2, T3}',
        '{T2, T4}',
        '{T5, T8, T9}',
        '{T5, T10}',
        '{T5, T11}',
        '{T6, T8, T9}',
        '{T6, T10}',
        '{T6, T11}',
        '{T7, T8, T9}',
        '{T7, T10}',
        '{T7, T11}',
      ],
    );
    // a dependency's context is required (D16): no variant achieves G3 without the staff
    assert.ok(all.every((v) => tasksOf(cgm, v).length > 0));
  });

  it('counts the seeds’ variants, as DLV does (the stress test checks them against it)', () => {
    assert.deepStrictEqual(
      (['museum-guide', 'museum-guide-costs', 'smart-home'] as const).map(
        (seed) => variantsOf(seed).all.length,
      ),
      [160, 13, 168],
    );
  });

  it('excludes a variant whose context is unreadable (#238)', () => {
    const base = seedModel('museum-guide-costs');
    const readable = cgmVariants(readCgmModel(base)).flatMap((r) => r.variants);
    // G2 → G1 is an OR refinement with a context on museum-guide-costs
    const link = base.links.find(
      (l) =>
        l.kind === 'istar.OrRefinementLink' &&
        l.properties.context !== undefined,
    );
    assert.ok(link, 'expected an OR refinement with a context');
    const broken: typeof base = {
      ...base,
      links: base.links.map((l) =>
        l.id === link.id
          ? { ...l, properties: { ...l.properties, context: 'C5 &' } }
          : l,
      ),
    };
    const after = cgmVariants(readCgmModel(broken)).flatMap((r) => r.variants);
    assert.ok(
      after.length < readable.length,
      `expected fewer variants after unreadable context (${after.length} vs ${readable.length})`,
    );
  });

  it("writes Fig. 3's variant's context as the figure does", () => {
    const { cgm, all } = variantsOf('museum-guide');
    const fig3 = all.filter(
      (v) =>
        variantName(cgm, v) === '{T7, T8, T9}' &&
        !v.elements.includes(cgm.byId('G14')!.id) &&
        !v.elements.includes(cgm.byId('G15')!.id),
    );
    assert.strictEqual(fig3.length, 1);
    assert.strictEqual(
      contextText(cgm, fig3[0]!),
      'C0 ∧ ¬C2 ∧ ¬C3 ∧ C1 ∧ C6 ∧ C10 ∧ C11',
    );
  });
});

describe('Contextual goal models: variants in a situation (§4)', () => {
  const ranking = (seed: Parameters<typeof seedModel>[0]) => {
    const run = runAnalysis(
      cgmAnalyses.cgmVariants,
      seedModel(seed),
      seedResource(seed, 'situations'),
    );
    assert.ok('result' in run, JSON.stringify(run));
    return run.result.cases.map((c) => [
      c.label.replace(/^.*: /, ''),
      c.summary!.replace(/;.*/, ''),
    ]);
  };

  it("Code 3: G10's variant scores 4, G11's −2, G10's first", () => {
    assert.deepStrictEqual(ranking('museum-guide-costs'), [
      ['#1 {T5, T8, T9}', 'score 4'],
      ['#2 {T5, T10}', 'score -2'],
      ['#3 {T5, T11}', 'score -2'],
    ]);
  });

  it('Example 1, its erratum: in person −1, by call +1 (the paper prints 1 and −1)', () => {
    assert.deepStrictEqual(ranking('museum-guide'), [
      ['#1 {T6, T10}', 'score 1'],
      ['#2 {T6, T11}', 'score 1'],
      ['#3 {T6, T8, T9}', 'score -1'],
    ]);
  });

  it('scores by percentages: two of three contributions positive, priority 3, is 1', () => {
    const model = toy(
      [
        ['G1', 'goal'],
        ['T1', 'task'],
        ['T2', 'task'],
        ['SG1', 'quality'],
      ],
      [
        ['T1', 'and', 'G1'],
        ['T2', 'and', 'G1'],
        ['G1', 'contribution', 'SG1', {}, 'help'],
        ['T1', 'contribution', 'SG1', { context: 'C1' }, 'help'],
        ['T2', 'contribution', 'SG1', {}, 'hurt'],
      ],
    );
    const cgm = readCgmModel(model);
    const [variant] = cgmVariants(cgm)[0]!.variants;
    assert.deepStrictEqual(
      variantScore(cgm, variant!, new Set(['C1']), { SG1: 3 }).score,
      1,
    );
    // C1 false: T1's contribution doesn't apply, one of two positive
    assert.deepStrictEqual(
      variantScore(cgm, variant!, new Set(), { SG1: 3 }).score,
      0,
    );
  });
});

describe('Contextual goal models: unadoptable variants (§5.1)', () => {
  it('Example 2: under wp8.1 → ¬wp7.1, C7 → ¬C8, and every variant with both is unadoptable', () => {
    const { cgm, all } = variantsOf('museum-guide');
    const assumptions = relationsOf('museum-guide')[0]!.absolute.map((r) =>
      expandToFacts(r.tree, cgm.lookup)!,
    );
    const fact = (text: string) =>
      expandToFacts(readAssertion(text), cgm.lookup)!;
    assert.strictEqual(
      implies(fact('C7'), fact('!C8'), assumptions).holds,
      true,
    );
    assert.strictEqual(implies(fact('C7'), fact('!C8')).holds, false);
    const both = all.filter((v) =>
      ['C7', 'C8'].every((c) =>
        v.literals.some(
          (l) =>
            l.holds && l.condition.kind === 'var' && l.condition.variable === c,
        ),
      ),
    );
    assert.strictEqual(both.length, 32);
    for (const variant of both)
      assert.strictEqual(
        satisfiable(factContext(cgm, variant)!, assumptions).satisfiable,
        false,
      );
  });

  it("Fig. 9's variant: unsatisfiable through C7 against C1, the relation named", () => {
    const run = runAnalysis(
      cgmAnalyses.cgmUnadoptable,
      seedModel('museum-guide'),
      seedResource('museum-guide', 'relations'),
    );
    assert.ok('result' in run);
    const fig9 = run.result.cases.filter((c) =>
      c.summary!.startsWith('context C0 ∧ C2 ∧ C7 ∧ ¬C8 ∧ C3 ∧ C1 ∧ C4 ∧ C9;'),
    );
    assert.strictEqual(fig9.length, 1);
    assert.match(fig9[0]!.summary!, /unsatisfiable with !F7\.1 \| !F1\.1$/);
    assert.match(fig9[0]!.label, /\{T14, T16, T18, T19\} is unadoptable$/);
    const cgm = readCgmModel(seedModel('museum-guide'));
    assert.ok(fig9[0]!.selection!.includes(cgm.byId('T14')!.id));
  });

  it("reads an environment's relations with the absolute ones, a case each", () => {
    const model = toy(
      [
        ['G1', 'goal'],
        ['T1', 'task'],
        ['T2', 'task'],
        ['C1', 'context', { formula: 'F1' }],
        ['C2', 'context'],
        ['F1', 'fact'],
      ],
      [
        ['T1', 'or', 'G1', { context: 'C1' }],
        ['T2', 'or', 'G1', { context: 'C2' }],
      ],
    );
    const run = runAnalysis(cgmAnalyses.cgmUnadoptable, model, {
      'relations/x.json': JSON.stringify({
        label: 'x',
        absolute: ['!C2 | C1'],
        environments: { dark: ['!F1'] },
      }),
    });
    assert.ok('result' in run);
    assert.deepStrictEqual(
      run.result.cases.map((c) => [c.label, c.summary]),
      [
        [
          'x, in dark: {T1} is unadoptable',
          'context C1; unsatisfiable with !F1',
        ],
        [
          'x, in dark: {T2} is unadoptable',
          'context C2; unsatisfiable with !C2 | C1, !F1',
        ],
      ],
    );
  });
});

describe('Contextual goal models: core variants and minimum-cost tasks (§5.2–5.3)', () => {
  it("Fig. 13: the core groups V1–V4, V5, V6; seven non-core, each replaced by V5 or V6 (the paper's erratum)", () => {
    const { cgm, all } = variantsOf('museum-guide-costs');
    const { groups, nonCore, unadoptable } = coreGroups(
      cgm,
      all,
      relationsOf('museum-guide-costs')[0]!.absolute,
    );
    assert.deepStrictEqual(
      groups.map((g) => g.map((v) => variantName(cgm, v))),
      [
        ['{T1, T3}', '{T1, T4}', '{T2, T3}', '{T2, T4}'],
        ['{T5, T8, T9}'],
        ['{T7, T8, T9}'],
      ],
    );
    assert.deepStrictEqual(
      nonCore.map(
        ({ variant, replacedBy }) =>
          `${variantName(cgm, variant)} → ${variantName(cgm, replacedBy)}`,
      ),
      [
        '{T5, T10} → {T5, T8, T9}',
        '{T5, T11} → {T5, T8, T9}',
        '{T6, T8, T9} → {T5, T8, T9}',
        '{T6, T10} → {T5, T8, T9}',
        '{T6, T11} → {T5, T8, T9}',
        '{T7, T10} → {T7, T8, T9}',
        '{T7, T11} → {T7, T8, T9}',
      ],
    );
    assert.deepStrictEqual(unadoptable, []);
  });

  it('Fig. 13: tasks {T1, T4, T5, T7, T8, T9}, cost 215, implementing V2, V5, V6; all tasks 340', () => {
    const { cgm, all } = variantsOf('museum-guide-costs');
    const { groups } = coreGroups(
      cgm,
      all,
      relationsOf('museum-guide-costs')[0]!.absolute,
    );
    const result = minimumCostTasks(cgm, groups);
    assert.deepStrictEqual(
      {
        tasks: result.tasks.map(cgm.idOf),
        cost: result.cost,
        allTasksCost: result.allTasksCost,
        implemented: result.implemented.map((v) => variantName(cgm, v)),
        mandatory: result.mandatory.map(cgm.idOf),
      },
      {
        tasks: ['T1', 'T4', 'T5', 'T7', 'T8', 'T9'],
        cost: 215,
        allTasksCost: 340,
        implemented: ['{T1, T4}', '{T5, T8, T9}', '{T7, T8, T9}'],
        mandatory: ['T5', 'T8', 'T9', 'T7'],
      },
    );
    const run = runAnalysis(
      cgmAnalyses.cgmMinimumCost,
      seedModel('museum-guide-costs'),
      seedResource('museum-guide-costs', 'relations'),
    );
    assert.ok('result' in run);
    assert.strictEqual(
      run.result.cases[0]!.summary,
      'tasks {T1, T4, T5, T7, T8, T9}, cost 215 (all tasks 340); implements {T1, T4}, {T5, T8, T9}, {T7, T8, T9}',
    );
  });

  it('without the relation C13 → C12, the variants through T6 are core too', () => {
    const { cgm, all } = variantsOf('museum-guide-costs');
    const { groups } = coreGroups(cgm, all, []);
    assert.deepStrictEqual(
      groups.map((g) => g.map((v) => variantName(cgm, v))),
      [
        ['{T1, T3}', '{T1, T4}', '{T2, T3}', '{T2, T4}'],
        ['{T5, T8, T9}'],
        ['{T6, T8, T9}'],
        ['{T7, T8, T9}'],
      ],
    );
  });
});
