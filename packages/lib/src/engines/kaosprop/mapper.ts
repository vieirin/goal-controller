/**
 * kaosprop's mapper (goal-controller#181, #215): how goal-tree reads a KAOS
 * model for its analyses. Its own naming matches kaosdoc's; goals, obstacles
 * and hubs carry ESR / RSR / Probability through their entries
 * (goal-controller#244), and a link keeps the keys its kind has that the
 * dialect reads as set, as written (goal-controller#187).
 */
import { parsePistar } from '@istar-ts/core';
import { KAOS_REFINEMENT_HUB } from '@istar-ts/dsm3-kaos/metamodel';
import { KAOS_MODEL } from '../../dialects/kaos/metamodel';
import { linkPropertyKeys } from '@goal-controller/dialect';
import {
  createEngineMapper,
  GoalTree,
  type ModelFor,
  type ModelOf,
  type NodeOf,
} from '@goal-controller/goal-tree';
import { analysisViewOf, type AnalysisModel } from '../analysis';
import {
  KAOS_OPERATION_KINDS,
  KAOS_OPERATION_LINKS,
} from '../../dialects/kaos';
import { kaosprop } from './definition';

export const kaospropLinkKeys = linkPropertyKeys(kaosprop);

const OBSTACLE_HUB = 'kaosObstacles.ObstacleRefinementLinkHub';

/**
 * A kind's keys, kept where the dialect reads them as set (its value isn't
 * null or undefined: a key a dialect's checks say is wrong, or has none,
 * stays out); distributive over a group of kinds (a link entry's covers
 * several): each kind keeps its own keys, not the group's intersection.
 */
type StringProps<X extends { props: object }> = X extends unknown
  ? { readonly [K in keyof X['props']]?: string }
  : never;

/** Strings the analyses read: set dialect values, as written. */
const written = <
  X extends {
    props: Record<string, unknown>;
    raw: Record<string, string | undefined>;
  },
>({
  props,
  raw,
}: X): StringProps<X> =>
  Object.fromEntries(
    Object.entries(raw).flatMap(([key, text]) =>
      text !== undefined && props[key] != null ? [[key, text]] : [],
    ),
  ) as StringProps<X>;

/** A tree node's text, plus its quantities when the dialect reads them. */
const elementEngine = <
  X extends {
    text: string;
    props: Record<string, unknown>;
    raw: Record<string, string | undefined>;
  },
>(
  input: X,
): { text: string } & StringProps<X> => ({
  text: input.text,
  ...written(input),
});

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
      mapProps: written,
    }),
    entry({
      kind: OBSTACLE_HUB,
      as: 'obstacleRefinement',
      tree: false,
      mapProps: written,
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
      mapProps: written,
    }),
    // the operation and object models' (goal-controller#194), as written
    entry({ kinds: KAOS_OPERATION_LINKS, mapProps: written }),
  ],
  // the operation and object models' nodes: the model's elements, no tree's
  ignore: KAOS_OPERATION_KINDS,
});

export type KaospropGoalModel = ModelOf<typeof kaospropEngineMapper>;
export type KaospropNode = NodeOf<typeof kaospropEngineMapper>;

/** A KAOS model as kaosprop's analyses read it: the view of its `KindModel`. */
export const kaospropAnalysisModel = <EK extends string, LK extends string>(
  model: ModelFor<typeof kaosprop, EK, LK>,
): AnalysisModel =>
  analysisViewOf(GoalTree.goalModel(model, kaospropEngineMapper), {
    fromEntries: true,
  });

/** A KAOS model's piStar text, read with KAOS, its obstacle analysis and its operation and object models (goal-controller#194). */
export const readKaosObstacleModel = (text: string) =>
  parsePistar(text, { metamodel: KAOS_MODEL });
