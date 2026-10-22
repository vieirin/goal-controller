/**
 * kaoslts's mapper (goal-controller#209): how goal-tree reads a KAOS model
 * for it. What it reads is the operation and object models
 * (goal-controller#194): goals with their formal definitions, agents,
 * operations with their domain conditions, and the objects whose attributes
 * are the state variables; the links (operationalisations with their
 * required conditions, performances, monitorings and controls) as the
 * `kaos` dialect reads them. Refinements, obstacles, domain properties,
 * predicates and given types are not its concern.
 */
import { KAOS_REFINEMENT_HUB } from '@istar-ts/dsm3-kaos/metamodel';
import type { Pair } from '@goal-controller/goal-language';
import {
  createEngineMapper,
  GoalTree,
  type ModelFor,
  type ModelOf,
} from '@goal-controller/goal-tree';
import { kaos } from '../../dialects/kaos';

/** An attribute's pairs as the dialect reads them (`highWater:bool`), none when unset. */
const pairs = (list: readonly Pair[] | null | undefined): Pair[] =>
  (list ?? []).map(({ name, value }) => ({ name, value }));

/** An object's state: its attributes and their initial values. */
const objectProps = ({
  props,
}: {
  props: {
    Attributes?: readonly Pair[] | null;
    Initially?: readonly Pair[] | null;
  };
}) => ({
  attributes: pairs(props.Attributes),
  initially: pairs(props.Initially),
});

export const kaosltsEngineMapper = createEngineMapper({
  dialect: kaos,
  elements: (entry) => [
    entry({
      kinds: ['kaos.BehavioralGoal', 'kaos.Softgoal'],
      as: 'goal',
      // read from the model's elements: refinement trees are not its concern
      tree: false,
      mapProps: ({ props }) => ({ formalSpec: props.FormalSpec ?? null }),
    }),
    // an agent is an object too: FSE'02's PumpController has PumpSwitch
    entry({
      kinds: ['kaos.Agent', 'kaos.EnvironmentAgent'],
      as: 'agent',
      tree: false,
      mapProps: objectProps,
    }),
    entry({
      kind: 'kaosOperations.Operation',
      as: 'operation',
      tree: false,
      mapProps: ({ props }) => ({
        domPre: props.DomPre ?? null,
        domPost: props.DomPost ?? null,
      }),
    }),
    entry({
      kinds: [
        'kaosOperations.Entity',
        'kaosOperations.Association',
        'kaosOperations.Event',
      ],
      as: 'object',
      tree: false,
      mapProps: objectProps,
    }),
  ],
  links: (entry) => [
    // a conflict's boundary condition and a resolution's are not its concern
    entry({
      kinds: ['kaos.Conflict', 'kaosObstacles.ResolutionLink'],
      mapProps: () => ({ required: null }),
    }),
    // an operation's required conditions for a requirement (FSE'02 §2.1.4)
    entry({
      kind: 'kaosOperations.OperationalisationLink',
      mapProps: ({ props }) => ({
        required: {
          ReqPre: props.ReqPre ?? null,
          ReqTrig: props.ReqTrig ?? null,
          ReqPost: props.ReqPost ?? null,
        },
      }),
    }),
    // its interfaces and causes: not its concern (its fluents are the
    // objects' attributes, whoever monitors or controls them)
    entry({
      kinds: [
        'kaosOperations.MonitoringLink',
        'kaosOperations.ControlLink',
        'kaosOperations.CauseLink',
        'kaosOperations.AssociationLink',
      ],
      mapProps: () => ({ required: null }),
    }),
  ],
  ignore: [
    'kaos.DomainProperty',
    'kaosObstacles.Obstacle',
    KAOS_REFINEMENT_HUB,
    'kaosOperations.Predicate',
    'kaosOperations.Type',
  ],
});

/** kaoslts's IR of a KAOS model. */
export type KaosltsGoalModel = ModelOf<typeof kaosltsEngineMapper>;

/** A KAOS model's IR, as kaoslts reads it. */
export const kaosltsGoalModel = <EK extends string, LK extends string>(
  model: ModelFor<typeof kaosltsEngineMapper.dialect, EK, LK>,
): KaosltsGoalModel => GoalTree.goalModel(model, kaosltsEngineMapper);
