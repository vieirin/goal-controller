/**
 * kaosprop's mapper (goal-controller#181, #215): how goal-tree reads a KAOS
 * model for its analyses. Its own naming matches kaosdoc's; goals, obstacles
 * and hubs carry ESR / RSR / Probability through their entries
 * (goal-controller#244), and a link keeps the keys its kind has that the
 * dialect reads as set, as written (goal-controller#187).
 */
import { parsePistar } from '@istar-ts/core';
import {
  KAOS_OBSTACLES,
  KAOS_REFINEMENT_HUB,
} from '@istar-ts/dsm3-kaos/metamodel';
import { linkPropertyKeys } from '@goal-controller/dialect';
import {
  createEngineMapper,
  GoalTree,
  type ModelFor,
  type ModelOf,
  type NodeOf,
} from '@goal-controller/goal-tree';
import { analysisViewOf, type AnalysisModel } from '../analysis';
import { kaosprop } from './definition';

export const kaospropLinkKeys = linkPropertyKeys(kaosprop);

const OBSTACLE_HUB = 'kaosObstacles.ObstacleRefinementLinkHub';

/** Strings the analyses read: set dialect values, as written. */
const written = ({
  props,
  raw,
}: {
  props: Readonly<Record<string, unknown>>;
  raw: Readonly<Record<string, string | undefined>>;
}): Readonly<Record<string, string>> =>
  Object.fromEntries(
    Object.entries(raw).flatMap(([key, text]) =>
      text !== undefined && props[key] != null ? [[key, text]] : [],
    ),
  );

/** A tree node's text, plus its quantities when the dialect reads them. */
const elementEngine = ({
  text,
  props,
  raw,
}: {
  text: string;
  props: Readonly<Record<string, unknown>>;
  raw: Readonly<Record<string, string | undefined>>;
}) => ({ text, ...written({ props, raw }) });

export const kaospropEngineMapper = createEngineMapper({
  dialect: kaosprop,
  elements: (entry) => [
    entry({
      kinds: ['kaos.BehavioralGoal', 'kaos.Softgoal'],
      as: 'goal',
      mapProps: elementEngine,
    }),
    entry({
      kind: 'kaos.DomainProperty',
      as: 'domainProperty',
      mapProps: elementEngine,
    }),
    entry({
      kind: 'kaosObstacles.Obstacle',
      as: 'obstacle',
      mapProps: elementEngine,
    }),
    entry({
      kinds: ['kaos.Agent', 'kaos.EnvironmentAgent'],
      as: 'agent',
      tree: false,
      mapProps: elementEngine,
    }),
    entry({
      kind: KAOS_REFINEMENT_HUB,
      as: 'refinement',
      tree: false,
      mapProps: ({ props, raw }) => written({ props, raw }),
    }),
    entry({
      kind: OBSTACLE_HUB,
      as: 'obstacleRefinement',
      tree: false,
      mapProps: ({ props, raw }) => written({ props, raw }),
    }),
  ],
  links: (entry) => [
    entry({
      kinds: [
        'kaos.Conflict',
        'kaosObstacles.ResolutionLink',
        'kaos.RefinementLinkStart',
        'kaosObstacles.ObstructionLink',
      ],
      mapProps: ({ props, raw }) => written({ props, raw }),
    }),
  ],
});

export type KaospropGoalModel = ModelOf<typeof kaospropEngineMapper>;
export type KaospropNode = NodeOf<typeof kaospropEngineMapper>;

/** A KAOS model as kaosprop's analyses read it: the view of its `GoalModel`. */
export const kaospropAnalysisModel = <EK extends string, LK extends string>(
  model: ModelFor<typeof kaosprop, EK, LK>,
): AnalysisModel =>
  analysisViewOf(GoalTree.goalModel(model, kaospropEngineMapper), {
    fromEntries: true,
  });

/** A KAOS model's piStar text, read with KAOS and its obstacle analysis. */
export const readKaosObstacleModel = (text: string) =>
  parsePistar(text, { metamodel: KAOS_OBSTACLES });
