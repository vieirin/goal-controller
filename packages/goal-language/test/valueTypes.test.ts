/**
 * The generic value types a framework's dialect types its keys with
 * (goal-controller#181): a `reference` names one element of its kinds, a
 * `formula` is text in a tagged language — `ltl` is RT-LTL, parsed and
 * checked (goal-controller#211); any other tag is unchecked text — a
 * `probability` is a decimal or a percentage in [0, 1]. A bad value is a
 * problem; the value stays as written.
 */
import type { DefinitionContext, ValueConfig } from '@goal-controller/dialect';
import { expect } from 'chai';
import { highlightValue, readProperties, valueProblem } from '../src/index.js';

const context: DefinitionContext = {
  elements: {
    G1: { kind: 'kaos.BehavioralGoal', children: [], properties: {} },
    A1: { kind: 'kaos.Agent', children: [], properties: {} },
  },
  variables: [],
  named: { G9: 'G1' },
};

describe('value types: reference, formula, probability (#181)', () => {
  const anchor: ValueConfig = {
    type: 'reference',
    target: { kinds: ['kaos.BehavioralGoal', 'kaos.Softgoal'] },
  };

  it('a reference names one element of its kinds', () => {
    expect(valueProblem(anchor, 'G1', context)).to.equal(null);
    // by the id its text gives it, too
    expect(valueProblem(anchor, 'G9', context)).to.equal(null);
    expect(valueProblem(anchor, 'G2', context)).to.equal(
      'G2 is not an element of this model',
    );
    expect(valueProblem(anchor, 'A1', context)).to.equal(
      'A1 is a kaos.Agent, not a kaos.BehavioralGoal or kaos.Softgoal',
    );
    expect(valueProblem(anchor, 'G1, G2', context)).to.equal(
      "An element's id (G1), not G1, G2",
    );
    // the grammar's ids; a piStar id only where the model has it
    expect(valueProblem(anchor, 'G1:', context)).to.equal(
      "An element's id (G1), not G1:",
    );
    expect(
      valueProblem(anchor, 'achieve_on_scene', {
        ...context,
        iStarIds: { achieve_on_scene: 'G1' },
      }),
    ).to.equal(null);
    expect(valueProblem(anchor, 'achieve_on_scene', context)).to.equal(
      "An element's id (G1), not achieve_on_scene",
    );
    // without a model, only its form is checked
    expect(valueProblem(anchor, 'G2')).to.equal(null);
    expect(valueProblem(anchor, '')).to.equal(null);
  });

  it('a formula tagged `ltl` is RT-LTL, either surface (goal-controller#211); other languages are unchecked text', () => {
    const spec: ValueConfig = { type: 'formula', language: 'ltl' };
    expect(
      valueProblem(
        spec,
        'when incidentReported() then sooner-or-later ambulanceOnScene()',
      ),
    ).to.equal(null);
    expect(valueProblem(spec, 'Incident ⇒ ◇ Resolved')).to.equal(null);
    expect(valueProblem(spec, 'when incidentReported() then')).to.not.equal(
      null,
    );
    const other: ValueConfig = { type: 'formula', language: 'prism' };
    expect(valueProblem(other, 'G (Incident -> F<=11 Resolved)')).to.equal(
      null,
    );
    expect(highlightValue(other, 'G (x)')).to.have.length(1);
  });

  it('a probability is a decimal or a percentage in [0, 1]', () => {
    const p: ValueConfig = { type: 'probability' };
    for (const text of ['0.8', '.8', '80%', '20.00%', '1', '0'])
      expect(valueProblem(p, text), text).to.equal(null);
    for (const text of ['1.5', '120%', 'likely', '-0.2'])
      expect(valueProblem(p, text), text).to.equal(
        `A probability in [0, 1] (0.8, .8 or 80%), not ${text}`,
      );
  });
});

describe('value types: distribution, and keyed properties (#190)', () => {
  const estimate: ValueConfig = { type: 'distribution', point: true };

  it('a distribution is one of its named forms or quantiles; with `point`, a value too', () => {
    for (const text of [
      'beta[2, 98]',
      'uniform[1%, 3%]',
      'triangular[1%, 2%, 5%]',
      'pert[1%, 2%, 5%]',
      'PERT[.01, .02, .05]',
      'quantile[2.46%, 2.76%, 3.07%]',
      'quantiles[.1, .2]',
      '(2.4%, 2.7%, 3%)',
      '2.7%',
    ])
      expect(valueProblem(estimate, text), text).to.equal(null);
    expect(valueProblem({ type: 'distribution' }, '2.7%')).to.equal(
      'A distribution, not the single value 2.7%',
    );
    expect(valueProblem(estimate, '(30%, 10%, 50%)')).to.equal(
      "Quantiles don't decrease: 0.1 after 0.3",
    );
    expect(valueProblem(estimate, 'gamma[1, 2]')).to.equal(
      'No distribution gamma: beta, uniform, triangular, pert or quantile',
    );
    expect(valueProblem(estimate, 'pert[5%, 2%, 1%]')).to.equal(
      'pert[min, mode, max]: min ≤ mode ≤ max, not 0.05, 0.02, 0.01',
    );
    expect(valueProblem(estimate, 'beta[0, 2]')).to.equal(
      'beta[α, β]: both shapes above 0, not 0 and 2',
    );
    expect(valueProblem(estimate, 'uniform[1%]')).to.equal(
      'uniform[…] takes 2 parameters, not 1',
    );
    expect(valueProblem(estimate, '(2%, 120%)')).to.equal(
      '1.2 is not a probability in [0, 1]',
    );
    // over the reals, any number
    expect(
      valueProblem(
        { type: 'distribution', range: 'real' },
        'triangular[-3, 0, 12]',
      ),
    ).to.equal(null);
    expect(highlightValue(estimate, 'beta[2, 3]')).to.have.length(1);
  });

  it('a keyed property reads each name’s value by its key on disk (`Probability[e1]`)', () => {
    const dialect = {
      properties: {
        obstacle: [
          {
            key: 'Probability',
            value: estimate,
            keyed: { resource: 'expert' },
          },
        ],
      },
    } as const;
    const { values, text } = readProperties(
      dialect,
      { element: 'obstacle' },
      {
        Probability: '2%',
        'Probability[e1]': '(1%, 2%, 3%)',
        'Probability[e2]': '(3%, 1%, 2%)',
        'Other[e1]': '1',
      },
    );
    expect(values).to.deep.equal({
      Probability: { kind: 'point', value: 0.02 },
      'Probability[e1]': {
        kind: 'quantiles',
        values: [0.01, 0.02, 0.03],
        form: 'tuple',
      },
    });
    // a value written with an error is unset, kept as written
    expect(Object.keys(text)).to.deep.equal([
      'Probability',
      'Probability[e1]',
      'Probability[e2]',
    ]);
  });
});
