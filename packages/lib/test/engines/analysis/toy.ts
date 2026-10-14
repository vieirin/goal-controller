/**
 * A toy dialect for goal-controller#107: one property on contribution links,
 * one on actors, and one analysis summing the links' property over each
 * actor, with no engine and no core change.
 */
import { defineDialect } from '@goal-controller/dialect';
import { defineAnalyses, type AnalysisModel } from '../../../src';

const problem = { severity: 'warning' as const, message: 'mismatch' };

export const toyGraph = defineDialect({
  id: 'toygraph',
  name: 'Toy graph',
  elements: {
    goal: { prefix: 'G', fill: '#CCFFCC' },
    task: { prefix: 'T', fill: '#CCFFCC' },
  },
  defaultFill: '#FFFFFF',
  properties: { goal: [], task: [] },
  propertyLineOrder: [],
  indent: '  ',
  problems: {
    notAChild: problem,
    missingFromNotation: problem,
    relationMismatch: problem,
    notInDiagram: problem,
  },
  links: {
    'istar.ContributionLink': [
      { key: 'weight', value: { type: 'int' }, help: 'how much it adds' },
    ],
  },
  actors: [{ key: 'budget', value: { type: 'int', min: 0 }, help: 'its cap' }],
});

/** Each actor: the weights of the contributions from its elements, summed. */
const sumWeights = (model: AnalysisModel) => ({
  cases: [
    {
      id: 'all',
      label: 'All contributions',
      values: Object.fromEntries(
        model.actors.map((actor) => {
          const total = model.links
            .filter((link) => actor.elements.includes(link.source))
            .reduce(
              (sum, link) => sum + Number(link.properties.weight ?? 0),
              0,
            );
          const over = total > Number(actor.properties.budget ?? Infinity);
          return [
            actor.id,
            { value: total, ...(over && { severity: 'warning' as const }) },
          ];
        }),
      ),
    },
  ],
});

export const toyAnalyses = defineAnalyses(toyGraph, {
  weights: { label: 'Contribution weight', run: sumWeights },
});
