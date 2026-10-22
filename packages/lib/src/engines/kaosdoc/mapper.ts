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
import { KAOS_REFINEMENT_HUB } from '@istar-ts/dsm3-kaos/metamodel';
import { KAOS_MODEL } from '../../dialects/kaos/metamodel';
import { linkPropertyKeys, propertyKeys } from '@goal-controller/dialect';
import {
  createEngineMapper,
  GoalTree,
  type EngineProps,
  type ModelOf,
  type NodeOf,
  type ModelFor,
} from '@goal-controller/goal-tree';
import {
  kaos,
  KAOS_OPERATION_KINDS,
  KAOS_OPERATION_LINKS,
} from '../../dialects/kaos';

/** The keys a KAOS goal reads: DSM3's eight, and its description. */
export const KAOSDOC_GOAL_KEYS = propertyKeys(kaos, 'kaos.BehavioralGoal');
/** A domain property's: its description. */
export const KAOSDOC_DOMAIN_PROPERTY_KEYS = propertyKeys(
  kaos,
  'kaos.DomainProperty',
);
/** A conflict's: its boundary condition. A resolution's: its type and anchor. */
export const KAOSDOC_LINK_KEYS = linkPropertyKeys(kaos);

/**
 * A kind's properties, kept where the dialect reads a string (text, a
 * vocabulary's word, a formula, an anchor's id): unset, blank or outside
 * its vocabulary, a key is absent (the dialect's checks report the last).
 * Distributive over a group of kinds (a link entry's): each kind keeps its
 * own keys, not the group's intersection.
 */
type StringProps<P> = P extends unknown
  ? { readonly [K in keyof P]?: string }
  : never;

const set = <P extends Record<string, unknown>>(props: P): StringProps<P> =>
  Object.fromEntries(
    Object.entries(props).flatMap(([key, value]) =>
      typeof value === 'string' ? [[key, value]] : [],
    ),
  ) as StringProps<P>;

const nodeProps =
  <K extends string>(kind: K) =>
  <P extends Record<string, unknown>>({
    props,
  }: {
    props: P;
  }): { kind: K; properties: StringProps<P> } => ({
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
    // the operation and object models' (goal-controller#194), as written
    entry({ kinds: KAOS_OPERATION_LINKS, mapProps: ({ props }) => set(props) }),
  ],
  // the operation and object models' nodes: the model's elements, no tree's
  ignore: KAOS_OPERATION_KINDS,
});

/** kaosdoc's IR of a KAOS model: its trees on the paper, its links and elements. */
export type KaosdocGoalModel = ModelOf<typeof kaosdocEngineMapper>;
export type KaosdocNode = NodeOf<typeof kaosdocEngineMapper>;

/**
 * A node's engine properties: its kind and the properties its kind
 * declares (goal, domain property, obstacle, agent; the refinement hub's
 * has no `kind` field, kept on its own for a refinement's properties,
 * goal-controller#226).
 */
export type KaosdocNodeProps = EngineProps<typeof kaosdocEngineMapper>[Exclude<
  keyof EngineProps<typeof kaosdocEngineMapper>,
  typeof KAOS_REFINEMENT_HUB
>];

/** A refinement hub's properties, kept on its own (goal-controller#226): no `kind` field. */
export type KaosdocRefinementProperties = EngineProps<
  typeof kaosdocEngineMapper
>[typeof KAOS_REFINEMENT_HUB];

/** A KAOS model's IR, as kaosdoc reads it. */
export const kaosdocGoalModel = <EK extends string, LK extends string>(
  model: ModelFor<typeof kaosdocEngineMapper.dialect, EK, LK>,
): KaosdocGoalModel => GoalTree.goalModel(model, kaosdocEngineMapper);

/** A KAOS model's piStar text (DSM3's), read with KAOS, its obstacle analysis and its operation and object models (goal-controller#194). */
export const readKaosModel = (text: string) =>
  parsePistar(text, { metamodel: KAOS_MODEL });
