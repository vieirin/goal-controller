/**
 * #152's toy: contexts as an extension's kind (`C1: Busy`), a `context`
 * assertion over them on goals and on refinement, contribution and
 * dependency links, and the guard an engine would give `variantsOf`.
 */
import {
  defineDialect,
  defineExtension,
  extensionKind,
  linkPropertyKeys,
  links,
  property,
} from '@goal-controller/dialect';
import { readAssertion } from '@goal-controller/goal-language';
import {
  createEngineMapper,
  GoalTree,
  type IStarModel,
} from '@goal-controller/goal-tree';
import {
  analysisViewOf,
  type AnalysisModel,
  type VariationPoint,
} from '../../../src';
import { toyGraph } from '../analysis/toy';

const context = property.assertion('context', {
  resolves: ['situ.Context'],
  help: 'when it applies',
});
export const situated = defineDialect({
  id: 'situated',
  name: 'Situated',
  extension: defineExtension({
    name: 'situ',
    label: 'Situations',
    elements: [extensionKind('situ.Context', { category: 'node' })],
    links: [],
    groupers: {},
    stereotypes: [],
    taggedValues: [],
    defaultTags: [],
  }),
  elements: {
    goal: { prefix: 'G', fill: '#CCFFCC' },
    task: { prefix: 'T', fill: '#CCFFCC' },
    'situ.Context': { prefix: 'C', fill: '#FFFFFF' },
  },
  defaultFill: '#FFFFFF',
  properties: {
    goal: [context],
    task: [],
    resource: [],
    quality: [],
    'situ.Context': [],
  },
  propertyLineOrder: ['context'],
  indent: '  ',
  problems: toyGraph.problems,
  links: links({
    'istar.AndRefinementLink': [context],
    'istar.OrRefinementLink': [context],
    'istar.ContributionLink': [context],
    'istar.DependencyLink': [context],
  }),
});

const mapper = createEngineMapper<object, object, never>()({
  dialect: situated,
  allowedGoalKeys: [],
  allowedTaskKeys: [],
  skipResource: true,
  allowLeafGoals: true,
  mapGoalProps: () => ({}),
  mapTaskProps: () => ({}),
  allowedLinkKeys: linkPropertyKeys(situated),
  mapLinkProps: ({ raw }) => raw,
});

/** The model as its analyses read it. */
export const situatedModel = (model: IStarModel): AnalysisModel =>
  analysisViewOf(GoalTree.goalModel(model, mapper));

/** The engine's guard: the root's or the link's `context`, read as a tree. */
export const contextGuard = (at: VariationPoint) =>
  readAssertion(
    (at.point === 'root' ? at.element : at.link).properties.context ?? '',
  );
