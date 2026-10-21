/**
 * kaossim (goal-controller#193): the simulation and the design-space search
 * on small synthetic models whose values are derived by hand (closed forms:
 * a hypoexponential CDF, a sum of normals, a fault tree's OR, a
 * conditional's mean), and the search's oracle: the exhaustive Pareto front
 * of a design space shaped as RE'11's (4 × 3 × 3 × 3 × 6 = 648 designs),
 * which NSGA-II, seeded, reaches. Each Monte Carlo check is within 4
 * standard errors (100 000 samples, seed 1).
 */
import * as assert from 'assert';
import { describe, it } from 'mocha';
import { distributionOf } from '@goal-controller/dialect';
import type {
  AnalysisElement,
  AnalysisLink,
  AnalysisModel,
} from '../../../src/engines/analysis';
import {
  enumerateDesigns,
  exhaustiveSearch,
  nsga2Search,
  quantitativeModel,
  readDesigns,
  runDesignSpace,
  runSimulation,
  simulateDesign,
  DEFAULT_SIM_OPTIONS,
  type DesignChoice,
  type ObjectiveValue,
  type QuantitativeModel,
} from '../../../src/engines/kaossim';
import { continuousOf } from '../../../src/numeric/distributions';
import { normalCdf, normalQuantile } from '../../../src/numeric/special';

type Props = Readonly<Record<string, string>>;

/** A model built by hand: goals, refinements (hubs), agents and assignments. */
const build = () => {
  const elements: AnalysisElement[] = [];
  const links: AnalysisLink[] = [];
  let hubs = 0;
  const api = {
    goal(id: string, properties: Props = {}) {
      elements.push({ id, kind: 'kaos.BehavioralGoal', name: id, properties });
      return api;
    },
    refine(parent: string, children: string[], properties: Props = {}) {
      const hub = `hub${++hubs}`;
      elements.push({
        id: hub,
        kind: 'kaos.RefinementLinkHub',
        name: '',
        properties,
      });
      children.forEach((child, i) =>
        links.push({
          id: `${hub}-${i}`,
          kind: 'kaos.RefinementLinkStart',
          source: child,
          target: hub,
          properties: {},
        }),
      );
      links.push({
        id: `${hub}-end`,
        kind: 'kaos.RefinementLinkEnd',
        source: hub,
        target: parent,
        properties: {},
      });
      return api;
    },
    assign(goal: string, agent: string, properties: Props = {}) {
      if (!elements.some((e) => e.id === agent))
        elements.push({
          id: agent,
          kind: 'kaos.Agent',
          name: agent,
          properties: {},
        });
      links.push({
        id: `${agent}-assigned-${goal}`,
        kind: 'kaos.ResponsibilityAssignment',
        source: agent,
        target: goal,
        properties,
      });
      return api;
    },
    view: (): AnalysisModel => ({ actors: [], elements, links }),
  };
  return api;
};

const OPTIONS = { samples: 100000, seed: 1 };
const modelDesign: DesignChoice = {
  id: 'model',
  name: 'The model',
  options: [],
  set: new Map(),
};

const valueOf = (values: readonly ObjectiveValue[], name: string) => {
  const found = values.find((v) => v.objective.name === name);
  assert.ok(found && !('missing' in found), `${name} is resolved`);
  return found as { value: number; stderr: number };
};
const close = (
  got: { value: number; stderr: number },
  expected: number,
  what: string,
) =>
  assert.ok(
    Math.abs(got.value - expected) <= 4 * got.stderr + 1e-12,
    `${what}: ${got.value} vs ${expected} (± ${got.stderr})`,
  );

