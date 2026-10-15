/**
 * GRL's evaluations (goal-controller#106), on small models computed by hand
 * from jUCMNav's Java (QuantitativeGRLStrategyAlgorithm,
 * QualitativeGRLStrategyAlgorithm, EvaluationStrategyManager). The seeds'
 * values against jUCMNav's own are `pnpm stress:grl`'s.
 */
import * as assert from 'assert';
import { describe, it } from 'mocha';
import type { AnalysisModel } from '../../../src/engines/analysis';
import {
  evaluateStrategy,
  grlGraph,
  kpiEvaluation,
  labelOf,
  type GrlAlgorithm,
  type GrlPreferences,
} from '../../../src/engines/grl';

type Link = AnalysisModel['links'][number];
let next = 0;
const link = (
  kind: string,
  source: string,
  target: string,
  properties: Record<string, string> = {},
  label?: string,
): Link => ({
  id: `l${next++}`,
  kind,
  source,
  target,
  properties,
  ...(label && { label }),
});
const contribution = (
  source: string,
  target: string,
  weight: number,
  type?: string,
) =>
  link('istar.ContributionLink', source, target, {
    quantitativeContribution: String(weight),
    ...(type && { contribution: type }),
  });
const and = (child: string, parent: string) =>
  link('istar.AndRefinementLink', child, parent);
const or = (child: string, parent: string) =>
  link('istar.OrRefinementLink', child, parent);
/** `depender` depends on `dependee` (piStar's direction) */
const dependency = (depender: string, dependee: string) =>
  link('istar.DependencyLink', depender, dependee);

/** A model of goals (or `kind`), links, and actors with their elements. */
const model = (
  elements: (
    | string
    | { id: string; kind?: string; properties?: Record<string, string> }
  )[],
  links: Link[],
  actors: {
    id: string;
    elements: string[];
    properties?: Record<string, string>;
  }[] = [],
): AnalysisModel => ({
  elements: elements.map((e) =>
    typeof e === 'string'
      ? { id: e, kind: 'istar.Goal', name: e, properties: {} }
      : {
          id: e.id,
          kind: e.kind ?? 'istar.Goal',
          name: e.id,
          properties: e.properties ?? {},
        },
  ),
  links,
  actors: actors.map((a) => ({
    id: a.id,
    kind: 'istar.Actor',
    name: a.id,
    properties: a.properties ?? {},
    elements: a.elements,
  })),
});

/** The values a strategy (element → value, its label from the value) gives. */
const evaluate = (
  m: AnalysisModel,
  values: Record<string, number>,
  algorithm: GrlAlgorithm = 'quantitative',
  preferences: Partial<GrlPreferences> = {},
) => {
  const prefs: GrlPreferences = { range: 'full', tolerance: 0, ...preferences };
  const evaluations = new Map(
    Object.entries(values).map(([id, value]) => [
      id,
      { value, label: labelOf(value, prefs.range) ?? ('None' as const) },
    ]),
  );
  const result = evaluateStrategy(
    grlGraph(m),
    { evaluations },
    algorithm,
    prefs,
  );
  return (id: string) =>
    (result.elements.get(id) ?? result.actors.get(id))?.value;
};

