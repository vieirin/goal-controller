/**
 * The generic value types a framework's dialect types its keys with
 * (goal-controller#181): a `reference` names one element of its kinds, a
 * `formula` is text in a tagged language that nothing checks yet, a
 * `probability` is a decimal or a percentage in [0, 1]. A bad value is a
 * problem; the value stays as written.
 */
import type { DefinitionContext, ValueConfig } from '@goal-controller/dialect';
import { expect } from 'chai';
import { highlightValue, valueProblem } from '../src/index.js';

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
    kinds: ['kaos.BehavioralGoal', 'kaos.Softgoal'],
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
      "An element's id, not G1, G2",
    );
    // without a model, only its form is checked
    expect(valueProblem(anchor, 'G2')).to.equal(null);
    expect(valueProblem(anchor, '')).to.equal(null);
  });

  it('a formula is text in its language, which nothing checks yet', () => {
    const spec: ValueConfig = { type: 'formula', language: 'ltl' };
    expect(valueProblem(spec, 'G (Incident -> F<=11 Resolved)')).to.equal(null);
    expect(highlightValue(spec, 'G (x)')).to.have.length(1);
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