describe('kaossim: distributions over the reals (#193)', () => {
  it('reads exponential[mean] and normal[μ, σ], over the reals only', () => {
    assert.deepStrictEqual(
      distributionOf('exponential[60]', { range: 'real' }),
      {
        kind: 'exponential',
        mean: 60,
      },
    );
    assert.deepStrictEqual(
      distributionOf('normal[0, 120]', { range: 'real' }),
      {
        kind: 'normal',
        mean: 0,
        sd: 120,
      },
    );
    assert.strictEqual(distributionOf('exponential[60]'), null);
    assert.strictEqual(
      distributionOf('exponential[0]', { range: 'real' }),
      null,
    );
    assert.strictEqual(
      distributionOf('normal[0, -1]', { range: 'real' }),
      null,
    );
  });

  it('gives Φ and Φ⁻¹ to double precision, and the exponential its mean', () => {
    assert.ok(Math.abs(normalCdf(1) - 0.8413447460685429) < 1e-14);
    assert.ok(Math.abs(normalCdf(-3) - 0.0013498980316301) < 1e-15);
    assert.ok(Math.abs(normalQuantile(0.975) - 1.959963984540054) < 1e-12);
    assert.ok(Math.abs(normalQuantile(1e-6) + 4.753424308822899) < 1e-9);
    for (const u of [1e-9, 0.01, 0.3, 0.5, 0.77, 0.999])
      assert.ok(
        Math.abs(normalCdf(normalQuantile(u)) - u) <
          1e-14 * Math.max(1, u / 1e-9),
      );
    const exp = continuousOf({ kind: 'exponential', mean: 60 });
    assert.ok(Math.abs(exp.cdf(60) - (1 - Math.exp(-1))) < 1e-15);
    assert.ok(Math.abs(exp.quantile(exp.cdf(123)) - 123) < 1e-9);
    const normal = continuousOf({ kind: 'normal', mean: 10, sd: 30 });
    assert.ok(Math.abs(normal.quantile(0.5) - 10) < 1e-12);
  });
});

describe('kaossim: the model read (#193 D1, D2)', () => {
  it('reads quality variables, objective functions, equations and decision points', () => {
    const model = quantitativeModel(
      build()
        .goal('top', {
          'QualityVariable[ResponseTime]': 'Time',
          'SampleSpace[ResponseTime]': 'set of reported incidents',
          'Objective[8MinRespRate]': 'ResponseTime <= 8 * 60',
          'Modal[8MinRespRate]': 'Max',
          'Target[8MinRespRate]': '50%',
          'Current[8MinRespRate]': '35%',
        })
        .goal('a', { 'QualityVariable[A]': 'Time' })
        .goal('b')
        .refine('top', ['a'], { 'Equation[ResponseTime]': 'A', SysRef: '1.1' })
        .refine('top', ['b'], {
          'Equation[ResponseTime]': 'A + 1',
          SysRef: '1.2',
        })
        .assign('a', 'human', {
          SysRef: '2.1',
          'Distribution[A]': 'exponential[60]',
        })
        .assign('a', 'software', {
          SysRef: '2.2',
          'Distribution[A]': 'exponential[30]',
        })
        .view(),
    );
    assert.deepStrictEqual(model.problems, []);
    assert.deepStrictEqual(model.variables.get('ResponseTime'), {
      name: 'ResponseTime',
      goal: 'top',
      sort: 'Time',
      sampleSpace: 'set of reported incidents',
    });
    const [objective] = model.objectives;
    assert.strictEqual(objective!.name, '8MinRespRate');
    assert.strictEqual(objective!.modal, 'Max');
    assert.strictEqual(objective!.target, 0.5);
    assert.strictEqual(objective!.current, 0.35);
    assert.strictEqual(objective!.def.measure, 'probability');
    assert.deepStrictEqual(
      model.decisions.map((d) => [
        d.goal,
        d.via,
        d.options.map((o) => o.sysRef),
      ]),
      [
        ['top', 'refinement', ['1.1', '1.2']],
        ['a', 'assignment', ['2.1', '2.2']],
      ],
    );
    // 1.2 doesn't reach a: three designs, not four
    assert.deepStrictEqual(
      enumerateDesigns(model).designs.map((d) => d.id),
      ['1.1+2.1', '1.1+2.2', '1.2'],
    );
  });

  it('says what it can’t read', () => {
    const model = quantitativeModel(
      build()
        .goal('g', {
          'QualityVariable[X]': 'Duration',
          'Objective[o]': 'X <=',
          'Modal[p]': 'Max',
          'Objective[p]': 'X > 1',
          'Mean[q]': 'X',
          'Modal[q]': 'Most',
        })
        .goal('h')
        .goal('i')
        .refine('g', ['h'])
        .refine('g', ['i'], { SysRef: 'x' })
        .view(),
    );
    assert.deepStrictEqual(model.problems, [
      "g: X's sort is Time, Boolean or Number, not Duration",
      "g: objective o's definition X <= is not one",
      "g: objective q's modality is Max or Min, not Most",
      "g's refinements: an alternative without a SysRef is no option",
    ]);
  });
});

