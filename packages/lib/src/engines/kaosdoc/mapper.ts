/**
 * kaosdoc's mapper (goal-controller#171): how goal-tree reads a KAOS model
 * for it. Goals and domain properties are the IR's goal nodes, each with its
 * kind and the properties its kind declares in the `kaos` dialect (trimmed,
 * empty ones left out); conflicts keep their boundary condition, and
 * resolutions their type and anchor. Obstacles are goal nodes too, in their
 * own trees. A refinement's properties are its hub's, an element of the
 * model.
 */
import { parsePistar } from '@istar-ts/core';
import { KAOS_OBSTACLES } from '@istar-ts/dsm3-kaos/metamodel';
import { linkPropertyKeys, propertyKeys } from '@goal-controller/dialect';
import {
  createEngineMapper,
  GoalTree,
  type GoalModel,
  type IStarModel,
  type RawProps,
} from '@goal-controller/goal-tree';
import { kaos } from '../../dialects/kaos';

/** The keys a KAOS goal reads: DSM3's eight, and its description. */
export const KAOSDOC_GOAL_KEYS = propertyKeys(kaos, 'kaos.BehavioralGoal');
/** A domain property's: its description. */
export const KAOSDOC_DOMAIN_PROPERTY_KEYS = propertyKeys(
  kaos,
  'kaos.DomainProperty',
);
/** A conflict's: its boundary condition. */
export const KAOSDOC_LINK_KEYS = linkPropertyKeys(kaos);

/** Properties as the document reads them: the ones set, trimmed. */
export type KaosdocProperties = Readonly<Record<string, string>>;

/** A goal node's: its kind (`kaos.BehavioralGoal`, `kaos.DomainProperty`, …) and properties. */
export type KaosdocNodeProps = { kind: string; properties: KaosdocProperties };

const set = (raw: RawProps<string>): KaosdocProperties =>
  Object.fromEntries(
    Object.entries(raw).flatMap(([key, value]) =>
      value?.trim() ? [[key, value.trim()]] : [],
    ),
  );

export const kaosdocEngineMapper = createEngineMapper<
  KaosdocNodeProps,
  never
>()({
  dialect: kaos,
  allowedGoalKeys: KAOSDOC_GOAL_KEYS,
  allowedTaskKeys: [],
  kindKeys: {
    'kaos.DomainProperty': KAOSDOC_DOMAIN_PROPERTY_KEYS,
    'kaosObstacles.Obstacle': propertyKeys(kaos, 'kaosObstacles.Obstacle'),
  },
  // a KAOS goal may be a leaf: a requirement, an expectation
  allowLeafGoals: true,
  skipResource: true,
  allowedLinkKeys: KAOSDOC_LINK_KEYS,
  mapLinkProps: ({ raw }) => set(raw),
  mapGoalProps: ({ raw, kind }) => ({ kind, properties: set(raw) }),
  mapTaskProps: ({ id }) => {
    throw new Error(`[INVALID_MODEL]: ${id}: a KAOS model has no tasks`);
  },
});

/** kaosdoc's IR of a KAOS model: its trees on the paper, its links and elements. */
export type KaosdocGoalModel = GoalModel<
  KaosdocNodeProps,
  never,
  never,
  {},
  KaosdocProperties
>;

/** A KAOS model's IR, as kaosdoc reads it. */
export const kaosdocGoalModel = (model: IStarModel): KaosdocGoalModel =>
  GoalTree.goalModel(model, kaosdocEngineMapper);

/** A KAOS model's piStar text (DSM3's), read with KAOS and its obstacle analysis. */
export const readKaosModel = (text: string): IStarModel =>
  parsePistar(text, { metamodel: KAOS_OBSTACLES }) as unknown as IStarModel;
