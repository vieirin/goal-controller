/**
 * kaosdoc's mapper (goal-controller#171, #215): how goal-tree reads a KAOS
 * model for it. Its own naming: goals, domain properties and obstacles are
 * tree nodes; agents and refinement hubs are not (`tree: false`). Each
 * element's properties are what its kind declares in the `kaos` dialect, as
 * it reads them (goal-controller#187: trimmed; empty ones, and a value
 * outside its vocabulary, left out). Conflicts keep their boundary
 * condition, and resolutions their type and anchor. A hub's Tactic, Status
 * and SysRef arrive through its entry (goal-controller#226).
 */
import { parsePistar } from '@istar-ts/core';
import {
  KAOS_OBSTACLES,
  KAOS_REFINEMENT_HUB,
} from '@istar-ts/dsm3-kaos/metamodel';
import { linkPropertyKeys, propertyKeys } from '@goal-controller/dialect';
import {
  createEngineMapper,
  GoalTree,
  type ModelOf,
  type NodeOf,
  type IStarModel,
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

/** Properties as the document reads them: the ones set, as the dialect reads them (trimmed). */
export type KaosdocProperties = Readonly<Record<string, string>>;

/** A node's: its kind and the properties its kind declares. */
export type KaosdocNodeProps = {
  kind: string;
  properties: KaosdocProperties;
};

/**
 * The properties set, in the dialect's order: every KAOS value reads as a
 * string (text, a vocabulary's word, a formula, an anchor's id); unset,
 * blank or outside its vocabulary, it is absent (the dialect's checks
 * report the last).
 */
const set = (props: Readonly<Record<string, unknown>>): KaosdocProperties =>
  Object.fromEntries(
    Object.entries(props).flatMap(([key, value]) =>
      typeof value === 'string' ? [[key, value]] : [],
    ),
  );

const nodeProps =
  (kind: string) =>
  ({
    props,
  }: {
    props: Readonly<Record<string, unknown>>;
  }): KaosdocNodeProps => ({
    kind,
    properties: set(props),
  });

export const kaosdocEngineMapper = createEngineMapper({
  dialect: kaos,
  elements: (entry) => [
    entry({
      kinds: ['kaos.BehavioralGoal', 'kaos.Softgoal'],
      as: 'goal',
      mapProps: ({ kind, props }) => ({ kind, properties: set(props) }),
    }),
    entry({
      kind: 'kaos.DomainProperty',
      as: 'domainProperty',
      mapProps: nodeProps('kaos.DomainProperty'),
    }),
    entry({
      kind: 'kaosObstacles.Obstacle',
      as: 'obstacle',
      mapProps: nodeProps('kaosObstacles.Obstacle'),
    }),
    entry({
      kinds: ['kaos.Agent', 'kaos.EnvironmentAgent'],
      as: 'agent',
      tree: false,
      mapProps: ({ kind, props }) => ({ kind, properties: set(props) }),
    }),
    // a refinement's properties are its hub's (goal-controller#226)
    entry({
      kind: KAOS_REFINEMENT_HUB,
      as: 'refinement',
      tree: false,
      mapProps: ({ props }) => set(props),
    }),
  ],
  links: (entry) => [
    entry({
      kinds: ['kaos.Conflict', 'kaosObstacles.ResolutionLink'],
      mapProps: ({ props }) => set(props),
    }),
  ],
});

/** kaosdoc's IR of a KAOS model: its trees on the paper, its links and elements. */
export type KaosdocGoalModel = ModelOf<typeof kaosdocEngineMapper>;
export type KaosdocNode = NodeOf<typeof kaosdocEngineMapper>;

/** A KAOS model's IR, as kaosdoc reads it. */
export const kaosdocGoalModel = (model: IStarModel): KaosdocGoalModel =>
  GoalTree.goalModel(model, kaosdocEngineMapper);

/** A KAOS model's piStar text (DSM3's), read with KAOS and its obstacle analysis. */
export const readKaosModel = (text: string): IStarModel =>
  parsePistar(text, { metamodel: KAOS_OBSTACLES }) as unknown as IStarModel;