describe('kaossim: the simulation, against closed forms (#193)', () => {
  it('a sum of exponentials: the hypoexponential CDF (RE’11’s ResponseTime shape)', () => {
    const model = quantitativeModel(
      build()
        .goal('top', {
          'QualityVariable[T]': 'Time',
          'Objective[two]': 'T <= 120',
          'Modal[two]': 'Max',
          'Mean[mean]': 'T',
          'Modal[mean]': 'Min',
        })
        .goal('a', {
          'QualityVariable[A]': 'Time',
          'Distribution[A]': 'exponential[60]',
        })
        .goal('b', {
          'QualityVariable[B]': 'Time',
          'Distribution[B]': 'exponential[40]',
        })
        .refine('top', ['a', 'b'], { 'Equation[T]': 'A + B' })
        .view(),
    );
    const run = simulateDesign(model, modelDesign, OPTIONS);
    const [l1, l2] = [1 / 60, 1 / 40];
    const t = 120;
    const cdf =
      1 - (l2 * Math.exp(-l1 * t) - l1 * Math.exp(-l2 * t)) / (l2 - l1);
    close(valueOf(run.objectives, 'two'), cdf, 'P(A + B ≤ 120)');
    close(valueOf(run.objectives, 'mean'), 100, 'E(A + B)');
  });

  it('a sum of normals, a conditional, and the Boolean OR of a fault tree', () => {
    const model = quantitativeModel(
      build()
        .goal('top', {
          'QualityVariable[T]': 'Time',
          'QualityVariable[Dropped]': 'Boolean',
          'Objective[fast]': 'T <= 50',
          'Modal[fast]': 'Max',
          'Objective[dropped]': 'Dropped',
          'Modal[dropped]': 'Min',
          'Mean[recovery]': 'if(F, 2 * X + D, X)',
          'Modal[recovery]': 'Min',
        })
        .goal('a', {
          'QualityVariable[A]': 'Time',
          'Distribution[A]': 'normal[10, 30]',
          'QualityVariable[F]': 'Boolean',
          'Distribution[F]': '25%',
          'QualityVariable[X]': 'Time',
          'Distribution[X]': '100',
          'QualityVariable[D]': 'Time',
          'Distribution[D]': '50',
        })
        .goal('b', {
          'QualityVariable[B]': 'Time',
          'Distribution[B]': 'normal[0, 40]',
          'QualityVariable[P]': 'Boolean',
          'Distribution[P]': '10%',
          'QualityVariable[Q]': 'Boolean',
          'Distribution[Q]': 'beta[2, 8]',
          'QualityVariable[R]': 'Boolean',
          'Distribution[R]': '30%',
        })
        .refine('top', ['a', 'b'], {
          'Equation[T]': 'A + B',
          'BooleanEquation[Dropped]': 'P | Q | R',
        })
        .view(),
    );
    const run = simulateDesign(model, modelDesign, OPTIONS);
    close(
      valueOf(run.objectives, 'fast'),
      normalCdf((50 - 10) / 50),
      'P(A + B ≤ 50)',
    );
    // Q's probability is Beta(2, 8)'s, mean .2
    close(
      valueOf(run.objectives, 'dropped'),
      1 - 0.9 * 0.8 * 0.7,
      'P(P ∨ Q ∨ R)',
    );
    close(
      valueOf(run.objectives, 'recovery'),
      0.75 * 100 + 0.25 * 250,
      'E(if)',
    );
  });

  it('an objective whose leaves aren’t all estimated is unresolved, with what it lacks', () => {
    const model = quantitativeModel(
      build()
        .goal('top', {
          'QualityVariable[T]': 'Time',
          'Objective[o]': 'T <= 60',
          'Modal[o]': 'Max',
        })
        .goal('a', {
          'QualityVariable[A]': 'Time',
          'Distribution[A]': 'exponential[10]',
        })
        .goal('b', { 'QualityVariable[L]': 'Number' })
        .refine('top', ['a', 'b'], { 'Equation[T]': 'A + L * NbAvAmb' })
        .view(),
    );
    const run = simulateDesign(model, modelDesign, { samples: 10, seed: 1 });
    assert.deepStrictEqual(
      run.objectives.map((o) => ('missing' in o ? o.missing : o.value)),
      [['L', 'NbAvAmb']],
    );
  });

  it('a design keeps one alternative and one agent; its set replaces an estimate', () => {
    const model = quantitativeModel(
      build()
        .goal('top', {
          'QualityVariable[T]': 'Time',
          'Mean[t]': 'T',
          'Modal[t]': 'Min',
        })
        .goal('radio', {
          'QualityVariable[C]': 'Time',
          'Distribution[C]': '60',
        })
        .goal('mdt', { 'QualityVariable[C]': 'Time' })
        .refine('top', ['radio'], { SysRef: 'radio', 'Equation[T]': 'C + K' })
        .refine('top', ['mdt'], { SysRef: 'mdt', 'Equation[T]': 'C' })
        .assign('radio', 'crew', { 'Distribution[K]': '5' })
        .assign('mdt', 'terminalA', { SysRef: 'A', 'Distribution[C]': '30' })
        .assign('mdt', 'terminalB', { SysRef: 'B', 'Distribution[C]': '15' })
        .view(),
    );
    // C is declared on two goals: the second is a problem, its estimate still counts
    assert.deepStrictEqual(model.problems, [
      'mdt: C is already a quality variable of radio',
    ]);
    const mean = (options: string[], set: [string, string][] = []) =>
      valueOf(
        simulateDesign(
          model,
          {
            id: 'd',
            name: 'd',
            options,
            set: new Map(
              set.map(([v, t]) => [
                v,
                {
                  distribution: distributionOf(t, {
                    point: true,
                    range: 'real',
                  })!,
                  text: t,
                },
              ]),
            ),
          },
          { samples: 10, seed: 1 },
        ).objectives,
        't',
      ).value;
    assert.strictEqual(mean(['radio']), 65);
    assert.strictEqual(mean(['mdt', 'A']), 30);
    assert.strictEqual(mean(['mdt', 'B']), 15);
    assert.strictEqual(mean(['radio'], [['K', '20']]), 80);
    const undecided = simulateDesign(
      model,
      { ...modelDesign, options: ['mdt'] },
      { samples: 10, seed: 1 },
    );
    assert.deepStrictEqual(undecided.problems, [
      'mdt: the design picks none of its assignments (A, B)',
    ]);
  });

  it('reads the designs resource, and runs a case per design', () => {
    const view = build()
      .goal('top', {
        'QualityVariable[T]': 'Time',
        'Mean[t]': 'T',
        'Modal[t]': 'Min',
      })
      .goal('x')
      .refine('top', ['x'], { SysRef: 'slow', 'Distribution[T]': '60' })
      .refine('top', ['x'], { SysRef: 'fast', 'Distribution[T]': '30' })
      .view();
    const designs = JSON.stringify({
      designs: [
        { id: 'asis', name: 'As is', options: ['slow'] },
        { id: 'tobe', name: 'To be', options: ['fast'], set: { T: '20' } },
      ],
    });
    assert.deepStrictEqual(
      readDesigns([{ path: 'designs.json', text: designs }]).diagnostics,
      [],
    );
    const result = runSimulation(view, undefined, {
      resources: { design: { 'designs.json': designs } },
      options: { samples: 10 },
    });
    assert.deepStrictEqual(
      result.cases.map((c) => [c.label, c.values.top!.value]),
      [
        ['As is', 60],
        ['To be', 20],
      ],
    );
    assert.ok(result.cases[0]!.selection!.includes('hub1'));
    assert.ok(!result.cases[0]!.selection!.includes('hub2'));
  });
});