describe('GRL quantitative evaluation (QuantitativeGRLStrategyAlgorithm)', () => {
  it('takes an AND decomposition’s minimum, an OR’s and a XOR’s maximum', () => {
    const m = model(
      [
        'p',
        'q',
        { id: 'x', properties: { decompositionType: 'Xor' } },
        'a',
        'b',
      ],
      [
        and('a', 'p'),
        and('b', 'p'),
        or('a', 'q'),
        or('b', 'q'),
        or('a', 'x'),
        or('b', 'x'),
      ],
    );
    const value = evaluate(m, { a: 30, b: 70 });
    assert.deepStrictEqual([value('p'), value('q'), value('x')], [30, 70, 70]);
  });

  it('adds contributions as Java’s integer division does: toward zero', () => {
    const m = model(['t', 's'], [contribution('s', 't', 25)]);
    // 25 × 30 / 100 = 7.5: 7
    assert.strictEqual(evaluate(m, { s: 30 })('t'), 7);
    const hurt = model(['t', 's'], [contribution('s', 't', -25)]);
    // −7.5: −7, not −8
    assert.strictEqual(evaluate(hurt, { s: 30 })('t'), -7);
  });

  it('reads a contribution without a weight as EMF’s default, 25', () => {
    const m = model(
      ['t', 's'],
      [link('istar.ContributionLink', 's', 't', {}, 'make')],
    );
    assert.strictEqual(evaluate(m, { s: 100 })('t'), 25);
  });

  it('saturates at 100 and at the range’s bottom', () => {
    const m = model(
      ['t', 'a', 'b'],
      [contribution('a', 't', 100), contribution('b', 't', 100)],
    );
    assert.strictEqual(evaluate(m, { a: 100, b: 100 })('t'), 100);
    const down = model(
      ['t', 'a', 'b'],
      [contribution('a', 't', -100), contribution('b', 't', -100)],
    );
    assert.strictEqual(evaluate(down, { a: 100, b: 100 })('t'), -100);
  });

  it('holds a value the tolerance short of 100, unless a contribution reaches it', () => {
    const m = model(
      ['t', 'a', 'b'],
      [contribution('a', 't', 50), contribution('b', 't', 45)],
    );
    assert.strictEqual(
      evaluate(m, { a: 100, b: 100 }, 'quantitative', { tolerance: 0 })('t'),
      95,
    );
    // 95 ≥ 100 − 10, and no contribution is 100: the decomposition's (none) or 90
    assert.strictEqual(
      evaluate(m, { a: 100, b: 100 }, 'quantitative', { tolerance: 10 })('t'),
      90,
    );
    const make = model(
      ['t', 'a', 'b'],
      [contribution('a', 't', 100), contribution('b', 't', -5)],
    );
    // a Make (100) among them: 95 stays
    assert.strictEqual(
      evaluate(make, { a: 100, b: 100 }, 'quantitative', { tolerance: 10 })(
        't',
      ),
      95,
    );
  });

  it('holds a value the tolerance above the bottom only over a decomposition (jUCMNav’s condition)', () => {
    // no decomposition: −95 stays (decompositionValue > 100 × minRange is false at −10000)
    const alone = model(
      ['t', 'a', 'b'],
      [contribution('a', 't', -50), contribution('b', 't', -45)],
    );
    assert.strictEqual(
      evaluate(alone, { a: 100, b: 100 }, 'quantitative', { tolerance: 10 })(
        't',
      ),
      -95,
    );
    // with one (50): min(50, −90)
    const decomposed = model(
      ['t', 'c', 'a', 'b'],
      [and('c', 't'), contribution('a', 't', -75), contribution('b', 't', -75)],
    );
    assert.strictEqual(
      evaluate(decomposed, { c: 50, a: 100, b: 100 }, 'quantitative', {
        tolerance: 10,
      })('t'),
      -90,
    );
  });

  it('caps an element at its dependees’ minimum', () => {
    const m = model(
      ['t', 'c', 'd1', 'd2'],
      [and('c', 't'), dependency('t', 'd1'), dependency('t', 'd2')],
    );
    assert.strictEqual(evaluate(m, { c: 80, d1: 30, d2: 60 })('t'), 30);
    // a cap only: 20 under 30 stays 20
    assert.strictEqual(evaluate(m, { c: 20, d1: 30, d2: 60 })('t'), 20);
  });

  it('bottoms out at 0 in the 0..100 range', () => {
    const m = model(['t', 's'], [contribution('s', 't', -100)]);
    assert.strictEqual(
      evaluate(m, { s: 100 }, 'quantitative', { range: 'positive' })('t'),
      0,
    );
  });

  it('keeps a value the strategy sets, and 0 for what no evaluation reaches (a cycle)', () => {
    const m = model(
      ['t', 's', 'c1', 'c2'],
      [contribution('s', 't', 100), and('c1', 'c2'), and('c2', 'c1')],
    );
    const value = evaluate(m, { s: 100, t: -40 });
    assert.strictEqual(value('t'), -40);
    assert.deepStrictEqual([value('c1'), value('c2')], [0, 0]);
  });

  it('gives an actor its elements’ importance-weighted mean, as Java’s int division', () => {
    const m = model(
      [
        { id: 'a', properties: { importanceQuantitative: '80' } },
        { id: 'b', properties: { importanceQuantitative: '50' } },
        { id: 'c' },
      ],
      [],
      [{ id: 'actor', elements: ['a', 'b', 'c'] }],
    );
    // (100 × 80 + 33 × 50) / 130 = 74.2: 74; c (importance 0) is left out
    assert.strictEqual(evaluate(m, { a: 100, b: 33, c: -100 })('actor'), 74);
    const none = model(['a'], [], [{ id: 'actor', elements: ['a'] }]);
    assert.strictEqual(evaluate(none, { a: 100 })('actor'), 0);
  });
});

describe('GRL qualitative evaluation (QualitativeGRLStrategyAlgorithm)', () => {
  const satisfied = (values: string[]) =>
    Object.fromEntries(values.map((id) => [id, 100]));

  it('maps a source’s label through its contribution type', () => {
    const help = model(['t', 's'], [contribution('s', 't', 25, 'Help')]);
    assert.strictEqual(
      evaluate(help, satisfied(['s']), 'qualitative')('t'),
      50,
    );
    const brk = model(['t', 's'], [contribution('s', 't', -100, 'Break')]);
    assert.strictEqual(
      evaluate(brk, satisfied(['s']), 'qualitative')('t'),
      -100,
    );
  });

  it('combines contributions: weak ones cancel, full ones of both signs conflict', () => {
    const cancel = model(
      ['t', 'a', 'b'],
      [contribution('a', 't', 25, 'Help'), contribution('b', 't', -25, 'Hurt')],
    );
    assert.strictEqual(
      evaluate(cancel, satisfied(['a', 'b']), 'qualitative')('t'),
      0,
    );
    const conflict = model(
      ['t', 'a', 'b'],
      [
        contribution('a', 't', 100, 'Make'),
        contribution('b', 't', -100, 'Break'),
      ],
    );
    assert.strictEqual(
      evaluate(conflict, satisfied(['a', 'b']), 'qualitative')('t'),
      -101,
    );
    assert.strictEqual(labelOf(-101, 'full'), 'Conflict');
  });

  it('takes an AND decomposition’s worst label, an OR’s best', () => {
    const m = model(
      ['p', 'q', 'a', 'b'],
      [and('a', 'p'), and('b', 'p'), or('a', 'q'), or('b', 'q')],
    );
    const value = evaluate(m, { a: 100, b: -100 }, 'qualitative');
    assert.deepStrictEqual([value('p'), value('q')], [-100, 100]);
  });

  it('caps an element at its dependee’s lower label', () => {
    const m = model(['t', 'c', 'd'], [and('c', 't'), dependency('t', 'd')]);
    assert.strictEqual(
      evaluate(m, { c: 100, d: -50 }, 'qualitative')('t'),
      -50,
    );
  });

  it('weighs an actor’s labels by importance', () => {
    const m = model(
      [
        { id: 'a', properties: { importance: 'High' } },
        { id: 'b', properties: { importance: 'Low' } },
      ],
      [],
      [{ id: 'actor', elements: ['a', 'b'] }],
    );
    // High × Satisfied = S, Low × Denied = WD: weakly satisfied
    assert.strictEqual(
      evaluate(m, { a: 100, b: -100 }, 'qualitative')('actor'),
      50,
    );
  });
});

describe('GRL labels and KPI conversion (EvaluationStrategyManager)', () => {
  it('labels a value, in either range', () => {
    assert.deepStrictEqual(
      [100, 60, 0, -1, -100, -102, 101].map((v) => labelOf(v, 'full')),
      [
        'Satisfied',
        'WeaklySatisfied',
        'None',
        'WeaklyDenied',
        'Denied',
        'Unknown',
        null,
      ],
    );
    // 0..100: 50 is the middle
    assert.deepStrictEqual(
      [100, 75, 50, 0].map((v) => labelOf(v, 'positive')),
      ['Satisfied', 'WeaklySatisfied', 'None', 'Denied'],
    );
  });

  it('converts a KPI value set as calculateIndicatorEvalLevel does', () => {
    const kpi = (
      target: number,
      threshold: number,
      worst: number,
      value: number,
    ) => ({
      targetValue: target,
      thresholdValue: threshold,
      worstValue: worst,
      evaluationValue: value,
      unit: 'C',
    });
    // higher is better: (19.5 − 18) / (21 − 18) × 100
    assert.strictEqual(kpiEvaluation(kpi(21, 18, 15, 19.5), 'full'), 50);
    // lower is better, past the threshold: (90 − 60) / (60 − 120) × −100 … −50
    assert.strictEqual(kpiEvaluation(kpi(60, 60, 120, 90), 'full'), -50);
    assert.strictEqual(kpiEvaluation(kpi(30, 90, 360, 0), 'full'), 100);
    assert.strictEqual(kpiEvaluation(kpi(21, 18, 15, 19.5), 'positive'), 75);
    // a set that says nothing: no conversion
    assert.strictEqual(
      kpiEvaluation(
        { targetValue: 0, thresholdValue: 0, worstValue: 0, unit: '' },
        'full',
      ),
      null,
    );
  });
});