/**
 * A design space shaped as RE'11's: five decision points of 4, 3, 3, 3 and
 * 6 options (648 designs), each option a deterministic time and cost, so
 * the front is known exactly: two objectives, Max P(T ≤ 300) is either 0 or
 * 1, so a third, Min E(T), and Min E(Cost).
 */
const designSpace = (): QuantitativeModel => {
  const b = build().goal('top', {
    'QualityVariable[T]': 'Time',
    'QualityVariable[Cost]': 'Number',
    'Mean[time]': 'T',
    'Modal[time]': 'Min',
    'Mean[cost]': 'Cost',
    'Modal[cost]': 'Min',
  });
  const sizes = [4, 3, 3, 3, 6];
  const subgoals = sizes.map((_, i) => `d${i + 1}`);
  b.refine('top', subgoals, {
    'Equation[T]': subgoals.map((_, i) => `T${i + 1}`).join(' + '),
    'Equation[Cost]': subgoals.map((_, i) => `C${i + 1}`).join(' + '),
  });
  sizes.forEach((n, i) => {
    b.goal(`d${i + 1}`);
    for (let k = 1; k <= n; k++)
      // option k: faster and dearer as k grows, with uneven steps
      b.assign(`d${i + 1}`, `agent${i + 1}.${k}`, {
        SysRef: `${i + 1}.${k}`,
        [`Distribution[T${i + 1}]`]: String(
          100 - 7 * k * (i + 1) + ((k * k) % 5),
        ),
        [`Distribution[C${i + 1}]`]: String(10 * k * k + 3 * i),
      });
  });
  return quantitativeModel(b.view());
};

describe('kaossim: the design-space search (#193 D5)', () => {
  const options = { ...DEFAULT_SIM_OPTIONS, samples: 4 };

  it('enumerates RE’11’s 4 × 3 × 3 × 3 × 6 = 648 designs, and finds the exact front', () => {
    const model = designSpace();
    assert.strictEqual(enumerateDesigns(model).designs.length, 648);
    const result = exhaustiveSearch(model, options);
    assert.strictEqual(result.evaluated.length, 648);
    assert.ok(result.complete);
    // the front, by brute force on the same deterministic sums
    const scores = result.evaluated.map((s) => s.scores!);
    const front = scores.filter(
      (s) =>
        !scores.some(
          (t) =>
            t !== s &&
            t[0]! >= s[0]! &&
            t[1]! >= s[1]! &&
            (t[0]! > s[0]! || t[1]! > s[1]!),
        ),
    );
    assert.strictEqual(result.front.length, front.length);
    assert.ok(result.front.length > 3);
  });

  it('NSGA-II, seeded, reaches the exhaustive front', () => {
    const model = designSpace();
    const exact = exhaustiveSearch(model, options)
      .front.map((s) => s.run.design.id)
      .sort();
    const found = nsga2Search(model, {
      ...options,
      method: 'nsga2',
      population: 40,
      generations: 60,
    });
    assert.deepStrictEqual(
      found.front.map((s) => s.run.design.id).sort(),
      exact,
    );
    assert.ok(
      found.evaluated.length < 648,
      `${found.evaluated.length} designs evaluated`,
    );
    const again = nsga2Search(model, {
      ...options,
      method: 'nsga2',
      population: 40,
      generations: 60,
    });
    assert.deepStrictEqual(
      again.evaluated.map((s) => s.run.design.id),
      found.evaluated.map((s) => s.run.design.id),
    );
  });

  it('runs as an analysis: a case per Pareto-optimal design', () => {
    const view = build()
      .goal('top', {
        'QualityVariable[T]': 'Time',
        'Mean[t]': 'T',
        'Modal[t]': 'Min',
        'Mean[c]': 'C',
        'Modal[c]': 'Min',
      })
      .goal('x')
      .assign('x', 'a', {
        SysRef: 'a',
        'Distribution[T]': '10',
        'Distribution[C]': '5',
      })
      .assign('x', 'b', {
        SysRef: 'b',
        'Distribution[T]': '20',
        'Distribution[C]': '1',
      })
      .assign('x', 'c', {
        SysRef: 'c',
        'Distribution[T]': '20',
        'Distribution[C]': '2',
      })
      .refine('top', ['x'])
      .view();
    const result = runDesignSpace(view, undefined, { options: { samples: 2 } });
    assert.deepStrictEqual(
      result.cases.map((c) => c.label),
      ['Pareto 1: a', 'Pareto 2: b'],
    );
    assert.match(
      result.cases[0]!.summary!,
      /3 designs evaluated \(every design\), 2 samples each: 2 Pareto-optimal/,
    );
  });
});
